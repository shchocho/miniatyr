// home.js — 홈: 스크롤에 맞춰 같은 가구 모델이 실물 → 분해도 → 삼면도 → 평면 → 미니어처로 바뀌는 3D 연출 + 컬렉션.
// 도면은 따로 그린 그림이 아니라 같은 모델의 다른 투영이라는 것을 보여 준다.

import { h, icon, store, thumb, no3, pips, esc } from './dom.js';
import { CATALOG, CATS, getItem, searchText } from '../data/catalog.js';
import { buildModel } from '../core/kit.js';
import { fmt } from '../core/scale.js';
import { cutList } from '../core/cutlist.js';
import { SEASONS } from '../data/seasons.js';

// 간판 가구: 편집 순번 1~6(책장·선반·암체어·테이블·수납·소파 한 점씩)
const FEATURED = ['billy', 'kallax', 'poang', 'lack-side', 'malm-dresser', 'klippan'];
// 장면별 연출값: 도면선 비율(split), 분해(explode), 카메라 방위·고도, 가구가 서는 쪽(side: 문구의 반대편, +1 오른쪽)
// 방 배경(첫 장)과 커팅 매트(끝 장), 치수선(삼면도·평면)은 진행률 구간으로 켜고 끈다(apply).
const KEYS = [
  { split: 0, explode: 0, theta: 35, phi: 68, side: 1 },     // 실물: 방에 놓인 가구
  { split: 0, explode: 1, theta: 48, phi: 66, side: -1 },    // 분해도: 부품과 기호
  { split: 1, explode: 0, theta: 0, phi: 88, side: 1 },      // 삼면도: 정면 + 치수선
  { split: 1, explode: 0, theta: 0, phi: 4, side: -1 },      // 평면: 위에서 본 모습
  { split: 0, explode: 0, theta: -32, phi: 70, side: 1 },    // 완성: 커팅 매트 위 실제 크기
];
const CHAPTERS = [
  { n: '01', k: '분해도', t: '부품으로 나누면 구조가 보입니다', d: '가구를 부품 단위로 풀고 A, B, C 기호를 붙입니다. 같은 기호가 부품표와 재단표, 조립 순서에 그대로 쓰입니다.' },
  { n: '02', k: '삼면도', t: '정면에서 보면 치수가 읽힙니다', d: '같은 3D 모델을 정면·평면·측면으로 비춰 삼면도를 그립니다. 치수선의 숫자는 모델에서 직접 잰 값이고, 도면 시트에서는 고른 축척의 mm로 바뀝니다.' },
  { n: '03', k: '재단', t: '위에서 보면 자를 판이 정해집니다', d: '재단표가 필요한 판재·각재·철사를 두께별로 묶어 줍니다. 1:1 템플릿을 인쇄해 재료에 붙이고 선을 따라 자르면 됩니다.' },
  { n: '04', k: '완성', t: '손바닥 위에 올립니다', d: '완성 모습은 커팅 매트와 15cm 자, 500원 동전 옆에서 실제 크기로 확인합니다. STL로 내보내 3D 프린트할 수도 있습니다.' },
];

const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => t * t * (3 - 2 * t);

export function homePage(root, ctx) {
  let stage = null, model = null, feat = FEATURED[0], disposed = false, raf = 0;
  const N = store.get('N');
  const page = h('div', { class: 'page' });

  // ───── 스토리
  const host = h('div', { class: 'shot__host' });
  const poster = h('img', { class: 'shot__poster', src: thumb(feat), alt: '' });
  const frame = h('div', { class: 'shot__frame' }, host, poster);
  const chips = h('div', { class: 'seg', role: 'group', 'aria-label': '보여 줄 가구' }, FEATURED.map((id) => {
    const it = getItem(id);
    return h('button', { type: 'button', 'aria-pressed': String(id === feat), onclick: () => setFeat(id) }, it.name.split(' ')[0]);
  }));
  // 계절 테마: 창밖 풍경과 방에 드는 빛, 쿠션·커튼 색이 함께 바뀐다(워크벤치의 룸 배경도 같은 계절을 쓴다)
  const seasons = h('div', { class: 'seg', role: 'group', 'aria-label': '계절 테마' }, Object.entries(SEASONS).map(([id, s]) =>
    h('button', { type: 'button', title: `창밖 풍경: ${s.view}`, 'aria-pressed': String(id === store.get('season')), onclick: () => {
      store.set('season', id);
      for (const b of seasons.children) b.setAttribute('aria-pressed', String(b.textContent === s.name));
      if (stage) stage.setSeason(id);
    } }, s.name)));
  const stageCol = h('div', { class: 'story__stage' }, frame, h('div', { class: 'shot__cap' }, seasons, chips, h('a', { class: 'btn btn--sm', href: `#item-${feat}`, id: 'hero-open' }, '이 가구 만들기')));
  const toCollection = (e) => { e.preventDefault(); document.getElementById('collection').scrollIntoView({ behavior: 'smooth' }); };

  const hero = h('article', { class: 'chapter chapter--hero', dataset: { ch: '0' } }, h('div', { class: 'copy' },
    h('h1', { html: '백 개의 가구를<br><em>손바닥 위에.</em>' }),
    h('p', { class: 'hero__lead' }, '도면을 뽑고, 재료를 자르고, 순서대로 붙이면 미니어처가 됩니다. 책장부터 소파까지 100가지 가구의 삼면도·재단표·조립 순서·3D 모델을 한곳에 담았습니다.'),
    h('div', { class: 'hero__cta' },
      h('a', { class: 'btn btn--lg btn--mat', href: '#collection', onclick: toCollection }, '컬렉션 보기'),
      h('a', { class: 'btn btn--lg', href: '#guide' }, '처음이라면: 만드는 법')),
    h('dl', { class: 'hero__facts' },
      h('div', {}, h('dt', {}, '100'), h('dd', {}, '가구')),
      h('div', {}, h('dt', {}, '138'), h('dd', {}, '크기·구성 변형')),
      h('div', {}, h('dt', {}, '1,824'), h('dd', {}, '부품')),
      h('div', {}, h('dt', {}, '1:6–1:48'), h('dd', {}, '다섯 가지 축척'))),
    h('p', { class: 'scrollcue' }, h('span', { html: icon('down') }), '스크롤하면 같은 가구가 도면으로 바뀝니다')));
  // 끝 장: 같은 모습을 실물과 도면으로 바꿔 본다
  let drawView = false;
  const viewSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '보기 방식' }, [['real', '실물'], ['draw', '도면']].map(([id, label]) =>
    h('button', { type: 'button', dataset: { v: id }, 'aria-pressed': String(id === 'real'), onclick: () => {
      drawView = id === 'draw'; KEYS[4].split = drawView ? 1 : 0;
      for (const b of viewSeg.children) b.setAttribute('aria-pressed', String(b.dataset.v === id));
      apply(true);
    } }, label)));
  const chapEls = [hero, ...CHAPTERS.map((c, i) => h('article', { class: `chapter${i % 2 === 0 ? ' chapter--right' : ''}`, dataset: { ch: String(i + 1) } }, h('div', { class: 'copy' },
    h('p', { class: 'overline' }, `${c.n} — ${c.k}`), h('h2', {}, c.t), h('p', {}, c.d),
    i === 3 ? viewSeg : null,
    i === 3 ? h('div', { class: 'hero__cta' }, h('a', { class: 'btn btn--mat', href: '#collection', onclick: (e) => { e.preventDefault(); setView('room'); document.getElementById('collection').scrollIntoView({ behavior: 'smooth' }); } }, '3D 쇼룸 둘러보기'), h('a', { class: 'btn', href: '#collection', onclick: toCollection }, '목록으로 고르기')) : null)))];
  const story = h('section', { class: 'story', 'aria-label': '실물에서 도면, 미니어처까지' }, stageCol, h('div', { class: 'story__text wrap' }, chapEls));

  // ───── 컬렉션
  const f = { cat: 'all', q: '', sort: 'no', view: 'grid' };
  const grid = h('div', { class: 'grid', id: 'grid' });
  const count = h('p', {});
  const cats = h('div', { class: 'seg', role: 'group', 'aria-label': '분류' }, CATS.map((c) => h('button', { type: 'button', 'aria-pressed': String(c.id === f.cat), onclick: (e) => { f.cat = c.id; press(cats, e.currentTarget); draw(); } }, c.ko)));
  const q = h('input', { type: 'search', id: 'q', placeholder: '이름으로 찾기 (예: 빌리, KALLAX)', 'aria-label': '가구 이름으로 찾기', oninput: (e) => { f.q = e.target.value.trim().toLowerCase(); draw(); } });
  const sort = h('select', { id: 'sort', 'aria-label': '정렬', onchange: (e) => { f.sort = e.target.value; draw(); } },
    h('option', { value: 'no' }, '순번순'), h('option', { value: 'name' }, '이름순'), h('option', { value: 'easy' }, '쉬운 것부터'), h('option', { value: 'small' }, '작은 것부터'), h('option', { value: 'big' }, '큰 것부터'));
  const viewBtn = (id, ic, label) => h('button', { type: 'button', class: 'seg__ic', dataset: { v: id }, 'aria-pressed': String(f.view === id), onclick: () => setView(id), html: `${icon(ic)}<span>${label}</span>` });
  const views = h('div', { class: 'seg', role: 'group', 'aria-label': '보기 방식' }, viewBtn('grid', 'grid', '격자'), viewBtn('lineup', 'bars', '크기 비교'), viewBtn('room', 'cube', '3D 쇼룸'));
  function setView(id) { f.view = id; for (const b of views.children) b.setAttribute('aria-pressed', String(b.dataset.v === id)); draw(); }
  const coll = h('section', { class: 'sec wrap', id: 'collection' },
    h('div', { class: 'sec__head' }, h('div', {}, h('h2', {}, '컬렉션'), count), views),
    h('div', { class: 'filters' }, cats, h('label', { class: 'field' }, h('span', { html: icon('search') }), q), h('label', { class: 'field', style: { flex: '0 0 auto', maxWidth: '170px' } }, sort)),
    grid);
  page.append(story, coll);
  root.append(page);

  function press(group, btn) { for (const b of group.children) b.setAttribute('aria-pressed', String(b === btn)); }

  let manifest = null;
  function card(it) {
    const [w, d, hh] = it.dims;
    return h('a', { class: 'card', href: `#item-${it.id}`, 'aria-label': `${it.name} ${it.type}, 난이도 ${it.diff}/5` },
      h('div', { class: 'card__face' },
        h('div', { class: 'card__pic' }, h('img', { src: thumb(it.id), alt: '', loading: 'lazy', decoding: 'async', width: 720, height: 720 }),
          h('span', { class: 'card__no' }, `No.${no3(it.no)}`)),
        h('div', { class: 'card__body' },
          h('h3', { class: 'card__name' }, it.name), h('span', { class: 'card__diff', html: pips(it.diff) }),
          h('p', { class: 'card__type' }, `${it.ko} ${it.type}`),
          h('p', { class: 'card__dims' }, `${fmt(w / N, 1)} × ${fmt(d / N, 1)} × ${fmt(hh / N, 1)} mm · 1:${N}`))));
  }
  // ───── 3D 쇼룸: 룸 세트 사이를 돌아다니며 고른다. 필터는 방을 다시 짓지 않고 핀으로 표시한다.
  let room = null, roomUI = null, roomMatch = null, roomKey = '';
  function openRoom() {
    const host = h('div', { class: 'room__host' });
    const prog = h('div', { class: 'hud hud--tl', role: 'status' }, h('span', { class: 'mono' }, '방 짓는 중…'));
    const found = h('div', { class: 'hud hud--c', hidden: true });
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const hint = h('div', { class: 'hud hud--bl' }, touch ? '끌어서 이동 · 두 손가락으로 확대·회전 · 가구를 한 번 눌러 고르고, 다시 누르면 열립니다' : '끌어서 이동 · 휠로 확대 · Shift+끌기로 회전 · 가구를 누르면 열립니다 · 방 이름표를 누르면 그 방으로');
    const cardName = h('b', {}), cardType = h('span', {}), cardDims = h('span', { class: 'mono' }), cardGo = h('a', { class: 'btn btn--sm btn--mat', href: '#home' }, '워크벤치 열기');
    const cardEl = h('div', { class: 'room__card', hidden: true }, h('div', {}, cardName, cardType, cardDims), cardGo);
    const tools = h('div', { class: 'viewer__tools viewer__tools--tr' },
      h('button', { type: 'button', class: 'btn btn--sm', onclick: () => room && room.reset() }, '처음 위치'),
      h('button', { type: 'button', class: 'btn btn--sm btn--icon', 'aria-label': '전체 화면', title: '전체 화면', html: icon('expand'), onclick: () => { (document.fullscreenElement ? document.exitFullscreen() : grid.requestFullscreen && grid.requestFullscreen())?.catch?.(() => {}); } }));
    grid.append(host, prog, found, hint, cardEl, tools);
    roomUI = { found };
    import('../three/showroom.js').then(({ Showroom }) => import('../three/stage.js').then(({ webglSupported }) => {
      if (disposed || f.view !== 'room' || !host.isConnected) return;
      if (!webglSupported()) { roomUI = null; grid.replaceChildren(h('p', { class: 'empty' }, '이 기기에서는 3D 쇼룸을 쓸 수 없습니다. 격자 보기를 이용해 주세요.')); return; }
      room = new Showroom(host, {
        dark: ctx.isDark(), lowPower: ctx.lowPower, match: roomMatch,
        onOpen: (it) => { location.hash = `#item-${it.id}`; },
        onProgress: (a, b) => { prog.firstChild.textContent = a >= b ? `방 16개 · 가구 ${b}개` : `가구 놓는 중 ${a}/${b}`; },
        onFocus: (it, roomName) => {
          cardEl.hidden = !it; if (!it) return;
          cardName.textContent = it.name; cardType.textContent = `${it.ko} ${it.type} · ${roomName}`;
          cardDims.textContent = `${fmt(it.dims[0] / N, 1)} × ${fmt(it.dims[1] / N, 1)} × ${fmt(it.dims[2] / N, 1)} mm · 1:${N}`;
          cardGo.setAttribute('href', `#item-${it.id}`);
        },
      });
      room.onFrame = (r) => { const a = r.anchor(); if (a) cardEl.style.transform = `translate(-50%, -100%) translate(${a.x}px, ${a.y}px)`; else if (!cardEl.hidden && r.hover < 0 && r.focus < 0) cardEl.hidden = true; };
    })).catch(() => { roomUI = null; grid.replaceChildren(h('p', { class: 'empty' }, '3D 쇼룸을 불러오지 못했습니다. 격자 보기를 이용해 주세요.')); });
  }
  function closeRoom() { if (room) { room.dispose(); room = null; } roomUI = null; roomKey = ''; }
  function draw() {
    let list = CATALOG.filter((it) => (f.cat === 'all' || it.cat === f.cat) && (!f.q || searchText(it).includes(f.q)));
    const vol = (it) => it.dims[0] * it.dims[1] * it.dims[2];
    if (f.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (f.sort === 'easy') list = [...list].sort((a, b) => a.diff - b.diff || a.no - b.no);
    else if (f.sort === 'small') list = [...list].sort((a, b) => vol(a) - vol(b));
    else if (f.sort === 'big') list = [...list].sort((a, b) => vol(b) - vol(a));
    count.textContent = `${list.length}개 · 순번은 편집 큐레이션이며 판매 순위가 아닙니다`;
    if (f.view === 'room') {
      // 쇼룸은 늘 100개가 제자리에 있고, 필터에 맞는 가구에만 노란 핀을 꽂는다
      roomMatch = list.length === CATALOG.length ? null : new Set(list.map((it) => it.id));
      if (!roomUI) { grid.className = 'room'; grid.replaceChildren(); openRoom(); }
      const key = roomMatch ? [...roomMatch].sort().join(',') : '';
      if (room && key !== roomKey) room.setMatch(roomMatch);
      roomKey = key;
      if (roomUI) { roomUI.found.hidden = !roomMatch; roomUI.found.textContent = roomMatch ? (list.length ? `${list.length}개 찾음 · 노란 핀이 꽂힌 가구입니다` : '조건에 맞는 가구가 없습니다') : ''; }
      return;
    }
    closeRoom();
    grid.className = f.view === 'grid' ? 'grid' : 'lineup';
    grid.replaceChildren();
    if (!list.length) { grid.append(h('p', { class: 'empty' }, '조건에 맞는 가구가 없습니다. 분류를 "전체"로 바꾸거나 다른 이름으로 찾아보세요.')); return; }
    if (f.view === 'grid') { grid.append(...list.map(card)); return; }
    // 실물 크기 비교: 모든 가구를 같은 축척으로 한 줄에 세운다
    const ppm = 320 / 2400, row = h('div', { class: 'lineup__row' });
    const sorted = [...list].sort((a, b) => a.dims[2] - b.dims[2]);
    for (const it of sorted) {
      const m = manifest && manifest[it.id];
      const size = m ? (720 * ppm) / m.k : (it.dims[2] * ppm) / 0.8;
      const drop = m ? (1 - m.base) * size : size * 0.12;
      row.append(h('a', { class: 'lineup__item', href: `#item-${it.id}`, title: `${it.name} ${it.type}` },
        h('img', { src: thumb(it.id), alt: `${it.name} ${it.type}`, loading: 'lazy', style: { width: `${size}px`, height: `${size}px`, marginBottom: `${-drop}px` } }),
        h('span', { html: `${esc(it.name)}<br>${fmt(it.dims[2] / 10, 0)}cm` })));
    }
    grid.append(row, h('div', { class: 'lineup__pad' }));
  }
  draw();
  fetch('assets/thumbs/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { manifest = m; if (f.view === 'lineup') draw(); }).catch(() => {});

  // ───── 3D 스테이지
  function setFeat(id) {
    feat = id;
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.textContent === getItem(id).name.split(' ')[0]));
    document.getElementById('hero-open').setAttribute('href', `#item-${id}`);
    poster.src = thumb(id);
    load();
  }
  const on = { scene: null, mini: null, dims: null };      // 지금 장면에 켜져 있는 것(구간이 바뀔 때만 다시 건다)
  function load() {
    const it = getItem(feat);
    model = buildModel(it, { N });
    if (stage) { stage.setModel(model, it.finishes[0]); on.scene = on.mini = on.dims = null; calls(); apply(true); }
  }
  const wide = () => window.innerWidth > 1040;
  function calls() {
    const rows = cutList(model).rows.filter((r) => !r.opt).slice(0, 7);
    stage.setCallouts(rows.map((r) => ({ id: r.parts[0], text: r.label, name: r.name })));
  }
  let prog = 0;
  function measure() {
    const mid = window.innerHeight * 0.5;
    const cs = chapEls.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
    let i = 0;
    while (i < cs.length - 2 && mid > cs[i + 1]) i++;
    const t = Math.max(0, Math.min(1, (mid - cs[i]) / Math.max(1, cs[i + 1] - cs[i])));
    return i + t;
  }
  function apply(force) {
    const p = measure();
    if (!force && Math.abs(p - prog) < 0.002) return;
    prog = p;
    const i = Math.min(KEYS.length - 2, Math.floor(p)), t = sm(Math.min(1, p - i)), a = KEYS[i], b = KEYS[i + 1];
    if (!stage) return;
    // 방은 첫 장에 서 있다가, 분해가 시작되면 벽과 소품이 바닥 아래로 천천히 내려간다(거꾸로 올리면 다시 선다).
    // 벽이 다 내려간 뒤 부품이 흩어지는 동안 바닥을 스튜디오로 바꾸고, 커팅 매트는 도면선이 화면을 다 덮은 구간에서 놓는다.
    const mini = p > 3.02, scene = !mini && p < 0.5 ? 'room' : 'studio', dims = p > 1.55 && p < 3.45;
    if (mini !== on.mini) { stage.setMini(mini, N); on.mini = mini; }
    if (scene !== on.scene) { stage.setScene(scene); on.scene = scene; }
    stage.setRoomSink(sm(Math.max(0, Math.min(1, (p - 0.04) / 0.4))));
    if (dims !== on.dims) { stage.setDims(dims); on.dims = dims; }
    stage.setSplit(lerp(a.split, b.split, t));
    stage.setExplode(lerp(a.explode, b.explode, t), false);
    stage.goal.theta = (lerp(a.theta, b.theta, t) * Math.PI) / 180;
    stage.goal.phi = (lerp(a.phi, b.phi, t) * Math.PI) / 180;
    // 가구는 문구의 반대편에 선다. 좁은 화면에서는 문구가 아래에 있으니 위로 올린다.
    stage.viewShift = wide() ? [0.19 * lerp(a.side, b.side, t), 0] : [0, -0.2];
    stage.fitScale = wide() ? 1.3 : 2;      // 좁은 화면은 문구 위에 남는 높이에 가구가 다 들어오게 물러선다
    stage.fit(false, true);
  }
  const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(false)); };
  const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => apply(true)); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  load();

  import('../three/stage.js').then(({ Stage, webglSupported }) => {
    if (disposed || !webglSupported()) return;
    stage = new Stage(host, { maxDpr: ctx.lowPower ? 1.25 : 2, samples: ctx.lowPower ? 40 : 72, daylight: true, season: store.get('season') });
    stage.canvas.setAttribute('aria-label', '가구 3D 미리보기. 페이지를 스크롤하면 실물, 분해도, 삼면도, 평면, 완성된 미니어처 순서로 바뀝니다.');
    stage.setTheme({ dark: ctx.isDark() });
    stage.setLineTheme(ctx.isDark() ? 'canvasDark' : 'canvas');
    stage.N = N;
    stage.setModel(model, getItem(feat).finishes[0]);
    calls();
    apply(true);
    requestAnimationFrame(() => { poster.style.opacity = '0'; });
    ctx.onTheme = () => { if (stage) { stage.setTheme({ dark: ctx.isDark() }); stage.setLineTheme(ctx.isDark() ? 'canvasDark' : 'canvas'); } if (room) room.setTheme(ctx.isDark()); };
  }).catch(() => {});

  return () => {
    disposed = true; ctx.onTheme = null;
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
    cancelAnimationFrame(raf);
    closeRoom();
    if (stage) stage.dispose();
  };
}
