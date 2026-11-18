// print-sim.mjs — 3D 프린트 출력 시뮬레이션 CLI(의존성 없음, Node).
//
// 계산은 src/core/printsim.js(층 단면·열림 연산·돌출·서포트), 프린터 값은 src/data/printers.js 에 있다.
// 여기는 100종 해석표(sweep)와, 층 줄무늬가 보이는 등각 PNG 렌더러만 둔다.
//
//   node tools/print-sim.mjs sweep                      100종 × 5축척 표 → docs/print-sim/sweep.csv
//   node tools/print-sim.mjs render <id> <N> [assembled|kit] [fdm|fdmFine|resin] [print]   → docs/print-sim/<id>-1x<N>-<모드>-<프로파일>[-print].png
//   node tools/print-sim.mjs overlaps                   두께 보정으로 새로 생긴 겹침 → docs/print-sim/thicken-overlaps.json
//     print = 내보내기와 같은 출력용 모델(printModel 두께 보정)로 뽑는다

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG, getItem } from '../src/data/catalog.js';
import { buildModel } from '../src/core/kit.js';
import { cutList } from '../src/core/cutlist.js';
import * as EX from '../src/core/export.js';
import { SCALES } from '../src/core/scale.js';
import { simulate } from '../src/core/printsim.js';
import { printProfile, getPrinter } from '../src/data/printers.js';
import { printModel, printReport, fitsUpright } from '../src/core/printprep.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'print-sim');

// CLI 프로파일 이름 → 프린터 · 층 모드. 지금까지의 sweep·그림은 fdm(기준 프린터 0.2mm 층)으로 뽑았다.
export const PROFILES = {
  fdm: printProfile('fdm-256', 'fast'),
  fdmFine: printProfile('fdm-256', 'fine'),
  resin: printProfile('msla', 'fast'),
};
const BEDS = { a1mini: getPrinter('fdm-180').bed, fdm: PROFILES.fdm.bed, resin: PROFILES.resin.bed };

// ---------------------------------------------------------------- 등각 렌더(Z 버퍼 + 깊이로 음영 + 층 줄무늬)
// 1 출력됨(PLA 회백색) · 2 사라짐(노즐보다 좁음) · 3 서포트가 받쳐야 하는 아랫면 · 4 서포트 기둥
const COLORS = { 1: [222, 218, 209], 2: [212, 62, 48], 3: [52, 104, 206], 4: [178, 198, 226] };
function makeRenderer({ lo, hi, r, h, ox, oy, view }) {
  const az = ((view.az ?? -35) * Math.PI) / 180, el = ((view.el ?? 28) * Math.PI) / 180;
  const c = [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];   // 화면 → 카메라 쪽(앞 = -y)
  const f = c.map((x) => -x), up = [0, 0, 1];
  let R = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  const rl = Math.hypot(...R); R = R.map((x) => x / rl);
  const U = [R[1] * f[2] - R[2] * f[1], R[2] * f[0] - R[0] * f[2], R[0] * f[1] - R[1] * f[0]];
  const s = Math.min(r, h) * 0.9;
  const corners = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [0, hi[2] - lo[2]]) corners.push([x, y, z]);
  const su = corners.map((p) => p[0] * R[0] + p[1] * R[1] + p[2] * R[2]), sv = corners.map((p) => p[0] * U[0] + p[1] * U[1] + p[2] * U[2]);
  const u0 = Math.min(...su) - 3 * s, v1 = Math.max(...sv) + 3 * s;
  const Wi = Math.ceil((Math.max(...su) - u0) / s + 6), Hi = Math.ceil((v1 - Math.min(...sv)) / s + 6);
  const depth = new Float32Array(Wi * Hi).fill(-Infinity), cat = new Uint8Array(Wi * Hi), par = new Uint8Array(Wi * Hi);
  const bu = Math.max(1, Math.ceil((r * Math.max(Math.abs(R[0]), Math.abs(R[1]))) / s)) + 1;
  const bv = Math.max(1, Math.ceil(Math.max(h * Math.abs(U[2]), r * Math.max(Math.abs(U[0]), Math.abs(U[1]))) / s)) + 1;
  return {
    splat(i, j, k, cc) {
      if (!cc) return;
      const x = ox + (i + 0.5) * r, y = oy + (j + 0.5) * r, z = (k + 0.5) * h;
      const u = (x * R[0] + y * R[1] + z * R[2] - u0) / s, v = (v1 - (x * U[0] + y * U[1] + z * U[2])) / s, d = x * c[0] + y * c[1] + z * c[2];
      const iu = Math.round(u - bu / 2), iv = Math.round(v - bv / 2);
      for (let b = 0; b < bv; b++) for (let a = 0; a < bu; a++) {
        const X = iu + a, Y = iv + b; if (X < 0 || Y < 0 || X >= Wi || Y >= Hi) continue;
        const q = Y * Wi + X;
        if (d > depth[q] || (cc === 2 && d > depth[q] - r)) { depth[q] = d; cat[q] = cc; par[q] = k & 1; }
      }
    },
    finish() {
      const img = new Uint8Array(Wi * Hi * 3).fill(250);
      const L = norm3([-0.45, 0.55, 0.7]);
      for (let Y = 1; Y < Hi - 1; Y++) for (let X = 1; X < Wi - 1; X++) {
        const q = Y * Wi + X; if (!cat[q]) continue;
        const dl = depth[q - 1], dr2 = depth[q + 1], du = depth[q - Wi], dd = depth[q + Wi], d0 = depth[q];
        const ok = (v) => Number.isFinite(v) && Math.abs(v - d0) < 4 * s;
        const gx = (ok(dr2) ? dr2 : d0) - (ok(dl) ? dl : d0), gy = (ok(du) ? du : d0) - (ok(dd) ? dd : d0);
        const n = norm3([-gx / (2 * s), -gy / (2 * s), 1]);
        let lit = 0.42 + 0.58 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        if (!ok(dl) || !ok(dr2) || !ok(du) || !ok(dd)) lit *= 0.72;   // 윤곽
        if (cat[q] !== 4 && par[q]) lit *= 0.94;                     // 층 줄무늬
        const col = COLORS[cat[q]];
        for (let ch = 0; ch < 3; ch++) img[q * 3 + ch] = Math.min(255, col[ch] * lit + (cat[q] === 4 ? 30 : 0));
      }
      // 절반 크기로 줄여 가장자리를 부드럽게
      const w2 = Wi >> 1, h2 = Hi >> 1, out = new Uint8Array(w2 * h2 * 3);
      for (let Y = 0; Y < h2; Y++) for (let X = 0; X < w2; X++) for (let ch = 0; ch < 3; ch++) {
        const a = ((2 * Y) * Wi + 2 * X) * 3 + ch, b = ((2 * Y + 1) * Wi + 2 * X) * 3 + ch;
        out[(Y * w2 + X) * 3 + ch] = (img[a] + img[a + 3] + img[b] + img[b + 3]) >> 2;
      }
      return encodePNG(out, w2, h2);
    },
  };
}
const norm3 = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// ---------------------------------------------------------------- PNG
const CRC_T = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- 해석(빠름): 두께·크기·키트 자세
const minDim = (r) => { const m = r.mini; return r.stock === 'stick' ? m.b : r.stock === 'rod' || r.stock === 'wire' || r.stock === 'turn' ? m.d : r.stock === 'bead' ? m.d : r.stock === 'disc' ? m.t : m.t; };
const fits = (sz, bed) => { const a = [...sz].sort((x, y) => x - y), b = [...bed].sort((x, y) => x - y); return a[0] <= b[0] && a[1] <= b[1] && a[2] <= b[2]; };

export function analyse(item, N, { fit = false } = {}) {
  const model = buildModel(item, { N, fit }), list = cutList(model);
  const rows = list.rows.filter((r) => !r.opt);
  const thick = rows.map((r) => ({ r, t: minDim(r) })).filter((x) => x.t != null && Number.isFinite(x.t));
  const cnt = (lim) => thick.filter((x) => x.t < lim).reduce((a, x) => a + x.r.qty, 0);
  const groups = EX.modelTriangles(model);
  let vol = 0, tris = 0;
  for (const g of groups) for (const t of g.tris) { const a = g.pts[t[0]], b = g.pts[t[1]], c = g.pts[t[2]]; vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; tris += 1; }
  const [w, d, hh] = model.bbox.size, size = [w / N, d / N, hh / N];   // 폭(x) · 높이(y) · 깊이(z) 실물 순서 → 아래에서 바로잡음
  const S = [size[0], size[2], size[1]];   // 폭 × 깊이 × 높이(mm)
  const plates = EX.kitTriangles(model, { bed: BEDS.fdm[0] });
  let unstable = 0, oversize = 0, kitParts = 0;
  for (const pl of plates) for (const it of pl) {
    kitParts++;
    if (it.w > BEDS.fdm[0] || it.h > BEDS.fdm[1]) oversize++;
    let contact = 0;
    for (const t of it.tris) { const a = it.pts[t[0]], b = it.pts[t[1]], c = it.pts[t[2]]; if (Math.abs(a[2]) < 1e-6 && Math.abs(b[2]) < 1e-6 && Math.abs(c[2]) < 1e-6) contact += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2; }
    if (contact < 0.3 * it.w * it.h) unstable++;
  }
  // 출력용 모델(printModel, 기준 프린터 0.12mm 층 = 내보내기 기본값)에서 다시 센 두께
  const pm = printModel(model, PROFILES.fdmFine).model, rep = printReport(pm, PROFILES.fdmFine);   // 내보내기 탭 보고와 같은 값
  const pList = cutList(pm).rows.filter((r) => !r.opt);
  const pThick = pList.map((r) => ({ r, t: minDim(r) })).filter((x) => x.t != null && Number.isFinite(x.t));
  const pCnt = (lim) => pThick.filter((x) => x.t < lim).reduce((a, x) => a + x.r.qty, 0);
  const stocks = {};
  for (const r of rows) stocks[r.stock] = (stocks[r.stock] || 0) + r.qty;
  return {
    id: item.id, no: item.no, name: item.name, cat: item.cat, N, fit,
    parts: rows.reduce((a, r) => a + r.qty, 0), tris, size: S, volMm3: vol,
    minT: thick.length ? Math.min(...thick.map((x) => x.t)) : null,
    fdmLost: cnt(PROFILES.fdm.minFeature), fdmWeak: cnt(PROFILES.fdm.weak), resinLost: cnt(PROFILES.resin.minFeature), resinWeak: cnt(PROFILES.resin.weak),
    fitFdm: fitsUpright(S, BEDS.fdm), fitA1mini: fitsUpright(S, BEDS.a1mini), fitResin: fitsUpright(S, BEDS.resin), fitResinAny: fits(S, BEDS.resin),
    printLost: pCnt(PROFILES.fdm.minFeature), printWeak: pCnt(PROFILES.fdm.weak),
    printFit: rep.fitsBed, printPlates: rep.plates, printGrams: rep.grams, printFill: rep.fill, recommend: rep.recommend.join('+'),
    plates: plates.length, kitParts, unstable, oversize, stocks,
    thinParts: thick.filter((x) => x.t < PROFILES.fdm.weak).sort((a, b) => a.t - b.t).slice(0, 4).map((x) => `${x.r.label} ${x.r.name} ${x.t.toFixed(2)}`),
  };
}

// ---------------------------------------------------------------- CLI
function sweep() {
  mkdirSync(OUT, { recursive: true });
  const rows = [];
  for (const it of CATALOG) for (const s of SCALES) { rows.push(analyse(it, s.n)); rows.push(analyse(it, s.n, { fit: true })); }
  const head = ['no', 'id', 'name', 'cat', 'N', 'fit', 'parts', 'W', 'D', 'H', 'minT', 'fdmLost', 'fdmWeak', 'resinLost', 'resinWeak', 'printLost', 'printWeak', 'printFit256', 'printPlates', 'printGrams', 'printFill', 'recommend', 'fitFdm256', 'fitA1mini', 'fitResin', 'plates', 'kitParts', 'unstableKit', 'oversizeKit', 'volMm3', 'thinParts', 'stocks'];
  const q = (v) => (typeof v === 'string' && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [head.join(','), ...rows.map((r) => [r.no, r.id, r.name, r.cat, r.N, r.fit ? 1 : 0, r.parts, ...r.size.map((x) => x.toFixed(1)), r.minT == null ? '' : r.minT.toFixed(2), r.fdmLost, r.fdmWeak, r.resinLost, r.resinWeak, r.printLost, r.printWeak, +r.printFit, r.printPlates, r.printGrams.toFixed(1), r.printFill.toFixed(2), r.recommend, +r.fitFdm, +r.fitA1mini, +r.fitResin, r.plates, r.kitParts, r.unstable, r.oversize, r.volMm3.toFixed(0), r.thinParts.join(' / '), Object.entries(r.stocks).map(([k, v]) => `${k}:${v}`).join(' ')].map(q).join(','))];
  writeFileSync(join(OUT, 'sweep.csv'), `﻿${csv.join('\n')}\n`);
  // 축척별 요약
  const sum = {};
  for (const s of SCALES) for (const fit of [false, true]) {
    const R = rows.filter((r) => r.N === s.n && r.fit === fit), n = R.length, pct = (f) => Math.round((100 * R.filter(f).length) / n);
    sum[`1:${s.n}${fit ? ' fit' : ''}`] = {
      items: n,
      'FDM 사라지는 부품 없음 %': pct((r) => r.fdmLost === 0), 'FDM 0.8mm 미만 없음 %': pct((r) => r.fdmWeak === 0),
      '출력용 FDM 사라지는 부품 없음 %': pct((r) => r.printLost === 0), '출력용 FDM 0.8mm 미만 없음 %': pct((r) => r.printWeak === 0),
      '출력용 키트 판 수(평균)': +(R.reduce((a, r) => a + r.printPlates, 0) / n).toFixed(2), '출력용 필라멘트 g(평균, 서포트 제외)': +(R.reduce((a, r) => a + r.printGrams, 0) / n).toFixed(1), '조립형도 권하는 가구': R.filter((r) => r.recommend.includes('assembled')).length,
      '레진 사라지는 부품 없음 %': pct((r) => r.resinLost === 0), '조립형 256 판에 들어감 %': pct((r) => r.fitFdm), '조립형 A1 mini(180)에 들어감 %': pct((r) => r.fitA1mini), '조립형 레진 판에 들어감 %': pct((r) => r.fitResin),
      '키트 판 수(평균)': +(R.reduce((a, r) => a + r.plates, 0) / n).toFixed(2), '키트에서 눕기 불안정한 부품(평균)': +(R.reduce((a, r) => a + r.unstable, 0) / n).toFixed(1), '키트 판보다 큰 부품이 있는 가구': R.filter((r) => r.oversize).length,
    };
  }
  writeFileSync(join(OUT, 'sweep-summary.json'), JSON.stringify(sum, null, 2));
  console.log(JSON.stringify(sum, null, 2));
}

// 두께 보정으로 새로 생긴 겹침(할 일 B1 → D1 입력). 두껍게 한 부품과 다른 부품의 경계 상자가 새로 0.01mm³ 넘게 겹치면 센다.
// shortcut: 축 정렬 경계 상자 기준이라 기울어진·둥근 부품은 과대 추정, D1 접촉 그래프가 생기면 그것으로 바꾼다
const boxOverlap = (a, b) => [0, 1, 2].reduce((m, k) => m * Math.max(0, Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k])), 1);
export function thickenOverlaps(item, N, prof = PROFILES.fdmFine) {
  const raw = buildModel(item, { N }), { model, changes } = printModel(raw, prof);
  const changed = new Set(changes.map((c) => c.id)), byId = new Map(raw.parts.map((p) => [p.id, p])), N3 = N ** 3, out = [];
  const live = model.parts.filter((p) => !p.opt && !p.inner);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (!changed.has(a.id) && !changed.has(b.id)) continue;
    const grew = (boxOverlap(a.bb, b.bb) - boxOverlap(byId.get(a.id).bb, byId.get(b.id).bb)) / N3;
    if (grew > 0.01) out.push({ a: a.name, b: b.name, mm3: +grew.toFixed(2) });
  }
  return { id: item.id, N, changed: changes.length, overlaps: out };
}
function overlaps() {
  const sum = {}, items = [];
  for (const N of [12, 24]) {
    const R = CATALOG.map((it) => thickenOverlaps(it, N));
    const pairs = R.flatMap((r) => r.overlaps.map((o) => `${o.a} ↔ ${o.b}`)), top = {};
    for (const k of pairs) top[k] = (top[k] || 0) + 1;
    sum[`1:${N}`] = { '두껍게 한 부품': R.reduce((a, r) => a + r.changed, 0), '새 겹침(쌍)': pairs.length, '겹침이 생긴 가구': R.filter((r) => r.overlaps.length).length,
      '많은 쌍': Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ×${v}`) };
    items.push(...R.filter((r) => r.overlaps.length));
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'thicken-overlaps.json'), JSON.stringify({ summary: sum, items }, null, 2));
  console.log(JSON.stringify(sum, null, 2));
}

function renderOne(id, N, mode = 'assembled', pk = 'fdm', print = false, view = {}) {
  const item = getItem(id); if (!item) throw new Error(`no item ${id}`);
  const prof = PROFILES[pk], raw = buildModel(item, { N });
  const model = print ? printModel(raw, prof).model : raw;   // print: 내보내기와 같은 출력용 모델(두께 보정)
  const groups = mode === 'kit' ? EX.kitTriangles(model, { bed: prof.bed[0] })[0] : EX.modelTriangles(model);
  const t0 = Date.now(), res = simulate(groups, prof, { render: (g) => makeRenderer({ ...g, view }) });
  mkdirSync(OUT, { recursive: true });
  const file = `${id}-1x${N}-${mode}-${pk}${print ? '-print' : ''}.png`;
  writeFileSync(join(OUT, file), res.image);
  delete res.image;
  const out = { id, N, mode, profile: pk, file, ms: Date.now() - t0, ...Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? +x.toFixed(1) : x)) : typeof v === 'number' ? +v.toFixed(2) : v])) };
  console.log(JSON.stringify(out));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'sweep') sweep();
  else if (cmd === 'overlaps') overlaps();
  else if (cmd === 'render') renderOne(a[0], Number(a[1] || 12), a[2] || 'assembled', a[3] || 'fdm', a[4] === 'print');
  else console.log('node tools/print-sim.mjs sweep | render <id> <N> [assembled|kit] [fdm|fdmFine|resin] [print]');
}
