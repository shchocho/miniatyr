// printprep.js — 3D 프린트용 출력 변환(할 일 B1). 도면·재단표는 원래 모델에서 나오고, 여기서는 복사본만 고친다.
//
// 두께 보정: 축척으로 나누면 프린터 최소 벽(profile.weak, FDM 0.8mm)보다 얇아지는 판·각재·원판·곡선판·띠를
// 층 높이의 정수배(0.12mm 층이면 0.84mm)까지 두껍게 한다. 바깥면은 그대로 두고 **안쪽으로만** 키운다.
//   안쪽 = 맞닿은 이웃 부품이 더 많이 뻗어 있는 쪽(서랍 바닥 → 서랍 옆판이 있는 위, 뒤판 → 본체가 있는 앞).
//   이웃이 없으면 분해 방향(ex)의 반대, 그것도 없으면 모델 중심 쪽. 그래도 가구 바깥 상자를 넘으면 반대쪽·양쪽 순으로 바꾼다.
// 지름 보정(B2): 봉·철사·구슬·둥근 손잡이가 profile.minRound(FDM 1.0mm)보다 가늘면 축을 그대로 두고 굵게 한다.
//   가구 바깥 상자를 넘으면 넘은 만큼 안으로 민다. 길이가 최소 형상보다 짧아 굵게 해도 점에 불과한 것은 빼고 dropped 에 남긴다.
// 회전체 벽(B3): 갓·컵처럼 얇은 벽의 회전체(stock 'cone')는 경계 상자로 두께를 알 수 없어 단면(profile)에서 잰다.
//   가장 짧은 두 변(테두리)으로 단면을 두 사슬로 나누고, 축에 가까운 안쪽 사슬만 밀어 벽을 최소 벽까지 키운다.
// 투명판(유리·거울, stock 'film')은 출력하지 않는다: 빼고 dropped 에 남긴다(투명판은 DXF 로 따로 자른다).

import { orientFn, orientedMesh, bboxOf, V } from './geom.js';
import { classify } from './kit.js';
import { modelTriangles, kitTriangles } from './export.js';

const TOUCH = 0.5;   // 실물 mm: 이만큼 떨어져 있어도 맞닿은 이웃으로 본다
const PLANE_T = { xy: [0, 0, 1], zy: [-1, 0, 0], xz: [0, -1, 0] };   // 압출 두께 방향(geom.js PLANE 에 [0,0,1] 을 넣은 값)
const CYL_AXIS = { y: [0, 1, 0], x: [1, 0, 0], z: [0, 0, 1] };

/** 부품에서 두께를 바꿀 수 있는 치수(실물 mm)와 그 로컬 방향. 메시는 모두 기준점 중심이다. */
function adjustable(p) {
  switch (p.kind) {
    case 'box':
    case 'rbox':
      return [0, 1, 2].map((a) => ({ axis: 'xyz'[a], value: p.size[a], dir: [0, 1, 2].map((i) => (i === a ? 1 : 0)), set: (q, v) => { q.size[a] = v; } }));
    case 'ext': {
      const out = [{ axis: 't', value: p.t, dir: PLANE_T[p.plane || 'xy'], set: (q, v) => { q.t = v; } }];
      if (p.wall) out.push({ axis: 'wall', value: p.wall, dir: null, set: (q, v) => { q.wall = v; } });   // 띠의 벽은 윤곽 안쪽으로 자란다
      return out;
    }
    case 'cyl':
      return p.stock === 'disc' ? [{ axis: 'len', value: p.len, dir: CYL_AXIS[p.axis || 'y'], set: (q, v) => { q.len = v; } }] : [];
    default:
      return [];
  }
}

/** 둥근 부품의 지름·길이(실물 mm)와 지름을 f 배로 키우는 함수. 해당 없으면 null. */
function roundOf(p) {
  switch (p.kind) {
    case 'cyl':
      return p.stock === 'disc' ? null : { d: 2 * Math.max(p.r, p.r2 ?? p.r), l: p.len, grow: (q, f) => { q.r = p.r * f; if (p.r2 != null) q.r2 = p.r2 * f; } };
    case 'sph':
      return { d: 2 * p.r * Math.min(1, p.sy ?? 1), l: 2 * p.r, grow: (q, f) => { q.r = p.r * f; } };
    case 'tube':
      return { d: 2 * p.r, l: p.cut?.l ?? Infinity, grow: (q, f) => { q.r = p.r * f; } };
    case 'lathe':
      return p.stock === 'cone' ? null : { d: p.cut.d, l: p.cut.l, grow: (q, f) => { q.profile = p.profile.map(([r, y, ...rest]) => [r * f, y, ...rest]); } };
    default:
      return null;
  }
}

/**
 * 얇은 벽 회전체 단면을 안쪽으로 두껍게. 벽이 이미 want 이상이면 null. 테두리를 못 찾으면(사슬이 둘로 안 나뉨) null 로 두고 보고에 맡긴다.
 */
export function thickenProfile(profile, want) {
  const P = profile.map(([r, y]) => [r, y]), n = P.length;
  if (n < 4) return null;
  let A = 0;
  const len = [];
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; len.push(Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const [e1, e2] = [...len.keys()].sort((a, b) => len[a] - len[b]);
  if ((e1 + 1) % n === e2 || (e2 + 1) % n === e1) return null;   // 테두리 둘이 붙어 있으면 띠가 아니다
  // 사슬: e1 끝 → e2 시작, e2 끝 → e1 시작(꼭짓점 번호). 평균 반지름이 작은 쪽이 안쪽
  const chain = (from, to) => { const out = []; for (let i = (from + 1) % n; ; i = (i + 1) % n) { out.push(i); if (i === to) break; } return out; };
  const c1 = chain(e1, e2), c2 = chain(e2, e1);
  const avgR = (c) => c.reduce((m, i) => m + P[i][0], 0) / c.length;
  const [inner, outerC] = avgR(c1) <= avgR(c2) ? [c1, c2] : [c2, c1];
  // 벽 두께 = 안쪽 꼭짓점에서 바깥 사슬 변(축 위 변 제외)까지의 가장 짧은 거리. 고르지 않은 벽은 가장 얇은 곳 기준
  let t = Infinity;
  for (let k = 0; k + 1 < outerC.length; k++) {
    const a = P[outerC[k]], b = P[outerC[k + 1]], dx = b[0] - a[0], dy = b[1] - a[1];
    if (a[0] === 0 && b[0] === 0) continue;
    for (const i of inner) { const v = P[i], u = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); t = Math.min(t, Math.hypot(v[0] - a[0] - u * dx, v[1] - a[1] - u * dy)); }
  }
  if (!(t < want - 1e-9)) return null;
  // 안쪽 사슬의 변(사슬 안 이웃 꼭짓점 사이)만 바깥 법선으로 delta 만큼 민다. 꼭짓점은 이웃 변의 선이 만나는 곳으로
  const sgn = A > 0 ? 1 : -1, delta = want - t, off = new Array(n).fill(0);
  for (let k = 0; k + 1 < inner.length; k++) off[inner[k]] = delta;   // 변 i = 꼭짓점 i → i+1
  const line = (i) => { const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nr = (sgn * dy) / l, ny = (-sgn * dx) / l; return { p: [a[0] + nr * off[i], a[1] + ny * off[i]], d: [dx / l, dy / l], nrm: [nr, ny] }; };
  const meet = (a, b, o) => {   // 변 a 와 변 b 의 민 선이 만나는 점(평행이면 o 만큼 민 점)
    const L1 = line(a), L2 = line(b), cr = L1.d[0] * L2.d[1] - L1.d[1] * L2.d[0];
    if (Math.abs(cr) < 1e-6) return [o[0] + L2.nrm[0] * (off[b] || off[a]), o[1] + L2.nrm[1] * (off[b] || off[a])];
    const s1 = ((L2.p[0] - L1.p[0]) * L2.d[1] - (L2.p[1] - L1.p[1]) * L2.d[0]) / cr;
    return [Math.max(0, L1.p[0] + L1.d[0] * s1), L1.p[1] + L1.d[1] * s1];
  };
  const out = profile.map((q) => [...q]);
  for (const i of inner) [out[i][0], out[i][1]] = meet((i - 1 + n) % n, i, P[i]);
  // 짧은 변(모따기)은 크게 밀면 뒤집힌다: 그 변의 두 끝을 앞뒤 변의 선이 만나는 한 점으로 접는다
  for (let k = 0; k + 1 < inner.length; k++) {
    const i = inner[k], j = inner[k + 1];
    if ((out[j][0] - out[i][0]) * (P[j][0] - P[i][0]) + (out[j][1] - out[i][1]) * (P[j][1] - P[i][1]) < 0) {
      const m = meet((i - 1 + n) % n, j, P[i]);
      [out[i][0], out[i][1]] = m; [out[j][0], out[j][1]] = m;
    }
  }
  const prof = out.filter((q, i) => i === 0 || Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1]) > 1e-6);   // 접은 점은 하나로
  return { profile: prof, from: t, to: want };
}

const worldBox = (q) => { const bb = bboxOf(orientedMesh(q, 0).v); return { min: V.add(bb.min, q.pos), max: V.add(bb.max, q.pos), center: V.add(bb.center, q.pos) }; };
const excess = (bb, outer) => { let e = 0; for (let a = 0; a < 3; a++) e += Math.max(0, outer.min[a] - bb.min[a]) + Math.max(0, bb.max[a] - outer.max[a]); return e; };

/** 맞닿은 이웃이 +d 쪽으로 더 뻗어 있으면 양수. 이웃마다 맞닿은 넓이로 무게를 준다. */
function neighbourSide(p, d, parts) {
  const k = [0, 1, 2].reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 0), sk = Math.sign(d[k]);
  let score = 0;
  for (const q of parts) {
    if (q === p || q.opt || q.inner) continue;
    const ov = [0, 1, 2].map((a) => Math.min(p.bb.max[a] + TOUCH, q.bb.max[a]) - Math.max(p.bb.min[a] - TOUCH, q.bb.min[a]));
    if (ov.some((x) => x < 0)) continue;
    const w = ov.reduce((m, x, a) => (a === k ? m : m * x), 1);
    score += w * (Math.max(0, q.bb.max[k] - p.bb.max[k]) - Math.max(0, p.bb.min[k] - q.bb.min[k]));
  }
  return score * sk;
}

/**
 * 출력용 모델을 만든다. profile = printProfile(프린터, 층 모드). keepFilm: 투명판을 빼지 않는다.
 * 돌려주는 값: { model: 고친 복사본, changes: [{ id, name, kind, from, to, axes: [{ axis, from, to, side }] }], dropped: [{ id, name, reason: 'film'|'tiny' }] }
 * (두께·지름은 미니어처 mm. 원형 부품은 axis 'd')
 */
export function printModel(model, profile, { keepFilm = false } = {}) {
  const N = model.N, layer = profile.layer;
  const W = Number((Math.ceil(profile.weak / layer - 1e-9) * layer).toFixed(6));   // 최소 벽을 층의 정수배로 올린 값
  const outer = model.bbox, changes = [];
  const dropped = [], R = profile.minRound;
  const parts = model.parts.map((p) => {
    if (p.stock === 'film' && !p.inner && !keepFilm) { dropped.push({ id: p.id, name: p.name, reason: 'film' }); return null; }
    if (p.kind === 'lathe' && p.stock === 'cone' && !p.inner) {
      const th = thickenProfile(p.profile, W * N);
      if (!th) return p;
      const q = { ...p, profile: th.profile }, bb = worldBox(q);
      Object.assign(q, { bb: { min: bb.min, max: bb.max }, center: bb.center }, classify(q));
      changes.push({ id: p.id, name: p.name, kind: p.kind, from: th.from / N, to: W, axes: [{ axis: 'wall', from: th.from / N, to: W, side: -1 }] });
      return q;
    }
    const rd = p.inner ? null : roundOf(p);
    if (rd && rd.d / N < R - 1e-9) {
      if (rd.l / N < profile.minFeature) { dropped.push({ id: p.id, name: p.name, reason: 'tiny' }); return null; }
      const q = { ...p, pos: [...p.pos] };
      rd.grow(q, (R * N) / rd.d);
      let bb = worldBox(q);
      if (!p.opt) {   // 바깥 상자를 넘은 만큼 안으로
        for (let a = 0; a < 3; a++) q.pos[a] += Math.max(0, outer.min[a] - bb.min[a]) - Math.max(0, bb.max[a] - outer.max[a]);
        bb = worldBox(q);
      }
      Object.assign(q, { bb: { min: bb.min, max: bb.max }, center: bb.center }, classify(q));
      changes.push({ id: p.id, name: p.name, kind: p.kind, from: rd.d / N, to: R, axes: [{ axis: 'd', from: rd.d / N, to: R, side: 0 }] });
      return q;
    }
    const dims = p.inner ? [] : adjustable(p);
    if (!dims.some((d) => d.value / N < profile.weak - 1e-9)) return p;
    const q = { ...p, pos: [...p.pos], ...(p.size ? { size: [...p.size] } : {}) };
    const { tf } = orientFn(p), axes = [];
    for (const d of dims) {
      if (d.value / N >= W - 1e-9) continue;
      const next = W * N, grow = next - d.value;
      d.set(q, next);
      let side = 0;
      if (d.dir) {
        const w = V.norm(tf(d.dir));
        const nb = neighbourSide(p, w, model.parts);
        const exd = p.ex ? V.dot(V.norm(p.ex), w) : 0;
        const toCenter = V.dot(V.sub(outer.center, p.center), w);
        side = Math.abs(nb) > 1e-6 ? Math.sign(nb) : Math.abs(exd) >= 0.7 ? -Math.sign(exd) : Math.abs(toCenter) > 1e-6 ? Math.sign(toCenter) : 0;
        // 가구 바깥 상자를 넘으면 반대쪽 → 양쪽 순으로(넘는 양이 가장 적은 쪽)
        const base = [...q.pos], tryAt = (s) => { q.pos = V.add(base, V.mul(w, (s * grow) / 2)); return p.opt ? 0 : excess(worldBox(q), outer); };
        if (tryAt(side) > 1e-6) side = [side, -side, 0].map((s) => [s, tryAt(s)]).sort((a, b) => a[1] - b[1])[0][0];
        tryAt(side);
      }
      axes.push({ axis: d.axis, from: d.value / N, to: W, side });
    }
    const bb = worldBox(q);
    Object.assign(q, { bb: { min: bb.min, max: bb.max }, center: bb.center }, classify(q));
    const before = dims.map((d) => d.value / N), after = adjustable(q).map((d) => d.value / N);
    changes.push({ id: p.id, name: p.name, kind: p.kind, from: Math.min(...before), to: Math.min(...after), axes });
    return q;
  }).filter(Boolean);
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) if (!p.opt) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p.bb.min[a]); max[a] = Math.max(max[a], p.bb.max[a]); }
  if (!Number.isFinite(min[0])) { min = outer.min; max = outer.max; }
  const bbox = { min, max, size: V.sub(max, min), center: V.mul(V.add(min, max), 0.5) };
  return { model: { ...model, parts, bbox, print: { printer: profile.id, layer, minWall: W, minRound: R } }, changes, dropped };
}

// ---------------------------------------------------------------- 출력 점검 보고(할 일 B4). 내보내기 탭과 sweep 이 같은 값을 쓴다.

const BLOCK_FILL = 0.4;   // 부품 부피 ÷ 바깥 상자 부피. 소파 0.45–0.72, 상자·의자·침대 틀 0.32 이하(1:12 100종)

/** 껍질 하나의 부피·겉넓이(mm³·mm²) */
function volArea(g) {
  let v = 0, a = 0;
  for (const t of g.tris) {
    const p = g.pts[t[0]], q = g.pts[t[1]], r = g.pts[t[2]];
    v += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6;
    const u = V.sub(q, p), w = V.sub(r, p);
    a += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
  }
  return { v: Math.abs(v), a };
}

/** 판에 세워 놓을 수 있는가(폭·깊이는 돌려 맞춰도 됨, 높이는 그대로) */
export const fitsUpright = (sz, bed) => Math.max(sz[0], sz[1]) <= Math.max(bed[0], bed[1]) && Math.min(sz[0], sz[1]) <= Math.min(bed[0], bed[1]) && sz[2] <= bed[2];

/**
 * 출력용 모델(printModel 결과)의 점검 보고. 미니어처 mm·g.
 * 필라멘트는 부품마다 겉 벽(profile.wall)은 꽉 차게, 그 안은 profile.infill 로 센 근사(서포트 제외, 시뮬레이터와 같은 가정).
 */
export function printReport(pm, profile) {
  const N = pm.N, sz = pm.bbox.size, size = [sz[0] / N, sz[2] / N, sz[1] / N];   // 폭 × 깊이 × 높이
  const plates = kitTriangles(pm, { bed: profile.bed[0] });
  let oversize = 0;
  for (const pl of plates) for (const it of pl) if (it.w > profile.bed[0] || it.h > profile.bed[1]) oversize++;
  let vol = 0, mm3 = 0;
  for (const g of modelTriangles(pm)) { const { v, a } = volArea(g), shell = Math.min(v, a * profile.wall); vol += v; mm3 += shell + profile.infill * (v - shell); }
  const fill = vol / (size[0] * size[1] * size[2]);
  return {
    size, fitsBed: fitsUpright(size, profile.bed), plates: plates.length, oversize,
    grams: (mm3 * profile.density) / 1000, fill,
    recommend: fill >= BLOCK_FILL ? ['assembled', 'kit'] : ['kit'],
  };
}
