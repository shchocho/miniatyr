// Miniatyr — furniture and room, built in code (no external 3D files).
// One scene unit is one metre of the full-size piece; the miniature is that length divided by 12.
// The outer sizes below are the single source for the geometry and for the figures printed in the page.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wood, weave, boucle, plaster, rugWeave, plyEdge, floorBoards, shadeStrip, shadeBlob, leafBands } from './textures.js';

export const SCALE = 12;
export const SIZES = {
  room:      { w: 3.60, d: 3.00, h: 2.40 },
  chair:     { w: 0.72, d: 0.78, h: 0.78 },
  sofa:      { w: 1.68, d: 0.84, h: 0.78 },
  table:     { w: 0.84, d: 0.84, h: 0.36 },
  lamp:      { w: 0.36, d: 0.36, h: 1.56 },
  sideboard: { w: 1.32, d: 0.42, h: 0.66 },
};
export const mm = (metres) => Math.round((metres / SCALE) * 1000);

/* ---------- materials: every textured one carries the real size of one texture tile (userData.tile, metres) ---------- */
export function makeMaterials() {
  const tiled = (mat, tu, tv = tu) => { mat.userData.tile = [tu, tv]; return mat; };
  const cloth = (tex, tile, extra = {}) => tiled(new THREE.MeshPhysicalMaterial({ color: '#ffffff', ...tex, bumpScale: 1.6, roughness: 0.97, sheen: 0.8, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff'), ...extra }), tile);
  const oak = wood({ base: '#b88c5c', dark: '82, 52, 24', seed: 3 });
  const walnut = wood({ base: '#5e4431', dark: '28, 16, 8', seed: 9, alpha: 0.28 });
  const birch = wood({ base: '#dcc9a6', dark: '150, 112, 66', seed: 17, lines: 90, alpha: 0.14 });
  const woolCloth = weave({ base: '#57534d', seed: 51, contrast: 0.12, thread: 8 });
  return {
    plaster: tiled(new THREE.MeshStandardMaterial({ color: '#ffffff', ...plaster({ base: '#d9d4c8', seed: 5 }), bumpScale: 0.12, roughness: 0.95 }), 1.2),
    birch: tiled(new THREE.MeshStandardMaterial({ color: '#ffffff', ...birch, bumpScale: 0.6, roughness: 0.7 }), 1.2, 0.6),
    plyEdge: tiled(new THREE.MeshStandardMaterial({ color: '#ffffff', ...plyEdge(), bumpScale: 0.8, roughness: 0.8 }), 0.4, 0.08),
    floor: new THREE.MeshStandardMaterial({ color: '#ffffff', ...floorBoards(), bumpScale: 1.2, roughness: 1 }),   // how matt it is comes from the boards themselves (roughnessMap)
    wood: tiled(new THREE.MeshPhysicalMaterial({ color: '#ffffff', ...oak, bumpScale: 0.7, roughness: 0.46, clearcoat: 0.25, clearcoatRoughness: 0.5 }), 1.0, 0.5),
    woodDark: tiled(new THREE.MeshPhysicalMaterial({ color: '#ffffff', ...walnut, bumpScale: 0.7, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.45 }), 1.0, 0.5),
    skirting: new THREE.MeshStandardMaterial({ color: '#efece5', roughness: 0.55 }),
    steel: new THREE.MeshStandardMaterial({ color: '#1f1e1c', roughness: 0.38, metalness: 0.8 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.28, metalness: 1 }),
    fabric: cloth(boucle({ base: '#d3ccbd', seed: 21 }), 0.2, { bumpScale: 2.4 }),
    fabricAccent: cloth(weave({ base: '#2f5d46', seed: 31 }), 0.16, { sheenColor: new THREE.Color('#9fc7ae') }),   // the one accent in the scene: the lounge chair's cushions
    linen: cloth(weave({ base: '#b9a98c', seed: 41, contrast: 0.14 }), 0.14),
    wool: cloth(woolCloth, 0.2, { bumpScale: 2.2, side: THREE.DoubleSide }),      // the throw is a single draped sheet, seen from both sides
    rug: cloth(rugWeave({ base: '#c4bcab', seed: 61 }), 0.5, { bumpScale: 2.0 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#f2efe8', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    stoneware: new THREE.MeshStandardMaterial({ color: '#b3aa9b', roughness: 0.85 }),
    soil: new THREE.MeshStandardMaterial({ color: '#2b241d', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', map: leafBands(), roughness: 0.5, side: THREE.DoubleSide }),
    twig: new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 0.85 }),
    pages: new THREE.MeshStandardMaterial({ color: '#ece6d6', roughness: 0.95 }),
    coverInk: new THREE.MeshStandardMaterial({ color: '#2f2d2b', roughness: 0.6 }),
    coverClay: new THREE.MeshStandardMaterial({ color: '#8d6a55', roughness: 0.7 }),
    coverSand: new THREE.MeshStandardMaterial({ color: '#cfc4ad', roughness: 0.75 }),
    coffee: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.15 }),
    paper: new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.9 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.45 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#161514', roughness: 0.7 }),
    shade: new THREE.MeshStandardMaterial({ color: '#f1ead9', roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffd9a0', emissiveIntensity: 0.3 }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffe6bd' }),
    ruler: new THREE.MeshStandardMaterial({ color: '#cfcdc6', roughness: 0.4, metalness: 0.55 }),
    pencil: new THREE.MeshStandardMaterial({ color: '#c79a3c', roughness: 0.38 }),   // a plain ochre pencil: it reads on the light and the dark ground
    graphite: new THREE.MeshStandardMaterial({ color: '#3a3936', roughness: 0.4, metalness: 0.3 }),
    // soft shade drawn where surfaces meet and under what stands on the floor (in place of real-time ambient occlusion)
    shadeStrip: new THREE.MeshBasicMaterial({ map: shadeStrip(), transparent: true, depthWrite: false }),
    shadeBlob: new THREE.MeshBasicMaterial({ map: shadeBlob(), transparent: true, depthWrite: false }),
  };
}

/* ---------- helpers ---------- */
// map a part by its real size: each face is projected flat, u along the given axis where the face has it (the grain),
// or v along the given axis (the thickness of a plywood edge)
function projectUV(geo, mat, opts) {
  const tile = mat && mat.userData && mat.userData.tile; if (!tile) return geo;
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)], N = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
    const m = N[0] >= N[1] && N[0] >= N[2] ? 0 : N[1] >= N[2] ? 1 : 2;
    let [a, b] = [0, 1, 2].filter((k) => k !== m);
    if (opts.u === b || opts.v === a) [a, b] = [b, a];
    uv[i * 2] = P[a] / tile[0]; uv[i * 2 + 1] = P[b] / tile[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const longest = (w, h, d) => (w >= h && w >= d ? 0 : h >= d ? 1 : 2);
const shadowed = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
const box = (w, h, d, r, mat, opts) => shadowed(new THREE.Mesh(projectUV(r > 0 ? new RoundedBoxGeometry(w, h, d, r >= 0.045 ? 4 : 2, r) : new THREE.BoxGeometry(w, h, d), mat, opts || { u: longest(w, h, d) }), mat));
const cyl = (rTop, rBottom, h, mat, seg = 32, opts) => shadowed(new THREE.Mesh(projectUV(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat, opts || { u: h < rTop * 1.2 ? 0 : 1 }), mat));
const lathe = (points, mat, seg = 56) => shadowed(new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat));
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };
const flat = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);    // a shade plane: receives and casts nothing
// a surface skin laid over a plywood core: a plane, mapped by size
const skin = (w, h, mat) => { const m = new THREE.Mesh(projectUV(new THREE.PlaneGeometry(w, h), mat, {}), mat); m.receiveShadow = true; return m; };

// normals smoothed across vertices that share a place (a box is six separate faces)
function smoothNormals(geo) {
  const p = geo.attributes.position, idx = geo.index, sums = new Map();
  const keys = Array.from({ length: p.count }, (_, i) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < idx.count; f += 3) {
    const tri = [idx.getX(f), idx.getX(f + 1), idx.getX(f + 2)];
    a.fromBufferAttribute(p, tri[0]); b.fromBufferAttribute(p, tri[1]); c.fromBufferAttribute(p, tri[2]);
    c.sub(b).cross(a.sub(b));                                              // weighted by the triangle's area
    tri.forEach((v) => { if (!sums.has(keys[v])) sums.set(keys[v], new THREE.Vector3()); sums.get(keys[v]).add(c); });
  }
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { a.copy(sums.get(keys[i])).normalize(); n.setXYZ(i, a.x, a.y, a.z); }
  return geo;
}

// An upholstered form: a rounded box crowned on its two broad faces, drawn in at its corners and a little uneven,
// as filled cloth is, with a welt sewn round its middle. The broad faces are the ones across its thinnest side.
//   puff: how far the middle of a broad face rises · under: the share of that on the face it rests on
//   pinch: how much thinner it is at the corners · wrinkle: unevenness · welt: radius of the piping (0 for none)
function cushion(w, h, d, r, mat, { puff = 0.02, under = 1, pinch = 0.15, wrinkle = 0.003, welt = 0.0052, seed = 1, n = 12, k = 3 } = {}) {
  const half = [w / 2, h / 2, d / 2], T = half.indexOf(Math.min(...half)), [A, B] = [0, 1, 2].filter((i) => i !== T), side = puff * 0.4;
  r = Math.min(r, half[T]);
  const m = n / 2 - k;
  // the grid is denser where the corners turn
  const place = (u, hf) => { const i = Math.round(Math.abs(u) * n); return Math.sign(u) * (i <= m ? (i / m) * (hf - r) : hf - r + ((i - m) / k) * r); };
  const shape = (P) => {
    const a = P[A] / half[A], b = P[B] / half[B], t = P[T] / half[T];
    const lift = t * (t < 0 ? under : 1) * (puff * (1 - a * a) * (1 - b * b) + wrinkle * (Math.sin(P[A] * 23 + seed) * Math.sin(P[B] * 19 + seed * 1.7) + 0.6 * Math.sin(P[A] * 41 - P[B] * 37 + seed * 2.3)));
    P[T] = (P[T] + lift) * (1 - pinch * a * a * b * b);
    P[A] += a * a * a * side * (1 - b * b); P[B] += b * b * b * side * (1 - a * a);
    return P;
  };
  const geo = new THREE.BoxGeometry(1, 1, 1, n, n, n), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const P = [place(p.getX(i), half[0]), place(p.getY(i), half[1]), place(p.getZ(i), half[2])];
    const q = P.map((v, j) => Math.min(half[j] - r, Math.max(-(half[j] - r), v))), dv = P.map((v, j) => v - q[j]), len = Math.hypot(...dv) || 1;
    shape(q.map((v, j) => v + (dv[j] / len) * r)).forEach((v, j) => p.setComponent(i, j, v));
  }
  const mesh = shadowed(new THREE.Mesh(projectUV(smoothNormals(geo), mat, { u: longest(w, h, d) }), mat));
  if (welt > 0) {
    // the welt follows the outline at mid-thickness, through the same shaping as the cushion
    const pts = [], ha = half[A], hb = half[B];
    const push = (a, b) => { const P = [0, 0, 0]; P[A] = a; P[B] = b; pts.push(new THREE.Vector3(...shape(P))); };
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sa, sb], c) => {
      for (let j = 0; j <= 6; j++) { const ang = (c + j / 6) * Math.PI / 2; push(sa * (ha - r) + Math.cos(ang) * r, sb * (hb - r) + Math.sin(ang) * r); }
      const next = [[-1, 1], [-1, -1], [1, -1], [1, 1]][c], end = (c + 1) * Math.PI / 2;
      const from = [sa * (ha - r) + Math.cos(end) * r, sb * (hb - r) + Math.sin(end) * r], to = [next[0] * (ha - r) + Math.cos(end) * r, next[1] * (hb - r) + Math.sin(end) * r];
      for (let j = 1; j < 6; j++) push(from[0] + (to[0] - from[0]) * (j / 6), from[1] + (to[1] - from[1]) * (j / 6));
    });
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5), 96, welt, 5, true);
    mesh.add(shadowed(new THREE.Mesh(projectUV(tube, mat, {}), mat)));
  }
  return mesh;
}

// a book lying flat: boards and a spine round a block of pages that sits back from three edges
function book(M, long, thick, short, cover) {
  const g = new THREE.Group(), c = 0.003;
  g.add(at(box(long, c, short, 0, cover), 0, thick / 2 - c / 2, 0), at(box(long, c, short, 0, cover), 0, -thick / 2 + c / 2, 0), at(box(long, thick, c, 0, cover), 0, 0, -short / 2 + c / 2));
  g.add(at(box(long - 0.012, thick - 2 * c, short - 0.008, 0, M.pages), 0, 0, -0.001));
  return g;
}

function printTexture() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 510;
  const g = c.getContext('2d');
  g.fillStyle = '#f1ede3'; g.fillRect(0, 0, 768, 510);
  g.fillStyle = '#e6e0d2'; g.fillRect(96, 78, 576, 354);                    // the sheet inside its mount
  g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(318, 300, 118, Math.PI, 0); g.fill();
  g.fillStyle = '#b9895a'; g.fillRect(436, 182, 118, 118);
  g.fillStyle = '#1b1a18'; g.fillRect(200, 300, 354, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function rulerTexture() {
  // 325 mm of steel rule: 12.5 mm of margin, then 0 to 300 mm, one tick a millimetre
  const W = 4096, H = 384, pxPerMm = W / 325, x0 = 12.5 * pxPerMm;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#d7d5ce'; g.fillRect(0, 0, W, H);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(0, 0, 0, ${(rnd() * 0.035).toFixed(3)})`; g.fillRect(0, y, W, 1); }   // brushed along its length
  g.fillStyle = '#1b1a18';
  for (let i = 0; i <= 300; i++) {
    const len = i % 10 === 0 ? 150 : i % 5 === 0 ? 105 : 70;
    g.fillRect(x0 + i * pxPerMm - 1.5, 0, 3, len);
  }
  g.font = '500 92px "IBM Plex Mono", ui-monospace, Consolas, monospace';
  g.textBaseline = 'top'; g.textAlign = 'left';
  for (let cm = 0; cm <= 30; cm++) g.fillText(String(cm), x0 + cm * 10 * pxPerMm + 12, 176);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}

/* ---------- the room box: plywood, painted inside, bare birch outside, its cut edges showing ---------- */
export function buildRoom(M) {
  const { w, d, h } = SIZES.room, t = 0.08, e = 0.0006, g = new THREE.Group();
  // floor: a plywood slab with boards laid on it
  g.add(at(box(w, t, d, 0, M.plyEdge, { v: 1 }), 0, -t / 2, 0));
  const boards = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.floor); boards.rotation.x = -Math.PI / 2; boards.receiveShadow = true;
  g.add(at(boards, 0, e, 0));
  // back wall and left wall: core, plaster inside, birch outside
  g.add(at(box(w, h + t, t, 0, M.plyEdge, { u: 0 }), 0, (h - t) / 2, -d / 2 - t / 2));
  g.add(at(skin(w, h, M.plaster), 0, h / 2, -d / 2 + e));
  const backOut = skin(w, h + t, M.birch); backOut.rotation.y = Math.PI; g.add(at(backOut, 0, (h - t) / 2, -d / 2 - t - e));
  g.add(at(box(t, h + t, d + t, 0, M.plyEdge, { u: 2 }), -w / 2 - t / 2, (h - t) / 2, -t / 2));
  const leftIn = skin(d, h, M.plaster); leftIn.rotation.y = Math.PI / 2; g.add(at(leftIn, -w / 2 + e, h / 2, 0));
  const leftOut = skin(d + t, h + t, M.birch); leftOut.rotation.y = -Math.PI / 2; g.add(at(leftOut, -w / 2 - t - e, (h - t) / 2, -t / 2));
  // skirting boards
  g.add(at(box(w, 0.085, 0.014, 0.003, M.skirting), 0, 0.0425, -d / 2 + 0.007));
  g.add(at(box(0.014, 0.085, d, 0.003, M.skirting), -w / 2 + 0.007, 0.0425, 0));
  // a framed print above the sofa, behind glass
  const frame = box(0.96, 0.66, 0.035, 0.004, M.woodDark);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.58), new THREE.MeshPhysicalMaterial({ map: printTexture(), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }));
  print.position.z = 0.0182; frame.add(print);
  g.add(at(frame, 0.25, 1.58, -d / 2 + 0.0175));
  // a socket by the lamp and a switch by the open side, each with its plate
  const socket = box(0.085, 0.085, 0.012, 0.004, M.plastic);
  [-0.014, 0.014].forEach((x) => socket.add(at(cyl(0.0045, 0.0045, 0.004, M.rubber, 12).rotateX(Math.PI / 2), x, 0, 0.0055)));
  g.add(at(socket, -0.92, 0.3, -d / 2 + 0.006));
  g.add(at(box(0.04, 0.04, 0.03, 0.006, M.rubber), -0.92, 0.3, -d / 2 + 0.026));         // the lamp's plug
  const sw = box(0.085, 0.085, 0.012, 0.004, M.plastic);
  const rocker = box(0.034, 0.05, 0.008, 0.002, M.plastic); rocker.rotation.x = 0.1; sw.add(at(rocker, 0, 0, 0.008));
  g.add(at(sw, 1.52, 1.12, -d / 2 + 0.006));
  // the lamp's flex, from its base along the skirting up to the plug
  const flex = new THREE.CatmullRomCurve3([[-1.36, 0.006, -1.2], [-1.33, 0.006, -1.36], [-1.2, 0.006, -1.45], [-1.02, 0.008, -1.465], [-0.93, 0.05, -1.47], [-0.92, 0.2, -1.47], [-0.92, 0.285, -1.468]].map((p) => new THREE.Vector3(...p)));
  g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(flex, 60, 0.0055, 8), M.rubber)));
  // shade where the surfaces meet
  const s = 0.42, y = 0.0018;
  const fb = flat(w, s, M.shadeStrip); fb.rotation.x = -Math.PI / 2; g.add(at(fb, 0, y, -d / 2 + s / 2));
  const fl = flat(d, s, M.shadeStrip); fl.rotation.set(-Math.PI / 2, 0, Math.PI / 2); g.add(at(fl, -w / 2 + s / 2, y, 0));
  const wb = flat(w, s, M.shadeStrip); wb.rotation.z = Math.PI; g.add(at(wb, 0, s / 2, -d / 2 + 0.016));
  const wl = flat(d, s, M.shadeStrip); wl.rotation.set(0, Math.PI / 2, Math.PI); g.add(at(wl, -w / 2 + 0.016, s / 2, 0));
  const cb = flat(h, s, M.shadeStrip); cb.rotation.z = Math.PI / 2; g.add(at(cb, -w / 2 + s / 2, h / 2, -d / 2 + 0.002));
  const cl = flat(h, s, M.shadeStrip); cl.rotation.set(0, Math.PI / 2, -Math.PI / 2); g.add(at(cl, -w / 2 + 0.002, h / 2, -d / 2 + s / 2));
  return g;
}

// a soft shade under a piece, laid on the floor (or on the rug) in the room's own coordinates
export function contactShade(M, x, z, w, d, y = 0.003) {
  const b = flat(w, d, M.shadeBlob); b.rotation.x = -Math.PI / 2;
  return at(b, x, y, z);
}

/* ---------- lounge chair: frame, seat cushion and back cushion are separate parts ---------- */
export function buildChair(M) {
  const g = new THREE.Group(), frame = new THREE.Group(), seat = new THREE.Group(), back = new THREE.Group();
  [-1, 1].forEach((sx) => {
    const front = cyl(0.021, 0.016, 0.52, M.wood, 20); front.rotation.x = -0.05;
    frame.add(at(front, sx * 0.335, 0.26, 0.345));
    const rear = cyl(0.021, 0.016, 0.78, M.wood, 20); rear.rotation.x = 0.06;
    frame.add(at(rear, sx * 0.335, 0.39, -0.36));
    frame.add(at(box(0.052, 0.034, 0.78, 0.013, M.wood), sx * 0.335, 0.532, 0));          // arm
    frame.add(at(box(0.03, 0.05, 0.69, 0.008, M.wood), sx * 0.335, 0.3, -0.005));         // side rail
  });
  frame.add(at(box(0.65, 0.05, 0.03, 0.008, M.wood), 0, 0.3, 0.33));                      // front rail
  frame.add(at(box(0.65, 0.05, 0.03, 0.008, M.wood), 0, 0.3, -0.345));                    // rear rail
  frame.add(at(box(0.65, 0.04, 0.03, 0.008, M.wood), 0, 0.74, -0.385));                   // top rail
  [-0.2, 0, 0.2].forEach((x) => {                                                         // three back slats behind the cushion
    const slat = box(0.05, 0.42, 0.014, 0.005, M.wood); slat.rotation.x = -0.16;
    frame.add(at(slat, x, 0.53, -0.355));
  });
  for (let i = 0; i < 6; i++) frame.add(at(box(0.62, 0.012, 0.05, 0.003, M.wood, { u: 0 }), 0, 0.322, -0.28 + i * 0.112));   // seat slats
  seat.add(at(cushion(0.6, 0.125, 0.62, 0.05, M.fabricAccent, { puff: 0.02, under: 0.15, pinch: 0.14, seed: 2 }), 0, 0.395, 0.01));
  const rest = cushion(0.6, 0.36, 0.125, 0.055, M.fabricAccent, { puff: 0.024, under: 0.4, pinch: 0.2, seed: 5 }); rest.rotation.x = -0.16;
  back.add(at(rest, 0, 0.61, -0.275));
  g.add(frame, seat, back);
  g.userData.parts = { frame, seat, back };
  return g;
}

/* ---------- two-seat sofa, with a linen cushion and a folded wool throw ---------- */
export function buildSofa(M) {
  const g = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(at(cyl(0.027, 0.02, 0.13, M.wood, 20), sx * 0.74, 0.075, sz * 0.33));
    g.add(at(cyl(0.021, 0.021, 0.012, M.brass, 20), sx * 0.74, 0.006, sz * 0.33));        // brass feet
  });
  const firm = { puff: 0.007, pinch: 0.04, wrinkle: 0.0016, welt: 0, n: 10 };           // the upholstered body: taut, only just crowned
  g.add(at(cushion(1.68, 0.2, 0.84, 0.055, M.fabric, { ...firm, seed: 1 }), 0, 0.24, 0));
  [-1, 1].forEach((sx) => g.add(at(cushion(0.16, 0.36, 0.84, 0.07, M.fabric, { ...firm, seed: 3 + sx }), sx * 0.76, 0.5, 0)));
  g.add(at(cushion(1.38, 0.42, 0.18, 0.075, M.fabric, { ...firm, seed: 6 }), 0, 0.57, -0.33));
  [-1, 1].forEach((sx) => {
    const seat = cushion(0.665, 0.15, 0.6, 0.06, M.fabric, { puff: 0.022, under: 0.1, pinch: 0.16, wrinkle: 0.004, seed: 8 + sx }); seat.rotation.z = sx * 0.012;     // sat-on, not factory square
    g.add(at(seat, sx * 0.338, 0.408, 0.07));
    const rest = cushion(0.64, 0.31, 0.15, 0.07, M.fabric, { puff: 0.03, under: 0.5, pinch: 0.22, wrinkle: 0.005, seed: 12 + sx }); rest.rotation.set(-0.2, sx * 0.03, sx * -0.015);
    g.add(at(rest, sx * 0.338, 0.625, -0.19));
  });
  const pillow = cushion(0.4, 0.4, 0.13, 0.055, M.linen, { puff: 0.034, pinch: 0.5, wrinkle: 0.006, welt: 0.004, seed: 17 }); pillow.rotation.set(-0.34, -0.3, 0.08);
  g.add(at(pillow, 0.44, 0.63, -0.02));
  g.add(drape(M));
  return g;
}

// the wool throw, laid over the left arm: one sheet that follows the arm's section, hangs outside and rests on the seat
function drape(M) {
  const o = 0.014, xo = -0.84 - o, xi = -0.68 + o, top = 0.68 + o, z0 = 0.0, z1 = 0.4, nu = 44, nv = 16;
  const section = new THREE.CatmullRomCurve3([[xo - 0.006, 0.3], [xo, 0.45], [xo, 0.6], [-0.818, 0.67], [-0.76, top], [-0.702, 0.67], [xi, 0.6], [xi + 0.006, 0.545], [-0.628, 0.508], [-0.54, 0.506], [-0.45, 0.51]].map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const length = section.getLength(), tile = M.wool.userData.tile;
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv), p = geo.attributes.position, uv = geo.attributes.uv, at2 = new THREE.Vector3(), tan = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const zn = j / nv, hem = 0.07 * zn + 0.015 * Math.sin(zn * 5.2), s = hem + (1 - hem - 0.05 * (1 - zn)) * (i / nu);   // neither end is cut square to the arm
    section.getPointAt(s, at2); section.getTangentAt(s, tan);
    const free = s < 0.3 ? 1 - s / 0.3 : 0;                                    // the hanging part is free to fold
    const z = z0 + (z1 - z0) * zn + 0.006 * Math.sin(s * 21), wave = 0.5 + 0.5 * Math.sin(z * 34 + 1.1 + s * 3) * Math.cos(z * 13 - 0.4);
    const out = (0.002 + 0.02 * free * free + 0.004 * (s > 0.72 ? 1 : 0)) * wave;
    const v = j * (nu + 1) + i;
    p.setXYZ(v, at2.x - tan.y * out, at2.y + tan.x * out, z);
    uv.setXY(v, (s * length) / tile[0], z / tile[1]);
  }
  geo.computeVertexNormals();
  return shadowed(new THREE.Mesh(geo, M.wool));
}

/* ---------- round coffee table with two books, a bowl and a cup ---------- */
export function buildTable(M) {
  const g = new THREE.Group();
  const top = lathe([[0, 0.33], [0.4, 0.33], [0.414, 0.336], [0.42, 0.346], [0.418, 0.356], [0.41, 0.36], [0, 0.36]], M.wood, 96);   // an eased edge
  projectUV(top.geometry, M.wood, { u: 0 });
  g.add(top);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, leg = cyl(0.021, 0.014, 0.335, M.wood, 16);
    leg.rotation.z = Math.cos(a) * -0.14; leg.rotation.x = Math.sin(a) * 0.14;
    g.add(at(leg, Math.cos(a) * 0.3, 0.166, Math.sin(a) * 0.3));
  }
  const bookA = book(M, 0.21, 0.022, 0.15, M.coverSand), bookB = book(M, 0.19, 0.018, 0.135, M.coverInk);
  bookA.rotation.y = 0.4; bookB.rotation.y = 0.62;
  g.add(at(bookA, -0.13, 0.371, 0.08), at(bookB, -0.125, 0.391, 0.082));
  g.add(at(lathe([[0, 0], [0.06, 0], [0.085, 0.02], [0.095, 0.05], [0.09, 0.052], [0.078, 0.022], [0.055, 0.008], [0, 0.008]], M.ceramic), 0.17, 0.36, -0.1));
  // a cup of coffee on its saucer
  g.add(at(lathe([[0, 0], [0.05, 0], [0.062, 0.006], [0.064, 0.01], [0.05, 0.007], [0, 0.007]], M.ceramic, 40), 0.1, 0.36, 0.2));
  g.add(at(lathe([[0, 0.007], [0.022, 0.007], [0.03, 0.02], [0.034, 0.055], [0.031, 0.055], [0.027, 0.022], [0.02, 0.012], [0, 0.012]], M.ceramic, 40), 0.1, 0.36, 0.2));
  g.add(at(cyl(0.0305, 0.0305, 0.002, M.coffee, 32), 0.1, 0.408, 0.2));
  return g;
}

/* ---------- floor lamp ---------- */
export function buildLamp(M) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.15, 0], [0.152, 0.008], [0.146, 0.02], [0.03, 0.026], [0.014, 0.04], [0, 0.04]], M.steel, 64));
  g.add(at(cyl(0.011, 0.011, 1.375, M.steel, 16), 0, 0.726, 0));
  g.add(at(cyl(0.02, 0.02, 0.03, M.brass, 24), 0, 1.4, 0));
  g.add(at(cyl(0.016, 0.02, 0.04, M.plastic, 20), 0, 1.385, 0));                          // lamp holder
  g.add(at(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.22, 72, 1, true), M.shade)), 0, 1.45, 0));
  [0.1, 0.18].forEach((r, i) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003, 8, 72), M.steel); ring.rotation.x = Math.PI / 2; g.add(at(ring, 0, i ? 1.34 : 1.56, 0)); });
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), M.bulb), 0, 1.44, 0));
  return g;
}

/* ---------- sideboard with a vase and three books (built along x, front on +z) ---------- */
export function buildSideboard(M) {
  const g = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(at(cyl(0.02, 0.015, 0.2, M.wood, 16), sx * 0.6, 0.1, sz * 0.16)));
  g.add(at(box(1.32, 0.46, 0.4, 0.01, M.wood), 0, 0.43, -0.01));                          // carcass
  [-0.495, -0.165, 0.165, 0.495].forEach((x) => g.add(at(box(0.322, 0.44, 0.018, 0.004, M.wood, { u: 1 }), x, 0.43, 0.2)));   // four doors, grain upright
  [-0.375, -0.285, 0.285, 0.375].forEach((x) => g.add(at(cyl(0.011, 0.013, 0.016, M.brass, 20).rotateX(Math.PI / 2), x, 0.47, 0.217)));
  g.add(at(lathe([[0, 0], [0.05, 0], [0.075, 0.05], [0.07, 0.13], [0.032, 0.2], [0.03, 0.25], [0.04, 0.26], [0.026, 0.262], [0.022, 0.2], [0, 0.2]], M.ceramic), -0.4, 0.66, 0.02));
  [[0.24, 0.03, M.coverInk], [0.22, 0.026, M.coverClay], [0.2, 0.022, M.coverSand]].reduce((y, [w, h, mat], i) => {
    const b = book(M, w, h, 0.16, mat); b.rotation.y = Math.PI + (i - 1) * 0.14;           // spines to the room
    g.add(at(b, 0.34, y + h / 2, 0)); return y + h;
  }, 0.66);
  // a few dry branches in the vase; they lean to the room, not into the wall behind
  let seed = 37; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5; i++) {
    const a = rnd() * 6.283, lean = 0.07 + rnd() * 0.2, hgt = 0.4 + rnd() * 0.3, lx = Math.cos(a) * lean, lz = Math.max(-0.09, Math.sin(a) * lean);
    const stem = new THREE.CatmullRomCurve3([0, 0.35, 0.7, 1].map((t) => new THREE.Vector3(-0.4 + lx * t * t + (rnd() - 0.5) * 0.03 * t, 0.84 + (hgt + 0.08) * t, 0.02 + lz * t * t + (rnd() - 0.5) * 0.03 * t)));
    g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(stem, 14, 0.003, 5), M.twig)));
    for (let k = 0; k < 2; k++) {
      const from = stem.getPoint(0.4 + rnd() * 0.4), tip = from.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.14, 0.07 + rnd() * 0.1, Math.max(-0.03, (rnd() - 0.5) * 0.14)));
      g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(from, tip), 3, 0.0019, 4), M.twig)));
    }
  }
  return g;
}

/* ---------- rug, with a fringe at both ends ---------- */
export function buildRug(M) {
  const g = new THREE.Group(), w = 2.3, d = 1.56;
  const r = box(w, 0.012, d, 0.005, M.rug, { u: 0 }); r.castShadow = false;
  g.add(at(r, 0, 0.006, 0));
  const n = 150, fringe = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.004, 0.005), M.rug, n * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n * 2; i++) {
    const side = i < n ? -1 : 1, k = i % n;
    e.set(0, (rnd() - 0.5) * 0.5, 0); q.setFromEuler(e); s.set(0.75 + rnd() * 0.5, 1, 1);
    p.set(side * (w / 2 + 0.024), 0.003, -d / 2 + 0.006 + (k / (n - 1)) * (d - 0.012));
    fringe.setMatrixAt(i, m.compose(p, q, s));
  }
  fringe.receiveShadow = true;
  g.add(fringe);
  return g;
}

/* ---------- a snake plant in a stoneware pot ---------- */
export function buildPlant(M) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.105, 0], [0.13, 0.03], [0.14, 0.24], [0.146, 0.26], [0.13, 0.262], [0.124, 0.24], [0, 0.24]], M.stoneware));
  g.add(at(cyl(0.123, 0.123, 0.004, M.soil, 32), 0, 0.236, 0));
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const hgt = 0.42 + rnd() * 0.5, wid = 0.055 + rnd() * 0.03, bend = (rnd() - 0.3) * 0.16;
    const geo = new THREE.PlaneGeometry(wid, hgt, 2, 10), pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const t = Math.min(1, Math.max(0, pos.getY(v) / hgt + 0.5));                                  // 0 at the soil, 1 at the tip
      const taper = Math.min(1, t * 5 + 0.45) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 0.8);
      const x = pos.getX(v) * taper;
      pos.setXYZ(v, x, pos.getY(v) + hgt / 2, bend * t * t + Math.abs(x) * 0.5);   // a shallow V, leaning out as it rises
    }
    geo.computeVertexNormals();
    const leaf = shadowed(new THREE.Mesh(geo, M.leaf)), a = (i / 9) * Math.PI * 2 + rnd();
    leaf.rotation.set((rnd() - 0.5) * 0.18, a, (rnd() - 0.5) * 0.12, 'YXZ');
    g.add(at(leaf, Math.cos(a) * 0.035 * (i % 3), 0.238, Math.sin(a) * 0.035 * (i % 3)));
  }
  return g;
}

/* ---------- the real-size cues on the desk: a 300 mm steel rule and a pencil, drawn at 12 times ---------- */
export function buildRuler(M) {
  const g = new THREE.Group();
  g.add(box(3.9, 0.012, 0.36, 0, M.ruler));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.36), new THREE.MeshStandardMaterial({ map: rulerTexture(), roughness: 0.42, metalness: 0.3 }));   // satin steel: the figures have to read in the dim part of the light too
  face.rotation.x = -Math.PI / 2; face.receiveShadow = true;
  g.add(at(face, 0, 0.0064, 0));
  return g;
}
export function buildPencil(M) {
  const g = new THREE.Group(), R = 0.042;
  const turn = (m) => { m.rotation.z = Math.PI / 2; return m; };
  g.add(turn(cyl(R, R, 1.78, M.pencil, 6)));
  g.add(at(turn(cyl(0.012, R, 0.24, M.wood, 24)), -1.01, 0, 0));
  g.add(at(turn(cyl(0.001, 0.012, 0.06, M.graphite, 16)), -1.16, 0, 0));
  g.add(at(turn(cyl(R * 0.98, R * 0.98, 0.03, M.brass, 24)), 0.905, 0, 0));
  return g;
}

/* ---------- merge everything under a group into one mesh per material: the scene is drawn twice a frame (colour, depth) ---------- */
export function bake(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert(), local = new THREE.Matrix4();
  const sets = new Map(), kept = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    local.multiplyMatrices(inverse, o.matrixWorld);
    if (o.isInstancedMesh || Array.isArray(o.material)) { kept.push([o, local.clone()]); return; }
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    Object.keys(geo.attributes).forEach((name) => { if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name); });
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(local);
    const key = `${o.material.uuid}${o.castShadow ? 'c' : '-'}${o.receiveShadow ? 'r' : '-'}`;
    if (!sets.has(key)) sets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    sets.get(key).geos.push(geo);
    o.geometry.dispose();
  });
  root.clear();
  kept.forEach(([o, m]) => { m.decompose(o.position, o.quaternion, o.scale); root.add(o); });
  sets.forEach(({ material, cast, receive, geos }) => {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    geos.forEach((gg) => gg.dispose());
    root.add(mesh);
  });
  return root;
}
