// 3D 출력 쪽 단위 테스트: 출력 시뮬레이터(src/core/printsim.js)와 프린터 프로파일(src/data/printers.js). `npm test`
// 손으로 계산할 수 있는 작은 도형으로 "무엇이 안 나오고, 어디에 서포트가 필요한가"를 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/core/printsim.js';
import { printModel } from '../src/core/printprep.js';
import { PRINTERS, DEFAULT_PRINTER, printProfile, printerId, layerMode } from '../src/data/printers.js';
import { CATALOG, getItem } from '../src/data/catalog.js';
import { buildModel } from '../src/core/kit.js';
import { cutList } from '../src/core/cutlist.js';

// 바깥을 향한(반시계) 삼각형 12개짜리 상자. 내보내기(EX.modelTriangles)와 같은 { pts, tris, part } 모양.
function box([x0, y0, z0], [x1, y1, z1], name) {
  const pts = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return name ? { pts, tris, part: { name } } : { pts, tris };
}
// 껍질 여러 개를 한 부품(한 그룹)으로 묶는다
function oneGroup(...shells) {
  const pts = [], tris = [];
  for (const s of shells) { const o = pts.length; pts.push(...s.pts); tris.push(...s.tris.map((t) => t.map((i) => i + o))); }
  return { pts, tris };
}
const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol * Math.abs(want), `${msg}: ${got} (기대 ${want} ±${tol * 100}%)`);

const FDM_FAST = printProfile('fdm-256', 'fast');   // 0.4mm 노즐 · 0.2mm 층

test('출력 시뮬레이션: 노즐보다 얇게 세운 판(0.2mm)은 전부 사라지고 1.0mm 판은 다 나온다', () => {
  const thin = simulate([box([0, 0, 0], [20, 0.2, 10], '뒤판')], FDM_FAST);
  assert.ok(thin.lostPct > 99, `0.2mm 판 사라짐 ${thin.lostPct}%`);
  assert.deepEqual(thin.lostParts, ['뒤판']);
  const ok = simulate([box([0, 0, 0], [20, 1, 10], '측판')], FDM_FAST);
  assert.ok(ok.lostPct < 0.5, `1.0mm 판 사라짐 ${ok.lostPct}%`);
  assert.deepEqual(ok.lostParts, []);
});

test('출력 시뮬레이션: 한 부품 안의 좁은 지느러미(0.2mm)는 층 단면에서 지워지고 몸통은 남는다', () => {
  const part = oneGroup(box([0, 0, 0], [10, 10, 5]), box([10, 4.9, 0], [20, 5.1, 5]));
  const res = simulate([part], FDM_FAST);
  near(res.lostMm3, 10 * 0.2 * 5, 0.2, '지느러미 부피');
  near(res.printMm3, 10 * 10 * 5, 0.02, '몸통 부피');
});

test('출력 시뮬레이션: 겹친 두 부품은 합집합 부피로 센다(겹친 곳을 두 번 세지 않음)', () => {
  const res = simulate([box([0, 0, 0], [10, 10, 10]), box([5, 0, 0], [15, 10, 10])], FDM_FAST);
  near(res.designMm3, 1500, 0.01, '합집합 부피');
});

test('출력 시뮬레이션: ㄱ자 외팔보의 돌출 면적과 서포트 부피가 손 계산과 5% 안에서 맞는다', () => {
  // 기둥 4×4×10 위에 길이 20 · 폭 4 · 두께 2 팔. 기둥 밖으로 나간 16×4 가 공중에 뜬 아랫면이다.
  const res = simulate([box([0, 0, 0], [4, 4, 10]), box([0, 0, 10], [20, 4, 12])], FDM_FAST);
  near(res.overhangMm2, 16 * 4, 0.05, '돌출 면적');
  near(res.supportMm3, 16 * 4 * 10, 0.05, '서포트 부피');
  assert.equal(res.lostPct, 0);
});

test('출력 시뮬레이션: 눕힌 얇은 판은 반 층보다 두꺼우면 한 층으로 남고, 얇으면 사라진다', () => {
  const one = simulate([box([0, 0, 0], [20, 20, 0.25], '서랍 바닥')], FDM_FAST);
  assert.equal(one.lostPct, 0);
  near(one.printMm3, 20 * 20 * 0.2, 0.02, '한 층(0.2mm) 부피');
  const gone = simulate([box([0, 0, 0], [20, 20, 0.08], '거울')], FDM_FAST);
  assert.ok(gone.lostPct > 99, `0.08mm 판 사라짐 ${gone.lostPct}%`);
});

test('출력 시뮬레이션: 격자 칸이 상한을 넘으면 격자를 성기게 하고 그 사실을 알린다', () => {
  const fine = simulate([box([0, 0, 0], [30, 30, 1])], FDM_FAST);
  assert.equal(fine.coarse, false);
  const coarse = simulate([box([0, 0, 0], [30, 30, 1])], FDM_FAST, { maxCols: 1e4 });
  assert.equal(coarse.coarse, true);
  assert.ok(coarse.grid > FDM_FAST.xy);
});

test('출력 시뮬레이션: 그림은 바깥에서 넘긴 렌더러가 그리고 결과는 image 로 돌아온다', () => {
  let splats = 0, geom = null;
  const res = simulate([box([0, 0, 0], [4, 4, 10]), box([0, 0, 10], [20, 4, 12])], FDM_FAST, {
    render: (g) => { geom = g; return { splat: () => { splats++; }, finish: () => 'image' }; },
  });
  assert.equal(res.image, 'image');
  assert.ok(splats > 0);
  for (const k of ['lo', 'hi', 'r', 'h', 'ox', 'oy']) assert.ok(k in geom, k);
});

test('프린터 프로파일: 모두 필수 값을 갖고, 층 높이는 세밀 ≤ 빠르게', () => {
  assert.equal(new Set(PRINTERS.map((p) => p.id)).size, PRINTERS.length);
  for (const p of PRINTERS) {
    assert.match(p.id, /^[a-z0-9-]+$/, p.id);
    assert.ok(['fdm', 'resin'].includes(p.tech), p.id);
    assert.ok(p.name && p.example, p.id);
    assert.equal(p.bed.length, 3, p.id);
    assert.ok(p.bed.every((x) => x > 0), p.id);
    assert.ok(p.layers.fine > 0 && p.layers.fine <= p.layers.fast, p.id);
    assert.ok(p.xy > 0 && p.minFeature > 0 && p.weak >= p.minFeature, p.id);
    assert.ok(p.overhangDeg > 0 && p.overhangDeg < 90, p.id);
    assert.ok(p.density > 0 && p.infill > 0 && p.infill <= 1 && p.wall >= 0 && p.clearance > 0, p.id);
    if (p.tech === 'fdm') assert.ok(p.nozzle > 0, p.id);
  }
});

test('프린터 프로파일: 기본은 256mm 판 FDM · 0.4mm 노즐 · 0.12mm 층', () => {
  assert.equal(DEFAULT_PRINTER, 'fdm-256');
  const p = printProfile();
  assert.equal(p.id, 'fdm-256');
  assert.equal(p.tech, 'fdm');
  assert.equal(p.nozzle, 0.4);
  assert.deepEqual(p.bed, [256, 256, 256]);
  assert.equal(p.mode, 'fine');
  assert.equal(p.layer, 0.12);
  assert.equal(printProfile('fdm-256', 'fast').layer, 0.2);
});

test('프린터 프로파일: 저장된 값이 모르는 프린터·층 모드면 기본값으로 돌아간다', () => {
  assert.equal(printerId('fdm-180'), 'fdm-180');
  assert.equal(printerId('nope'), DEFAULT_PRINTER);
  assert.equal(printerId(undefined), DEFAULT_PRINTER);
  assert.equal(layerMode('fast'), 'fast');
  assert.equal(layerMode('turbo'), 'fine');
  assert.equal(printProfile('nope', 'turbo').id, DEFAULT_PRINTER);
});

test('프린터 프로파일: 지금까지의 시뮬레이션 기준선(0.2mm FDM · 0.05mm 레진) 값을 그대로 낸다', () => {
  const pick = (p) => ({ xy: p.xy, layer: p.layer, minFeature: p.minFeature, weak: p.weak, overhangDeg: p.overhangDeg, bed: p.bed, density: p.density, wall: p.wall, infill: p.infill });
  assert.deepEqual(pick(printProfile('fdm-256', 'fast')), { xy: 0.1, layer: 0.2, minFeature: 0.3, weak: 0.8, overhangDeg: 45, bed: [256, 256, 256], density: 1.24, wall: 0.8, infill: 0.25 });
  assert.deepEqual(pick(printProfile('msla', 'fast')), { xy: 0.05, layer: 0.05, minFeature: 0.15, weak: 0.4, overhangDeg: 45, bed: [218, 123, 250], density: 1.1, wall: 0, infill: 1 });
});

// ---------------------------------------------------------------- 출력용 두께 보정(printModel, 할 일 B1)
const FINE = printProfile();   // 기준 프린터 · 0.12mm 층 → 얇은 부품은 0.84mm(7층)로
const isMultiple = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6;
// 두께를 바꿀 수 있는 축(실물 mm): 상자는 세 변, 압출은 두께(띠는 벽 두께도), 원판은 길이
function flatDims(p) {
  if (p.kind === 'box' || p.kind === 'rbox') return [...p.size];
  if (p.kind === 'ext') return p.wall ? [p.t, p.wall] : [p.t];
  if (p.kind === 'cyl' && p.stock === 'disc') return [p.len];
  return [];
}

test('출력용 두께 보정: 1:12 BILLY 뒤판(0.25mm)은 뒷면을 그대로 두고 안쪽(앞)으로 0.84mm 가 된다', () => {
  const model = buildModel(getItem('billy'), { N: 12 });
  const { model: pm, changes } = printModel(model, FINE);
  const i = model.parts.findIndex((p) => p.name === '뒤판');
  const a = model.parts[i], b = pm.parts[i];
  near(Math.min(...b.size) / 12, 0.84, 1e-9, '보정한 두께');
  near(b.bb.min[2], a.bb.min[2], 1e-9, '뒷면 위치');
  near(b.bb.max[2] - a.bb.max[2], (0.84 - 0.25) * 12, 1e-9, '앞면이 안쪽으로 나온 양');
  const c = changes.find((x) => x.id === a.id);
  near(c.from, 0.25, 1e-9, '바꾸기 전');
  near(c.to, 0.84, 1e-9, '바꾼 뒤');
});

test('출력용 두께 보정: 서랍 바닥은 위·아래 어느 서랍이든 서랍 안쪽(위)으로 두꺼워진다', () => {
  const model = buildModel(getItem('malm-dresser'), { N: 12 });
  const { model: pm } = printModel(model, FINE);
  const idx = model.parts.map((p, i) => (p.name === '서랍 바닥' ? i : -1)).filter((i) => i >= 0);
  assert.ok(idx.length >= 3, `서랍 바닥 ${idx.length}개`);
  for (const i of idx) {
    const a = model.parts[i], b = pm.parts[i];
    near(b.bb.min[1], a.bb.min[1], 1e-9, `${i} 바닥 아랫면`);
    assert.ok(b.bb.max[1] > a.bb.max[1] + 1, `${i} 바닥 윗면이 올라감`);
  }
});

test('출력용 두께 보정: 원래 모델·재단표는 그대로 두는 출력 전용 변환이다', () => {
  const model = buildModel(getItem('malm-dresser'), { N: 12 });
  const before = JSON.stringify(cutList(model)), parts = JSON.stringify(model.parts.map((p) => [p.size, p.t, p.len, p.wall, p.pos, p.bb]));
  printModel(model, FINE);
  assert.equal(JSON.stringify(cutList(model)), before);
  assert.equal(JSON.stringify(model.parts.map((p) => [p.size, p.t, p.len, p.wall, p.pos, p.bb])), parts);
});

test('출력용 두께 보정: 100종 1:12·1:24 — 판·각재·원판·곡선판 0.8mm 이상, 보정한 두께는 층의 정수배, 바깥 크기 변화 0.05mm 이하', () => {
  for (const N of [12, 24]) for (const item of CATALOG) {
    const model = buildModel(item, { N });
    const { model: pm, changes } = printModel(model, FINE);
    for (const p of pm.parts) for (const d of flatDims(p)) assert.ok(d / N >= FINE.weak - 1e-9, `${item.id} 1:${N} ${p.name} ${(d / N).toFixed(3)}mm`);
    for (const c of changes) for (const ax of c.axes) if (ax.axis !== 'wall') assert.ok(isMultiple(ax.to, FINE.layer), `${item.id} 1:${N} ${c.name} ${ax.axis} ${ax.to}`);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of pm.parts) if (!p.opt) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.bb.min[a]); hi[a] = Math.max(hi[a], p.bb.max[a]); }
    for (let a = 0; a < 3; a++) {
      const d = Math.max(Math.abs(lo[a] - model.bbox.min[a]), Math.abs(hi[a] - model.bbox.max[a])) / N;
      assert.ok(d <= 0.05, `${item.id} 1:${N} 바깥 크기 축 ${a} 변화 ${d.toFixed(3)}mm`);
    }
  }
});

test('출력용 두께 보정: 레진이면 0.4mm 를 0.03mm 층의 정수배(0.42mm)로 맞춘다', () => {
  const model = buildModel(getItem('billy'), { N: 12 });
  const { model: pm } = printModel(model, printProfile('msla', 'fine'));
  const b = pm.parts.find((p) => p.name === '뒤판');
  near(Math.min(...b.size) / 12, 0.42, 1e-9, '레진 뒤판 두께');
});
