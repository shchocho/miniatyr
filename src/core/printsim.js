// printsim.js — 3D 프린트 출력 시뮬레이션(순수 함수, 브라우저·Node 공용, 의존성 없음).
//
// 내보내기와 똑같은 삼각형(EX.modelTriangles / EX.kitTriangles 의 { pts, tris, part })을 받아
//   1) 기둥(XY 격자 한 칸)마다 표면을 지나는 높이와 방향을 모아 층마다 안/밖을 정하고(겹친 부품은 합집합),
//   2) 층 단면에서 노즐이 그릴 수 없는 좁은 부분을 열림 연산으로 지우고(= 실제로 안 나오는 부분),
//   3) 아래층이 받쳐 주지 못하는 돌출을 찾아 서포트 기둥 부피와 필라멘트 무게를 셈한다.
// 프로파일은 src/data/printers.js 의 printProfile(). 그림은 render(격자 정보) → { splat, finish } 를 넘기면 그린다
// (Node 의 PNG 렌더러는 tools/print-sim.mjs). 슬라이서가 아니라 같은 기준으로 고친 결과를 비교하는 근사다.

export const MAX_COLS = 6e6, MAX_WORK = 3.5e8;   // 격자 칸 수 · 칸 × 층 수 상한(넘으면 격자를 성기게)

export function simulate(groups, prof, { render = null, maxCols = MAX_COLS, maxWork = MAX_WORK } = {}) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of groups) for (const p of g.pts) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
  const W = hi[0] - lo[0], D = hi[1] - lo[1], H = hi[2] - lo[2];
  const h = prof.layer, PAD = 5, nz = Math.max(1, Math.ceil(H / h - 1e-9));
  let r = prof.xy;
  const cap = Math.min(maxCols, maxWork / nz);
  if ((W / r) * (D / r) > cap) r = Math.sqrt((W * D) / cap);   // 큰 모델은 격자를 성기게(작은 디테일 판정이 무뎌진다)
  const nx = Math.ceil(W / r) + 2 * PAD, ny = Math.ceil(D / r) + 2 * PAD;
  const ox = lo[0] - PAD * r, oy = lo[1] - PAD * r;
  const N = nx * ny;

  // 0) 격자보다 얇은 수직 판(가로 방향이 가장 얇은 부품)은 격자에 잡히지 않고 조용히 사라진다.
  //    최소 형상보다 얇으면 실제로도 안 나오므로, 보이게 두께를 키워 따로 넣고 늘 "사라짐"으로 칠한다.
  //    가장 얇은 축이 위(Z)인 부품(키트에서 눕힌 판)은 층 표본이 판단한다.
  const solid = [], thin = [], lostParts = [];
  let thinMm3 = 0;
  for (const g of groups) {
    const gl = [Infinity, Infinity, Infinity], gh = [-Infinity, -Infinity, -Infinity];
    for (const p of g.pts) for (let a = 0; a < 3; a++) { gl[a] = Math.min(gl[a], p[a]); gh[a] = Math.max(gh[a], p[a]); }
    const ext = [gh[0] - gl[0], gh[1] - gl[1], gh[2] - gl[2]], ax = ext[0] <= ext[1] && ext[0] <= ext[2] ? 0 : ext[1] <= ext[2] ? 1 : 2;
    if ((ax < 2 && ext[ax] < prof.minFeature) || (ax === 2 && ext[2] < h / 2)) {   // 눕힌 판도 반 층보다 얇으면 층에 걸리지 않는다
      const c = (gl[ax] + gh[ax]) / 2, f = Math.max(ext[ax], ax < 2 ? 2.5 * r : 1.5 * h) / Math.max(ext[ax], 1e-6);
      thin.push({ ...g, pts: g.pts.map((p) => { const q = [...p]; q[ax] = c + (p[ax] - c) * f; return q; }) });
      thinMm3 += meshVolume(g);
      if (g.part) lostParts.push(g.part.name);
    } else solid.push(g);
  }
  const X = rasterize(solid, { nx, ny, ox, oy, r, z0: lo[2] }), T = thin.length ? rasterize(thin, { nx, ny, ox, oy, r, z0: lo[2] }) : null;

  // 2) 층마다: 안/밖 → 열림(좁은 곳 지우기) → 돌출 → 서포트
  const kr = Math.max(0, Math.round((prof.minFeature / r - 1) / 2));   // 정사각 커널 반지름(화소): 2kr+1 화소보다 좁으면 사라진다
  const dr = Math.max(1, Math.round((h * Math.tan((prof.overhangDeg * Math.PI) / 180)) / r));
  const wr = prof.wall ? Math.max(1, Math.round(prof.wall / r)) : 0;
  const occ = new Uint8Array(N), prn = new Uint8Array(N), prevPrn = new Uint8Array(N), prevOcc = new Uint8Array(N), prevCat = new Uint8Array(N);
  const tmpA = new Uint8Array(N), sup = new Uint8Array(N), cat = new Uint8Array(N), thinOcc = new Uint8Array(N), core = new Uint8Array(N);
  const lastTop = new Int32Array(N).fill(-1);
  const st = { voxDesign: 0, voxPrint: 0, voxLost: 0, voxCore: 0, overhangPx: 0, supportVox: 0, firstLayerPx: 0, lostLayers: 0 };
  const R = render ? render({ lo, hi, r, h, ox, oy }) : null;
  const SP = Math.max(1, Math.round(2.5 / r));   // 서포트 기둥은 약 2.5mm 간격으로만 그린다(안이 보이게)

  for (let z = 0; z < nz; z++) {
    const zc = (z + 0.5) * h + 1;
    X.layer(zc, occ);
    if (kr > 0) {
      morph(occ, tmpA, nx, ny, kr, false); morph(tmpA, prn, nx, ny, kr, true);
      for (let k = 0; k < N; k++) prn[k] &= occ[k];
      // 열림이 겉 윤곽에서 떼어 낸 외톨이 화소(원·사선 단면의 계단)는 잡음으로 보고 되돌린다:
      // 진짜로 좁은 벽은 길게 이어져 "사라진 이웃"이 둘 이상이다
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (!occ[k] || prn[k]) continue;
        const nb = (occ[k - 1] && !prn[k - 1]) + (occ[k + 1] && !prn[k + 1]) + (occ[k - nx] && !prn[k - nx]) + (occ[k + nx] && !prn[k + nx]);
        if (nb < 2) tmpA[k] = 2; else tmpA[k] = 0;
      }
      for (let k = 0; k < N; k++) if (tmpA[k] === 2) { prn[k] = 1; tmpA[k] = 0; }
    } else prn.set(occ);
    if (T) { T.layer(zc, thinOcc); for (let k = 0; k < N; k++) if (thinOcc[k] && !occ[k]) occ[k] = 3; }   // 3 = 얇아서 통째로 사라지는 부품
    if (wr) morph(prn, core, nx, ny, wr, false);
    if (z > 0) morph(prevPrn, sup, nx, ny, dr, true);
    let lostHere = 0;
    for (let k = 0; k < N; k++) {
      if (!occ[k]) { cat[k] = 0; continue; }
      if (occ[k] === 3) { occ[k] = 1; prn[k] = 0; lostHere++; cat[k] = 2; continue; }   // 부피는 실제 메시 부피로 따로 셈
      st.voxDesign++;
      if (!prn[k]) { st.voxLost++; lostHere++; cat[k] = 2; continue; }
      st.voxPrint++;
      if (wr && core[k]) st.voxCore++;
      if (z === 0) { st.firstLayerPx++; cat[k] = 1; }
      else if (!sup[k]) {
        st.overhangPx++; cat[k] = 3;
        const below = lastTop[k], hgt = z - below - 1;
        st.supportVox += hgt;
        if (R) { const i = k % nx, j = (k / nx) | 0; if (i % SP === 0 && j % SP === 0) for (let q = below + 1; q < z; q++) R.splat(i, j, q, 4); }
      } else cat[k] = 1;
      lastTop[k] = z;
    }
    if (lostHere) st.lostLayers++;
    if (R) {
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (occ[k]) {   // 이 층의 겉면(옆이 비었거나 아래가 비었다)
          if (!occ[k - 1] || !occ[k + 1] || !occ[k - nx] || !occ[k + nx] || !prevOcc[k]) R.splat(i, j, z, cat[k]);
        } else if (prevOcc[k]) R.splat(i, j, z - 1, prevCat[k]);   // 아래층의 윗면
      }
    }
    prevPrn.set(prn); prevOcc.set(occ); prevCat.set(cat);
  }
  if (R) for (let k = 0; k < N; k++) if (prevOcc[k]) R.splat(k % nx, (k / nx) | 0, nz - 1, prevCat[k]);   // 맨 윗면

  const vv = r * r * h;
  const design = st.voxDesign * vv + thinMm3, lost = st.voxLost * vv + thinMm3;
  const res = {
    size: [W, D, H], grid: r, layer: h, layers: nz, coarse: r > prof.xy + 1e-9,
    designMm3: design, printMm3: st.voxPrint * vv, lostMm3: lost,
    lostPct: design ? (100 * lost) / design : 0, lostLayers: st.lostLayers, lostParts: [...new Set(lostParts)],
    overhangMm2: st.overhangPx * r * r, supportMm3: st.supportVox * vv, firstLayerMm2: st.firstLayerPx * r * r,
  };
  // 필라멘트: 바깥 벽은 꽉 차게, 벽 안쪽은 infill 비율로, 서포트는 20% 로 친다
  const coreMm3 = st.voxCore * vv, shellMm3 = res.printMm3 - coreMm3;
  res.grams = ((shellMm3 + coreMm3 * prof.infill + res.supportMm3 * 0.2) / 1000) * prof.density;
  if (R) res.image = R.finish();
  return res;
}

export const meshVolume = (g) => { let v = 0; for (const t of g.tris) { const a = g.pts[t[0]], b = g.pts[t[1]], c = g.pts[t[2]]; v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; } return Math.abs(v); };

// 1) 표면 교차: 기둥(격자 한 칸)을 위로 지나는 광선이 아래를 향한 면을 지나면 들어가고(+1) 위를 향한 면을 지나면 나온다(-1).
//    칸마다 교차 높이를 모아 정렬해 두면, 층마다 "감긴 수 > 0"이 곧 안(겹친 부품은 합집합)이다.
//    메모리를 아끼려고 두 번 훑는다: 한 번은 칸마다 개수만 세고, 한 번은 한 배열에 채운다.
function rasterize(groups, { nx, ny, ox, oy, r, z0 }) {
  const JX = 0.01371, JY = 0.02193;   // 화소 중심을 살짝 비켜 축에 맞춘 모서리를 정확히 밟지 않게
  const N = nx * ny, count = new Uint32Array(N + 1);
  let off = null, buf = null, fill = null;
  const visit = (emit) => {
    for (const g of groups) {
      const P = g.pts;
      for (const t of g.tris) {
        const a = P[t[0]], b = P[t[1]], c = P[t[2]];
        const nzv = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(nzv) < 1e-12) continue;
        const s = nzv < 0 ? 1 : -1;
        const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
        const i0 = Math.max(0, Math.ceil((x0 - ox) / r - 0.5 - JX)), i1 = Math.min(nx - 1, Math.floor((x1 - ox) / r - 0.5 - JX));
        const j0 = Math.max(0, Math.ceil((y0 - oy) / r - 0.5 - JY)), j1 = Math.min(ny - 1, Math.floor((y1 - oy) / r - 0.5 - JY));
        const az = a[2] - z0, bz = b[2] - z0, cz = c[2] - z0;
        for (let j = j0; j <= j1; j++) {
          const py = oy + (j + 0.5 + JY) * r;
          for (let i = i0; i <= i1; i++) {
            const px = ox + (i + 0.5 + JX) * r;
            const w0 = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
            const w1 = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
            const w2 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
            if (nzv > 0 ? (w0 < 0 || w1 < 0 || w2 < 0) : (w0 > 0 || w1 > 0 || w2 > 0)) continue;
            emit(j * nx + i, s * ((w0 * az + w1 * bz + w2 * cz) / nzv + 1));   // 부호에 방향을 싣는다(z+1 > 0)
          }
        }
      }
    }
  };
  visit((k) => { count[k + 1]++; });
  off = count; for (let k = 0; k < N; k++) off[k + 1] += off[k];
  buf = new Float64Array(off[N]); fill = new Uint32Array(N);
  visit((k, v) => { buf[off[k] + fill[k]++] = v; });
  for (let k = 0; k < N; k++) {   // 칸 안 정렬(삽입 정렬: 칸마다 수십 개)
    const s = off[k], e = off[k + 1];
    for (let i = s + 1; i < e; i++) { const v = buf[i], av = Math.abs(v); let j = i - 1; while (j >= s && Math.abs(buf[j]) > av) { buf[j + 1] = buf[j]; j--; } buf[j + 1] = v; }
  }
  const ptr = new Uint32Array(N), wind = new Int32Array(N);
  for (let k = 0; k < N; k++) ptr[k] = off[k];
  return {
    layer(zc, out) {
      for (let k = 0; k < N; k++) {
        let p = ptr[k];
        const e = off[k + 1];
        if (p === e && wind[k] === 0) { out[k] = 0; continue; }
        let w = wind[k];
        while (p < e && Math.abs(buf[p]) < zc) { w += buf[p] > 0 ? 1 : -1; p++; }
        ptr[k] = p; wind[k] = w; out[k] = w > 0 ? 1 : 0;
      }
    },
  };
}

// 이진 영상의 정사각 침식(dilate=false)·팽창(true). 행·열로 나눠 미끄러지는 창의 개수로 센다.
function morph(src, dst, nx, ny, rad, dilate) {
  const tmp = morph.tmp && morph.tmp.length === src.length ? morph.tmp : (morph.tmp = new Uint8Array(src.length));
  const full = 2 * rad + 1;
  for (let j = 0; j < ny; j++) {
    const o = j * nx; let cnt = 0;
    for (let i = -rad; i < nx; i++) {
      const add = i + rad; if (add < nx) cnt += src[o + add];
      if (i >= 0) { tmp[o + i] = dilate ? (cnt > 0 ? 1 : 0) : (cnt === full ? 1 : 0); const rem = i - rad; if (rem >= 0) cnt -= src[o + rem]; }
    }
  }
  for (let i = 0; i < nx; i++) {
    let cnt = 0;
    for (let j = -rad; j < ny; j++) {
      const add = j + rad; if (add < ny) cnt += tmp[add * nx + i];
      if (j >= 0) { dst[j * nx + i] = dilate ? (cnt > 0 ? 1 : 0) : (cnt === full ? 1 : 0); const rem = j - rad; if (rem >= 0) cnt -= tmp[rem * nx + i]; }
    }
  }
}
