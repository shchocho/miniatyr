// Miniatyr — surface textures drawn in code: wood grain, woven cloth, plaster, plywood edges, floor boards.
// Each returns a colour map and a matching bump map. Meshes are mapped by real size (furniture.js, projectUV),
// so one texture tile always covers the same length of material whatever the part.
import * as THREE from 'three';

const rng = (seed) => { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const board = (size, h = size) => { const c = document.createElement('canvas'); c.width = size; c.height = h; return [c, c.getContext('2d')]; };
function asTexture(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const pair = (colour, bump) => ({ map: asTexture(colour, true), bumpMap: asTexture(bump, false) });

// grain lines that wrap in both directions, drawn the same on the colour and the bump canvas
function grain(g, b, size, rand, { lines, dark, alpha, width, wobble }) {
  for (let i = 0; i < lines; i++) {
    const y0 = rand() * size, amp = wobble * (0.3 + rand()), k = 1 + Math.floor(rand() * 3), ph = rand() * 6.283;
    const a = alpha * (0.35 + rand() * 0.65), w = width * (0.5 + rand());
    [-size, 0, size].forEach((off) => {
      [[g, `rgba(${dark}, ${a.toFixed(3)})`], [b, `rgba(0, 0, 0, ${(a * 1.6).toFixed(3)})`]].forEach(([ctx, style]) => {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
        for (let x = 0; x <= size; x += 16) {
          const y = y0 + off + Math.sin((x / size) * 6.283 * k + ph) * amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    });
  }
}

// one tile: 1.0 m along the grain (u), 0.5 m across it (v)
export function wood({ base, dark, seed, lines = 150, alpha = 0.2 }) {
  const size = 1024, [c, g] = board(size), [bc, b] = board(size), rand = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  b.fillStyle = '#b4b4b4'; b.fillRect(0, 0, size, size);
  // slow tone drift across the board, then the grain itself
  for (let i = 0; i < 14; i++) {
    const y = rand() * size, h = 30 + rand() * 120;
    g.fillStyle = `rgba(${dark}, ${(0.03 + rand() * 0.06).toFixed(3)})`;
    [-size, 0, size].forEach((off) => g.fillRect(0, y + off, size, h));
  }
  grain(g, b, size, rand, { lines, dark, alpha, width: 1.6, wobble: 9 });
  grain(g, b, size, rand, { lines: Math.round(lines / 6), dark, alpha: alpha * 1.5, width: 3.2, wobble: 14 });
  return pair(c, bc);
}

// a plain weave: one tile is 0.16 m of cloth
export function weave({ base, seed, contrast = 0.1, thread = 4 }) {
  const size = 256, [c, g] = board(size), [bc, b] = board(size), rand = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += thread) for (let x = 0; x < size; x += thread) {
    const over = ((x / thread) + (y / thread)) % 2 === 0, n = rand();
    g.fillStyle = over ? `rgba(255, 255, 255, ${(contrast * n).toFixed(3)})` : `rgba(0, 0, 0, ${(contrast * n).toFixed(3)})`;
    g.fillRect(x, y, thread, thread);
    const v = Math.round(over ? 150 + n * 70 : 60 + n * 50);
    b.fillStyle = `rgb(${v}, ${v}, ${v})`;
    b.fillRect(x, y, thread, thread);
  }
  return pair(c, bc);
}

// looped wool (boucle): small round tufts; one tile is 0.2 m
export function boucle({ base, seed }) {
  const size = 512, [c, g] = board(size), [bc, b] = board(size), rand = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  b.fillStyle = '#5a5a5a'; b.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const x = rand() * size, y = rand() * size, r = 3 + rand() * 5, n = rand();
    [-size, 0, size].forEach((ox) => [-size, 0, size].forEach((oy) => {
      if (x + ox < -r || x + ox > size + r || y + oy < -r || y + oy > size + r) return;
      g.fillStyle = n > 0.5 ? `rgba(255, 255, 255, ${(0.05 + n * 0.06).toFixed(3)})` : `rgba(60, 50, 35, ${(0.04 + n * 0.08).toFixed(3)})`;
      g.beginPath(); g.arc(x + ox, y + oy, r, 0, 6.283); g.fill();
      const grd = b.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.55)'); grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
      b.fillStyle = grd; b.beginPath(); b.arc(x + ox, y + oy, r, 0, 6.283); b.fill();
    }));
  }
  return pair(c, bc);
}

// painted plaster: almost flat, with a fine roller stipple; one tile is 1.2 m
export function plaster({ base, seed }) {
  const size = 512, [c, g] = board(size), [bc, b] = board(size), rand = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  // slow, faint mottling, as a rolled wall has: it wraps, so the tile repeats without a seam
  for (let i = 0; i < 26; i++) {
    const x = rand() * size, y = rand() * size, r = 70 + rand() * 130, light = rand() > 0.5;
    [-size, 0, size].forEach((ox) => [-size, 0, size].forEach((oy) => {
      if (x + ox < -r || x + ox > size + r || y + oy < -r || y + oy > size + r) return;
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, light ? 'rgba(255, 252, 244, 0.026)' : 'rgba(96, 84, 66, 0.022)'); grd.addColorStop(1, light ? 'rgba(255, 252, 244, 0)' : 'rgba(96, 84, 66, 0)');
      g.fillStyle = grd; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }));
  }
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size, y = rand() * size, r = 0.6 + rand() * 1.8, n = rand();
    g.fillStyle = n > 0.5 ? 'rgba(255, 255, 255, 0.018)' : 'rgba(70, 60, 45, 0.014)';
    g.fillRect(x, y, r * 2, r * 2);
    const v = Math.round(100 + n * 60);
    b.fillStyle = `rgba(${v}, ${v}, ${v}, 0.5)`;
    b.fillRect(x, y, r * 2, r * 2);
  }
  return pair(c, bc);
}

// a flat-woven rug: ribs across the short side and a slightly uneven yarn; one tile is 0.5 m
export function rugWeave({ base, seed }) {
  const size = 512, [c, g] = board(size), [bc, b] = board(size), rand = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  b.fillStyle = '#707070'; b.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 6) {
    const n = rand();
    g.fillStyle = `rgba(${n > 0.5 ? '255, 255, 255' : '70, 55, 35'}, ${(0.04 + n * 0.07).toFixed(3)})`;
    g.fillRect(0, y, size, 3);
    b.fillStyle = '#c8c8c8'; b.fillRect(0, y, size, 3);
    for (let x = 0; x < size; x += 5) if (rand() > 0.6) { b.fillStyle = 'rgba(0, 0, 0, 0.25)'; b.fillRect(x, y, 2, 3); }
  }
  return pair(c, bc);
}

// the cut edge of plywood: thin plies, alternately light and dark, stacked across the thickness (v)
export function plyEdge() {
  const [c, g] = board(256, 64), [bc, b] = board(256, 64), rand = rng(11);
  const plies = ['#d9c39c', '#b9976a', '#dcc7a2', '#b38f60', '#d6bf97', '#b9976a', '#dcc7a2'];
  plies.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (i * 64) / plies.length, 256, 64 / plies.length + 1); });
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60, 40, 20, ${(rand() * 0.12).toFixed(3)})`; g.fillRect(rand() * 256, rand() * 64, 1 + rand() * 10, 1); }
  b.fillStyle = '#909090'; b.fillRect(0, 0, 256, 64);
  plies.forEach((_, i) => { b.fillStyle = 'rgba(0, 0, 0, 0.35)'; b.fillRect(0, (i * 64) / plies.length, 256, 1); });
  return pair(c, bc);
}

// floor boards over the whole 3.6 m by 3.0 m floor (mapped 0 to 1 across it): twelve 300 mm boards with butt joints
export function floorBoards() {
  const size = 2048, [c, g] = board(size), [bc, b] = board(size), [rc, r] = board(size), rand = rng(7);
  const tones = ['#a07a50', '#98724a', '#a68055', '#926c44', '#9c764d', '#aa845a'];
  const plank = size / 12;
  b.fillStyle = '#c0c0c0'; b.fillRect(0, 0, size, size);
  for (let i = 0; i < 12; i++) {
    let y = -rand() * 700;
    while (y < size) {
      const len = 620 + rand() * 760;
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.fillRect(i * plank, y, plank, len);
      const matt = Math.round(84 + rand() * 46);            // each board took the oil a little differently
      r.fillStyle = `rgb(${matt}, ${matt}, ${matt})`; r.fillRect(i * plank, y, plank, len);
      // each board's own grain, running along its length
      for (let k = 0; k < 26; k++) {
        const x = i * plank + rand() * plank, a = 0.05 + rand() * 0.14, w = 0.8 + rand() * 1.8, sway = (rand() - 0.5) * 10;
        g.strokeStyle = `rgba(74, 48, 24, ${a.toFixed(3)})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + sway, y + len * 0.3, x - sway, y + len * 0.7, x + sway * 0.4, y + len); g.stroke();
        b.strokeStyle = `rgba(0, 0, 0, ${(a * 0.9).toFixed(3)})`; b.lineWidth = w;
        b.beginPath(); b.moveTo(x, y); b.lineTo(x + sway * 0.4, y + len); b.stroke();
      }
      g.fillStyle = 'rgba(52, 34, 18, 0.55)'; g.fillRect(i * plank, y + len - 2, plank, 2.5);
      r.fillStyle = '#e0e0e0'; r.fillRect(i * plank, y + len - 3, plank, 4);
      b.fillStyle = '#303030'; b.fillRect(i * plank, y + len - 3, plank, 4);
      y += len;
    }
    g.fillStyle = 'rgba(52, 34, 18, 0.6)'; g.fillRect(i * plank - 1, 0, 2.5, size);
    r.fillStyle = '#e0e0e0'; r.fillRect(i * plank - 2, 0, 4, size);
    b.fillStyle = '#303030'; b.fillRect(i * plank - 2, 0, 4, size);
  }
  // wear: long, faint scuffs along the boards where the room is walked
  for (let i = 0; i < 520; i++) {
    const x = rand() * size, y = rand() * size, len = 30 + rand() * 180, v = rand() > 0.5 ? 255 : 0;
    r.fillStyle = `rgba(${v}, ${v}, ${v}, ${(0.03 + rand() * 0.07).toFixed(3)})`; r.fillRect(x, y, 1 + rand() * 5, len);
  }
  const out = pair(c, bc);
  out.roughnessMap = asTexture(rc, false);
  out.roughnessMap.wrapS = out.roughnessMap.wrapT = THREE.ClampToEdgeWrapping; out.roughnessMap.anisotropy = 16;
  out.map.wrapS = out.map.wrapT = out.bumpMap.wrapS = out.bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  out.map.anisotropy = out.bumpMap.anisotropy = 16;
  return out;
}

// soft shade where two surfaces meet (v runs from the open side, 0, to the join, 1) and under things that stand on the floor
export function shadeStrip() {
  const [c, g] = board(8, 128), grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(24, 18, 12, 0)'); grd.addColorStop(0.55, 'rgba(24, 18, 12, 0.1)'); grd.addColorStop(1, 'rgba(24, 18, 12, 0.42)');
  g.fillStyle = grd; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function shadeBlob() {
  const [c, g] = board(128), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(24, 18, 12, 0.5)'); grd.addColorStop(0.5, 'rgba(24, 18, 12, 0.2)'); grd.addColorStop(1, 'rgba(24, 18, 12, 0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// what the window does to the light: a dim, cool level everywhere and warm sun through the panes.
// The texture covers a square of 2 * reach metres across the beam; the window is given in metres from its middle.
export function windowLight({ reach, x, y, w, h, cols, rows, bar }) {
  const size = 2048, [c, g] = board(size), k = size / (2 * reach), mid = size / 2;
  g.fillStyle = 'rgb(96, 102, 114)'; g.fillRect(0, 0, size, size);
  const pw = (w - bar * (cols - 1)) / cols, ph = (h - bar * (rows - 1)) / rows;
  g.filter = 'blur(4px)';                                 // the sun is not a point: the edges of the patch are soft
  g.fillStyle = 'rgb(255, 240, 218)';
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = x - w / 2 + i * (pw + bar), py = y - h / 2 + j * (ph + bar);
    g.fillRect(mid + px * k, mid - (py + ph) * k, pw * k, ph * k);
  }
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// a snake plant's leaf: dark cross-bands on green and a pale margin (u across the leaf, v along it)
export function leafBands() {
  const [c, g] = board(64, 512), rand = rng(29);
  g.fillStyle = '#4f6846'; g.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 5 + rand() * 12) {
    g.fillStyle = `rgba(28, 46, 30, ${(0.25 + rand() * 0.4).toFixed(3)})`;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + (rand() - 0.5) * 14, 44, y + (rand() - 0.5) * 14, 64, y + (rand() - 0.5) * 6);
    const hh = 2 + rand() * 7; g.lineTo(64, y + hh); g.bezierCurveTo(44, y + hh + (rand() - 0.5) * 10, 20, y + hh + (rand() - 0.5) * 10, 0, y + hh); g.fill();
  }
  const edge = g.createLinearGradient(0, 0, 64, 0);
  edge.addColorStop(0, 'rgba(196, 190, 120, 0.95)'); edge.addColorStop(0.09, 'rgba(196, 190, 120, 0)');
  edge.addColorStop(0.91, 'rgba(196, 190, 120, 0)'); edge.addColorStop(1, 'rgba(196, 190, 120, 0.95)');
  g.fillStyle = edge; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
