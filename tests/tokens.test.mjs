// 색 토큰 테스트: 화면에 실제로 나오는 글자·경계 조합의 대비(WCAG 2.x)와, 3D 스테이지가 복사해 둔 토큰 값이 app.css 와 같은지. `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('../styles/app.css'), stage = read('../src/three/stage.js');

// :root { … } 과 :root[data-theme="dark"] { … } 의 --이름: #hex 만 모은다
function block(selector) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} 블록이 없다`);
  const body = css.slice(at, css.indexOf('\n}', at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}
const THEMES = { light: block(':root'), dark: { ...block(':root'), ...block(':root[data-theme="dark"]') } };

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [글자·선, 바탕, 최소 대비, 어디에 나오나] — 글자 4.5:1, 조작 요소 경계·포커스·채움 3:1
const PAIRS = [
  ['ink', 'bg', 4.5, '본문'], ['ink', 'surface-2', 4.5, '카드·입력 글자'],
  ['ink-2', 'bg', 4.5, '보조 글자'], ['ink-2', 'surface', 4.5, '보조 글자(표면)'],
  ['ink-3', 'bg', 4.5, '흐린 글자'], ['ink-3', 'surface', 4.5, '흐린 글자(표면)'], ['ink-3', 'sunk', 4.5, '흐린 글자(파인 곳)'], ['ink-3', 'surface-2', 4.5, '흐린 글자(카드)'],
  ['bg', 'ink', 4.5, '주 행동 버튼 글자'], ['on-tape', 'tape', 4.5, '3D 위 칩'],
  ['mat-text', 'bg', 4.5, '강조 글자·링크'], ['mat-text', 'surface-2', 4.5, '강조 글자(카드)'], ['mat-text', 'mat-soft', 4.5, '선택 행 강조 글자'], ['ink', 'mat-soft', 4.5, '선택 영역 본문'],
  ['on-mat', 'mat', 4.5, '강조 바탕 위 글자'],
  ['mat', 'bg', 3, '진행·핍 채움'], ['mat', 'sunk', 3, '슬라이더 채움 대 트랙'], ['mat-text', 'bg', 3, '포커스 링'],
  ['edge', 'bg', 3, '조작 요소 테두리'], ['edge', 'surface-2', 3, '조작 요소 테두리(카드)'],
  ['ok', 'bg', 4.5, '성공 글자'], ['warn', 'bg', 4.5, '주의 글자'], ['bad', 'bg', 4.5, '오류 글자'], ['warn', 'surface-2', 4.5, '주의 글자(카드)'],
  ['warn', 'mat-soft', 4.5, '선택 행의 주의 글자(재단표)'], ['warn', 'sunk', 3, '안내 상자의 주의 아이콘'],
];

for (const [theme, T] of Object.entries(THEMES)) {
  test(`대비(${theme}): 글자 4.5:1, 경계·포커스 3:1 이상`, () => {
    const fails = [];
    for (const [f, b, min, what] of PAIRS) {
      assert.ok(T[f] && T[b], `--${f} 또는 --${b} 가 없다`);
      const r = ratio(T[f], T[b]);
      if (r < min) fails.push(`${what}: --${f} ${T[f]} / --${b} ${T[b]} = ${r.toFixed(2)} (< ${min})`);
    }
    assert.deepEqual(fails, []);
  });
}

test('강조색과 상태색이 서로 구분된다(색만으로 뜻을 전하지는 않지만, 같은 색으로 보이지 않게)', () => {
  // sRGB 거리. 같은 계열로 보이는 기준을 넉넉히 60으로 둔다
  const dist = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [p(a), p(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  for (const [theme, T] of Object.entries(THEMES)) for (const s of ['ok', 'warn', 'bad']) assert.ok(dist(T['mat-text'], T[s]) >= 60, `${theme}: --mat-text 와 --${s} 가 너무 가깝다 (${dist(T['mat-text'], T[s]).toFixed(0)})`);
});

test('3D 스테이지가 복사한 토큰이 app.css 와 같다', () => {
  const theme = (name) => { const m = stage.match(new RegExp(`\\b${name}: \\{ bg: '(#\\w+)', fill: '(#\\w+)', line: '(#\\w+)' \\}`)); assert.ok(m, `LINE_THEMES.${name} 를 찾지 못했다`); return { bg: m[1], fill: m[2], line: m[3] }; };
  for (const [name, T] of [['canvas', THEMES.light], ['canvasDark', THEMES.dark]]) assert.deepEqual(theme(name), { bg: T.bg, fill: T.surface, line: T.ink }, `LINE_THEMES.${name} ↔ --bg · --surface · --ink`);
  const dim = stage.match(/DIM_COLOR = \{ light: '(#\w+)', dark: '(#\w+)' \}/);
  assert.ok(dim, 'DIM_COLOR 를 찾지 못했다');
  assert.deepEqual({ light: dim[1], dark: dim[2] }, { light: THEMES.light['mat-text'], dark: THEMES.dark['mat-text'] }, '치수선 ↔ --mat-text');
});
