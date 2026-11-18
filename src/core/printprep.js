// printprep.js — 3D 프린트용 출력 변환(할 일 B1). 도면·재단표는 원래 모델에서 나오고, 여기서는 복사본만 고친다.
//
// 두께 보정: 축척으로 나누면 프린터 최소 벽(profile.weak, FDM 0.8mm)보다 얇아지는 판·각재·원판·곡선판·띠를
// 층 높이의 정수배(0.12mm 층이면 0.84mm)까지 두껍게 한다. 바깥면은 그대로 두고 **안쪽으로만** 키운다.
//   안쪽 = 맞닿은 이웃 부품이 더 많이 뻗어 있는 쪽(서랍 바닥 → 서랍 옆판이 있는 위, 뒤판 → 본체가 있는 앞).
//   이웃이 없으면 분해 방향(ex)의 반대, 그것도 없으면 모델 중심 쪽. 그래도 가구 바깥 상자를 넘으면 반대쪽·양쪽 순으로 바꾼다.
// 지름 보정(B2): 봉·철사·구슬·둥근 손잡이가 profile.minRound(FDM 1.0mm)보다 가늘면 축을 그대로 두고 굵게 한다.
//   가구 바깥 상자를 넘으면 넘은 만큼 안으로 민다. 길이가 최소 형상보다 짧아 굵게 해도 점에 불과한 것은 빼고 dropped 에 남긴다.
// 회전체 갓(cone, B3)은 아직 손대지 않는다.

import { orientFn, orientedMesh, bboxOf, V } from './geom.js';
import { classify } from './kit.js';

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
 * 출력용 모델을 만든다. profile = printProfile(프린터, 층 모드).
 * 돌려주는 값: { model: 고친 복사본, changes: [{ id, name, kind, from, to, axes: [{ axis, from, to, side }] }], dropped: [{ id, name, reason }] }
 * (두께·지름은 미니어처 mm. 원형 부품은 axis 'd')
 */
export function printModel(model, profile) {
  const N = model.N, layer = profile.layer;
  const W = Number((Math.ceil(profile.weak / layer - 1e-9) * layer).toFixed(6));   // 최소 벽을 층의 정수배로 올린 값
  const outer = model.bbox, changes = [];
  const dropped = [], R = profile.minRound;
  const parts = model.parts.map((p) => {
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
