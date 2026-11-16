// Miniatyr — the real-time 3D act (WebGL2, three.js r169).
// One scroll progress value drives everything: the camera on its spline, where it looks, the lens's focus,
// the chair's exploded view, and the rule and pencil being set down.
// The scene is drawn as a photograph of it would be: light through a window, shade where things touch,
// a lens with a shallow depth of field, a little grain. Its background is painted in the scene itself and
// corrected to land exactly on the page's --canvas colour in both themes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { windowLight } from './textures.js';
import { makeMaterials, buildRoom, buildChair, buildSofa, buildTable, buildLamp, buildSideboard, buildRug, buildPlant, buildRuler, buildPencil, contactShade, bake } from './furniture.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const canvas = document.getElementById('gl');
const act = document.querySelector('.act');
const chapters = [...document.querySelectorAll('.chapter')];
const bar = document.querySelector('.progress i');
const status = document.getElementById('scene-status');
const setLoad = (v) => { if (bar) bar.style.transform = `scaleX(${v / 100})`; };

let renderer = null;
try {
  // ?nowebgl forces the fallback, to check it on a machine that has WebGL2
  if (new URLSearchParams(location.search).has('nowebgl') || !document.createElement('canvas').getContext('webgl2')) throw new Error('no webgl2');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('no-webgl');
  if (status) status.textContent = '이 브라우저에서는 3D 장면 대신 정지 이미지를 보여 줍니다.';
}

if (renderer) init();

async function init() {
  // the rule's figures are drawn with the page's mono face: wait for it (briefly) before the textures are made
  await Promise.race([document.fonts.load('500 16px "IBM Plex Mono"').catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  const dpr = () => Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(dpr());
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;      // keeps the materials and the page colour true
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;         // with a radius on the light: soft-edged, as from a window
  renderer.shadowMap.autoUpdate = false;                // the scene is still: the shadow map is drawn once, then only while something moves
  renderer.info.autoReset = false;                      // count the colour pass and the depth pass together

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;
  setLoad(20);

  /* ---------- light: one window on the open side, the sky and the floor's bounce, and the lamp ---------- */
  // The window is a spot light set far off, so its rays run nearly parallel, with a picture of the window in its beam:
  // a dim cool level everywhere and low, warm sun through the panes. One light, so one set of shadows.
  const SUN = { dir: new THREE.Vector3(7.4, 5.4, 4.2).normalize(), far: 40, reach: 7 };
  const sun = new THREE.SpotLight('#fff4e6', 5.6, 0, Math.atan(SUN.reach / SUN.far), 0.02, 0);
  sun.target.position.set(0, 0, 0.4);
  sun.position.copy(sun.target.position).addScaledVector(SUN.dir, SUN.far);
  // placed so the sun crosses the rug and climbs the left wall above the sideboard
  sun.map = windowLight({ reach: SUN.reach, x: -0.45, y: 0.9, w: 1.4, h: 2.1, cols: 2, rows: 3, bar: 0.07 });
  sun.castShadow = true;
  const mapSize = coarse ? 2048 : 4096;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.camera.near = SUN.far - 12; sun.shadow.camera.far = SUN.far + 12;
  sun.shadow.radius = 5; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.018;
  const sky = new THREE.HemisphereLight('#eef2fa', '#b89468', 0.62);     // cool from above, warm off the floor
  const fill = new THREE.DirectionalLight('#dbe6ff', 0.22);
  fill.position.set(-2.5, 4, 7);
  const lampLight = new THREE.PointLight('#ffcf94', 0.7, 3.4, 2);
  lampLight.position.set(-1.36, 1.38, -1.08);
  scene.add(sun, sun.target, sky, fill, lampLight);

  /* ---------- the room and its furniture ---------- */
  const M = makeMaterials();
  const world = new THREE.Group();
  scene.add(world);
  const pieces = { chair: buildChair(M), sofa: buildSofa(M), table: buildTable(M), lamp: buildLamp(M), sideboard: buildSideboard(M) };
  setLoad(40);
  renderThumbnails();                                   // before the pieces are merged into the room
  setLoad(55);

  const still = new THREE.Group();                      // everything that never moves: merged into one mesh per material
  const rug = buildRug(M), plant = buildPlant(M);
  pieces.sofa.position.set(0.25, 0, -0.98);
  rug.position.set(0.3, 0, 0.12);
  pieces.table.position.set(0.3, 0.012, 0.2);
  pieces.lamp.position.set(-1.36, 0, -1.08);
  pieces.sideboard.position.set(-1.57, 0, 0.42); pieces.sideboard.rotation.y = Math.PI / 2;
  plant.position.set(1.5, 0, -1.2);
  still.add(buildRoom(M), rug, pieces.sofa, pieces.table, pieces.lamp, pieces.sideboard, plant,
    contactShade(M, 0.25, -0.98, 2.0, 1.15), contactShade(M, -1.55, 0.42, 0.7, 1.6), contactShade(M, -1.36, -1.08, 0.5, 0.5),
    contactShade(M, 1.5, -1.2, 0.5, 0.5), contactShade(M, 0.3, 0.2, 1.05, 1.05, 0.014), contactShade(M, 1.22, 0.62, 1.0, 1.0, 0.0145));
  world.add(bake(still));
  pieces.chair.position.set(1.22, 0.012, 0.62); pieces.chair.rotation.y = -0.95;
  world.add(pieces.chair);
  const parts = pieces.chair.userData.parts;
  Object.values(parts).forEach(bake);

  // the desk under the room box: no surface is drawn, only the shadow that falls on it
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.3 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -0.081; desk.receiveShadow = true;
  const RULER_Z = 2.12, PENCIL_X = 3.05;
  const ruler = buildRuler(M); ruler.position.set(0, -0.074, RULER_Z);
  const pencil = bake(buildPencil(M)); pencil.position.set(PENCIL_X, -0.044, 0.55); pencil.rotation.y = 1.05;
  world.add(desk, ruler, pencil);
  setLoad(70);

  /* ---------- thumbnails for the collection list: each piece rendered once, alone, on a clear ground ---------- */
  function renderThumbnails() {
    const slots = [...document.querySelectorAll('[data-thumb]')];
    if (!slots.length) return;
    const W = 640, H = 480;
    const ts = new THREE.Scene(); ts.environment = envTex; ts.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight('#fff1dc', 2.0); key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight('#dbe6ff', 0.5); rim.position.set(-4, 3, -2);
    ts.add(key, rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.shadeBlob); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.002; ts.add(ground);
    const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 50);
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    const bounds = new THREE.Box3(), centre = new THREE.Vector3(), size = new THREE.Vector3();
    slots.forEach((slot) => {
      const src = pieces[slot.dataset.thumb]; if (!src) return;
      const copy = src.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0);
      ts.add(copy);
      bounds.setFromObject(copy); bounds.getCenter(centre); bounds.getSize(size);
      ground.scale.set(size.x * 1.5, size.z * 1.5, 1); ground.position.set(centre.x, 0.002, centre.z);
      const reach = Math.max(size.x, size.y * 1.25, size.z) * 2.75;
      cam.position.copy(centre).add(new THREE.Vector3(0.62, 0.36, 0.86).normalize().multiplyScalar(reach));
      cam.lookAt(centre);
      renderer.render(ts, cam);
      const img = new Image(W, H);
      img.alt = slot.dataset.alt || ''; img.decoding = 'async';
      img.src = canvas.toDataURL('image/webp', 0.92);
      slot.replaceChildren(img);
      ts.remove(copy);
    });
    key.dispose(); rim.dispose(); ground.geometry.dispose();
  }

  /* ---------- the picture: colour pass (multisampled), shade where things touch, depth of field, tone mapping, grain ---------- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  // ambient occlusion, worked out from the picture's own depth: under the furniture, in the corners, between the cushions
  // (thickness: only what lies within 0.3 m in depth shades a point, so a lamp pole does not darken the wall far behind it)
  const ao = new GTAOPass(scene, camera, 1, 1, undefined, { radius: 0.34, distanceExponent: 1.2, thickness: 0.3, scale: 1.2, samples: 16 }, { radius: 12, samples: 16, rings: 2 });
  ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-2.6, -0.2, -2.2), new THREE.Vector3(4.6, 2.7, 3.0)));     // nothing to shade out on the open desk
  composer.addPass(ao);
  const lens = new BokehPass(scene, camera, { focus: 9, aperture: 0.003, maxblur: 0.013 });
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  // film grain, on the scene only: a pixel that is the page's own colour is left exactly as it is
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, ground: { value: new THREE.Vector3() }, seed: { value: 0 }, amount: { value: 0.02 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec3 ground; uniform float seed; uniform float amount; varying vec2 vUv;
      float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float inScene = smoothstep(0.012, 0.06, distance(c.rgb, ground));
        float n = hash(gl_FragCoord.xy + seed) + hash(gl_FragCoord.yx * 1.31 + seed + 17.0) - 1.0;
        float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb += n * amount * inScene * (1.0 - 0.55 * luma);
        gl_FragColor = c;
      }`,
  });
  composer.addPass(finish);
  // A phone keeps the plain, sharp picture: no lens, and the painted shade stands in for the worked-out one.
  const paintedShade = (on) => { M.shadeStrip.opacity = on ? 1 : 0.4; M.shadeBlob.opacity = on ? 1 : 0.55; };
  const setAO = (on) => { ao.enabled = on; paintedShade(!on); dirty = true; };
  lens.enabled = !coarse;

  // The output pass tone-maps every pixel, the background too. Pre-invert PBR Neutral so the painted
  // background lands exactly on the page's --canvas token and meets the HTML around it without a seam.
  const neutral = (c) => {
    let [r, g, b] = c; const x = Math.min(r, g, b), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
    r -= off; g -= off; b -= off; const peak = Math.max(r, g, b), sc = 0.76;
    if (peak < sc) return [r, g, b];
    const d = 1 - sc, np = 1 - d * d / (peak + d - sc), k = np / peak; r *= k; g *= k; b *= k;
    const t = 1 - 1 / (0.15 * (peak - np) + 1); return [r + (np - r) * t, g + (np - g) * t, b + (np - b) * t];
  };
  const untone = (color) => {
    const tgt = [color.r, color.g, color.b], x = tgt.slice();
    for (let i = 0; i < 60; i++) { const y = neutral(x); for (let j = 0; j < 3; j++) x[j] = Math.max(0, x[j] + (tgt[j] - y[j])); }
    return new THREE.Color(x[0], x[1], x[2]);
  };
  function paintGround() {
    const token = new THREE.Color(getComputedStyle(root).getPropertyValue('--canvas').trim() || '#f5f4f0');
    scene.background = untone(token);
    const shown = token.clone().convertLinearToSRGB();
    finish.uniforms.ground.value.set(shown.r, shown.g, shown.b);
  }
  paintGround();

  /* ---------- camera: a spline through one position per chapter; the target, the framing and the aperture blend between them ---------- */
  // shift: where the subject sits across the screen, as a share of the half width (+ right, - left), opposite the copy
  // wide: for a subject that must be seen whole, its width on screen as a share of the screen's height;
  //       the camera then stands back until it fits beside the copy, in the middle of the space the copy leaves
  const CH = [
    { cam: [5.9, 2.8, 6.8],  tgt: [0.0, 0.95, 0.0],    shift: 0.36,  f: 0.0012, wide: 0.89 },   // the room, read as a full-size interior
    { cam: [3.7, 1.5, 3.9],  tgt: [1.22, 0.55, 0.62],  shift: -0.46, f: 0.0050 },   // lounge chair, comes apart
    { cam: [-0.5, 1.0, 3.9], tgt: [0.28, 0.42, -0.4],  shift: 0.44,  f: 0.0052 },   // sofa and table, low and close
    { cam: [0.9, 1.5, 3.0],  tgt: [-1.42, 0.8, -0.25], shift: -0.42, f: 0.0052 },   // lamp and sideboard
    { cam: [5.4, 9.4, 10.2], tgt: [0.7, 0.0, 0.75],    shift: 0.36,  f: 0.0016, wide: 0.72 },   // pulled back: the box on the desk beside a rule and a pencil
  ];
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const path = new THREE.CatmullRomCurve3(CH.map((c) => v3(c.cam)), false, 'catmullrom', 0.35);
  const targets = CH.map((c) => v3(c.tgt));
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const camPos = new THREE.Vector3(), tgt = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), look = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let portrait = false, copyEdge = 592;
  const fit = (c) => {
    if (portrait || !c.wide) return [1, c.shift];
    return [Math.max(1, (c.wide * innerHeight) / Math.max(240, innerWidth - copyEdge - 72)), Math.sign(c.shift) * (copyEdge / innerWidth - 0.045)];
  };

  function placeCamera(p) {
    const seg = p * (CH.length - 1), k = Math.min(CH.length - 2, Math.floor(seg)), t = ss(0, 1, seg - k);
    path.getPoint(p, camPos);
    tgt.copy(targets[k]).lerp(targets[k + 1], t);
    const [b0, s0] = fit(CH[k]), [b1, s1] = fit(CH[k + 1]);
    const shift = portrait ? 0 : s0 + (s1 - s0) * t;
    const back = portrait ? 1.5 : Math.max(Math.min(1.45, Math.max(1, 1.55 / camera.aspect)), b0 + (b1 - b0) * t);   // a narrow screen stands further back
    if (back > 1) camPos.sub(tgt).multiplyScalar(back).add(tgt);
    const dist = camPos.distanceTo(tgt), halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    fwd.copy(tgt).sub(camPos).normalize(); right.crossVectors(fwd, UP).normalize();
    look.copy(tgt).addScaledVector(right, -shift * halfH * camera.aspect);
    if (portrait) look.y -= 0.34 * halfH;                                // and holds the subject above the copy
    camera.position.copy(camPos); camera.lookAt(look);
    // the lens focuses on the chapter's subject, wherever it sits in the frame
    lens.uniforms.focus.value = dist;
    lens.uniforms.aperture.value = CH[k].f + (CH[k + 1].f - CH[k].f) * t;
  }

  /* ---------- scroll: one progress value over the act ---------- */
  let target = 0, p = 0, inView = true, dirty = true, lastExplode = -1, lastSetDown = -1;
  setAO(!coarse);
  function readScroll() {
    const r = act.getBoundingClientRect(), span = r.height - innerHeight;
    const raw = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    if (reduce) {
      // reduced motion: no travel; each chapter is its own still, picked by the chapter nearest the middle of the screen
      let best = 0, bestD = Infinity;
      chapters.forEach((c, i) => { const b = c.getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - innerHeight / 2); if (d < bestD) { bestD = d; best = i; } });
      target = best / (chapters.length - 1);
    } else target = raw;
  }
  addEventListener('scroll', () => { readScroll(); dirty = true; }, { passive: true });

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!coarse && !reduce) addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; dirty = true; }, { passive: true });

  function layout() {
    const w = innerWidth, h = innerHeight;
    portrait = w < 1024;      // the breakpoint where the copy moves to the foot of the screen (site.css)
    const copy = document.querySelector('.chapter--hero .copy');
    if (copy && !portrait) copyEdge = copy.getBoundingClientRect().right;
    renderer.setPixelRatio(dpr());
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr());
    composer.setSize(w, h);
    ao.setSize(w, h);                                    // the shade is soft: one sample a CSS pixel is enough
    camera.aspect = w / h; camera.fov = portrait ? 46 : 35;
    camera.updateProjectionMatrix();
    readScroll(); dirty = true;
  }

  /* ---------- labels: HTML that follows a point in the scene ---------- */
  const anchors = {
    back: () => parts.back.localToWorld(new THREE.Vector3(0.3, 0.62, -0.27)),
    seat: () => parts.seat.localToWorld(new THREE.Vector3(0.3, 0.4, 0.2)),
    frame: () => parts.frame.localToWorld(new THREE.Vector3(0.335, 0.2, 0.345)),
    rule: () => ruler.localToWorld(new THREE.Vector3(1.8, 0.01, 0.18)),
  };
  const labels = [...document.querySelectorAll('.tag')].map((el) => ({ el, at: anchors[el.dataset.anchor], from: +el.dataset.from, to: +el.dataset.to }));
  const proj = new THREE.Vector3();

  /* ---------- the frame ---------- */
  let last = performance.now(), raf = 0, frames = 0, fpsT = 0, fps = 0, slow = 0, timed = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!inView || document.hidden) return;
    const gap = target - p;
    pointer.sx += (pointer.x - pointer.sx) * 0.08; pointer.sy += (pointer.y - pointer.sy) * 0.08;
    const drifting = Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.0005;
    if (!dirty && Math.abs(gap) < 0.00005 && !drifting) return;        // nothing changed: no draw
    // a machine that cannot keep up while the camera travels gives up the worked-out shade first, then the lens
    if ((ao.enabled || lens.enabled) && Math.abs(gap) > 0.002 && timed < 45) {
      timed++; if (dt > 0.04) slow++;
      if (timed === 45 && slow > 22) { if (ao.enabled) { setAO(false); timed = 0; slow = 0; } else lens.enabled = false; }
    }
    p = reduce ? target : Math.abs(gap) < 0.00005 ? target : p + gap * (1 - Math.pow(0.002, dt));
    dirty = false;

    const explode = ss(0.13, 0.22, p) * (1 - ss(0.3, 0.38, p));
    parts.seat.position.y = 0.3 * explode;
    parts.back.position.set(0, 0.56 * explode, -0.16 * explode);
    // the rule and the pencil are set down on the desk as the camera pulls back: until then they wait out of frame
    const setDown = ss(0.76, 0.93, p);
    ruler.position.z = RULER_Z + (1 - setDown) * 13;
    pencil.position.x = PENCIL_X + (1 - setDown) * 9;
    pencil.rotation.x = (1 - setDown) * 9;      // it rolls in
    if (Math.abs(explode - lastExplode) > 0.0005 || Math.abs(setDown - lastSetDown) > 0.0005) { renderer.shadowMap.needsUpdate = true; lastExplode = explode; lastSetDown = setDown; }

    world.rotation.y = pointer.sx * 0.05;
    placeCamera(p);
    camera.position.y += -pointer.sy * 0.12;
    camera.updateMatrixWorld();

    labels.forEach(({ el, at, from, to }) => {
      const o = ss(from, from + 0.05, p) * (1 - ss(to - 0.05, to, p));
      el.style.opacity = o.toFixed(3);
      if (o < 0.01) return;
      proj.copy(at()).project(camera);
      el.style.transform = `translate(${((proj.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * innerHeight - 11).toFixed(1)}px)`;
    });

    finish.uniforms.seed.value = (finish.uniforms.seed.value + 7.31) % 251;     // the grain is new in every frame that is drawn
    renderer.info.reset();
    composer.render();
    frames++; fpsT += dt;
    if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    window.__scene = { p, target, fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, webgl2: renderer.capabilities.isWebGL2, lens: lens.enabled, ao: ao.enabled, ground: sampleGround };
  }
  // the colour the scene paints as its background, read back from the screen (for checking it against the token)
  function sampleGround() {
    renderer.info.reset(); composer.render();
    const gl = renderer.getContext(), px = new Uint8Array(4);
    // (x, y) as shares of the screen from its top left; the default is the top left corner
    const at = (x = 0.002, y = 0.004) => { gl.readPixels(Math.round(x * gl.drawingBufferWidth), Math.round((1 - y) * gl.drawingBufferHeight) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return `rgb(${px[0]}, ${px[1]}, ${px[2]})`; };
    return [at(), at(0.998, 0.004), at(0.5, 0.004)].join(' | ');
  }

  /* ---------- lifecycle: stop when the act is off screen or the tab is hidden; release everything on leave ---------- */
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; dirty = true; }).observe(act);
  document.addEventListener('visibilitychange', () => { last = performance.now(); dirty = true; });
  new ResizeObserver(layout).observe(document.body);
  new MutationObserver(() => { paintGround(); dirty = true; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    scene.traverse((o) => { o.geometry && o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map && x.map.dispose(); x.bumpMap && x.bumpMap.dispose(); x.dispose(); }); });
    envTex.dispose(); pmrem.dispose(); sun.shadow.map && sun.shadow.map.dispose(); sun.map.dispose(); ao.dispose(); finish.dispose(); composer.dispose(); renderer.dispose();
  });

  layout();
  placeCamera(0);
  renderer.shadowMap.needsUpdate = true;
  setLoad(85);
  const compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
  Promise.all([compiled, document.fonts ? document.fonts.ready : null]).then(() => {
    setLoad(100);
    raf = requestAnimationFrame(frame);
    requestAnimationFrame(() => { root.classList.add('scene-ready'); if (status) status.textContent = '3D 장면이 준비되었습니다.'; });
  });
}
