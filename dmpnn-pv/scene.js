// The pictures: one three.js scene, drawn from HyperFrames time on every hf-seek. Nothing here keeps state
// between frames; every frame is worked out from t alone.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const D = window.pvData;
// ---------- small tools ----------
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
// a pulse: 1 at dt = 0, gone after `len` seconds
const blip = (dt, len = 0.4) => (dt < 0 || dt > len ? 0 : 1 - dt / len);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CYAN = new THREE.Color(0x5eead4), PINK = new THREE.Color(0xf472b6), GOLD = new THREE.Color(0xfbbf24), BLUE = new THREE.Color(0x38bdf8);

// ---------- renderer, camera, light, glow ----------
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(1920, 1080, false); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050b);
scene.fog = new THREE.FogExp2(0x03050b, 0.018);
const camera = new THREE.PerspectiveCamera(35, 1920 / 1080, 0.1, 200);
scene.add(new THREE.HemisphereLight(0x9ec5ff, 0x0b1020, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(6, 8, 10); scene.add(key);
const rim = new THREE.PointLight(0x5eead4, 60, 40); rim.position.set(-8, -3, 6); scene.add(rim);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.6, 0.5, 0.62);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---------- stars ----------
const stars = (() => {
  const r = rng(3), n = 1800, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, d = 18 + r() * 50, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * d, u * d * 0.6, Math.sin(a) * s * d - 10], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8fb4ff, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(p); return p;
})();

// ---------- the molecule ----------
// atoms and bonds of the hero molecule, in ångström, centred; `heavy` are the atoms that are not hydrogen
const H = D.hero, atomsXYZ = H.atoms.map(([, x, y, z]) => V(x, y, z));
const heavy = H.atoms.map((a, i) => i).filter((i) => H.atoms[i][0] !== "H");
const INK = { C: 0xd6deee, H: 0xf8fafc, N: 0x5b9dff, O: 0xff5a6e };
const mol = new THREE.Group(); scene.add(mol);
const atomMats = {}, ball = new THREE.SphereGeometry(1, 32, 24);
const atomMat = (el) => (atomMats[el] ||= new THREE.MeshStandardMaterial({ color: INK[el] ?? 0xfbbf24, roughness: 0.32, metalness: 0.1, emissive: 0x000000, transparent: true }));
const r0 = rng(11);
const atoms = H.atoms.map(([el], i) => {
  const m = new THREE.Mesh(ball, atomMat(el)); m.userData.r = el === "H" ? 0.2 : 0.36;
  // where it flies in from
  const a = r0() * Math.PI * 2, u = r0() * 2 - 1, d = 9 + r0() * 7, s = Math.sqrt(1 - u * u);
  m.userData.from = V(Math.cos(a) * s * d, u * d, Math.sin(a) * s * d); mol.add(m); return m;
});
const bondMat = new THREE.MeshStandardMaterial({ color: 0x8796b3, roughness: 0.5, transparent: true });
const stick = new THREE.CylinderGeometry(1, 1, 1, 12);
const bonds = H.bonds.map(([i, j, order]) => {
  const m = new THREE.Mesh(stick, bondMat), A = atomsXYZ[i], B = atomsXYZ[j], dir = B.clone().sub(A), L = dir.length();
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  m.userData = { L, w: order > 1 ? 0.09 : 0.065 }; mol.add(m); return m;
});

// ---------- directed bonds: two glowing rails per heavy bond, a light running along each ----------
const railMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xc9fff4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const spark = new THREE.SphereGeometry(0.11, 16, 12);
const directed = [];
H.bonds.forEach(([i, j]) => {
  if (H.atoms[i][0] === "H" || H.atoms[j][0] === "H") return;
  [[i, j], [j, i]].forEach(([u, v]) => {
    const A = atomsXYZ[u], B = atomsXYZ[v], dir = B.clone().sub(A).normalize(), side = dir.clone().cross(V(0, 0, 1)).normalize().multiplyScalar(0.2);
    const a = A.clone().add(dir.clone().multiplyScalar(0.45)).add(side), b = B.clone().sub(dir.clone().multiplyScalar(0.45)).add(side), L = a.distanceTo(b);
    const rail = new THREE.Mesh(stick, railMat); rail.position.copy(a).add(b).multiplyScalar(0.5);
    rail.quaternion.setFromUnitVectors(V(0, 1, 0), dir); rail.scale.set(0.022, L, 0.022); mol.add(rail);
    const sparks = [0, 0.5].map(() => { const s = new THREE.Mesh(spark, sparkMat); mol.add(s); return s; });
    directed.push({ a, b, rail, sparks, from: u, to: v });
  });
});

// ---------- a vector on every atom: a ring of bars around it ----------
const BARS = 40, bar = new THREE.BoxGeometry(1, 1, 1);
const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
const r1 = rng(29), dummy = new THREE.Object3D();
const rings = heavy.map((i, k) => {
  const g = new THREE.Group(), im = new THREE.InstancedMesh(bar, barMat, BARS), vals = Array.from({ length: BARS }, () => r1());
  for (let b = 0; b < BARS; b++) im.setColorAt(b, CYAN.clone().lerp(k % 2 ? PINK : BLUE, b / BARS));
  g.add(im); scene.add(g); return { g, im, vals, atom: i };
});
// the molecule's vector: one big ring
const BIG = 180, bigRing = new THREE.Group(), bigIm = new THREE.InstancedMesh(bar, barMat, BIG), r2 = rng(53);
const bigVals = Array.from({ length: BIG }, (_, b) => 0.25 + 0.75 * Math.pow(r2(), 1.6) * (0.6 + 0.4 * Math.sin(b * 0.37) ** 2));
for (let b = 0; b < BIG; b++) bigIm.setColorAt(b, CYAN.clone().lerp(b % 3 ? BLUE : PINK, (Math.sin(b * 0.21) + 1) / 2));
bigRing.add(bigIm); scene.add(bigRing);
// lays out a ring of bars in its own plane: bar b points out at its angle, as long as vals[b] * len
const layRing = (im, vals, n, radius, len, width, wobble, t) => {
  for (let b = 0; b < n; b++) {
    const a = (b / n) * Math.PI * 2, l = Math.max(0.0001, vals[b] * len * (0.86 + 0.14 * Math.sin(t * 3.1 + b * 0.9) * wobble));
    dummy.position.set(Math.cos(a) * (radius + l / 2), Math.sin(a) * (radius + l / 2), 0);
    dummy.rotation.set(0, 0, a - Math.PI / 2); dummy.scale.set(width, l, width); dummy.updateMatrix(); im.setMatrixAt(b, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
};

// ---------- the network ----------
const net = new THREE.Group(); scene.add(net);
const LAYERS = [[-0.5, 9], [3.2, 7], [6.6, 1]], nodeGeo = new THREE.SphereGeometry(1, 24, 16);
const nodes = LAYERS.map(([x, n], l) => Array.from({ length: n }, (_, i) => {
  const m = new THREE.Mesh(nodeGeo, new THREE.MeshStandardMaterial({ color: l === 2 ? 0xfbbf24 : 0x9fb3d1, emissive: 0x000000, roughness: 0.3, transparent: true, opacity: 0 }));
  m.position.set(x, (i - (n - 1) / 2) * 0.82, 0); m.scale.setScalar(l === 2 ? 0.42 : 0.2); net.add(m); return m; }));
const RING_AT = V(-5.6, 0, 0);
// wires: from the ring to the first layer, and between layers; one material per stage, so a stage lights at once
const wireMats = [0, 1, 2].map(() => new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
const wire = (pairs, mat) => { const g = new THREE.BufferGeometry().setFromPoints(pairs.flat()); const s = new THREE.LineSegments(g, mat); net.add(s); return s; };
wire(nodes[0].map((n) => [RING_AT.clone().add(V(1.8, 0, 0)), n.position.clone()]), wireMats[0]);
wire(nodes[0].flatMap((a) => nodes[1].map((b) => [a.position.clone(), b.position.clone()])), wireMats[1]);
wire(nodes[1].map((a) => [a.position.clone(), nodes[2][0].position.clone()]), wireMats[2]);

// ---------- the molecules it learns from ----------
const smalls = D.stream.map((m, k) => {
  const g = new THREE.Group();
  m.atoms.forEach(([el, x, y, z]) => { const s = new THREE.Mesh(ball, atomMat(el)); s.position.set(x, y, z); s.scale.setScalar(el === "H" ? 0.2 : 0.36); g.add(s); });
  m.bonds.forEach(([i, j]) => { const A = V(...m.atoms[i].slice(1)), B = V(...m.atoms[j].slice(1)), dir = B.clone().sub(A), s = new THREE.Mesh(stick, bondMat);
    s.position.copy(A).add(B).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); s.scale.set(0.065, dir.length(), 0.065); g.add(s); });
  g.visible = false; scene.add(g); return g;
});
const STREAM_T = (k) => 53.6 + 9.0 * Math.pow(k / smalls.length, 0.85);

// ---------- the camera: keyframes, eased between ----------
const SHOTS = [
  [0, V(-3.0, 0, 34), V(-3.0, 0, 0)], [5.0, V(-2.8, 1.2, 19), V(-3.0, 0, 0)], [6.4, V(0, 0.6, 24), V(0, 6.0, 0)], [10.6, V(0, 0.4, 23), V(0, 6.2, 0)],
  [12.2, V(-6.0, 2.4, 17), V(-3.8, 0.6, 0)], [19, V(-1.8, -2.2, 15), V(-3.8, 0.4, 0)], [31, V(-6.6, 2.0, 16.5), V(-4.4, 0.6, 0)], [38, V(-3.6, 0.6, 17), V(-3.8, 2.2, 0)],
  [45, V(0.6, -0.2, 22), V(0.6, -0.8, 0)], [53, V(0.8, -0.2, 23), V(0.6, -0.8, 0)], [64, V(0.4, 0, 23), V(0.4, -0.6, 0)], [66, V(0, 0, 28), V(0, 5.2, 0)], [72, V(0, 0, 26), V(0, 5.0, 0)],
];
const shoot = (t) => {
  let k = 0; while (k < SHOTS.length - 2 && t >= SHOTS[k + 1][0]) k++;
  const [t0, p0, q0] = SHOTS[k], [t1, p1, q1] = SHOTS[k + 1], e = io(seg(t, t0, t1));
  camera.position.copy(p0).lerp(p1, e); camera.lookAt(q0.clone().lerp(q1, e));
};

// ---------- one frame ----------
function renderAt(t) {
  shoot(t);
  stars.rotation.y = t * 0.012; stars.rotation.x = Math.sin(t * 0.05) * 0.05;

  // the molecule turns slowly the whole time, and wakes up again at the end
  mol.rotation.set(Math.sin(t * 0.21) * 0.3, Math.sin(t * 0.17) * 0.7, Math.sin(t * 0.13) * 0.12);
  const gather = io(seg(t, 0.6, 4.6)), leave = io(seg(t, 39.2, 41.4)), back = io(seg(t, 64.6, 67.6));
  const show = clamp(1 - leave + back);
  atoms.forEach((m, i) => { const k = clamp(gather * 1.15 - (i % 7) * 0.025);
    m.position.copy(m.userData.from).lerp(atomsXYZ[i], out(k)); m.scale.setScalar(m.userData.r * (0.3 + 0.7 * out(k)) * (0.25 + 0.75 * show)); });
  bonds.forEach((m, n) => { const k = out(seg(t, 3.6 + n * 0.03, 4.8 + n * 0.03)) * show; m.scale.set(m.userData.w * k, m.userData.L, m.userData.w * k); });
  Object.values(atomMats).forEach((mat) => { mat.opacity = 0.15 + 0.85 * show; });
  bondMat.opacity = 0.15 + 0.85 * show;
  mol.position.y = -0.4 * leave * (1 - back);
  mol.visible = show > 0.02;

  // directed bonds: the rails, and the lights running along them, then three rounds of messages
  const rails = seg(t, 12.0, 13.4) * (1 - seg(t, 31.0, 32.0)), rounds = [21.0, 24.6, 28.0];
  railMat.opacity = 0.75 * rails;
  directed.forEach((d, k) => d.sparks.forEach((s, j) => {
    let p = 0, on = 0;
    if (t < 20.6) { p = (t * 0.55 + j * 0.5 + k * 0.137) % 1; on = rails; }
    else for (const r of rounds) if (t >= r && t < r + 2.6 && j === 0) { p = io(seg(t, r + 0.1, r + 2.2)); on = 1 - seg(t, r + 2.1, r + 2.6); }
    s.position.copy(d.a).lerp(d.b, p); s.scale.setScalar(0.6 + 0.6 * on); s.visible = on > 0.01;
  }));
  sparkMat.opacity = 0.95;
  // the atoms grow brighter with every round heard
  const heard = rounds.reduce((a, r) => a + seg(t, r + 1.8, r + 2.6), 0) * (1 - seg(t, 31.0, 33.0));
  Object.values(atomMats).forEach((mat) => mat.emissive.copy(CYAN).multiplyScalar(0.16 * heard));

  // a vector on every atom: rings of bars, facing the camera, which then fly to the middle and fold into one
  const grow = out(seg(t, 31.6, 33.6)), fold = io(seg(t, 38.6, 40.8));
  rings.forEach((r, k) => {
    const g = out(clamp(grow * 1.3 - k * 0.03)) * (1 - fold), world = atomsXYZ[r.atom].clone().applyEuler(mol.rotation).add(mol.position);
    r.g.position.copy(world).lerp(V(0, 0, 0), fold); r.g.quaternion.copy(camera.quaternion); r.g.visible = g > 0.01;
    layRing(r.im, r.vals, BARS, 0.5, 0.75 * g, 0.045, 1, t);
  });
  // the big ring: grows in the middle, then moves aside to feed the network, and pulses with every pass
  const big = out(seg(t, 39.8, 42.2)) * (1 - io(seg(t, 63.8, 65.0))), aside = io(seg(t, 44.8, 46.8));
  bigRing.position.copy(V(0, 0, 0).lerp(RING_AT, aside)); bigRing.quaternion.copy(camera.quaternion);
  bigIm.rotation.z = t * 0.18; bigRing.visible = big > 0.01;
  const passes = smalls.reduce((a, _, k) => Math.max(a, blip(t - (STREAM_T(k) + 1.0), 0.6)), 0);
  layRing(bigIm, bigVals, BIG, 2.0 - 0.4 * aside, (1.3 - 0.25 * aside) * big * (1 + 0.25 * passes), 0.05, 1, t);

  // the network: nodes come in, then the signal runs through it, stage by stage; when training, every pass runs
  // forward (cyan) and its error back (pink)
  const netOn = out(seg(t, 45.4, 47.4)) * (1 - io(seg(t, 63.8, 65.0)));
  net.visible = netOn > 0.01;
  nodes.flat().forEach((n) => { n.material.opacity = netOn; });
  const first = [47.4, 48.4, 49.4], fwd = [0, 0, 0], bwd = [0, 0, 0];
  first.forEach((s, i) => { fwd[i] = Math.max(fwd[i], blip(t - s, 1.2)); });
  smalls.forEach((_, k) => { const s = STREAM_T(k) + 1.0; for (let i = 0; i < 3; i++) { fwd[i] = Math.max(fwd[i], blip(t - (s + i * 0.18), 0.5)); bwd[i] = Math.max(bwd[i], blip(t - (s + 0.9 + (2 - i) * 0.18), 0.5)); } });
  wireMats.forEach((m, i) => { m.opacity = netOn * (0.12 + 0.85 * Math.max(fwd[i], bwd[i])); m.color.copy(bwd[i] > fwd[i] ? PINK : CYAN); });
  nodes.forEach((layer, l) => layer.forEach((n) => { const k = l === 2 ? Math.max(fwd[2], seg(t, 49.8, 50.4) * (1 - seg(t, 52.4, 53.4))) : fwd[Math.min(2, l + 1)];
    n.material.emissive.copy(l === 2 ? GOLD : CYAN).multiplyScalar(0.15 + 1.4 * k); }));

  // the molecules it learns from fly in from the left into the ring, spinning, one after another, faster and faster
  smalls.forEach((g, k) => { const s = STREAM_T(k), p = seg(t, s, s + 1.1), gone = seg(t, s + 0.85, s + 1.15);
    g.visible = p > 0 && gone < 1; g.position.copy(V(-17, 1.5 - (k % 3) * 1.4, 2).lerp(RING_AT, io(p))); g.scale.setScalar(0.42 * (1 - gone)); g.rotation.set(t * 1.3 + k, t * 0.9, 0); });

  bloom.strength = 0.6 + 0.3 * passes + 0.3 * seg(t, 49.8, 50.4) * (1 - seg(t, 52.4, 53.4));
  composer.render();
}

window.addEventListener("hf-seek", (event) => renderAt(event.detail.time));
renderAt(window.__hfThreeTime || 0);
