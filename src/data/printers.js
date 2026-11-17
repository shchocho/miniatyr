// printers.js — 3D 프린터 프로파일. 출력 판단(시뮬레이션·두께 보정·판 배치)의 기준값을 한곳에 둔다.
// 기종 이름은 판 크기를 알아보기 위한 예일 뿐이다. 값은 기본 슬라이서 설정에 맞춘 근사이고, 보정 시편(할 일 G1)으로 바꾼다.
// 결정과 근거: tasks/plan.md "기준 프린터", docs/PRINT_SIMULATION.md 6절.
//
//   xy          시뮬레이션 격자(mm)
//   layers      층 높이 — fine(미니어처 기본) · fast(빠르게)
//   minFeature  이보다 좁은 단면은 나오지 않는다(노즐 폭이 막는 수평 두께)
//   weak        이보다 얇으면 부러지기 쉽다(FDM 외벽 2줄)
//   overhangDeg 아래층이 받쳐 주지 않아도 되는 기울기
//   wall·infill 무게 계산용: 바깥 벽 두께 · 벽 안쪽을 채우는 비율(레진은 속이 찬 채로 굳는다)
//   clearance   끼워 맞추는 두 면 사이 틈(위치잡이·핀, 할 일 D2)

const FDM = {
  tech: 'fdm', nozzle: 0.4, material: 'PLA', density: 1.24,
  xy: 0.1, layers: { fine: 0.12, fast: 0.2 }, minFeature: 0.3, weak: 0.8, overhangDeg: 45,
  wall: 0.8, infill: 0.25, clearance: 0.2,
};

export const PRINTERS = [
  { ...FDM, id: 'fdm-256', name: 'FDM · 256mm 판', example: 'Bambu Lab A1·P1S 급', bed: [256, 256, 256] },
  { ...FDM, id: 'fdm-180', name: 'FDM · 180mm 판', example: 'Bambu Lab A1 mini 급', bed: [180, 180, 180] },
  { ...FDM, id: 'fdm-220', name: 'FDM · 220mm 판', example: 'Creality Ender-3 V3 급', bed: [220, 220, 250] },
  { ...FDM, id: 'fdm-250', name: 'FDM · 250 × 210mm 판', example: 'Prusa MK4S 급', bed: [250, 210, 220] },
  {
    id: 'msla', tech: 'resin', name: 'MSLA 레진', example: '10인치 MSLA 급', bed: [218, 123, 250],
    material: '표준 레진', density: 1.1, xy: 0.05, layers: { fine: 0.03, fast: 0.05 }, minFeature: 0.15, weak: 0.4, overhangDeg: 45,
    wall: 0, infill: 1, clearance: 0.1,
  },
];

export const DEFAULT_PRINTER = 'fdm-256';
export const LAYER_MODES = { fine: '세밀', fast: '빠르게' };

const BY_ID = new Map(PRINTERS.map((p) => [p.id, p]));

/** 저장된 값은 믿지 않는다: 아는 프린터 id 만, 아니면 기본값. */
export const printerId = (id) => (BY_ID.has(id) ? id : DEFAULT_PRINTER);
export const layerMode = (m) => (Object.hasOwn(LAYER_MODES, m) ? m : 'fine');
export const getPrinter = (id) => BY_ID.get(printerId(id));

/** 프린터 + 층 모드 → 시뮬레이터·출력 변환이 받는 평평한 프로파일(layer 하나로 정해짐). */
export function printProfile(id = DEFAULT_PRINTER, mode = 'fine') {
  const p = getPrinter(id), m = layerMode(mode), layer = p.layers[m];
  return { ...p, mode: m, layer, label: `${p.name} · ${layer}mm 층` };
}
