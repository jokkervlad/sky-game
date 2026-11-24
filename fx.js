// Эффекты и небольшие модели для способностей: собраны кодом из простых фигур, чтобы не грузить файлы и не терять кадры.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAIL = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;
const lin = h => new THREE.Color(h);
const cache = new Map();
const std = (color, metalness, roughness, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness, roughness }, extra));
const M = {
  steel: std(0x59616b, 0.9, 0.36), dark: std(0x1d2126, 0.85, 0.5), brass: std(0xb58c3e, 1, 0.3), canvas: std(0xd9d2bf, 0, 0.92), wood: std(0x6b4a2c, 0, 0.85),
  rope: std(0x8a7a5c, 0, 1), glass: std(0xcfefff, 0.1, 0.05, { transparent: true, opacity: 0.78, emissive: 0x7fd8ff, emissiveIntensity: 0.25 }),
};
// Износ: пятна, ржавчина (сталь), патина (латунь) или сколы краски до металла, мелкие царапины. Рисуется шейдером, текстур не грузит.
function worn(m, amt, kind) { m.customProgramCacheKey = () => 'worn' + amt + '_' + kind;
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position*vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOP; float wMask;
      float wh(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 p = vOP; float n1 = wn(p.xy*0.9 + p.zz*0.7), n2 = wn(p.yz*2.6 + p.xx*1.9 + 7.0), n3 = wn(p.zx*7.0 + p.yy*5.0);
        wMask = smoothstep(${(0.78 - amt * 0.5).toFixed(3)}, 0.92, n1*0.6 + n2*0.4);
        diffuseColor.rgb *= 0.9 + 0.16*n2 + 0.1*(n3 - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, ${kind === 0 ? 'vec3(0.20, 0.075, 0.03)' : kind === 1 ? 'vec3(0.09, 0.22, 0.17)' : 'vec3(0.15, 0.16, 0.17)'}*(0.7 + 0.6*n3), wMask*${kind === 1 ? '0.75' : '0.9'});
        diffuseColor.rgb += smoothstep(0.975, 1.0, wn(vec2(p.x*0.7 + p.z*0.6, p.y*13.0 + n1*3.0)))*0.22; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + ${kind === 2 ? '-0.15' : '0.3'}*wMask + 0.1 + 0.12*(wn(vOP.xz*1.3 + vOP.yy) - 0.5), 0.08, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = clamp(metalnessFactor ${kind === 2 ? '+ 0.5' : '- 0.45'}*wMask, 0.0, 1.0);`); };
  return m; }
worn(M.steel, 0.32, 0); worn(M.dark, 0.2, 0); worn(M.brass, 0.3, 1);
const paint = h => { const k = 'p' + h; if (!cache.has(k)) cache.set(k, worn(std(h, 0.35, 0.55), 0.34, 2)); return cache.get(k); };
// светящаяся деталь: лампа, сердечник, искра
const lamp = (h, k = 3) => { const key = 'l' + h + k; if (!cache.has(key)) { const c = lin(h); cache.set(key, new THREE.MeshBasicMaterial({ color: c.multiplyScalar(k), toneMapped: true })); } return cache.get(key); };
const G = {
  sph: new THREE.SphereGeometry(1, 20, 14), sphLo: new THREE.IcosahedronGeometry(1, 2), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cyl8: new THREE.CylinderGeometry(1, 1, 1, 8), hex: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 10), cone4: new THREE.ConeGeometry(1, 1, 4), box: new THREE.BoxGeometry(1, 1, 1), tor: new THREE.TorusGeometry(1, 0.09, 8, 32), torFat: new THREE.TorusGeometry(1, 0.2, 10, 28),
  half: new THREE.SphereGeometry(1, 20, 10, 0, 6.2832, 0, Math.PI / 2), disc: new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), horn: new THREE.CylinderGeometry(1, 0.22, 1, 16, 1, true),
};
function add(g, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; }
const shadow = g => { g.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) o.castShadow = true; }); return g; };
// маленький подвесной двигатель снизу: всё, что «стоит» в небе, держится на нём
function hover(g, h, r = 3) { add(g, G.cyl, M.dark, 0, -1.2, 0, r * 0.5, 1.6, r * 0.5); const t = add(g, G.torFat, M.steel, 0, -2, 0, r); t.rotation.x = Math.PI / 2; const l = add(g, G.cyl, lamp(h, 2.2), 0, -2.3, 0, r * 0.42, 0.5, r * 0.42); return l; }

// мелкие детали: заклёпки по кругу, труба между двумя точками, стеклянная линза
const UPV = new THREE.Vector3(0, 1, 0);
function rivets(g, n, r, y, s = 0.26, mat = M.steel, a0 = 0) { for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.2832; add(g, G.sphLo, mat, Math.cos(a) * r, y, Math.sin(a) * r, s, s * 0.7, s); } }
function pipe(g, a, b, r, mat = M.dark) { const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), m = add(g, G.cyl8, mat, a[0] + d.x / 2, a[1] + d.y / 2, a[2] + d.z / 2, r, d.length(), r); m.quaternion.setFromUnitVectors(UPV, d.normalize()); return m; }
function lens(g, x, y, z, r, h) { const b = add(g, G.cyl, M.dark, x, y, z, r * 1.25, r * 0.9, r * 1.25); b.rotation.x = Math.PI / 2; const l = add(g, G.sph, lamp(h, 2.4), x, y, z + r * 0.45, r, r, r * 0.4); return l; }
// Склеить неподвижные детали с одним материалом в один кусок: вместо полусотни отрисовок на модель остаётся несколько.
function fuse(root) { const groups = [root]; root.traverse(o => { if (o.isGroup && o !== root) groups.push(o); });
  for (const g of groups) { const by = new Map(); for (const c of [...g.children]) if (c.isMesh && !c.userData.live && c.children.length === 0 && c.material.isMeshStandardMaterial && !c.material.transparent && c.material.side === THREE.FrontSide) { if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(c); }
    for (const [mat, list] of by) { if (list.length < 2) continue; const geos = list.map(c => { c.updateMatrix(); const q = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); q.applyMatrix4(c.matrix); return q; }); const mg = mergeGeometries(geos, false); geos.forEach(q => q.dispose()); if (!mg) continue; list.forEach(c => g.remove(c)); const m = new THREE.Mesh(mg, mat); m.userData.own = [mg]; g.add(m); } }
  return root; }

// ---------- модели ----------
const PROPS = {
  // магнитная мина: шипастый шар с поясом и мигающей лампой
  mine(h) { const g = new THREE.Group(); add(g, G.sph, M.dark, 0, 0, 0, 4.2); const t = add(g, G.torFat, M.brass, 0, 0, 0, 4.3); t.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832, e = (i % 3 - 1) * 0.75; const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); const s = add(g, G.cyl8, M.steel, d.x * 4.8, d.y * 4.8, d.z * 4.8, 0.5, 1.8, 0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); add(g, G.sph, M.brass, d.x * 5.8, d.y * 5.8, d.z * 5.8, 0.62); }
    const l = add(g, G.sph, lamp(h, 4), 0, 4.6, 0, 1.0); add(g, G.cyl8, M.steel, 0, 4.1, 0, 0.9, 0.8, 0.9);
    const t2 = add(g, G.tor, M.steel, 0, 0, 0, 4.26); const t3 = add(g, G.tor, M.steel, 0, 0, 0, 4.26); t3.rotation.y = Math.PI / 2; rivets(g, 18, 4.55, 0, 0.3, M.steel); rivets(g, 10, 2.9, 3.1, 0.24, M.brass); rivets(g, 10, 2.9, -3.1, 0.24, M.brass);
    add(g, G.cyl, paint(0xc9a227), 0, -3.9, 0, 1.5, 0.7, 1.5); add(g, G.cyl8, M.dark, 0, -4.9, 0, 0.45, 1.6, 0.45); const eye = add(g, G.tor, M.steel, 0, -6, 0, 0.75); pipe(g, [0.9, 4.2, 0], [1.6, 6.4, 0.4], 0.07, M.dark); add(g, G.sphLo, M.dark, 1.6, 6.5, 0.4, 0.18);
    g.userData.anim = t => { g.rotation.y = t * 0.5; g.position.y += Math.sin(t * 2) * 0.8; l.scale.setScalar(Math.sin(t * 6) > 0.4 ? 1.15 : 0.5); }; return g; },
  // турель: платформа, поворотная башня, спаренные стволы
  turret(h) { const g = new THREE.Group(); add(g, G.cyl, M.steel, 0, 0, 0, 5.2, 1.4, 5.2); add(g, G.cyl, M.dark, 0, 1.4, 0, 2.6, 1.6, 2.6); hover(g, h, 4);
    const head = new THREE.Group(); head.position.y = 3.6; g.add(head); add(head, G.box, paint(0x5c6470), 0, 0, -0.4, 4.6, 3, 5.4); add(head, G.box, M.dark, 0, 0.2, 2.4, 3.4, 1.8, 1);
    for (const s of [-1, 1]) { const b = add(head, G.cyl8, M.dark, s * 1.1, 0.2, 6.2, 0.5, 7.4, 0.5); b.rotation.x = Math.PI / 2; const mz = add(head, G.cyl8, M.steel, s * 1.1, 0.2, 9.6, 0.75, 1.2, 0.75); mz.rotation.x = Math.PI / 2; }
    const l = add(head, G.sph, lamp(h, 3.5), 0, 1.9, -1.4, 0.7); g.userData.head = head; g.userData.aim = 0;
    rivets(g, 16, 4.8, 0.75, 0.3, M.dark); add(g, G.cyl, M.brass, 0, 2.3, 0, 2.9, 0.25, 2.9);
    for (const s of [-1, 1]) { add(head, G.box, paint(0x4c545f), s * 2.55, 0, -0.4, 0.5, 2.5, 4.6); const dr = add(head, G.cyl, M.dark, s * 3.3, -0.2, -0.8, 1.15, 1.3, 1.15); dr.rotation.z = Math.PI / 2; add(head, G.cyl, M.brass, s * 4, -0.2, -0.8, 0.5, 0.2, 0.5).rotation.z = Math.PI / 2;
      for (const zz of [4.2, 5.6, 7]) { const rg = add(head, G.tor, M.steel, s * 1.1, 0.2, zz, 0.62); } pipe(head, [s * 2.2, -1.2, -2.6], [s * 1.2, -1.5, 1.6], 0.14, M.dark);
      for (const zz of [-2.2, -0.4, 1.4]) add(head, G.sphLo, M.steel, s * 2.82, 0.9, zz, 0.2); }
    add(head, G.box, M.dark, 0, 2, 0.6, 1.2, 0.9, 1.8); lens(head, 0, 2, 1.5, 0.42, h); add(head, G.box, paint(0x4c545f), 0, 1.75, -2.2, 3.4, 0.5, 1.6); pipe(head, [1.4, 2, -2.6], [1.4, 4.6, -3], 0.06, M.steel); add(head, G.box, M.dark, 0, -0.9, -3.3, 2.6, 1.2, 0.8);
    g.userData.anim = (t, dt) => { let d = g.userData.aim - head.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); head.rotation.y += d * Math.min(1, dt * 8); l.scale.setScalar(0.8 + 0.3 * Math.sin(t * 5)); }; return g; },
  // мортирная башня: шестигранная площадка, короткий толстый ствол под углом, ящик с зарядами
  mortar(h) { const g = new THREE.Group(); add(g, G.hex, M.steel, 0, 0, 0, 6.2, 1.5, 6.2); hover(g, h, 4.4); add(g, G.cyl, M.dark, 0, 1.3, 0, 3, 1.2, 3);
    const tube = new THREE.Group(); tube.position.y = 2.2; tube.rotation.x = 0.6; g.add(tube); add(tube, G.cyl, paint(0x3f5a48), 0, 3.4, 0, 1.9, 7.4, 1.9); add(tube, G.cyl, M.dark, 0, 7.2, 0, 2.2, 0.9, 2.2); add(tube, G.cyl, lamp(h, 1.6), 0, 7.5, 0, 1.4, 0.3, 1.4);
    for (const s of [-1, 1]) { const leg = add(g, G.cyl8, M.steel, s * 2.6, 3, 2.6, 0.3, 5.6, 0.3); leg.rotation.z = -s * 0.5; leg.rotation.x = -0.4; }
    add(g, G.box, M.wood, -3.2, 1.7, -2.4, 2.6, 1.8, 2); add(g, G.box, M.brass, -3.2, 2.7, -2.4, 2.7, 0.25, 2.1);
    rivets(g, 12, 5.5, 0.8, 0.32, M.dark); for (const yy of [1.2, 3.6, 5.8]) { const b = add(tube, G.tor, M.steel, 0, yy, 0, 2); b.rotation.x = Math.PI / 2; b.scale.z = 2.4; }
    for (const s of [-1, 1]) { add(tube, G.cyl8, M.steel, s * 2.3, 2.2, 0, 0.32, 3.4, 0.32); add(tube, G.cyl8, M.brass, s * 2.3, 4.4, 0, 0.22, 1.6, 0.22); }
    const wh = add(g, G.tor, M.brass, 3.3, 3.1, -0.6, 1.1); wh.rotation.y = Math.PI / 2; pipe(g, [3.3, 3.1, -0.6], [2.2, 2.6, -0.4], 0.12, M.steel);
    for (const [x, z] of [[2.6, -3], [3.6, -2.2], [3.1, -3.8]]) { add(g, G.cyl, paint(0x3f5a48), x, 2, z, 0.5, 1.6, 0.5); add(g, G.cone, M.brass, x, 3.2, z, 0.5, 0.9, 0.5); }
    g.userData.tube = tube; g.userData.aim = 0; g.userData.anim = (t, dt) => { let d = g.userData.aim - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 3); }; return g; },
  // электромаяк: мачта с катушками и шаром-разрядником
  tesla(h) { const g = new THREE.Group(); add(g, G.cyl, M.steel, 0, 0, 0, 4.4, 1.4, 4.4); hover(g, h, 3.6); add(g, G.cyl8, M.dark, 0, 7, 0, 0.9, 13, 0.9);
    for (let i = 0; i < 4; i++) { const t = add(g, G.torFat, M.brass, 0, 4 + i * 2.6, 0, 2.6 - i * 0.35); t.rotation.x = Math.PI / 2; }
    add(g, G.cyl, M.steel, 0, 13.6, 0, 1.6, 0.6, 1.6); const orb = add(g, G.sph, lamp(h, 4.5), 0, 15.8, 0, 2.2); const cage = add(g, G.tor, M.steel, 0, 15.8, 0, 2.8); const cage2 = add(g, G.tor, M.steel, 0, 15.8, 0, 2.8); cage2.rotation.y = Math.PI / 2; cage.userData.live = cage2.userData.live = true;
    rivets(g, 12, 3.9, 0.75, 0.28, M.dark); for (let i = 0; i < 5; i++) add(g, G.cyl, M.canvas, 0, 1.6 + i * 0.5, 0, 1.5 - (i % 2) * 0.35, 0.3, 1.5 - (i % 2) * 0.35);
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.2832; pipe(g, [Math.cos(a) * 3.6, 0.6, Math.sin(a) * 3.6], [Math.cos(a) * 0.8, 9.5, Math.sin(a) * 0.8], 0.16, M.steel); add(g, G.sphLo, M.brass, Math.cos(a) * 3.6, 0.9, Math.sin(a) * 3.6, 0.45); }
    add(g, G.box, M.dark, 2.4, 1.6, 0, 1.6, 1.8, 1.4); lens(g, 2.4, 1.9, 0.45, 0.3, h); pipe(g, [2.4, 2.5, 0], [0.9, 5, 0], 0.09, M.dark);
    g.userData.top = 15.8; g.userData.anim = t => { orb.scale.setScalar(2.2 * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3))); cage.rotation.y = t; cage2.rotation.y = t + Math.PI / 2; }; return g; },
  // манок: шар-поплавок, под ним корзина с рупором, который крутится и зовёт
  lure(h) { const g = new THREE.Group(); const b = add(g, G.sph, M.canvas, 0, 9, 0, 4.4, 5.2, 4.4); const band = add(g, G.torFat, paint(lin(h).getHex()), 0, 9, 0, 4.45); band.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.2832 + 0.78; const r = add(g, G.cyl8, M.rope, Math.cos(a) * 1.9, 3.4, Math.sin(a) * 1.9, 0.09, 5.4, 0.09); r.rotation.z = -Math.cos(a) * 0.36; r.rotation.x = Math.sin(a) * 0.36; }
    for (let i = 0; i < 3; i++) { const t = add(g, G.tor, M.rope, 0, 9, 0, 4.5, 5.3, 4.5); t.rotation.y = i * Math.PI / 3; } add(g, G.cyl8, M.brass, 0, 14.3, 0, 0.5, 0.5, 0.5); add(g, G.cyl, M.brass, 0, 3.9, 0, 1.1, 0.5, 1.1);
    for (const [x, z] of [[1.9, 0], [-1.9, 0.4], [0, -1.9]]) add(g, G.sphLo, M.canvas, x, -0.9, z, 0.7, 0.9, 0.7); for (const y of [-0.7, 0.7]) { const t = add(g, G.box, M.dark, 0, y, 0, 3.36, 0.25, 3.36); }
    add(g, G.box, M.wood, 0, 0, 0, 3.2, 2.2, 3.2); const sp = new THREE.Group(); g.add(sp); const horn = add(sp, G.horn, M.brass, 0, 0, 3.6, 2.4, 4.6, 2.4); horn.rotation.x = -Math.PI / 2; horn.material.side = THREE.DoubleSide; add(sp, G.sph, lamp(h, 3.5), 0, 1.9, 0, 0.8);
    g.userData.anim = t => { sp.rotation.y = t * 1.6; g.rotation.z = Math.sin(t * 1.1) * 0.05; }; return g; },
  // динамит: связка шашек с запалом и часами
  dynamite(h) { const g = new THREE.Group(); const red = paint(0xa32220); for (const [x, z] of [[-1.3, -0.75], [1.3, -0.75], [0, 1.5]]) { add(g, G.cyl, red, x, 0, z, 1.25, 8, 1.25); add(g, G.cyl, M.canvas, x, 4.1, z, 1.27, 0.25, 1.27); }
    for (const y of [-2, 2]) { const t = add(g, G.torFat, M.dark, 0, y, 0.2, 2.75); t.rotation.x = Math.PI / 2; } add(g, G.cyl, M.brass, 0, 0, 3, 1.5, 0.6, 1.5).rotation.x = Math.PI / 2;
    const f = add(g, G.cyl8, M.rope, 0, 5.4, 1.5, 0.12, 2.6, 0.12); f.rotation.z = 0.4;
    add(g, G.cyl, M.canvas, 0, 0, 3.32, 1.25, 0.08, 1.25).rotation.x = Math.PI / 2; const hd = add(g, G.box, M.dark, 0, 0.5, 3.4, 0.12, 1, 0.06); const hd2 = add(g, G.box, M.dark, 0.35, 0, 3.4, 0.7, 0.12, 0.06); rivets(g, 4, 1.5, 0, 0.16, M.steel);
    pipe(g, [0.6, 0.9, 3.1], [1.3, 4.2, -0.75], 0.09, paint(0x2b6fb3)); pipe(g, [-0.6, 0.9, 3.1], [-1.3, 4.2, -0.75], 0.09, paint(0xd8c12a)); for (const [x, z] of [[-1.3, -0.75], [1.3, -0.75], [0, 1.5]]) { add(g, G.cyl, M.brass, x, 4.4, z, 0.45, 0.5, 0.45); add(g, G.cyl, M.canvas, x, -4.05, z, 1.27, 0.2, 1.27); } const sp = add(g, G.sph, lamp(0xffc84a, 6), -0.5, 6.7, 1.5, 0.6);
    g.rotation.z = 0.18; g.userData.spark = sp; g.userData.anim = t => { sp.scale.setScalar(0.5 + 0.5 * Math.abs(Math.sin(t * 31))); g.rotation.y = t * 0.6; }; return g; },
  // гравиколодец: тёмное ядро в трёх вращающихся кольцах
  well(h) { const g = new THREE.Group(); add(g, G.sph, new THREE.MeshBasicMaterial({ color: 0x05020a }), 0, 0, 0, 2.6); const halo = add(g, G.sph, lamp(h, 2.5), 0, 0, 0, 3.0); halo.material = halo.material.clone(); halo.material.transparent = true; halo.material.opacity = 0.45; halo.material.side = THREE.BackSide;
    const rs = [5.2, 6.8, 8.4].map((r, i) => { const t = add(g, G.torFat, i === 1 ? M.brass : M.steel, 0, 0, 0, r); t.scale.set(r, r, r * 0.6); t.userData.live = true; return t; });
    g.userData.anim = t => { rs[0].rotation.set(t * 1.9, t * 0.7, 0); rs[1].rotation.set(0.9, t * -1.4, t * 0.5); rs[2].rotation.set(t * 0.8, 0.4, t * -1.1); }; return g; },
  // ремонтный дрон: корпус на четырёх винтах со сварочной лампой
  drone(h) { const g = new THREE.Group(); add(g, G.box, paint(0x6c7a66), 0, 0, 0, 5, 1.8, 5); add(g, G.box, M.dark, 0, 1.1, 0, 2.6, 0.8, 2.6); const rot = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const arm = add(g, G.box, M.steel, x * 3.4, 0.2, z * 3.4, 0.7, 0.5, 4); arm.rotation.y = Math.atan2(x, z); add(g, G.cyl8, M.dark, x * 4.8, 0.7, z * 4.8, 0.55, 1, 0.55);
      const r = add(g, G.box, M.dark, x * 4.8, 1.35, z * 4.8, 5.6, 0.12, 0.5); r.userData.live = true; rot.push(r); const gd = add(g, G.tor, M.steel, x * 4.8, 1.3, z * 4.8, 3); gd.rotation.x = Math.PI / 2; add(g, G.sphLo, M.brass, x * 4.8, 1.55, z * 4.8, 0.3); const d = add(g, G.cyl, new THREE.MeshBasicMaterial({ color: 0xcfd6dd, transparent: true, opacity: 0.16, depthWrite: false }), x * 4.8, 1.4, z * 4.8, 2.9, 0.05, 2.9); d.renderOrder = 13; }
    add(g, G.cyl8, M.steel, 0, -1.5, 0, 0.5, 1.6, 0.5); const l = add(g, G.sph, lamp(h, 4), 0, -2.5, 0, 0.9);
    for (const s of [-1, 1]) { pipe(g, [s * 1.6, -0.9, -2.2], [s * 2.2, -2.6, -2.6], 0.12, M.steel); pipe(g, [s * 1.6, -0.9, 2.2], [s * 2.2, -2.6, 2.6], 0.12, M.steel); pipe(g, [s * 2.2, -2.6, -3], [s * 2.2, -2.6, 3], 0.14, M.dark); add(g, G.box, paint(0xc9a227), s * 2.52, 0, 0, 0.06, 0.9, 3.2); }
    add(g, G.sphLo, M.dark, 0, -0.6, 2.7, 0.75); lens(g, 0, -0.6, 3.2, 0.34, h); pipe(g, [-1, 1.5, -1], [-1.4, 3.6, -1.4], 0.05, M.steel); add(g, G.box, M.brass, 1.2, 1.55, 0.6, 0.9, 0.2, 1.2);
    g.userData.anim = t => { for (const r of rot) r.rotation.y = t * 38; g.position.x += Math.cos(t * 0.9) * 16; g.position.z += Math.sin(t * 0.9) * 16; g.rotation.y = -t * 0.9; g.rotation.z = Math.sin(t * 1.7) * 0.06; l.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 13))); }; return g; },
  // осветительная ракета: горящий заряд под маленьким парашютом
  flare(h) { const g = new THREE.Group(); const c = add(g, G.half, M.canvas, 0, 9, 0, 5, 3.4, 5); c.material = c.material.clone(); c.material.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; const r = add(g, G.cyl8, M.rope, Math.cos(a) * 2.4, 5, Math.sin(a) * 2.4, 0.06, 8.6, 0.06); r.rotation.z = -Math.cos(a) * 0.56; r.rotation.x = Math.sin(a) * 0.56; }
    add(g, G.cyl8, M.steel, 0, 0, 0, 0.7, 2.4, 0.7); const core = add(g, G.sph, lamp(h, 7), 0, -1.6, 0, 1.6); const halo = add(g, G.sph, new THREE.MeshBasicMaterial({ color: lin(h), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -1.6, 0, 7); halo.renderOrder = 13;
    g.userData.anim = t => { g.rotation.z = Math.sin(t * 0.9) * 0.12; core.scale.setScalar(1.6 * (0.85 + 0.2 * Math.sin(t * 23))); halo.scale.setScalar(7 + Math.sin(t * 9)); }; return g; },
  // дымовая шашка
  smokepot() { const g = new THREE.Group(); add(g, G.cyl, paint(0x4d5a46), 0, 0, 0, 1.9, 6, 1.9); add(g, G.cyl, paint(0xb23a2a), 0, 1.2, 0, 1.93, 0.8, 1.93); add(g, G.cyl, M.dark, 0, 3.2, 0, 1.3, 0.6, 1.3); add(g, G.tor, M.steel, 0, 3.9, 0, 0.7); for (const y of [-2.6, 2.4]) { const t = add(g, G.tor, M.steel, 0, y, 0, 1.95); t.rotation.x = Math.PI / 2; } rivets(g, 6, 1.1, 3.55, 0.16, M.dark); add(g, G.cyl, M.steel, 0, -3.1, 0, 1.95, 0.25, 1.95); g.rotation.z = 0.5; g.userData.anim = t => { g.rotation.y = t * 1.2; }; return g; },
  // разведзонд: шар-зонд с антенной
  probe(h) { const g = new THREE.Group(); add(g, G.sph, M.canvas, 0, 6, 0, 3.6, 4.2, 3.6); add(g, G.cyl8, M.rope, 0, 2, 0, 0.08, 4, 0.08); add(g, G.box, M.steel, 0, -0.4, 0, 2.2, 1.6, 2.2); for (let i = 0; i < 3; i++) { const t = add(g, G.tor, M.rope, 0, 6, 0, 3.66, 4.26, 3.66); t.rotation.y = i * Math.PI / 3; } for (const s of [-1, 1]) { add(g, G.box, M.dark, s * 2.4, -0.2, 0, 2.4, 0.08, 1.4); pipe(g, [s * 1.1, 0.4, 0.8], [s * 1.5, 2.6, 1.2], 0.05, M.steel); } rivets(g, 8, 1.56, -0.4, 0.14, M.brass, 0.39); const d = add(g, G.half, M.brass, 0, -1.6, 0, 1.8, 0.8, 1.8); d.rotation.x = Math.PI; d.material = d.material.clone(); d.material.side = THREE.DoubleSide; const l = add(g, G.sph, lamp(h, 4), 0, -2.4, 0, 0.5);
    const sweep = add(g, G.disc, new THREE.MeshBasicMaterial({ color: lin(h), transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), 0, -2.4, 0, 14); sweep.geometry = new THREE.CircleGeometry(1, 24, 0, 0.7).rotateX(-Math.PI / 2); sweep.renderOrder = 13;
    g.userData.anim = t => { sweep.rotation.y = t * 2.4; l.scale.setScalar(0.5 + 0.3 * Math.sin(t * 8)); }; return g; },
  // бот-ремонтник для «Бронеботов»
  bot(h) { const g = new THREE.Group(); add(g, G.box, M.steel, 0, 0, 0, 2.2, 1.6, 2.6); add(g, G.sph, lamp(h, 4), 0, 0.2, 1.3, 0.5); for (const s of [-1, 1]) add(g, G.box, M.dark, s * 1.5, -0.2, 0, 0.5, 0.5, 2); return g; },
  // метка над целью: перевёрнутый клин
  marker(h) { const g = new THREE.Group(); const c = add(g, G.cone4, lamp(h, 3), 0, 0, 0, 3, 6, 3); c.rotation.x = Math.PI; const t = add(g, G.tor, lamp(h, 2.5), 0, 4.4, 0, 3.4); t.rotation.x = Math.PI / 2; g.userData.anim = t0 => { g.rotation.y = t0 * 2; c.position.y = Math.sin(t0 * 4) * 0.8; }; return g; },
};

// туча: слепленные шары. Гроза — тёмная, кислотный дождь — зелёная
function cloudProp(r, tint, glowHex) { const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 1, metalness: 0, transparent: true, opacity: 0.94 }); let s = 7;
  const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 22; i++) { const a = rr() * 6.2832, d = Math.sqrt(rr()) * r * 0.7, k = r * (0.2 + rr() * 0.16) * (1 - d / r * 0.45); add(g, G.sphLo, mat, Math.cos(a) * d, (rr() - 0.35) * r * 0.16 + k * 0.2, Math.sin(a) * d, k, k * 0.72, k); }
  { const N = 150, pos = new Float32Array(N * 6), seed = new Float32Array(N * 2), top = new Float32Array(N * 2); for (let i = 0; i < N; i++) { const a = rr() * 6.2832, d = Math.sqrt(rr()) * r * 0.9, x = Math.cos(a) * d, z = Math.sin(a) * d, sd = rr(); pos.set([x, 0, z, x, 0, z], i * 6); seed.set([sd, sd], i * 2); top.set([0, 1], i * 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
    const rm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uH: { value: 80 }, uCol: { value: lin(glowHex || tint) } }, vertexShader: `attribute float aSeed, aTop; uniform float uT, uH; varying float vA; void main(){ float k = fract(aSeed*7.0 - uT*(1.6 + aSeed)); vec3 p = position; p.y = -k*uH + aTop*9.0; vA = aTop*(1.0 - k*0.5); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`, fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, 0.35 + 0.5*vA);${TAIL} }` });
    const rain = new THREE.LineSegments(geo, rm); rain.frustumCulled = false; rain.renderOrder = 13; g.add(rain); g.userData.own = [geo, rm, mat]; g.userData.anim = t => { rm.uniforms.uT.value = t; }; }
  if (glowHex) { const l = add(g, G.sphLo, new THREE.MeshBasicMaterial({ color: lin(glowHex), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -r * 0.05, 0, r * 0.7, r * 0.2, r * 0.7); g.userData.flash = l; }
  g.userData.mat = mat; return g; }

// сеть: радиальные верёвки и кольца, по краю грузила
function netProp(r, h) { const g = new THREE.Group(); const pts = []; const sag = q => -8 * (1 - q * q); const N = 16, K = 5;
  for (let i = 0; i < N; i++) { const a = i / N * 6.2832; for (let k = 0; k < K; k++) { const q0 = k / K, q1 = (k + 1) / K; pts.push(new THREE.Vector3(Math.cos(a) * r * q0, -sag(q0), Math.sin(a) * r * q0), new THREE.Vector3(Math.cos(a) * r * q1, -sag(q1), Math.sin(a) * r * q1)); } }
  for (let k = 1; k <= K; k++) { const q = k / K; for (let i = 0; i < 48; i++) { const a0 = i / 48 * 6.2832, a1 = (i + 1) / 48 * 6.2832; pts.push(new THREE.Vector3(Math.cos(a0) * r * q, -sag(q), Math.sin(a0) * r * q), new THREE.Vector3(Math.cos(a1) * r * q, -sag(q), Math.sin(a1) * r * q)); } }
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lin(h), transparent: true, opacity: 0.95, fog: false })); l.renderOrder = 14; g.add(l);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; add(g, G.sph, M.dark, Math.cos(a) * r, 0, Math.sin(a) * r, 2.2); } g.userData.own = [l.geometry, l.material]; return g; }

// ледяные шипы по кругу
function iceProp(r) { const g = new THREE.Group(); let s = 11; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 22; i++) { const a = rr() * 6.2832, d = (0.2 + rr() * 0.8) * r, hgt = r * (0.12 + rr() * 0.2), w = r * (0.03 + rr() * 0.035); const c = add(g, G.cone4, M.glass, Math.cos(a) * d, hgt / 2 - 8, Math.sin(a) * d, w, hgt, w); c.rotation.set((rr() - 0.5) * 0.5, rr() * 3, (rr() - 0.5) * 0.5); } return g; }

// ---------- купол и пузырь ----------
const domeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uFade: { value: 1 }, uCells: { value: 14 }, uCut: { value: -0.35 } },
  vertexShader: `varying vec3 vL; varying vec3 vN; varying vec3 vV; void main(){ vL = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uT, uFade, uCells, uCut; varying vec3 vL; varying vec3 vN; varying vec3 vV;
    float hexd(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0)*0.5; p = abs(fract(p) - 0.5); return abs(max(p.x*1.5 + p.y, p.y*2.0) - 1.0); }
    void main(){ vec3 n = normalize(vL); float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
      vec2 uv = vec2(atan(n.z, n.x)/6.2832*uCells*2.0, acos(clamp(n.y,-1.0,1.0))/3.1416*uCells);
      float line = smoothstep(0.10, 0.0, hexd(uv)) * smoothstep(0.98, 0.75, abs(n.y));
      float band = smoothstep(0.07, 0.0, abs(fract(n.y*1.5 - uT*0.35) - 0.5)) * 0.5;
      float edge = smoothstep(uCut + 0.10, uCut, n.y);             // светящаяся кромка внизу купола
      float a = (0.035 + fr*0.42 + line*0.20 + band*0.12 + edge*0.5) * uFade * smoothstep(uCut - 0.02, uCut + 0.02, n.y);
      vec3 c = uCol*(0.55 + fr*0.9 + line*0.7 + band*0.6 + edge*1.2);
      gl_FragColor = vec4(c*a, a*0.5);${TAIL} }` });
const domeGeo = new THREE.SphereGeometry(1, 48, 28, 0, 6.2832, 0, Math.PI * 0.62), ballGeo = new THREE.SphereGeometry(1, 36, 24);
function dome(r, h, full) { const m = new THREE.Mesh(full ? ballGeo : domeGeo, domeMat.clone()); m.material.uniforms.uCol.value = lin(h); m.material.uniforms.uCells.value = full ? 7 : 14; m.material.uniforms.uCut.value = full ? -2 : -0.35; m.scale.setScalar(r); m.renderOrder = 15; m.userData.own = [m.material]; return m; }

// ---------- круг зоны на облаках ----------
const decalMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uFade: { value: 1 }, uFill: { value: 0.5 }, uN: { value: 24 }, uSpin: { value: 0 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uCol; uniform float uT, uFade, uFill, uN, uSpin; varying vec2 vP;
    void main(){ float r = length(vP); if(r > 1.0) discard; float ang = atan(vP.y, vP.x);
      float rim = smoothstep(0.955, 0.975, r) * smoothstep(1.0, 0.99, r);
      float soft = smoothstep(0.80, 0.97, r) * 0.30;
      float dash = step(0.45, fract(ang/6.2832*uN + uT*0.12)) * smoothstep(0.865, 0.875, r) * smoothstep(0.905, 0.895, r);
      float wave = smoothstep(0.035, 0.0, abs(r - fract(uT*0.45))) * (1.0 - r) * 0.5;
      float spiral = uSpin * (0.5 + 0.5*sin(ang*3.0 + log(r + 0.02)*9.0 + uT*4.0*uSpin)) * smoothstep(1.0, 0.15, r) * 0.55;
      float a = (rim + soft*uFill + dash*0.7 + wave*uFill + uFill*0.10*smoothstep(1.0, 0.0, r) + spiral) * uFade;
      gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0));${TAIL} }` });
function decal(r, h, fill = 0.5, spin = 0) { const m = new THREE.Mesh(G.disc, decalMat.clone()); const u = m.material.uniforms; u.uCol.value = lin(h); u.uFill.value = fill; u.uN.value = Math.max(8, Math.round(r / 5)); u.uSpin.value = spin; m.scale.setScalar(r); m.renderOrder = 14; m.userData.own = [m.material]; return m; }

// расходящаяся волна (взрывы, вспышки, удары)
const waveMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 0 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uCol; uniform float uK; varying vec2 vP;
    void main(){ float r = length(vP); if(r > 1.0) discard; float w = 0.10 + 0.10*(1.0 - uK); float ring = smoothstep(1.0 - w, 1.0 - w*0.35, r) * smoothstep(1.0, 0.985, r); float inner = smoothstep(0.2, 1.0, r) * 0.22;
      float a = (ring + inner) * (1.0 - uK) * (1.0 - uK*0.5); gl_FragColor = vec4(uCol*(1.0 + ring*0.6), clamp(a, 0.0, 1.0));${TAIL} }` });
function wave(h) { const m = new THREE.Mesh(G.disc, waveMat.clone()); m.material.uniforms.uCol.value = typeof h === 'number' ? new THREE.Color(h) : lin(h); m.renderOrder = 14; m.userData.own = [m.material]; return m; }

// тень корабля на облаках, пока он под ними
const shadeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFade: { value: 0 } }, vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uFade; varying vec2 vP; void main(){ float r = length(vP*vec2(2.2, 1.0)); float a = smoothstep(1.0, 0.25, r) * 0.55 * uFade; gl_FragColor = vec4(0.10, 0.14, 0.30, a);${TAIL} }` });
function shade() { const m = new THREE.Mesh(G.disc, shadeMat.clone()); m.scale.setScalar(44); m.renderOrder = 13; return m; }

// ---------- пламя двигателя ----------
const flameGeo = (() => { const g = new THREE.CylinderGeometry(1, 0.12, 1, 14, 6, true); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.5); return g; })();   // основание в нуле, хвост уходит в −Z
const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uPow: { value: 0 }, uSeed: { value: 0 } },
  vertexShader: `uniform float uT, uSeed; varying float vK; varying vec3 vN; varying vec3 vV; void main(){ vK = -position.z; vec3 p = position; float w = vK*vK; p.x += sin(uT*31.0 + uSeed + vK*9.0)*0.10*w; p.y += cos(uT*27.0 + uSeed*1.7 + vK*7.0)*0.10*w;
    vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uT, uPow, uSeed; varying float vK; varying vec3 vN; varying vec3 vV;
    void main(){ float face = pow(abs(dot(normalize(vN), normalize(vV))), 1.3); float core = pow(1.0 - vK, 1.6); float fl = 0.82 + 0.18*sin(uT*47.0 + uSeed + vK*23.0);
      float a = core * (0.25 + 0.75*face) * fl * uPow; vec3 c = mix(uCol, vec3(1.0, 0.97, 0.9), core*core*0.75) * (1.2 + 2.6*core);
      gl_FragColor = vec4(c*a, a*0.35);${TAIL} }` });
// одно сопло: внешний факел, яркое ядро и светящийся срез
function flame(h, r) { const g = new THREE.Group(); const mk = () => { const m = new THREE.Mesh(flameGeo, flameMat.clone()); m.material.uniforms.uCol.value = lin(h); m.material.uniforms.uSeed.value = Math.random() * 10; m.renderOrder = 13; g.add(m); return m; };
  const outer = mk(), inner = mk(); const disc = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: lin(h).multiplyScalar(2.5) })); disc.scale.set(r * 0.8, r * 0.8, r * 0.3); g.add(disc);
  g.userData = { r, outer, inner, disc, pow: 0, set(p, boost, t) { this.pow += (p - this.pow) * 0.18; const k = this.pow; const L = r * (1.6 + 7.5 * k + boost * 9); outer.scale.set(r * (0.95 + 0.25 * boost), r * (0.95 + 0.25 * boost), L); inner.scale.set(r * 0.5, r * 0.5, L * 0.55);
    outer.material.uniforms.uPow.value = 0.25 + 0.75 * k + boost * 0.4; inner.material.uniforms.uPow.value = 0.5 + 0.9 * k + boost * 0.5; outer.material.uniforms.uT.value = t; inner.material.uniforms.uT.value = t; disc.scale.set(r * 0.8, r * 0.8, r * 0.3).multiplyScalar(0.7 + 0.5 * k); } }; return g; }

// полупрозрачная копия корабля для «Обманки»
function ghost(src, h) { const own = [], seen = new Map(); const g = src.clone(true);
  g.traverse(o => { if (!o.isMesh) return; const m0 = o.material; if (!seen.has(m0)) { const m = m0.clone(); m.transparent = true; m.opacity = 0.8; if (m.emissive) { m.emissive = lin(h); m.emissiveIntensity = 0.45; m.emissiveMap = null; } own.push(m); seen.set(m0, m); } o.material = seen.get(m0); o.castShadow = false; });
  g.visible = true; g.userData.own = own; g.userData.anim = t => { const k = 0.72 + 0.14 * Math.sin(t * 9) * Math.sin(t * 2.3); for (const m of own) m.opacity = k; }; return g; }

export function prop(kind, h) { const g = shadow(fuse(PROPS[kind](h))); g.userData.kind = kind; return g; }
export { dome, decal, wave, flame, ghost, cloudProp, netProp, iceProp, shade, lamp };
// освободить то, что создавалось под один эффект
export function release(o) { if (!o) return; o.traverse(q => { if (q.userData.own) for (const x of q.userData.own) x.dispose(); }); }
