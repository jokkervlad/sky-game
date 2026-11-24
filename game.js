import { applyModel, loadModel, dropModel, pauseModel } from './models.js';
import * as D from './data.js';
import { initHangar, dmgTable } from './menu.js';
import { COINS } from './coins.js';
import { initBuild, waterMat } from './build.js';
import { initMission } from './mission.js';
import { LOOT } from './loot.js';
import * as FX from './fx.js';
import { ICONS } from './icons.js';
import { NET } from './net.js';
import { THREE, scene, camera, renderer, canvas, sunDir, sun, cloud, cloudMat, sky, islands, spires, makeIsland, makeSpire, rng, perlin3, STILL, vortex, CLUMP_G, CLUMP_M, CLUMP_D, ridged3, hemi, ROCK_VARIANTS, ROCKS } from './main.js';

const PLANE = 36;             // высота, на которой идёт вся игра
const $ = id => document.getElementById(id);
const rnd = rng(2024);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ---------- мир ----------
const SS = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);      // 0 при x<=a, 1 при x>=b
const inside = (d, r0, r1) => 1 - SS(d, r0, r1);                     // 1 внутри r0, 0 снаружи r1
// горный остров со снежной вершиной
makeIsland({ x: 560, y: 34, z: -460, R: 250, hill: 46, depth: 290, seed: 3, trees: 1100, peak: 230, collide: true, rock: 8, mood: 'conifer', kind: 'Горный остров' });
// остров с замком
makeIsland({ x: -520, y: 30, z: -560, R: 170, hill: 30, depth: 190, seed: 8, trees: 520, collide: true, rock: 1, mood: 'autumn', kind: 'Остров с замком', shape: (lx, lz, h) => lerp(h, 20, inside(Math.hypot(lx, lz), 66, 98)), noTrees: (lx, lz) => Math.hypot(lx, lz) < 94 });
// джунгли с руинами башни
makeIsland({ x: -230, y: 28, z: 520, R: 120, hill: 22, depth: 150, seed: 12, trees: 380, collide: true, rock: 5, mood: 'tropic', kind: 'Джунгли', shape: (lx, lz, h) => lerp(h, 14, inside(Math.hypot(lx - 10, lz + 5), 44, 60)), noTrees: (lx, lz) => Math.hypot(lx - 10, lz + 5) < 50 });
// озеро, река и водопад
const LAKE = { x: -45, z: 25, a: 0.75 }; const RIVER = []; for (let s = 30; s < 330; s += 5) RIVER.push([LAKE.x + Math.cos(LAKE.a) * s - Math.sin(LAKE.a) * 14 * Math.sin(s * 0.045), LAKE.z + Math.sin(LAKE.a) * s + Math.cos(LAKE.a) * 14 * Math.sin(s * 0.045)]);
const riverD = (lx, lz) => { let b = 1e9; for (const p of RIVER) { const d = Math.hypot(lx - p[0], lz - p[1]); if (d < b) b = d; } return b; };
makeIsland({ x: 1040, y: 34, z: 600, R: 210, hill: 36, depth: 230, seed: 21, trees: 650, collide: true, rock: 0, mood: 'tropic', kind: 'Озёрный остров', shape: (lx, lz, h) => { h = lerp(h, 6.4, inside(Math.hypot(lx - LAKE.x, lz - LAKE.z), 40, 84)); return lerp(h, 6.4, inside(riverD(lx, lz), 6.5, 26)); }, noTrees: (lx, lz) => Math.hypot(lx - LAKE.x, lz - LAKE.z) < 62 || riverD(lx, lz) < 13 });
// ледяной остров
makeIsland({ x: 120, y: 32, z: -1300, R: 220, hill: 38, depth: 230, seed: 30, trees: 650, peak: 60, collide: true, rock: 4, mood: 'winter', kind: 'Ледяной остров', shape: (lx, lz, h) => lerp(h, 9, inside(Math.hypot(lx + 70, lz - 40), 34, 74)), noTrees: (lx, lz) => Math.hypot(lx + 70, lz - 40) < 58 });
// вулкан
makeIsland({ x: -1350, y: 32, z: -160, R: 230, hill: 20, depth: 250, seed: 41, trees: 280, collide: true, rock: 6, mood: 'dark', kind: 'Вулкан', shape: (lx, lz, h) => { const d = Math.hypot(lx, lz); return h + 185 * Math.pow(Math.max(0, 1 - d / 165), 1.25) * (0.9 + 0.2 * ridged3(lx / 50, 0.7, lz / 50)) - 62 * inside(d, 10, 36); }, noTrees: (lx, lz) => Math.hypot(lx, lz) < 125 });
// Атлантида: плато с двумя кольцевыми каналами
makeIsland({ x: 300, y: 32, z: 1260, R: 290, hill: 26, depth: 280, seed: 52, trees: 380, collide: true, rock: 3, mood: 'tropic', kind: 'Атлантида', shape: (lx, lz, h) => { const d = Math.hypot(lx, lz); h = lerp(h * 0.5 + 8, 12, inside(d, 212, 246)); for (const rc of [100, 170]) h = lerp(h, 3, inside(Math.abs(d - rc), 8, 14)); return h; }, noTrees: (lx, lz) => Math.hypot(lx, lz) < 222 });
// пустыня с пирамидами
const PYR = [[0, 0, 62, 46], [95, -75, 38, 28], [-85, 70, 32, 24]];
makeIsland({ x: -900, y: 30, z: -1500, R: 195, hill: 10, depth: 200, seed: 63, trees: 0, collide: true, rock: 7, mood: 'summer', kind: 'Пустыня', shape: (lx, lz, h) => { h = 7 + 17 * Math.abs(Math.sin(lx * 0.034 + 2.6 * perlin3(lx / 120, 3.3, lz / 120))) * (0.55 + 0.45 * perlin3(lx / 70, 1.7, lz / 70) + 0.3); for (const p of PYR) h = lerp(h, 9, inside(Math.hypot(lx - p[0], lz - p[1]), p[2] * 0.85, p[2] * 1.35)); return h; } });
// первая миссия: ещё три горных острова в том же стиле. Стоят на местах скрытых островов и видны только в ней
makeIsland({ x: 1040, y: 34, z: 600, R: 170, hill: 40, depth: 230, seed: 71, trees: 620, peak: 150, collide: true, rock: 8, mood: 'conifer', kind: 'Горный остров', set: 'm1' });
makeIsland({ x: -520, y: 30, z: -560, R: 135, hill: 34, depth: 180, seed: 74, trees: 460, peak: 120, collide: true, rock: 8, mood: 'conifer', kind: 'Горный остров', set: 'm1' });
makeIsland({ x: -230, y: 28, z: 520, R: 95, hill: 28, depth: 140, seed: 77, trees: 300, peak: 80, collide: true, rock: 8, mood: 'conifer', kind: 'Горный остров', set: 'm1' });
// третья миссия: голые скалы бездны из обсидиана и базальта. Видны только в ней
makeIsland({ x: 900, y: 30, z: -300, R: 180, hill: 60, depth: 260, seed: 81, trees: 0, peak: 190, collide: true, rock: 9, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
makeIsland({ x: -1050, y: 30, z: 260, R: 150, hill: 50, depth: 220, seed: 83, trees: 0, peak: 150, collide: true, rock: 2, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
makeIsland({ x: 200, y: 28, z: 950, R: 170, hill: 54, depth: 240, seed: 85, trees: 0, peak: 170, collide: true, rock: 9, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
makeIsland({ x: 1300, y: 28, z: 300, R: 140, hill: 46, depth: 200, seed: 87, trees: 0, peak: 120, collide: true, rock: 2, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
makeIsland({ x: -900, y: 28, z: -900, R: 150, hill: 50, depth: 220, seed: 89, trees: 0, peak: 140, collide: true, rock: 9, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
makeIsland({ x: -1300, y: 26, z: 900, R: 130, hill: 40, depth: 190, seed: 91, trees: 0, peak: 100, collide: true, rock: 2, mood: 'dark', kind: 'Скала бездны', set: 'm3' });
// малые острова: подняты над облаками, у каждого свой материал
{ const r = rng(77); const moods = ['summer', 'autumn', 'dark', 'tropic', 'winter', 'tropic', 'dark', 'summer', 'summer', 'dark']; let n = 0, guard = 0; while (n < 10 && guard++ < 200) { const x = -1800 + r() * 3600, z = -1800 + r() * 3600, R = 30 + r() * 26; if (islands.some(il => Math.hypot(x - il.x, z - il.z) < il.R * 1.35 + R + 110) || Math.hypot(x, z) < 260 || Math.hypot(x + 640, z - 520) < 420 || [[300, -120], [-800, 300], [680, -1080], [-560, 60], [930, -170], [250, 260], [-900, 760], [1400, -520], [1500, 900]].some(q => Math.hypot(x - q[0], z - q[1]) < 190)) continue; const rock = n % 10; makeIsland({ x, y: 24 + r() * 8, z, R, hill: 8 + r() * 8, depth: 70 + r() * 70, seed: 100 + n, trees: rock === 7 ? 0 : 14 + (r() * 22 | 0), rock, mood: moods[rock], collide: true }); n++; } }
makeSpire({ x: 250, z: 260, h: 520, r: 70, seed: 2, rock: 9 }); makeSpire({ x: 335, z: 315, h: 380, r: 48, seed: 5, rock: 9 }); makeSpire({ x: 195, z: 350, h: 300, r: 40, seed: 9, rock: 2 });
makeSpire({ x: -900, z: 760, h: 620, r: 85, seed: 14, rock: 1 }); makeSpire({ x: -820, z: 850, h: 420, r: 55, seed: 17, rock: 1 }); makeSpire({ x: 1400, z: -520, h: 560, r: 80, seed: 23, rock: 4 });
cloudMat.uniforms.uShade.value.setRGB(0.53, 0.54, 0.80);

// препятствия для столкновений
const obstacles = [];
for (const il of islands) if (il.collide) obstacles.push({ x: il.x, z: il.z, rad: th => il.R * il.outline(th) * 0.97, il });
for (const s of spires) obstacles.push({ x: s.x, z: s.z, rad: () => s.r });
function obstacleAt(x, z, pad) { for (const o of obstacles) { if (o.il && o.il.off) continue; const dx = x - o.x, dz = z - o.z; const d = Math.hypot(dx, dz); const r = o.rad(Math.atan2(dz, dx)) + pad; if (d < r) return { o, d, r, nx: dx / (d || 1), nz: dz / (d || 1) }; } return null; }
function freeSpot(x, z, pad = 60) { let g = 0; while (obstacleAt(x, z, pad) && g++ < 40) { x += (rnd() - 0.5) * 200; z += (rnd() - 0.5) * 200; } return [x, z]; }

// ---------- постройки и вода ----------
const std = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const BM = { marble: std(0xe9e3d6, 0.5), gold: std(0xd8a63a, 0.28, 1), teal: std(0x1f9f96, 0.3, 0.35), stone: std(0x8f897c, 0.9), stoneDark: std(0x5d594f, 0.9), roof: std(0x7a2f22, 0.8), slate: std(0x39485a, 0.7), sand: std(0xcaa468, 0.92), wood: std(0x4a3524, 0.9), flag: new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.8, side: THREE.DoubleSide }),
  water: new THREE.MeshStandardMaterial({ color: 0x1a8fa3, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.86 }) };
const isl = k => islands.find(i => i.kind === k);
let BLD;
function put(g, geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
function columns(g, list, h, r, mat) { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(r * 0.86, r, h, 12), mat, list.length * 3); const capG = new THREE.BoxGeometry(r * 2.6, r * 0.7, r * 2.6); const M = new THREE.Matrix4(); const caps = new THREE.InstancedMesh(capG, mat, list.length * 2); list.forEach((p, i) => { M.makeTranslation(p[0], p[1] + h / 2, p[2]); im.setMatrixAt(i, M); M.makeTranslation(p[0], p[1] + h + r * 0.35, p[2]); caps.setMatrixAt(i * 2, M); M.makeTranslation(p[0], p[1] + r * 0.35, p[2]); caps.setMatrixAt(i * 2 + 1, M); }); im.count = list.length; im.castShadow = caps.castShadow = true; im.receiveShadow = caps.receiveShadow = true; g.add(im, caps); }
const waterfalls = [], emitters = [];
// склеиваем постройки одного острова в несколько крупных объектов: меньше нагрузка
function bake(g) { g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); const by = new Map(), rm = []; const M = new THREE.Matrix4();
  g.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.keep) { const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); geo.applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld)); if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(geo); rm.push(o); } });
  rm.forEach(o => o.parent.remove(o));
  for (const [mat, list] of by) { let n = 0; list.forEach(x => n += x.attributes.position.count); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let off = 0; for (const x of list) { pos.set(x.attributes.position.array, off * 3); nor.set(x.attributes.normal.array, off * 3); off += x.attributes.position.count; x.dispose(); } const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); const m = new THREE.Mesh(bg, mat); m.castShadow = !mat.transparent; m.receiveShadow = true; g.add(m); } }

BLD = initBuild({ scene, put, bake, BM, std, rng }); BM.marble = BLD.M.marbleB; BM.white = BLD.M.marbleB; BM.teal = BLD.M.copper;
// --- Атлантида
{ const il = isl('Атлантида'); const g = new THREE.Group(); g.position.set(il.x, 0, il.z); scene.add(g); const y0 = il.y + 12;
  for (const rc of [100, 170]) { const wm = waterMat('ring', rc - 13, rc + 13); waterfalls.push(wm); const w = new THREE.Mesh(new THREE.RingGeometry(rc - 13, rc + 13, 96).rotateX(-Math.PI / 2), wm); w.position.y = il.y + 8.2; w.userData.keep = true; g.add(w); }
  [[76, 0], [68, 3], [60, 6]].forEach(([r, dy]) => put(g, new THREE.CylinderGeometry(r, r + 2, 3, 64), BM.marble, 0, y0 + dy + 1.5, 0));
  const top = y0 + 9; const ringCols = []; for (let i = 0; i < 26; i++) { const a = i / 26 * 6.2832; ringCols.push([Math.cos(a) * 50, top, Math.sin(a) * 50]); } columns(g, ringCols, 36, 2.8, BM.marble);
  put(g, new THREE.CylinderGeometry(33, 33, 36, 40), BM.marble, 0, top + 18, 0);
  put(g, new THREE.CylinderGeometry(56, 56, 5, 64), BM.marble, 0, top + 40, 0); put(g, new THREE.CylinderGeometry(57.5, 57.5, 1.4, 64), BM.gold, 0, top + 43.2, 0);
  const dome = put(g, new THREE.SphereGeometry(46, 48, 18, 0, 6.2832, 0, Math.PI / 2), BM.teal, 0, top + 43.5, 0); dome.scale.y = 0.82;
  put(g, new THREE.SphereGeometry(5, 16, 12), BM.gold, 0, top + 83, 0); put(g, new THREE.ConeGeometry(2.2, 22, 10), BM.gold, 0, top + 97, 0);
  // четыре храма на среднем кольце
  const roofShape = new THREE.Shape(); roofShape.moveTo(-17, 0); roofShape.lineTo(17, 0); roofShape.lineTo(0, 9); roofShape.closePath(); const roofG = new THREE.ExtrudeGeometry(roofShape, { depth: 50, bevelEnabled: false }).translate(0, 0, -25);
  for (let k = 0; k < 4; k++) { const a = k / 4 * 6.2832 + 0.785; const t = new THREE.Group(); t.position.set(Math.cos(a) * 135, il.heightAt(Math.cos(a) * 135, Math.sin(a) * 135), Math.sin(a) * 135); t.rotation.y = -a + Math.PI / 2; g.add(t);
    put(t, new THREE.BoxGeometry(34, 3, 50), BM.marble, 0, 1.5, 0); const cl = []; for (let i = 0; i < 7; i++) for (const s of [-1, 1]) cl.push([s * 14, 3, -21 + i * 7]); for (const x of [-7, 0, 7]) for (const z of [-21, 21]) cl.push([x, 3, z]); columns(t, cl, 20, 1.5, BM.marble);
    put(t, new THREE.BoxGeometry(20, 20, 34), BM.marble, 0, 13, 0); put(t, new THREE.BoxGeometry(34, 2.4, 50), BM.marble, 0, 25.4, 0); put(t, roofG, BM.teal, 0, 26.6, 0); put(t, new THREE.SphereGeometry(1.8, 10, 8), BM.gold, 0, 37, 24); }
  // мосты через каналы и обелиски
  for (let k = 0; k < 4; k++) { const a = k / 4 * 6.2832; for (const rc of [100, 170]) { const b = put(g, new THREE.BoxGeometry(34, 2.4, 13), BM.marble, Math.cos(a) * rc, il.y + 11.6, Math.sin(a) * rc, -a); for (const s of [-1, 1]) put(g, new THREE.BoxGeometry(34, 3.4, 1.2), BM.marble, Math.cos(a) * rc - Math.sin(a) * s * 6, il.y + 14, Math.sin(a) * rc + Math.cos(a) * s * 6, -a); } }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832 + 0.39; const x = Math.cos(a) * 200, z = Math.sin(a) * 200, y = il.heightAt(x, z); put(g, new THREE.CylinderGeometry(1.7, 3.2, 34, 4), BM.marble, x, y + 17, z, 0.785); put(g, new THREE.ConeGeometry(2.4, 5, 4), BM.gold, x, y + 36.5, z, 0.785); }
  // статуи атлантов по сторонам от моста через внутренний канал
  for (const s of [-1, 1]) BLD.atlas(g, 124, il.heightAt(124, s * 15) - 0.4, s * 15, Math.PI / 2, 1);
  bake(g);
}
// --- разваленный средневековый замок
{ const il = isl('Остров с замком'); BLD.castle(il, il.y + 20); }
// --- башни
{ const il = isl('Ледяной остров'); const im = waterMat('ice'); const ice = new THREE.Mesh(new THREE.CircleGeometry(58, 40).rotateX(-Math.PI / 2), im); ice.position.set(il.x - 70, il.y + 10.6, il.z + 40); scene.add(ice); }
{ const il = isl('Озёрный остров'); BLD.watchTower(il, -95, -85); BLD.chapel(isl('Джунгли'), 10, -5);
  // озеро, река, водопад
  const g = new THREE.Group(); g.position.set(il.x, il.y + 8.6, il.z); scene.add(g); const lakeM = waterMat('lake'); waterfalls.push(lakeM); const lake = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), lakeM); lake.position.set(LAKE.x, 0, LAKE.z); lake.userData.keep = true; g.add(lake);
  let end = RIVER.length - 1; for (let i = 0; i < RIVER.length; i++) { const [x, z] = RIVER[i]; if (Math.hypot(x, z) / (il.R * il.outline(Math.atan2(z, x))) > 0.985) { end = i; break; } }
  const pos = [], idx = [], uvs = []; for (let i = 0; i <= end; i++) { uvs.push(0, i / end, 1, i / end); const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(end, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; const nx = -dz / l * 7.5, nz = dx / l * 7.5; pos.push(RIVER[i][0] + nx, 0, RIVER[i][1] + nz, RIVER[i][0] - nx, 0, RIVER[i][1] - nz); if (i < end) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3, k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); const riverM = waterMat('flow', end * 5); waterfalls.push(riverM); const river = new THREE.Mesh(rg, riverM); river.position.y = 0.05; river.userData.keep = true; g.add(river);
  const e = RIVER[end], p = RIVER[end - 2]; const ang = Math.atan2(e[0] - p[0], e[1] - p[1]); const wfMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: `uniform float uT; varying vec2 vUv; void main(){ float s = 0.55 + 0.45*sin(vUv.x*40.0 + sin(vUv.y*9.0 - uT*5.0)*2.0)*sin(vUv.y*26.0 - uT*9.0 + vUv.x*7.0); float a = (0.55 + 0.4*s)*smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x)*smoothstep(0.0,0.25,vUv.y); gl_FragColor = vec4(vec3(0.82,0.93,1.0)*(0.9+0.5*s), a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(15, 130, 1, 1).translate(0, -65, 0), wfMat); wf.position.set(e[0] + Math.sin(ang) * 4, -0.5, e[1] + Math.cos(ang) * 4); wf.rotation.y = ang; wf.userData.keep = true; g.add(wf); waterfalls.push(wfMat); bake(g);
}
// --- вулкан: лава и дым
{ const il = isl('Вулкан'); const cy = il.heightAt(0, 0); const lava = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.3, 0.18) })); lava.position.set(il.x, cy + 6, il.z); scene.add(lava); emitters.push({ kind: 'volcano', x: il.x, y: cy + 12, z: il.z, lava }); }
// --- пирамиды
{ const il = isl('Пустыня'); const g = new THREE.Group(); g.position.set(il.x, 0, il.z); scene.add(g); PYR.forEach(([lx, lz, s, h], k) => BLD.pyramid(g, lx, il.y + 8, lz, s, h, 500 + k));
  for (const [lx, lz] of [[-40, -95], [150, 30], [40, 120]]) BLD.obelisk(g, lx, il.heightAt(lx, lz) - 0.5, lz); bake(g); }
// ---------- стиль мира по миссии ----------
// Каждая миссия идёт в одном стиле: остаются только её острова, остальные скрыты вместе с постройками, обыском и столкновением.
// привязываем постройки, воду и лаву к своему острову, чтобы скрывать их вместе с ним
for (const o of scene.children) { if (!(o.isMesh || o.isGroup) || o === sky || o === cloud) continue; if (islands.some(il => il.parts.includes(o))) continue;
  const il = islands.find(il => !il.set && Math.hypot(o.position.x - il.x, o.position.z - il.z) < il.R); if (il) il.extra.push(o); }
for (const e of emitters) e.il = islands.find(il => il.kind && !il.set && Math.hypot(e.x - il.x, e.z - il.z) < il.R);
const THEMES = {
  'M-1': { kinds: ['Горный остров'], set: 'm1', moods: [], rock: 8 },                              // горы и хвойный лес
  'M-2': { kinds: ['Джунгли', 'Остров с замком', 'Озёрный остров'], moods: ['tropic', 'autumn'], rock: 5, giant: true }, // джунгли и осень: вся порода — мшистый сланец; гигантские деревья мира остаются (Великое древо)
  'M-3': { kinds: [], set: 'm3', moods: [], rock: 9, bare: true },                                  // бездна: обсидиан и базальт, без зелени
};
let worldRock = 0, worldMood = 'summer', worldId = null;
const ISLET = { 'M-1': [8, 'conifer'], 'M-2': [5, 'tropic'], 'M-3': [9, 'dark'] };   // порода и лес островков под маяки и постаменты
let worldBare = false;
// воронка в облаках (шейдер облаков): своя у мира; в миссиях без спуска она убрана, M-2 ставит её туда, где открывает вихрь
const VORTEX0 = vortex.clone(); function cloudVortex(x, z, r) { vortex.set(x, z, r || 0.001); }
function setWorld(id) { worldId = id || null; const th = THEMES[id] || null; if (id && id !== 'M-3') cloudVortex(0, 0, 0); else vortex.copy(VORTEX0); [worldRock, worldMood] = ISLET[id] || [0, 'summer']; worldBare = !!(th && th.bare);
  // в «голой» миссии (бездна) прячутся и островки мира с маяками и гигантскими деревьями: тема держится только на скалах миссии
  // островки мира под маяками и гигантскими деревьями в миссиях скрыты; в M-2 остаются только островки гигантских деревьев — голая порода миссии, без летнего леса
  for (const il of islands) { const giant = !il.kind && !il.collide && objects.some(o => o.vis && Math.hypot(o.x - il.x, o.z - il.z) < 15); const on = il.set ? !!th && il.set === th.set : !th || (il.kind ? th.kinds.includes(il.kind) : il.collide ? th.moods.includes(il.mood) : giant && !!th.giant);
    il.off = !on; const bare = worldBare || (!!th && giant); for (const p of il.parts) p.visible = on && !(bare && p !== il.mesh); for (const p of il.extra) p.visible = on; il.mesh.material = ROCKS[th && th.rock != null && !il.set ? th.rock : il.rock][0]; }
  for (const s of spires) s.mesh.material = ROCKS[th && th.spire != null ? th.spire : th && th.rock != null ? th.rock : s.rock][1];
  for (const o of objects) if (o.kind === 'fish' && !o.mis) o.off = !!th;   // старые рыбные места мира: в миссиях свои пруды
  for (const o of objects) if (o.kind === 'island') { o.off = o.il.off; if (o.off) o.lbl.style.display = 'none'; } else if (o.vis || (o.kind === 'beacon' && o.g)) { const il = islands.find(q => !q.set && Math.hypot(o.x - q.x, o.z - q.z) < q.R + 10); if (il) { o.off = il.off; (o.vis || o.g).visible = !o.off; if (o.off && o.lbl) o.lbl.style.display = 'none'; } } }
// островок под постройку миссии (маяк, постамент): скала в породе текущей миссии. Столкновение снимается вместе с этапом или миссией
const isletPool = new Map();
function islet(x, z, { R = 34, seed = 0, life = 'stage' } = {}) { const key = R + ':' + worldRock + ':' + worldMood + ':' + seed; let q = isletPool.get(key);
  if (!q) { q = makeIsland({ x: 0, y: 26, z: 0, R, hill: 8, depth: R * 2.1, seed: 400 + seed, trees: worldBare ? 0 : R > 30 ? 8 : 5, rock: worldRock, mood: worldMood, detached: true }); isletPool.set(key, q); }
  q.g.position.set(x, 0, z); q.g.userData.rec = ['islet', x, z, R, seed, life]; obstacles.push({ x, z, rad: () => R * 0.8, life }); return q; }
function dropObst(life) { for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].life === life) obstacles.splice(i, 1); if (NET.host) NET.bcast('dropObst', life); }
function updateWorldFx(dt) { for (const m of waterfalls) m.uniforms.uT.value = time; for (const e of emitters) { if ((e.il && e.il.off) || dist2(P.x, P.z, e.x, e.z) > 1100) continue;
    if (rnd() < 0.12) { const a = rnd() * 6.28; fire.emit({ x: e.x + Math.cos(a) * rnd() * 22, y: e.y, z: e.z + Math.sin(a) * rnd() * 22, vx: Math.cos(a) * 18, vy: 40 + rnd() * 70, vz: Math.sin(a) * 18, life: 0.8 + rnd() * 0.8, s0: 8, s1: 2, r: 3.4, g: 0.9 + rnd(), b: 0.1, a: 1, drag: 0.6 }); } e.lava.material.color.setRGB(4.4 + Math.sin(time * 2.3) * 1.1, 1.15 + Math.sin(time * 3.1) * 0.3, 0.16); }
  updatePortalFx(dt); }

// ---------- частицы ----------
class Particles {
  constructor(max, additive) {
    this.max = max; this.items = []; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendSrc: additive ? THREE.OneFactor : THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vCol; void main(){ vCol = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*uScale/max(-mv.z, 1.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vCol; void main(){ float d = length(gl_PointCoord - 0.5); ${additive ? 'float a = exp(-d*d*17.0)*smoothstep(0.5, 0.34, d); gl_FragColor = vec4(vCol.rgb*vCol.a*a, vCol.a*a*0.55);' : 'float a = smoothstep(0.5, 0.02, d); a *= a; gl_FragColor = vec4(vCol.rgb, vCol.a*a);'}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 12 : 11; scene.add(this.pts);
  }
  emit(o) { if (this.items.length >= this.max) this.items.shift(); this.items.push(Object.assign({ vx: 0, vy: 0, vz: 0, t: 0, life: 1, s0: 10, s1: 20, r: 1, g: 1, b: 1, a: 1, drag: 0 }, o)); }
  update(dt) {
    const it = this.items; let n = 0;
    for (let i = 0; i < it.length; i++) { const p = it[i]; p.t += dt; if (p.t >= p.life) continue; const k = p.t / p.life; if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z; this.size[n] = lerp(p.s0, p.s1, k); const fade = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      this.col[n * 4] = p.r; this.col[n * 4 + 1] = p.g; this.col[n * 4 + 2] = p.b; this.col[n * 4 + 3] = p.a * fade; it[n++] = p; }
    it.length = n; const g = this.pts.geometry; g.setDrawRange(0, n); g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}
const fire = new Particles(1400, true), smoke = new Particles(1400, false);
function explosion(x, y, z, s = 1, tint = [3.2, 1.8, 0.4]) { NET.fx('explosion', [x, y, z, s, tint]);
  for (let i = 0; i < 16 * s; i++) { const a = rnd() * 6.28, e = (rnd() - 0.3) * 1.6, v = (30 + rnd() * 70) * s; fire.emit({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, life: 0.35 + rnd() * 0.4, s0: 16 * s, s1: 46 * s, r: tint[0] * (0.8 + rnd() * 0.4), g: tint[1] * (0.8 + rnd() * 0.4), b: tint[2] * (0.8 + rnd() * 0.4), a: 0.9, drag: 3 }); }
  fire.emit({ x, y, z, life: 0.22, s0: 40 * s, s1: 150 * s, r: tint[0] + 0.4, g: tint[1] + 0.4, b: tint[2] + 0.4, a: 1 });
  for (let i = 0; i < 12 * s; i++) { const a = rnd() * 6.28, v = (12 + rnd() * 30) * s; smoke.emit({ x: x + (rnd() - 0.5) * 12 * s, y: y + (rnd() - 0.5) * 8, z: z + (rnd() - 0.5) * 12 * s, vx: Math.cos(a) * v, vy: 8 + rnd() * 16, vz: Math.sin(a) * v, life: 1.4 + rnd() * 1.4, s0: 24 * s, s1: 80 * s, r: 0.16, g: 0.15, b: 0.15, a: 0.55, drag: 1.2 }); }
}
// всплеск облаков, когда корабль ныряет под них или выныривает
function splash() { shockRing(P.x, P.z, 80, 0xf2f6ff); for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, v = 20 + rnd() * 50; smoke.emit({ x: P.x + Math.cos(a) * 12, y: 4 + rnd() * 14, z: P.z + Math.sin(a) * 12, vx: Math.cos(a) * v, vy: 14 + rnd() * 30, vz: Math.sin(a) * v, life: 1.2 + rnd() * 1.2, s0: 26, s1: 80, r: 0.8, g: 0.86, b: 1.0, a: 0.7, drag: 1.6 }); } }
function puff(x, y, z, s, col = [0.75, 0.75, 0.78], a = 0.35, life = 1.2) { smoke.emit({ x, y, z, vy: 4, life, s0: s, s1: s * 2.6, r: col[0] * 1.6, g: col[1] * 1.6, b: col[2] * 1.6, a }); }

// ---------- корабль игрока ----------
const hullMat = new THREE.MeshStandardMaterial({ color: 0x565c66, roughness: 0.4, metalness: 0.85 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 0.5, metalness: 0.8 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0xa87432, roughness: 0.35, metalness: 0.95 });
function makeShip(accent = 0x4fd8ff) {
  const g = new THREE.Group(); const L = 46, W = 12, Hh = 7;
  const sh = new THREE.Shape(); sh.moveTo(0, L * 0.55); sh.lineTo(W * 0.5, L * 0.12); sh.lineTo(W * 0.5, -L * 0.36); sh.lineTo(W * 0.3, -L * 0.45); sh.lineTo(-W * 0.3, -L * 0.45); sh.lineTo(-W * 0.5, -L * 0.36); sh.lineTo(-W * 0.5, L * 0.12); sh.closePath();
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: Hh, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2 }).rotateX(Math.PI / 2).translate(0, Hh / 2, 0), hullMat));
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(W * 0.34, Hh * 0.7, L * 0.7), darkMat, 0, -Hh * 0.75, -L * 0.02);
  add(new THREE.BoxGeometry(W * 0.5, Hh * 0.8, L * 0.2), hullMat, 0, Hh * 0.85, -L * 0.14);
  add(new THREE.BoxGeometry(W * 0.3, Hh * 0.5, L * 0.1), darkMat, 0, Hh * 1.45, -L * 0.16);
  add(new THREE.CylinderGeometry(1.6, 2.0, 2.2, 12), darkMat, 0, Hh * 0.75, L * 0.2);                       // мортира
  add(new THREE.CylinderGeometry(0.9, 0.9, 4.5, 10).rotateX(-0.9), darkMat, 0, Hh * 1.05, L * 0.23);
  const engMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accent, emissiveIntensity: 5 }); g.userData.engMat = engMat;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(W * 0.24, Hh * 0.55, L * 0.34), darkMat, s * W * 0.62, -Hh * 0.05, -L * 0.1);
    add(new THREE.BoxGeometry(0.5, Hh * 0.14, L * 0.6), trimMat, s * (W * 0.5 + 1.3), Hh * 0.18, -L * 0.1);
    for (let k = 0; k < 3; k++) { add(new THREE.CylinderGeometry(1.3, 1.6, 1.6, 10), darkMat, s * W * 0.28, Hh * 0.55, L * (0.1 - k * 0.17)); add(new THREE.CylinderGeometry(0.28, 0.28, 5.5, 6).rotateZ(Math.PI / 2), darkMat, s * (W * 0.28 + 2.6), Hh * 0.62, L * (0.1 - k * 0.17)); }
    add(new THREE.CylinderGeometry(Hh * 0.26, Hh * 0.3, 3, 14).rotateX(Math.PI / 2), engMat, s * W * 0.24, -Hh * 0.05, -L * 0.46);
    add(new THREE.BoxGeometry(1.6, 1.6, 9), trimMat, s * W * 0.2, Hh * 1.0, -L * 0.3);                          // ракетные направляющие
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
const P = { diveK: 0, wasDive: false, wakeT: 0, thr: 0, boost: 0, x: 0, z: 0, yaw: 0.6, speed: 0, hp: 600, maxHp: 600, bank: 0, dead: 0, hitCd: 0, wind: 0, dvx: 0, dvz: 0, dashCd: 0, dashT: 0, aim: 0, still: 0, flood: 0, bubble: 0, shock: 0, flame: 0, flameT: 0, trail: 0, trailT: 0, buffW: 0, buffA: 0, cry: 0, anchor: 0, over: 0, will: 0, bots: 0, gambit: 0, dive: 0, rapid: 0, tail: 0, burn: 0, mirror: 0, probe: 0, bull: 0, pierce: false, second: false, calm: false };
const ship = makeShip(); scene.add(ship);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fe8ff, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false });
const ring = new THREE.Mesh(new THREE.RingGeometry(31, 34, 64).rotateX(-Math.PI / 2), ringMat); ring.renderOrder = 15; ring.visible = false;
const tick = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 3).rotateX(Math.PI / 2), ringMat); tick.renderOrder = 15; tick.visible = false;
const tRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a55, transparent: true, opacity: 0.95, depthWrite: false, fog: false, toneMapped: false })); tRing.renderOrder = 15; tRing.visible = false; scene.add(tRing);

// ---------- подписи и всплывающие числа ----------
const labels = $('labels'); const V = new THREE.Vector3();
function mkLabel(cls, text, bar = true) { const d = document.createElement('div'); d.className = 'lbl ' + cls; d.innerHTML = `<span></span>${bar ? '<div class="hb"><i></i></div>' : ''}`; d.firstChild.textContent = text; labels.appendChild(d); return d; }
function place(el, x, y, z) { V.set(x, y, z).project(camera); if (V.z > 1 || V.z < -1 || Math.abs(V.x) > 1.1 || Math.abs(V.y) > 1.1) { el.style.display = 'none'; return false; } el.style.display = ''; el.style.left = ((V.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-V.y * 0.5 + 0.5) * innerHeight) + 'px'; return true; }
function floatText(text, color, x, y, z, big) { V.set(x, y, z).project(camera); if (V.z > 1) return; const d = document.createElement('div'); d.className = big ? 'fl big' : 'fl'; d.textContent = text; d.style.color = color; d.style.left = ((V.x * 0.5 + 0.5) * innerWidth + (rnd() - 0.5) * 30) + 'px'; d.style.top = ((-V.y * 0.5 + 0.5) * innerHeight) + 'px'; labels.appendChild(d); setTimeout(() => d.remove(), 1150); }
// модальное окно: игра стоит, пока не нажато «ОК». В сетевой игре — пока «ОК» не нажмут все
const modalQ = []; let modalOn = false;
function modal(head, text, kick, ok, mid) { if (NET.host && NET.live && !mid) { mid = ++modalN; NET.bcast('modal', [mid, head, text, kick]); } modalQ.push({ head, text, kick, ok, mid, acks: new Set(), need: NET.host ? new Set(NET.players().map(g => g.id)) : null }); if (!modalOn && !hangarOpen) nextModal(); }
let modalN = 0, modalCur = null;
function nextModal() { const m = modalQ.shift(); if (!m) { modalOn = false; $('modal').style.display = 'none'; keys.clear(); return; } modalOn = true; $('modal-k').textContent = m.kick || ''; $('modal-h').textContent = m.head; $('modal-t').textContent = m.text; $('modal').style.display = 'flex'; modalCur = m; $('modal-ok').disabled = false; $('modal-ok').textContent = 'ОК'; $('modal-ok').onclick = () => { if (m.mid && NET.live) return modalAck(m, NET.id); nextModal(); if (m.ok) m.ok(); }; setTimeout(() => $('modal-ok').focus(), 0); }
let storyT = 0; function story(text, got, color) { $('story-t').textContent = text; const g = $('story-g'); g.textContent = got; g.style.color = color || '#ffe08a'; $('story').style.display = 'block'; storyT = 10; }
let toastT = 0, muteLog = false; function log(text, color) { if (muteLog) return; const el = $('toast'); el.textContent = text; el.style.color = color || '#eef2f6'; el.style.display = 'block'; toastT = 2.6; }
const meLbl = mkLabel('me', 'ВЫ');


// ---------- настройки, сохранение ----------
const LS = { get(k, d) { try { const v = localStorage.getItem('sky3d.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sky3d.' + k, JSON.stringify(v)); } catch (e) {} } };
const KEY = Object.assign({}, D.KEYS_DEFAULT, LS.get('keys', {}));
const keyName = c => !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : ({ ShiftLeft: 'Shift', ShiftRight: 'Shift (пр.)', ControlLeft: 'Ctrl', ControlRight: 'Ctrl (пр.)', AltLeft: 'Alt', Space: 'Пробел', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`' }[c] || c);
// снаряжение: этап 1, 2 или 3 — как на первой, второй и третьей миссии
// Набор по умолчанию пустой: корабль, оружие, техника, специальность и команда выбираются перед вылетом.
const L = Object.assign({ ship: 'SHIP-0', chosen: false, stage: 1, weapons: [], devices: [], spec: null, skills2: [], feat2: null, featX: null, skillX: null, crew: [], mission: null, nick: '' }, LS.get('loadout2', {}));
if (!D.MISSIONS[L.mission]) L.mission = null;
if (STILL && !/[?&]menu/.test(location.search)) Object.assign(L, { chosen: true, stage: 3, weapons: ['W-1', 'W-2', 'W-3', 'W-4'], devices: ['EQ-01', 'EQ-02', 'EQ-03', 'EQ-04'], spec: 'SPEC-1', featX: 'F-16', skillX: 'S-16', crew: ['CREW-03', 'CREW-02'] });
if (!D.SHIPS[L.ship]) { L.ship = 'SHIP-0'; L.chosen = false; } if (!D.SPECS[L.spec]) L.spec = null; if (!D.FEATS[L.featX]) L.featX = null; if (!D.SKILLS[L.skillX]) L.skillX = null; if (!Array.isArray(L.skills2)) L.skills2 = [];
L.weapons = L.weapons.filter(w => D.WEAPONS[w]); L.devices = L.devices.filter(w => D.DEVICES[w]); L.crew = L.crew.filter(w => D.CREW[w]);
const shop = { open: false, lv: { wpn: 0, arm: 0, hp: 0, spd: 0, life: 0 } };
const S = { hp: 600, speed: 1, armor: 1, arm: 1, dmg: 1 };       // итоговые характеристики корабля
let ACTIVE = new Set(); const has = id => ACTIVE.has(id);
function activeFeats() { const f = D.SHIPS[L.ship].feats; const x = L.stage >= 3 && L.featX && !f.includes(L.featX) ? [L.featX] : []; if (!f.length) return x; if (L.stage <= 1) return [f[0]]; if (L.stage === 2) return f.slice(1).includes(L.feat2) ? [f[0], L.feat2] : [f[0]]; return [...f, ...x]; }
function activeSkills() { if (L.stage < 2 || !L.spec) return []; if (L.stage === 2) return D.SPECS[L.spec].skills.filter(q => L.skills2.includes(q)).slice(0, 2); const s = [...D.SPECS[L.spec].skills]; if (L.stage >= 3 && L.skillX && !s.includes(L.skillX)) s.push(L.skillX); return s; }
const hexN = h => parseInt(h.slice(1), 16);
const glow = (h, k = 2.2) => { const c = new THREE.Color(h); const g = k / Math.sqrt(Math.max(c.r, c.g, c.b, 0.04)); return [c.r * g + 0.03, c.g * g + 0.03, c.b * g + 0.03]; };
const txt = h => `color-mix(in srgb, ${h} 62%, white)`;
const fmt = v => (Math.round(v * 10) / 10).toLocaleString('ru-RU');

// ---------- ресурсы ----------
const res = { gold: 0, wood: 0, fish: 0, pearls: 0, beacons: 0 };
function hudRes() { $('r-gold').textContent = fmt(res.gold); $('r-wood').textContent = res.wood; $('r-fish').textContent = res.fish; $('r-pearls').textContent = res.pearls; $('r-beacons').textContent = res.beacons + '/3'; }
function gain(k, n, x, z) { res[k] += n; const nm = { wood: 'древесины', fish: 'рыбы', pearls: 'жемчуга' }[k]; if (nm && n > 0) floatText('+' + n + ' ' + nm, '#ffe08a', x ?? P.x, PLANE + 26, z ?? P.z); hudRes(); }
// монеты: золото = 1, серебро = 0,7, медь = 0,5; всё складывается в общее золото. После открытия лавки монеты не падают
const COIN_N = { gold: ['золотая', '#ffd24a'], silver: ['серебряная', '#dfe6ee'], bronze: ['медная', '#e0905a'] };
function coin(kind, n = 1, x, z, ally) { if (shop.open || n <= 0) return; let v = D.COIN[kind] * n * TIERS[tier].loot; if (!ally) { if (has('F-20')) v *= 1.3; if (has('CREW-07')) v *= 1.15; } res.gold += v; if (NET.client) NET.req('gold', v); floatText(`+${n} ${COIN_N[kind][0]} (${fmt(v)})`, COIN_N[kind][1], x ?? P.x, PLANE + 30, z ?? P.z); hudRes(); return v; }
// награда с тела: значок монеты, название и сколько золота, 3 секунды
let lootT = 0; function lootToast(kind, n, v) { $('loot').innerHTML = `<img src="${COINS[kind]}" alt="" width="56" height="56"><div><b>${D.COIN_NAMES[kind]}${n > 1 ? ' × ' + n : ''}</b><span>+${fmt(v)} золота</span></div>`; $('loot').style.display = 'flex'; lootT = 1.5; }
function heal(n, quiet) { if (P.dead) return; const h = Math.min(S.hp - P.hp, n); if (h <= 0) return; P.hp += h; if (!quiet) floatText('+' + Math.round(h), '#63dcb4', P.x, PLANE + 22, P.z); }

// ---------- мобы и боссы ----------
let SEE = false;                       // видят ли мобы игрока (отвечают ли на атаку). Пока выключено
const mobSkin = new THREE.MeshStandardMaterial({ color: 0x3a2c40, roughness: 0.55, metalness: 0.1 });
const blobGeo = new THREE.SphereGeometry(1, 14, 10);
function mobMesh(T) { const g = new THREE.Group(); const b = new THREE.Mesh(blobGeo, mobSkin); b.scale.set(T.r * 0.8, T.r * 0.45, T.r * 1.1); b.castShadow = true; g.add(b); applyModel(g, T.model, { scale: T.scale, tint: T.tint }); return g; }
const mobs = [];
function spawnMob(id, x, z, o = {}) { if (NET.client && !o.net) { NET.req('spawn', [id, Math.round(x), Math.round(z), { respawn: o.respawn, name: o.name, hpMul: o.hpMul, dmgMul: o.dmgMul, scale: o.scale }]); return null; } const T = D.MOBS[id] || D.BOSSES[id]; const boss = !!D.BOSSES[id]; const sc = o.scale || 1; const hp = T.hp * (o.hpMul || 1);
  const m = { id, T, boss, arm: T.arm, x, z, hx: x, hz: z, yaw: rnd() * 6.28, hp, max: hp, baseMax: hp, aggro: false, cd: 1 + rnd() * 2, burst: 0, kx: 0, kz: 0, wander: rnd() * 6.28, wt: 0, name: o.name || T.name, mesh: mobMesh(T), dmgMul: o.dmgMul || 1, baseDmg: o.dmgMul || 1, r: T.r * sc, respawn: o.respawn !== false, added: !!o.added, dead: 0, strafe: rnd() < 0.5 ? 1 : -1, cd2: 2 + rnd() * 3, lunge: 0, wind: 0, slam: 0, beam: 0, tick: 0, stun: 0, slow: 0, burn: 0, bt: 0, mark: 0, acid: 0, blind: 0, weak: 0 };
  m.sc = sc; m.mesh.scale.setScalar(sc); m.mesh.position.set(x, PLANE, z); scene.add(m.mesh); m.lbl = mkLabel(boss ? 'boss' : '', m.name); mobs.push(m); if (!o.net) NET.mobNid(m); return m; }
function removeMob(m) { const i = mobs.indexOf(m); if (i < 0) return; m.gone = true; NET.mobRemoved(m); dropModel(m.mesh); scene.remove(m.mesh); m.lbl.remove(); mobs.splice(i, 1); if (target === m) target = null; }
const START_MOBS = [[-330, 280, 'MOB-01', 3], [560, 300, 'MOB-09', 2], [760, -40, 'MOB-01', 2], [800, 20, 'MOB-09', 2], [-760, -220, 'MOB-16', 1], [160, -760, 'MOB-16', 1], [220, -700, 'MOB-09', 2], [-380, 900, 'MOB-01', 3], [1300, 200, 'MOB-09', 2], [-1000, 420, 'MOB-16', 1], [60, 420, 'MOB-10', 2], [-420, -250, 'MOB-10', 2], [1150, -420, 'MOB-10', 2],
  [-600, -900, 'MOB-02', 3], [900, -700, 'MOB-05', 3], [-1150, 120, 'MOB-11', 2], [-180, -1000, 'MOB-17', 1], [-260, 300, 'MOB-18', 1], [330, -330, 'MOB-19', 1]];
function spawnStart() { START_MOBS.forEach(([x, z, id, n]) => { for (let i = 0; i < n; i++) { const [fx, fz] = freeSpot(x + (rnd() - 0.5) * 120, z + (rnd() - 0.5) * 120, D.MOBS[id].r + 40); spawnMob(id, fx, fz); } }); }
spawnStart();
// добавление и удаление из ангара (вкладка «Мобы и боссы»)
function addMob(id) { const T = D.MOBS[id] || D.BOSSES[id]; const a = P.yaw + (rnd() - 0.5) * 1.2, d = 240 + T.r * 2 + rnd() * 120; const [fx, fz] = freeSpot(P.x + Math.sin(a) * d, P.z + Math.cos(a) * d, T.r + 30); return spawnMob(id, fx, fz, { respawn: false, added: true }); }
function removeMobOf(id) { for (let i = mobs.length - 1; i >= 0; i--) if (mobs[i].id === id) { removeMob(mobs[i]); return true; } return false; }
function countMob(id) { let n = 0; for (const m of mobs) if (m.id === id && !m.dead) n++; return n; }
function clearMobs() { while (mobs.length) removeMob(mobs[0]); }

let target = null, inspect = null, inspDirty = false;
const ST_NAMES = [['stun', 'оглушён'], ['slow', 'замедлен'], ['mark', 'метка'], ['burn', 'горит'], ['acid', 'кислота'], ['blind', 'ослеплён'], ['weak', 'ослаблен'], ['shell', 'смоляной панцирь'], ['noheal', 'не лечится']];
const numRu = v => String(Math.round(v * 100) / 100).replace('.', ',');
// карточка цели: постоянная часть собирается один раз, прочность и состояния обновляются на ходу
function drawInspect() { const el = $('inspect'); if (inspect && (inspect.dead || inspect !== target)) inspect = null; if (!inspect) { el.style.display = 'none'; return; } { const mp = $('map').getBoundingClientRect(), sb = $('slots').getBoundingClientRect(), top = Math.round(mp.bottom + 8), low = sb.right > innerWidth - 324 ? $('php').getBoundingClientRect().top - 8 : innerHeight - 16; el.style.top = top + 'px'; el.style.maxHeight = Math.max(160, low - top) + 'px'; } const m = inspect, T = m.T, A = D.ARMOR[m.arm];
  if (inspDirty) { inspDirty = false; el.style.display = 'block'; const dmg = T.dmg * m.dmgMul, rank = m.boss ? 4 : T.cls + 1, sp = T.speed / (125 * S.speed);
    $('in-body').innerHTML = `<h2>${m.name}</h2><div class="sub"><span class="pips" aria-hidden="true">${'<i class="on"></i>'.repeat(rank)}${'<i></i>'.repeat(4 - rank)}</span>${m.boss ? 'Босс' : D.CLS_NAMES[T.cls][0].toUpperCase() + D.CLS_NAMES[T.cls].slice(1) + ' враг'}</div>
      <p class="desc">${T.desc || ''}</p>
      <div class="hpl"><span id="in-hpt"></span><span class="regen" title="Восстановление в секунду" aria-label="Восстановление: 0 в секунду">+0</span></div><div class="bar"><i id="in-hp"></i></div>
      <h3>Броня: ${lowFirst(A.name)}</h3>${dmgTable(A.m.map((v, i) => [D.DT_NAMES[i], v]))}
      <div class="two"><div><h3>Удар</h3><p>${dmg > 0 ? `<b>${numRu(dmg)}</b> · ${D.DT_FULL[T.atk]}` : 'Не нападает'}</p></div><div><h3>Скорость</h3><p><b>${T.speed}</b> · ${sp > 1.05 ? 'быстрее вас' : sp < 0.7 ? 'намного медленнее вас' : sp < 0.95 ? 'медленнее вас' : 'как у вас'}</p></div></div>
      <h3>Приёмы</h3><ul class="moves">${D.AI_INFO[T.ai].map(q => q[0] === '!' ? `<li class="dng"><span class="tagd">опасно</span>${q.slice(1)}</li>` : `<li>${q}</li>`).join('')}${T.sp && D.SP_INFO[T.sp] ? (D.SP_INFO[T.sp][0] === '!' ? `<li class="dng"><span class="tagd">опасно</span>${D.SP_INFO[T.sp].slice(1)}</li>` : `<li>${D.SP_INFO[T.sp]}</li>`) : ''}${T.water ? '<li class="dng"><span class="tagd">опасно</span>Заливает экран водой. Спасает толчок союзника</li>' : ''}</ul>
      <div id="in-st" class="chips"></div>`; }
  $('in-hp').style.width = Math.max(0, m.hp / m.max * 100) + '%'; $('in-hpt').textContent = m.gone ? 'Уничтожен' : m.dead ? 'Уничтожен' : `${Math.max(0, Math.ceil(m.hp))} / ${Math.round(m.max)}`;
  const st = ST_NAMES.filter(([k]) => m[k] > 0).map(([k, n]) => `<span>${n} · ${m[k].toFixed(1).replace('.', ',')} с</span>`).join(''); const se = $('in-st'); if (se.dataset.h !== st) { se.dataset.h = st; se.innerHTML = st; } }
const inR = (x, z, r) => mobs.filter(m => !m.dead && dist2(x, z, m.x, m.z) < r + m.r);
// урон по мобу: type — 0 КИН, 1 ВЗР, 2 ПРБ, 3 ОГН, 4 ТОК; броня моба задаёт множитель
function hitMob(m, dmg, type = 0, o = {}) { if (!m || m.dead) return 0; let k = o.pierce ? 1.5 : D.ARMOR[m.arm].m[type]; let crit = false;
  if (!o.dot) { k *= S.dmg; if (P.buffW > 0) k *= 1.2; if (P.fDmg > 0) k *= 1.15; if (P.cry > 0) k *= 1.15; if (P.anchor > 0) k *= 1.3; if (has('F-09') && P.still > 2) k *= 1.3; if (P.over > 0) k *= 1.15; if (has('F-30') && P.hp < S.hp * 0.25) k *= 1.3; if (has('F-15') && m.hp < m.max * 0.3) k *= 1.35; if (P.gambit > 0 || (has('F-13') && rnd() < 0.2)) { k *= 2; crit = true; } }
  if (m.mark > 0) k *= 1.2; if (m.acid > 0) k *= 1.25; if (m.open > 0) k *= 2;
  let melt = 0; if (m.shell > 0) { if (type === 3) { m.shell = 0; melt = 1; burst(m.x, m.z, m.r + 30, '#ffb030', 24); log('Огонь растопил смоляной панцирь', '#ffe08a'); } else { k *= 0.4; if (time - (m.shT || -9) > 1.5) { m.shT = time; floatText('смола', '#ffb030', m.x, PLANE + 26 + m.r, m.z); } } }
  if ((m.T.sp === 'shield' || m.T.sp === 'back') && !o.dot && m.stun <= 0) { let a = Math.atan2(P.x - m.x, P.z - m.z) - m.yaw; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (m.T.sp === 'shield' && a < 1.0) { k *= 0.25; floatText('щит', '#9fe8ff', m.x, PLANE + 26 + m.r, m.z); } else if (m.T.sp === 'back' && a > 2.0) { k *= 2; floatText('в спину', '#ffe08a', m.x, PLANE + 26 + m.r, m.z); } }
  if (m.boss && MIS.bossBright()) k *= 1.15; if (m.boss && MIS.bossDim()) { k *= 0.5; if (!o.dot && time - (hitMob.dimT || -9) > 6) { hitMob.dimT = time; log('Маяк погас: без света урон по боссу вдвое ниже', '#ffb4a0'); } }
  dmg = Math.max(1, Math.round(dmg * k));
  // гость: урон считает сам (свои усиления и броня цели), а снимает прочность и решает, сбит ли моб, ведущий
  if (NET.client) { if (m.nid) NET.req('hit', [m.nid, dmg, type, crit ? 1 : 0, o.dot ? 1 : 0, melt]); m.hp = Math.max(1, m.hp - dmg); floatText(crit ? 'КРИТ ' + dmg : String(dmg), crit ? '#ffd24a' : o.color ? txt(o.color) : '#ffffff', m.x, PLANE + 14 + m.r, m.z, crit); if (has('F-18') && !o.dot) heal(dmg * 0.04, true); return dmg; }
  m.hp -= dmg; if (SEE) m.aggro = true; floatText(crit ? 'КРИТ ' + dmg : String(dmg), crit ? '#ffd24a' : o.color ? txt(o.color) : '#ffffff', m.x, PLANE + 14 + m.r, m.z, crit);
  if (has('F-18') && !o.dot) heal(dmg * 0.04, true);
  if (m.hp <= 0) killMob(m); return dmg; }
function killMob(m, remote) { m.dead = 1; MIS.onKill(m); explosion(m.x, PLANE, m.z, m.boss ? 1.6 : m.T.cls === 2 ? 1.1 : 0.6);
  // тело остаётся висеть: заваливается на бок или на спину и ждёт, пока над ним пролетят
  m.loot = shop.open ? null : m.boss ? ['gold', 5] : [['bronze', 'silver', 'gold'][m.T.cls], 1]; m.ct = 0; m.fade = -1; m.cside = rnd() < 0.5 ? 1 : -1; m.cy = m.mesh.position.y; pauseModel(m.mesh, true); m.far = null;
  m.lbl.firstChild.textContent = m.loot ? 'Добыча: пролетите над телом' : shop.open && !m.kid ? 'Без добычи: лавка открыта' : ''; m.lbl.classList.add('loot');
  if (m.kid) { m.loot = null; m.lbl.firstChild.textContent = ''; }
  if (m.stolen) { res.gold += m.stolen * 2; floatText('+' + fmt(m.stolen * 2) + ' золота', '#ffd24a', m.x, PLANE + 30, m.z); log('Ворюга сбит: золото вернулось вдвое', '#ffe08a'); m.stolen = 0; hudRes(); }
  if (m.T.sp === 'split' && !m.kid && !m.still) for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, q = spawnMob(m.id, m.x + Math.cos(a) * 26, m.z + Math.sin(a) * 26, { respawn: false, scale: 0.55, hpMul: 0.35, name: 'Осколок' }); q.kid = true; q.mis = m.mis; q.aggro = m.aggro; q.kx = Math.cos(a) * 120; q.kz = Math.sin(a) * 120; }
  if (has('F-21') && !remote) P.over = 5; if (target === m) target = null; m.rt = 60; }
function corpse(m, dt) { m.ct += dt; const big = m.boss || m.T.cls === 2, e = 1 - Math.pow(1 - Math.min(1, m.ct / (big ? 1.4 : 0.8)), 3);
  m.mesh.rotation.z = m.cside * e * (big ? 1.35 : Math.PI);                    // крупные валятся на бок, мелкие переворачиваются на спину
  m.mesh.position.y = m.cy - e * m.r * (big ? 0.3 : 0.45) + Math.sin(time * 1.1 + m.hx) * 1.5 * e;
  if (m.fade < 0 && !NET.client) { const ally = m.loot && m.ct > 0.5 && NET.live ? NET.players().find(g => !g.dead && !(g.dive > 0) && dist2(g.x, g.z, m.x, m.z) < m.r + 40) : null;
    if (m.loot && m.ct > 0.5 && !P.dead && P.dive <= 0 && dist2(P.x, P.z, m.x, m.z) < m.r + 34) { const [k, n] = m.loot; m.loot = null; const v = coin(k, n, m.x, m.z); if (v) lootToast(k, n, v); m.fade = 0.5; }
    else if (ally) { const [k, n] = m.loot; m.loot = null; const v = coin(k, n, m.x, m.z, true); if (v) NET.tell(ally.id, 'loot', [k, n, v]); m.fade = 0.5; }
    else if (m.ct > (m.loot ? 45 : m.kid ? 2.5 : 12)) { m.loot = null; m.fade = 0.5; } }
  if (m.fade < 0) {
    if (m.loot && rnd() < dt * 3) fire.emit({ x: m.x + (rnd() - 0.5) * m.r, y: PLANE + m.r * 0.4 + rnd() * 10, z: m.z + (rnd() - 0.5) * m.r, vy: 22 + rnd() * 16, life: 0.8, s0: 2.6, s1: 0.4, r: 4, g: 3, b: 0.8, a: 1 }); }
  else if (m.fade > 0) { m.fade = Math.max(0, m.fade - dt); m.mesh.scale.setScalar(m.sc * Math.max(0.001, m.fade / 0.5)); if (m.fade === 0) { m.mesh.visible = false; m.lbl.style.display = 'none'; if (!m.respawn) removeMob(m); } } }
function die() { MIS.onDeath(); P.hp = 0; P.dead = waitRevive() ? 1e9 : 5; P.revive = 0; P.lost = 0; P.rooted = 0; P.hex = 0; P.sleep = 0; P.ink = 0; P.rot = 0; explosion(P.x, PLANE, P.z, 2.4); ship.visible = false; target = null; log(waitRevive() ? 'Корабль сбит. Союзники могут поднять вас: подлететь к обломкам и держать действие' : 'Корабль сбит', '#ff7a66'); $('dead-w').textContent = waitRevive() ? 'Ждите: союзники могут поднять вас. Если сбиты все, команда вернётся у последней отметки' : ''; $('dead-c').style.display = waitRevive() ? 'none' : ''; $('dead').style.display = 'flex'; }
// урон по игроку: класс брони корабля (множитель по типу) и число брони (−5 % за единицу)
function damagePlayer(dmg, why, type = 0, o = {}) { if (P.dead || P.dive > 0) return;
  if (!o.raw) { if (has('F-31') && rnd() < 0.12) return floatText('уворот', '#9fe8ff', P.x, PLANE + 22, P.z); if (has('F-22') && P.bubble <= 0) { P.bubble = 22; ball(34, '#8fe8ff', null, 0.7); shockRing(P.x, P.z, 40, 0x9fe8ff); return floatText('щит', '#9fe8ff', P.x, PLANE + 22, P.z); }
    let k = D.ARMOR[S.arm].m[type] * Math.max(0.2, 1 - D.ARMOR_PCT * S.armor); if (P.buffA > 0) k *= 0.8; if (P.fArm > 0) k *= 0.85; if (P.wArm > 0) k *= 0.9; if (P.will > 0) k *= 0.3; if (P.bots > 0) k *= 0.75; if (has('F-09') && P.still > 2) k *= 1.2; if (P.gambit > 0) k *= 1.25; if (type === 3 && has('F-29')) k *= 0.5; dmg *= k; }
  P.lastHit = time; dmg = Math.max(1, Math.round(dmg)); P.hp -= dmg; floatText('-' + dmg, '#ff7a66', P.x, PLANE + 22, P.z);
  if (o.from && !o.from.dead) { if (has('F-17') && o.melee) hitMob(o.from, dmg * 0.35, 0, { dot: true }); if (has('CREW-09') && P.shock <= 0) { P.shock = 15; bolt(P.x, P.z, o.from.x, o.from.z, '#7DF9FF'); hitMob(o.from, 80, 4, { dot: true, color: '#7DF9FF' }); } }
  if (P.hp <= 0) { if (has('F-16') && !P.second) { P.second = true; P.hp = Math.round(S.hp * 0.25); shockRing(P.x, P.z, 90, 0xffd24a); log('Вторая жизнь: корабль встал сам с 25 % корпуса', '#ffd24a'); } else if (shop.lv.life > 0) { shop.lv.life = 0; P.hp = Math.round(S.hp / 3); shockRing(P.x, P.z, 90, 0xffd24a); log('Запасной котёл: корабль встал сам с третью корпуса', '#ffd24a'); } else die(); } }

// ---------- снаряды ----------
const shots = []; const shellGeo = new THREE.SphereGeometry(1.1, 8, 6), eShotMat = new THREE.MeshBasicMaterial({ color: 0xff5a90, toneMapped: false }), rocketGeo = new THREE.CylinderGeometry(0.8, 0.8, 7, 8).rotateX(Math.PI / 2), mortGeo = new THREE.SphereGeometry(2.4, 10, 8);
const markGeo = new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2);
const matCache = new Map(); const flat = h => { if (!matCache.has(h)) matCache.set(h, new THREE.MeshBasicMaterial({ color: hexN(h), toneMapped: false })); return matCache.get(h); };
const ringMat2 = h => new THREE.MeshBasicMaterial({ color: typeof h === 'string' ? hexN(h) : h, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false });
const blast = r => r * (has('CREW-05') ? 1.25 : 1);
const wRange = id => D.WEAPONS[id].range * (has('F-08') ? 1.25 : 1);
function fireCannons(R) { if (target && target.nid) NET.fx('cannVis', [target.nid, P.x, P.z, P.yaw]); const t = target, col = D.WEAPONS['W-1'].color, g = glow(col); const n = 4; const dx = t.x - P.x, dz = t.z - P.z; const side = Math.sign(Math.sin(Math.atan2(dx, dz) - P.yaw)) || 1; const rx = Math.cos(P.yaw) * side, rz = -Math.sin(P.yaw) * side; const pierce = P.pierce; P.pierce = false;
  for (let i = 0; i < n; i++) { const off = (i - 1.5) * 7; const sx = P.x + rx * 9 + Math.sin(P.yaw) * off, sz = P.z + rz * 9 + Math.cos(P.yaw) * off; const hit = rnd() * 100 < P.aim; const d = Math.hypot(t.x - sx, t.z - sz); const miss = hit ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.12); const ang = Math.atan2(t.x - sx, t.z - sz) + miss; const mesh = new THREE.Mesh(shellGeo, flat(col)); scene.add(mesh);
    shots.push({ kind: 'shell', mesh, g, col, x: sx, y: PLANE + 4, z: sz, vx: Math.sin(ang) * 560, vz: Math.cos(ang) * 560, life: (d + (hit ? 0 : 220)) / 560, hit, t, pierce, dmg: (26 + rnd() * 8) * (has('CREW-01') ? 1.15 : 1), delay: i * 0.07 });
    fire.emit({ x: sx, y: PLANE + 4, z: sz, life: 0.16, s0: 14, s1: 48, r: g[0], g: g[1], b: g[2], a: 1 }); for (let k = 0; k < 4; k++) smoke.emit({ x: sx, y: PLANE + 4, z: sz, vx: rx * (20 + rnd() * 30), vy: 4 + rnd() * 8, vz: rz * (20 + rnd() * 30), life: 0.9 + rnd() * 0.6, s0: 8, s1: 34, r: 1.3, g: 1.3, b: 1.35, a: 0.4, drag: 2.5 }); } }
function fireRocket(t, dmg, col, x = P.x, z = P.z, yaw = P.yaw, vis) { if (!vis) NET.fx('rockVis', [t && t.nid || 0, col, x, z, yaw]); const g = glow(col); const mesh = new THREE.Mesh(rocketGeo, flat(col)); scene.add(mesh); shots.push({ kind: 'rocket', vis, mesh, g, col, x, y: PLANE + 9, z, yaw, sp: 126, life: 6, t, dmg }); fire.emit({ x, y: PLANE + 9, z, life: 0.2, s0: 20, s1: 60, r: g[0], g: g[1], b: g[2], a: 1 }); }
function fireMortar(tx, tz, dmg, rad, col, sx = P.x, sz = P.z, dur = 1.6, vis) { if (!vis) NET.fx('mortVis', [tx, tz, rad, col, sx, sz, dur]); const g = glow(col); const mesh = new THREE.Mesh(mortGeo, flat(col)); scene.add(mesh); const mark = new THREE.Mesh(markGeo, ringMat2(col)); mark.scale.setScalar(blast(rad)); mark.position.set(tx, PLANE - 6, tz); mark.renderOrder = 14; scene.add(mark);
  shots.push({ kind: 'mortar', vis, mesh, mark, g, col, sx, sz, tx, tz, t0: 0, dur, dmg, rad: blast(rad) }); fire.emit({ x: sx, y: PLANE + 12, z: sz, life: 0.2, s0: 24, s1: 70, r: g[0], g: g[1], b: g[2], a: 1 }); }
function enemyShot(m, dmg, sp, off = 0) { const ang = Math.atan2(TP.x - m.x, TP.z - m.z) + off + (rnd() - 0.5) * 0.08 + (m.blind > 0 ? (rnd() - 0.5) * 1.6 : 0); eShotVis(m.x, m.z, ang, sp, false, m, dmg); NET.fx('eShotVis', [m.x, m.z, ang, sp]); }
function eShotVis(x, z, ang, sp, vis, m, dmg) { const mesh = new THREE.Mesh(shellGeo, eShotMat); mesh.scale.setScalar(1.8); scene.add(mesh); shots.push({ kind: 'enemy', vis, mesh, x, y: PLANE + 2, z, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, life: 3.2, dmg, m, type: m ? m.T.atk : 0, from: m ? m.name : '' }); fire.emit({ x, y: PLANE + 2, z, life: 0.18, s0: 12, s1: 34, r: 3.5, g: 0.8, b: 1.6, a: 1 }); }
const warns = [];
function warnRing(x, z, r, dur) { NET.fx('warnRing', [x, z, r, dur]); const m = new THREE.Mesh(markGeo, ringMat2(0xff3048)); m.position.set(x, PLANE - 4, z); m.scale.setScalar(r); m.renderOrder = 14; scene.add(m); warns.push({ m, t: 0, dur }); }
function enemyBomb(m, dmg) { const tx = TP.x + Math.sin(TP.yaw) * TP.speed * 1.2, tz = TP.z + Math.cos(TP.yaw) * TP.speed * 1.2; warnRing(tx, tz, 80, 2.0); eBombVis(m.x, m.z, tx, tz, false, m, dmg); NET.fx('eBombVis', [m.x, m.z, tx, tz]); }
function eBombVis(sx, sz, tx, tz, vis, m, dmg) { const mesh = new THREE.Mesh(mortGeo, eShotMat); scene.add(mesh); shots.push({ kind: 'ebomb', vis, mesh, sx, sz, tx, tz, t0: 0, dur: 2.0, dmg, m, from: m ? m.name : '' }); }
function updateShots(dt) { NET.mute++; try { shotsStep(dt); } finally { NET.mute--; } }
function shotsStep(dt) {
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; let done = false; const g = s.g;
    if (s.kind === 'shell') { if (s.delay > 0) { s.delay -= dt; s.mesh.visible = false; continue; } s.mesh.visible = true; s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; fire.emit({ x: s.x, y: s.y, z: s.z, life: 0.22, s0: 9, s1: 2, r: g[0], g: g[1], b: g[2], a: 0.95 });
      const land = () => { if (s.vis) return explosion(s.t.x, s.y, s.t.z, 0.5, g); hitMob(s.t, s.dmg, 0, { color: s.col, pierce: s.pierce }); explosion(s.t.x, s.y, s.t.z, 0.5, g); if (has('F-23')) for (const m of inR(s.t.x, s.t.z, 55)) if (m !== s.t) hitMob(m, s.dmg * 0.4, 0, { color: s.col }); };
      if (s.hit && !s.t.dead && dist2(s.x, s.z, s.t.x, s.t.z) < s.t.r + 8) { land(); done = true; } else if (s.life <= 0) { if (s.hit && !s.t.dead) land(); else puff(s.x, s.y - 20, s.z, 16, [0.9, 0.9, 0.95], 0.5, 0.8); done = true; } }
    else if (s.kind === 'rocket') { s.life -= dt; s.sp = Math.min(273, s.sp + 231 * dt); if (s.t && !s.t.dead) { const want = Math.atan2(s.t.x - s.x, s.t.z - s.z); let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); s.yaw += clamp(d, -3.2 * dt, 3.2 * dt); }
      s.x += Math.sin(s.yaw) * s.sp * dt; s.z += Math.cos(s.yaw) * s.sp * dt; s.y = lerp(s.y, PLANE + 2, 1 - Math.exp(-2 * dt)); s.mesh.rotation.y = s.yaw;
      fire.emit({ x: s.x - Math.sin(s.yaw) * 4, y: s.y, z: s.z - Math.cos(s.yaw) * 4, life: 0.45, s0: 12, s1: 3, r: g[0], g: g[1], b: g[2], a: 1 }); smoke.emit({ x: s.x - Math.sin(s.yaw) * 5, y: s.y, z: s.z - Math.cos(s.yaw) * 5, vy: 3, life: 1.4 + rnd() * 0.6, s0: 6, s1: 28, r: 1.4, g: 1.1, b: 1.3, a: 0.4 });
      for (const m of mobs) if (!m.dead && dist2(s.x, s.z, m.x, m.z) < m.r + 6) { if (!s.vis) hitMob(m, s.dmg, 1, { color: s.col }); if (!s.vis) for (const q of inR(s.x, s.z, blast(45))) if (q !== m) hitMob(q, s.dmg * 0.3, 1, { color: s.col }); explosion(s.x, s.y, s.z, 1.2, g); done = true; break; }
      if (!done && (s.life <= 0 || obstacleAt(s.x, s.z, 0))) { explosion(s.x, s.y, s.z, 0.9, g); done = true; } }
    else if (s.kind === 'mortar') { s.t0 += dt; const k = Math.min(1, s.t0 / s.dur); s.x = lerp(s.sx, s.tx, k); s.z = lerp(s.sz, s.tz, k); s.y = PLANE + 10 + Math.sin(k * Math.PI) * 170; s.mark.material.opacity = 0.5 + 0.5 * Math.sin(s.t0 * 22); fire.emit({ x: s.x, y: s.y, z: s.z, life: 0.4, s0: 10, s1: 2, r: g[0], g: g[1], b: g[2], a: 0.6 });
      if (k >= 1) { explosion(s.tx, PLANE, s.tz, s.rad / 26, g); if (!s.vis) for (const m of inR(s.tx, s.tz, s.rad)) hitMob(m, s.dmg, 1, { color: s.col }); scene.remove(s.mark); done = true; } }
    else if (s.kind === 'ebomb') { s.t0 += dt; const k = Math.min(1, s.t0 / s.dur); s.x = lerp(s.sx, s.tx, k); s.z = lerp(s.sz, s.tz, k); s.y = PLANE + 6 + Math.sin(k * Math.PI) * 150; fire.emit({ x: s.x, y: s.y, z: s.z, life: 0.4, s0: 12, s1: 3, r: 2.4, g: 0.3, b: 1.0, a: 0.8 }); if (k >= 1) { explosion(s.tx, PLANE, s.tz, 2.2, [2.6, 0.4, 1.2]); if (!s.vis) for (const q of teamPlayers(true)) if (dist2(s.tx, s.tz, q.x, q.z) < 85) hurtP(q, s.dmg, s.from + ': бомба', 1, { from: s.m }); done = true; } }
    else { s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; fire.emit({ x: s.x, y: s.y, z: s.z, life: 0.25, s0: 9, s1: 3, r: 3.2, g: 0.6, b: 1.6, a: 0.9 });
      const dp = dist2(s.x, s.z, P.x, P.z); const shield = zones.find(zn => zn.shield && dist2(s.x, s.z, zn.x, zn.z) < zn.r);
      const gh = !s.vis && NET.live ? NET.players().find(g => !g.dead && !(g.dive > 0) && dist2(s.x, s.z, g.x, g.z) < (g.mirror ? 60 : 17)) : null;
      if (s.vis) { if ((!P.dead && dp < 17) || shield || s.life <= 0 || obstacleAt(s.x, s.z, 0)) { puff(s.x, s.y, s.z, 14, [0.9, 0.6, 0.8], 0.5, 0.6); done = true; } }
      else if (gh) { if (gh.sh) puff(s.x, s.y, s.z, 14, [0.8, 0.8, 0.9], 0.6, 0.5); else if (gh.mirror) { bolt(s.x, s.z, s.m.x, s.m.z, '#C0C0C0'); hitMob(s.m, s.dmg, s.type, { dot: true, color: '#C0C0C0' }); } else { hurtP(gh.proxy, s.dmg, s.from, s.type, { from: s.m }); explosion(s.x, s.y, s.z, 0.5); } done = true; }
      else if (shield) { puff(s.x, s.y, s.z, 14, [0.8, 0.8, 0.9], 0.6, 0.5); done = true; }
      else if (P.mirror > 0 && dp < 60) { bolt(s.x, s.z, s.m.x, s.m.z, '#C0C0C0'); hitMob(s.m, s.dmg, s.type, { dot: true, color: '#C0C0C0' }); done = true; }
      else if (!P.dead && dp < 17) { damagePlayer(s.dmg, s.from, s.type, { from: s.m }); explosion(s.x, s.y, s.z, 0.5); done = true; } else if (s.life <= 0 || obstacleAt(s.x, s.z, 0)) { puff(s.x, s.y, s.z, 14, [0.9, 0.6, 0.8], 0.5, 0.6); done = true; } }
    if (done) { scene.remove(s.mesh); shots.splice(i, 1); } else s.mesh.position.set(s.x, s.y, s.z);
  }
}

// ---------- эффекты: кольца, молнии, зоны ----------
const rings = [];
function shockRing(x, z, r, color) { NET.fx('shockRing', [x, z, r, color]); const m = FX.wave(color); m.position.set(x, PLANE - 2, z); m.scale.setScalar(1); scene.add(m); rings.push({ m, t: 0, r }); }
const WHITE = new THREE.Color(1, 1, 1);
// молния: две скрещённые ленты, чтобы была видна и сверху, и сбоку
function bolt(ax, az, bx, bz, color = '#bfe8ff', jit = 22, w = 1.4) { NET.fx('bolt', [ax, az, bx, bz, color, jit, w]); const n = 9, g = glow(color, 3), pos = [], idx = []; const Ln = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / Ln, nz = (bx - ax) / Ln;
  for (let i = 0; i <= n; i++) { const k = i / n, j = (i === 0 || i === n) ? 0 : 1; const x = lerp(ax, bx, k) + (rnd() - 0.5) * jit * j, y = PLANE + 4 + (rnd() - 0.5) * jit * 0.7 * j, z = lerp(az, bz, k) + (rnd() - 0.5) * jit * j;
    pos.push(x + nx * w, y, z + nz * w, x - nx * w, y, z - nz * w, x, y + w, z, x, y - w, z); if (i < n) { const b = i * 4; idx.push(b, b + 1, b + 4, b + 1, b + 5, b + 4, b + 2, b + 3, b + 6, b + 3, b + 7, b + 6); }
    if (i % 3 === 1) fire.emit({ x, y, z, life: 0.28, s0: 20, s1: 5, r: g[0], g: g[1], b: g[2], a: 0.9 }); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const l = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(WHITE, 0.5), transparent: true, opacity: 1, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })); l.renderOrder = 16; l.frustumCulled = false; scene.add(l); rings.push({ m: l, t: 0, bolt: true }); }
function burst(x, z, r, color, n = 30) { NET.fx('burst', [x, z, r, color, n]); const g = glow(color); shockRing(x, z, r, hexN(color)); fire.emit({ x, y: PLANE + 6, z, life: 0.3, s0: r * 0.3, s1: r * 0.9, r: g[0], g: g[1], b: g[2], a: 0.5 }); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = r * (0.8 + rnd() * 1.2); fire.emit({ x, y: PLANE + (rnd() - 0.5) * 10, z, vx: Math.cos(a) * v, vy: (rnd() - 0.3) * 30, vz: Math.sin(a) * v, life: 0.5 + rnd() * 0.4, s0: 12, s1: 3, r: g[0], g: g[1], b: g[2], a: 0.9, drag: 2 }); } }
const zones = [];
// установки (турель, мортирная башня, электромаяк, манок, обманка, дрон): у них есть прочность, мобы рядом их бьют
function struct(zn, name, hp) { zn.struct = true; zn.hp = zn.max = hp; zn.name = name; zn.lbl = mkLabel('struct', name); return zn; }
// сильнейшая цель в круге: босс, потом крупные, средние, мелкие; среди равных — у кого больше прочности
function strongest(x, z, R) { let best = null, bk = -1; for (const m of mobs) { if (m.dead || dist2(x, z, m.x, m.z) > R) continue; const k = (m.boss ? 3 : (m.T.cls || 0)) * 1e6 + m.hp; if (k > bk) { bk = k; best = m; } } return best; }
// зона: круг на облаках, живёт life секунд, раз в every вызывает tick
// prop — модель в центре (имя из fx.js или готовый объект), py — её высота над плоскостью полёта, dome — купол, smoke/dens — частицы
function zone(o) { if (!o.follow && (!o.prop || typeof o.prop === 'string')) NET.fx('zone', [{ x: o.x, z: o.z, r: o.r, life: o.life, color: o.color, prop: o.prop, py: o.py, ps: o.ps, fill: o.fill, spin: o.spin, smoke: o.smoke, dens: o.dens, pcol: o.pcol, dome: o.dome }]); const dec = FX.decal(o.r, o.color, o.fill ?? 0.5, o.spin || 0); dec.position.set(o.x, PLANE - 5, o.z); scene.add(dec); const parts = [dec];
  let post = null; if (o.prop) { post = typeof o.prop === 'string' ? FX.prop(o.prop, o.color) : o.prop; post.position.set(o.x, PLANE + (o.py ?? 4), o.z); post.userData.base = post.position.clone(); scene.add(post); parts.push(post); }
  let domeM = null; if (o.dome) { domeM = FX.dome(o.r, o.color, o.dome === 'ball'); domeM.position.set(o.x, PLANE, o.z); scene.add(domeM); parts.push(domeM); }
  const zn = Object.assign({ t: 0, acc: 0, pacc: 0, every: 0.5, g: glow(o.color), dens: 0 }, o, { dec, post, domeM, parts }); zones.push(zn); return zn; }
function updateZones(dt) { for (let i = zones.length - 1; i >= 0; i--) { const zn = zones[i]; zn.t += dt; zn.acc += dt; const k = clamp(Math.min(zn.t / 0.25, (zn.life - zn.t) / 0.35), 0, 1);
    if (zn.follow) { zn.x = P.x; zn.z = P.z; zn.dec.position.set(zn.x, PLANE - 5, zn.z); if (zn.domeM) zn.domeM.position.set(zn.x, PLANE, zn.z); if (zn.post) zn.post.userData.base.set(zn.x, PLANE + (zn.py ?? 4), zn.z); }
    zn.dec.material.uniforms.uT.value = time; zn.dec.material.uniforms.uFade.value = k; if (zn.domeM) { zn.domeM.material.uniforms.uT.value = time; zn.domeM.material.uniforms.uFade.value = k; }
    if (zn.post) { zn.post.position.copy(zn.post.userData.base); zn.post.scale.setScalar((zn.ps || 1.5) * (0.3 + 0.7 * k)); if (zn.post.userData.anim) zn.post.userData.anim(time, dt, zn.post); }
    if (zn.fx) zn.fx(zn, dt, k);
    if (zn.struct) { if (zn.hp <= 0 && !zn.dead) { zn.dead = true; burst(zn.x, zn.z, 60, '#ff8a6a', 20); log(`${zn.name}: разрушено`, '#ffb4a0'); } zn.lbl.firstChild.textContent = `${zn.name} ${Math.max(0, Math.ceil(zn.hp))}`; zn.lbl.querySelector('i').style.width = Math.max(0, zn.hp / zn.max * 100) + '%'; place(zn.lbl, zn.x, PLANE + 46, zn.z); }
    zn.pacc += zn.dens * 40 * dt; while (zn.pacc >= 1) { zn.pacc -= 1; const a = rnd() * 6.28, r = Math.sqrt(rnd()) * zn.r * (zn.smoke ? 0.85 : 1); const c = zn.pcol || zn.g; (zn.smoke ? smoke : fire).emit({ x: zn.x + Math.cos(a) * r, y: PLANE + (zn.ph ?? (rnd() - 0.3) * 14), z: zn.z + Math.sin(a) * r, vx: zn.smoke ? (rnd() - 0.5) * 10 : 0, vy: zn.pvy ?? (zn.smoke ? 6 : 16), vz: zn.smoke ? (rnd() - 0.5) * 10 : 0, life: (zn.smoke ? 2.2 : 0.7) + rnd() * 0.6, s0: zn.smoke ? 50 : 9, s1: zn.smoke ? 120 : 3, r: c[0], g: c[1], b: c[2], a: zn.smoke ? 0.5 : 0.85 }); }
    while (zn.acc >= zn.every) { zn.acc -= zn.every; if (zn.tick) zn.tick(zn); }
    if (zn.dead || zn.t >= zn.life) { if (zn.end) zn.end(zn); if (zn.lbl) zn.lbl.remove(); for (const q of zn.parts) { scene.remove(q); FX.release(q); } zones.splice(i, 1); } } }
// эффекты, привязанные к кораблю или к мобу: живут, пока alive() возвращает true
const attach = [];
function stick(obj, pos, alive, anim) { scene.add(obj); pos(obj); attach.push({ obj, pos, alive, anim, t: 0 }); return obj; }
function updateAttach(dt) { for (let i = attach.length - 1; i >= 0; i--) { const a = attach[i]; a.t += dt; if (!a.alive(a)) { scene.remove(a.obj); FX.release(a.obj); attach.splice(i, 1); continue; } a.pos(a.obj); if (a.obj.userData.anim) a.obj.userData.anim(time, dt, a.obj); if (a.anim) a.anim(a.obj, dt, a); } }
const onShip = (dy = 0) => o => o.position.set(P.x, PLANE + dy, P.z);
function ball(r, col, key, dur) { const b = FX.dome(r, col, true); stick(b, onShip(2), a => key ? P[key] > 0 && !P.dead : a.t < dur, (o, dt, a) => { o.material.uniforms.uT.value = time; o.material.uniforms.uFade.value = key ? Math.min(1, a.t / 0.2, P[key] / 0.3) : Math.min(1, a.t / 0.1) * (1 - a.t / dur); }); return b; }
const smokeCol = h => { const c = new THREE.Color(h); return [c.r * 1.5 + 0.2, c.g * 1.5 + 0.2, c.b * 1.5 + 0.2]; };
const ahead = (d) => [P.x + Math.sin(P.yaw) * d, P.z + Math.cos(P.yaw) * d];
const edgePt = (range, def = 160) => { if (!target || target.dead) return ahead(def); const d = Math.hypot(target.x - P.x, target.z - P.z); if (d <= range) return [target.x, target.z]; return [P.x + (target.x - P.x) / d * range, P.z + (target.z - P.z) / d * range]; };
const aimPt = (range, def = 160) => target && dist2(P.x, P.z, target.x, target.z) < range ? [target.x, target.z] : ahead(def);
// base — прежнее ослабление прыжка: по боссу, задетому не первым, прибавка к урону прыжка действует наполовину
function chain(t, dmg, jumps, fall, col, hop = 200, base = fall) { const seen = new Set(); let px = P.x, pz = P.z, cur = t, d = dmg, d0 = dmg; for (let j = 0; j <= jumps && cur; j++) { bolt(px, pz, cur.x, cur.z, col); hitMob(cur, j && cur.boss ? (d + d0) / 2 : d, 4, { color: col }); seen.add(cur); px = cur.x; pz = cur.z; d *= fall; d0 *= base; let best = null, bd = hop; for (const m of mobs) if (!m.dead && !seen.has(m)) { const q = dist2(px, pz, m.x, m.z); if (q < bd) { bd = q; best = m; } } cur = best; } }
const inCone = (R, half, yaw = P.yaw) => mobs.filter(m => { if (m.dead) return false; const d = dist2(P.x, P.z, m.x, m.z); if (d > R + m.r) return false; let a = Math.atan2(m.x - P.x, m.z - P.z) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < half + Math.atan2(m.r, d || 1); });
function spray(yaw, half, sp, col, n, life = 0.5) { const g = glow(col); for (let i = 0; i < n; i++) { const a = yaw + (rnd() - 0.5) * 2 * half, v = sp * (0.6 + rnd() * 0.6); fire.emit({ x: P.x + Math.sin(P.yaw) * 22, y: PLANE + 3 + (rnd() - 0.5) * 6, z: P.z + Math.cos(P.yaw) * 22, vx: Math.sin(a) * v, vy: (rnd() - 0.4) * 20, vz: Math.cos(a) * v, life: life * (0.7 + rnd() * 0.6), s0: 12, s1: 26, r: g[0], g: g[1], b: g[2], a: 0.9, drag: 1.2 }); } }

// ---------- огненный след ----------
// Цепочка очагов за кормой. Каждый вспыхивает, три секунды горит языками пламени, дымит, сыплет искрами и подсвечивает облака.
const trail = []; let trailTick = 0;
const trailTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,225,160,1)'); gr.addColorStop(0.3, 'rgba(255,130,36,0.75)'); gr.addColorStop(0.7, 'rgba(230,60,8,0.22)'); gr.addColorStop(1, 'rgba(200,40,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const trailGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function trailNode(x, z) { const m = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })); m.position.set(x, PLANE - 8, z); m.renderOrder = 13; scene.add(m); trail.push({ x, z, t: 0, m, s: 0.8 + rnd() * 0.5 }); }
function updateTrail(dt) { const col = D.DEVICES['EQ-08'].color;
  if (P.trail > 0 && !P.dead) { const bx = P.x - Math.sin(P.yaw) * 24, bz = P.z - Math.cos(P.yaw) * 24, l = trail[trail.length - 1]; if (!l || dist2(l.x, l.z, bx, bz) > 12 || l.t > 0.35) trailNode(bx, bz); }
  if (!trail.length) return; trailTick -= dt; const hit = trailTick <= 0; if (hit) trailTick = 0.5; const burned = new Set();
  for (let i = trail.length - 1; i >= 0; i--) { const n = trail[i]; n.t += dt; const k = n.t / 3.2; if (k >= 1) { scene.remove(n.m); n.m.material.dispose(); trail.splice(i, 1); continue; }
    const pw = k < 0.06 ? k / 0.06 : 1 - Math.pow(k, 2.4);
    n.m.material.opacity = 0.34 * pw * (0.82 + 0.18 * Math.sin(time * 19 + n.x)); n.m.scale.setScalar(52 * n.s * (0.65 + 0.35 * pw));
    if (rnd() < dt * 11 * pw) { const a = rnd() * 6.28, r = rnd() * 9 * n.s; fire.emit({ x: n.x + Math.cos(a) * r, y: PLANE - 5, z: n.z + Math.sin(a) * r, vx: (rnd() - 0.5) * 7, vy: 24 + rnd() * 38, vz: (rnd() - 0.5) * 7, life: 0.4 + rnd() * 0.4, s0: (11 + rnd() * 8) * n.s, s1: 1.5, r: 3.8, g: 1.5 + rnd() * 1.1, b: 0.22, a: 0.95, drag: 0.7 }); }
    if (rnd() < dt * 2.2 * pw) fire.emit({ x: n.x + (rnd() - 0.5) * 12, y: PLANE + 4, z: n.z + (rnd() - 0.5) * 12, vx: (rnd() - 0.5) * 30, vy: 45 + rnd() * 60, vz: (rnd() - 0.5) * 30, life: 0.7 + rnd() * 0.6, s0: 2.4, s1: 0.5, r: 4.2, g: 2.2, b: 0.5, a: 1, drag: 0.5 });
    if (rnd() < dt * 2.4) smoke.emit({ x: n.x + (rnd() - 0.5) * 8, y: PLANE + 16, z: n.z + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 6, vy: 14 + rnd() * 8, vz: (rnd() - 0.5) * 6, life: 1.5 + rnd(), s0: 12, s1: 44, r: 0.13, g: 0.12, b: 0.11, a: 0.28 * pw + 0.06 });
    if (hit && pw > 0.15) for (const m of inR(n.x, n.z, 20)) if (!burned.has(m)) { burned.add(m); hitMob(m, 15, 3, { color: col, dot: true }); if (!m.dead) m.burn = Math.max(m.burn, 1); } } }

// ---------- слоты: оружие, техустройства, навыки ----------
let slots = [];
function buildSlots() { const s = D.SHIPS[L.ship]; const nw = s.w + (has('F-07') ? 1 : 0), nd = s.d + (has('F-11') ? 1 : 0); const old = slots; slots = [];
  const keep = (kind, id, i) => { const o = old.find(q => q.kind === kind && q.id === id && (i == null || q.i === i)); return o ? o.cd : 0; };
  // в каждый слот своё оружие, повторы разрешены
  for (let i = 0; i < nw; i++) { const id = L.weapons[i]; if (!D.WEAPONS[id]) continue; slots.push({ kind: 'w', i, id, cd: keep('w', id, i), max: D.WEAPONS[id].cd * (has('F-24') ? 0.85 : 1), key: 'slot' + (slots.length + 1), color: D.WEAPONS[id].color, name: D.WEAPONS[id].name }); }
  for (let i = 0; i < nd; i++) { const id = L.devices[i]; if (!D.DEVICES[id]) continue; slots.push({ kind: 'd', i, id, cd: keep('d', id), max: D.DEVICES[id].cd * (has('CREW-08') ? 0.85 : 1), key: 'slot' + (slots.length + 1), color: D.DEVICES[id].color, name: D.DEVICES[id].name }); }
  activeSkills().forEach((id, i) => slots.push({ kind: 's', i, id, cd: keep('s', id), max: D.SKILLS[id].cd, key: 'skill' + (i + 1), color: SKILL_COL[id] || '#ffd58a', name: D.SKILLS[id].name }));
  const box = $('slots'); box.innerHTML = ''; let prev = null;
  slots.forEach((sl, n) => { if (prev && prev !== sl.kind) { const gp = document.createElement('span'); gp.className = 'gap'; box.appendChild(gp); } prev = sl.kind; const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.style.boxShadow = `inset 0 -4px 0 ${sl.color}`; b.innerHTML = `<b>${keyName(KEY[sl.key])}</b><svg class="ic" viewBox="0 0 512 512" aria-hidden="true"><path fill="${txt(sl.color)}" d="${ICONS[sl.id] || ''}"/></svg><span class="nm">${sl.name}</span><span class="st"></span><i class="cd"></i>`; b.addEventListener('click', () => use(n)); b.addEventListener('contextmenu', e => { e.preventDefault(); toggleAuto(sl); }); b.addEventListener('pointerenter', () => showTip(sl)); b.addEventListener('pointerleave', hideTip); b.addEventListener('focus', () => showTip(sl)); b.addEventListener('blur', hideTip); box.appendChild(b); sl.el = b; sl.st = b.querySelector('.st'); sl.cdEl = b.querySelector('.cd'); }); }

// ---------- автоприменение: правая кнопка мыши по слоту ----------
// Оружие стреляет само, когда цель в досягаемости (пушки ждут полного прицела). Техника и навыки срабатывают в бою: лечащие при корпусе ниже 60 %, остальные при цели рядом.
const HEAL_IDS = new Set(['EQ-17', 'S-07', 'S-09', 'S-21', 'S-20', 'S-38', 'S-06']);
function autoKey(sl) { return sl.kind + ':' + sl.id + ':' + sl.i; }
function toggleAuto(sl) { L.auto = L.auto || []; const k = autoKey(sl), i = L.auto.indexOf(k); if (i >= 0) L.auto.splice(i, 1); else L.auto.push(k); LS.set('loadout2', L); log(`${sl.name}: автоприменение ${i >= 0 ? 'выключено' : 'включено'}`, i >= 0 ? '#c9d2c4' : '#d6f23a'); }
function updateAuto() { if (P.dead || P.sleep > 0 || !L.auto || !L.auto.length) return; const t = target && !target.dead ? target : null;
  slots.forEach((sl, n) => { if (sl.cd > 0 || !L.auto.includes(autoKey(sl))) return; let go = false;
    if (sl.kind === 'w') { if (!t) return; const d = dist2(P.x, P.z, t.x, t.z); go = sl.id === 'W-3' ? d < wRange('W-3') : sl.id === 'W-1' ? P.aim >= 95 && d < wRange('W-1') + t.r : d < wRange(sl.id) + t.r; }
    else if (HEAL_IDS.has(sl.id)) go = P.hp < P.maxHp * 0.6; else go = !!t && dist2(P.x, P.z, t.x, t.z) < 520;
    if (go) { muteLog = true; try { use(n); } finally { muteLog = false; } } }); }
// ---------- пауза: в сетевой игре останавливает игру у всех ----------
let paused = false;
function setPause(v, net) { if (!net && NET.client) return NET.req('pause', v); if (NET.host) NET.bcast('pause', v); paused = v; $('pausebox').style.display = v ? 'flex' : 'none'; $('pause-k').textContent = keyName(KEY.pause); }
// подсказка над слотом: что это, чем бьёт, против какой брони сильнее и слабее
const lowFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
function showTip(sl) { const el = $('tip'), w = D.WEAPONS[sl.id], it = w || D.DEVICES[sl.id] || D.SKILLS[sl.id]; if (!it || !sl.el) return; let h = `<b>${it.name}</b>`;
  if (w) { const A = Object.values(D.ARMOR), good = A.filter(a => a.m[w.type] >= 1.2).map(a => lowFirst(a.name)), bad = A.filter(a => a.m[w.type] <= 0.8).map(a => lowFirst(a.name));
    h += `<div class="tl">Урон ${w.dmg} · ${lowFirst(D.DT_FULL[w.type])} · перезарядка ${numRu(sl.max)} с</div>${good.length ? `<div class="tg"><i>Сильнее против</i> ${good.join(', ')}</div>` : ''}${bad.length ? `<div class="tb"><i>Слабее против</i> ${bad.join(', ')}</div>` : ''}`; }
  else h += `<div class="tl">${it.note}</div><div class="tl">Перезарядка ${numRu(sl.max)} с</div>`;
  h += `<div class="tl" style="margin-top:4px;color:var(--muted)">Правая кнопка мыши: автоприменение ${L.auto && L.auto.includes(autoKey(sl)) ? 'включено' : 'выключено'}</div>`;
  el.innerHTML = h; el.style.display = 'block'; const r = sl.el.getBoundingClientRect(), tw = el.offsetWidth; el.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8) + 'px'; el.style.top = Math.max(8, r.top - el.offsetHeight - 10) + 'px'; }
function hideTip() { $('tip').style.display = 'none'; }
// сумма прокачки товара лавки на купленных уровнях: 8 + 9 + 10 % и т. д.
function shopUp(id) { const it = D.SHOP.find(q => q.id === id); return it.step.slice(0, shop.lv[id]).reduce((a, b) => a + b, 0); }
function recompute(full) { hideTip();  ACTIVE = new Set([...activeFeats(), ...L.crew]); const s = D.SHIPS[L.ship]; S.hp = Math.round(s.hp * (has('CREW-10') ? 1.08 : 1)) + shopUp('hp'); S.speed = s.speed * (has('CREW-02') ? 1.1 : 1) * (1 + shopUp('spd') / 100); S.armor = s.armor + shopUp('arm'); S.arm = s.arm; S.dmg = 1 + shopUp('wpn') / 100; P.maxHp = S.hp; P.hp = full ? S.hp : Math.min(P.hp, S.hp); buildSlots(); hudRes(); helpText(); LS.set('loadout2', L); }
function swapSlot(n) { const sl = slots[n]; if (!sl || sl.kind === 's') return; if (sl.kind === 'w') { const ids = D.WEAPON_IDS, k = (ids.indexOf(sl.id) + 1) % ids.length; L.weapons[sl.i] = ids[k]; recompute(false); const it = D.WEAPONS[ids[k]]; return log(`Слот ${sl.i + 1}: ${it.name}. ${it.note}`, txt(it.color)); } const ids = sl.kind === 'w' ? D.WEAPON_IDS : D.DEVICE_IDS, arr = sl.kind === 'w' ? L.weapons : L.devices; const used = new Set(slots.filter(q => q.kind === sl.kind && q !== sl).map(q => q.id)); let k = ids.indexOf(sl.id); for (let j = 0; j < ids.length; j++) { k = (k + 1) % ids.length; if (!used.has(ids[k])) break; } arr[sl.i] = ids[k]; recompute(false); const it = sl.kind === 'w' ? D.WEAPONS[ids[k]] : D.DEVICES[ids[k]]; log(`Слот ${keyName(KEY[sl.key])}: ${it.name}. ${it.note}`, txt(it.color)); burst(P.x, P.z, 40, it.color, 14); }
function use(n) { const sl = slots[n]; if (!sl || P.dead || sl.cd > 0) return; if ((P.will > 0 || P.dive > 0) && sl.kind === 'w') return log('Сейчас стрелять нельзя'); const ok = sl.kind === 'w' ? fireWeapon(sl) : sl.kind === 'd' ? useDevice(sl) : useSkill(sl); if (ok !== false) sl.cd = sl.max; }
function fireWeapon(sl) { const w = D.WEAPONS[sl.id], R = wRange(sl.id), col = w.color, t = target;
  const need = () => { if (!t) { log(`${w.name}: сначала выберите цель (клик или ${keyName(KEY.target)})`); return false; } if (dist2(P.x, P.z, t.x, t.z) > R + t.r) { log(`${w.name}: цель слишком далеко`); return false; } return true; };
  if (sl.id === 'W-1') { if (!need() || P.aim < 5) return false; fireCannons(R); P.aim = Math.max(0, P.aim - 100 / slots.filter(q => q.kind === 'w').length); }
  else if (sl.id === 'W-2') { if (!need()) return false; fireRocket(t, 110, col); }
  else if (sl.id === 'W-3') { let [tx, tz] = target ? [target.x, target.z] : ahead(260); const d = dist2(P.x, P.z, tx, tz); if (d > R) { tx = P.x + (tx - P.x) * R / d; tz = P.z + (tz - P.z) * R / d; } fireMortar(tx, tz, 150, 60, col); }
  else if (sl.id === 'W-4') { if (!need()) return false; bolt(P.x, P.z, t.x, t.z, col, 3); const d = dist2(P.x, P.z, t.x, t.z) || 1, nx = (t.x - P.x) / d, nz = (t.z - P.z) / d; hitMob(t, 73.5, 2, { color: col }); t.slow = 4.5; if (t.T.cls === 0 && !t.boss) { t.kx = -nx * 300; t.kz = -nz * 300; } else { P.dvx += nx * 300; P.dvz += nz * 300; } burst(t.x, t.z, 26, col, 10); }
  else if (sl.id === 'W-5') { P.flame = 3; P.flameT = 0; }
  else if (sl.id === 'W-6') { if (!need()) return false; chain(t, 80, 3, 0.765, col, 200, 0.75); }
  else if (sl.id === 'W-7') { const yaw = t && dist2(P.x, P.z, t.x, t.z) < R + t.r ? Math.atan2(t.x - P.x, t.z - P.z) : P.yaw; spray(yaw, 0.38, 420, col, 46, 0.45); for (const m of inCone(R, 0.38, yaw)) { const d = dist2(P.x, P.z, m.x, m.z); hitMob(m, lerp(180, 70, clamp((d - 40) / (R - 40), 0, 1)), 0, { color: col }); if (m.T.cls === 0 && !m.boss) { m.kx = Math.sin(yaw) * 240; m.kz = Math.cos(yaw) * 240; } } smoke.emit({ x: P.x + Math.sin(P.yaw) * 20, y: PLANE + 4, z: P.z + Math.cos(P.yaw) * 20, life: 0.9, s0: 20, s1: 70, r: 1.2, g: 1.1, b: 1.1, a: 0.4 }); }
  return true; }
function useDevice(sl) { const id = sl.id, col = D.DEVICES[id].color, c = { color: col }; const NET = () => log(`${D.DEVICES[id].name}: в одиночной сцене только эффект, работает в сетевой игре`, txt(col));
  if (id === 'EQ-01') { for (const m of inR(P.x, P.z, 190)) { bolt(P.x, P.z, m.x, m.z, col); hitMob(m, 60 + rnd() * 15, 4, c); } burst(P.x, P.z, 190, col); }
  else if (id === 'EQ-02') { for (const m of inR(P.x, P.z, 230)) { const d = dist2(P.x, P.z, m.x, m.z) || 1; const f = 260 * (1 - d / 320); m.kx = (m.x - P.x) / d * f; m.kz = (m.z - P.z) / d * f; } for (let i = shots.length - 1; i >= 0; i--) if (shots[i].kind === 'enemy' && dist2(P.x, P.z, shots[i].x, shots[i].z) < 230) { scene.remove(shots[i].mesh); shots.splice(i, 1); } burst(P.x, P.z, 230, col, 50); }
  else if (id === 'EQ-03') { zone({ x: P.x, z: P.z, r: 150, life: 9, color: col, smoke: true, dens: 0.9, pcol: [0.9, 0.92, 0.95], hide: true, prop: 'smokepot', fill: 0.25 }); for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 130; smoke.emit({ x: P.x + Math.cos(a) * r, y: PLANE + rnd() * 10, z: P.z + Math.sin(a) * r, vy: 5, life: 3 + rnd() * 2, s0: 60, s1: 150, r: 0.9, g: 0.92, b: 0.95, a: 0.55 }); } log('Дымовая завеса: враги теряют вас из виду на 9 секунд', txt(col)); }
  else if (id === 'EQ-04') { const [x, z] = aimPt(320); const R = blast(120); burst(x, z, R, col, 50); zone({ x, z, r: R, life: 3, color: col, prop: FX.iceProp(R * 0.85), py: 0, ps: 1, fill: 0.9 }); for (const m of inR(x, z, R)) { if (m.boss) m.slow = 3; else m.stun = 3; } }
  else if (id === 'EQ-05') { zone({ x: P.x, z: P.z, r: 40, life: 30, color: col, prop: 'mine', fill: 0.35, every: 0.2, tick: zn => { if (inR(zn.x, zn.z, 40).length) zn.dead = true; }, end: zn => { if (!zn.dead) return; explosion(zn.x, PLANE, zn.z, 2.6, zn.g); for (const m of inR(zn.x, zn.z, blast(90))) hitMob(m, 200, 1, c); } }); }
  else if (id === 'EQ-06') { const [x, z] = aimPt(360, 200); zone({ x, z, r: 200, life: 4, color: col, prop: 'well', py: 10, ps: 1.8, spin: 1, fill: 0.7, every: 0.05, tick: zn => { for (const m of inR(zn.x, zn.z, 200)) if (!m.boss) { const d = dist2(zn.x, zn.z, m.x, m.z) || 1; m.kx = (zn.x - m.x) / d * 150; m.kz = (zn.z - m.z) / d * 150; } } }); }
  else if (id === 'EQ-07') { zone({ x: P.x, z: P.z, r: 400, life: 20, color: col, prop: 'flare', py: 95, ps: 1.6, fill: 0.2 }); fire.emit({ x: P.x, y: PLANE + 95, z: P.z, life: 0.8, s0: 60, s1: 260, r: 3, g: 2.8, b: 1.2, a: 0.7 }); log('Осветительная ракета: туман рассеян на 20 секунд, невидимые враги видны', txt(col)); }
  else if (id === 'EQ-08') { P.trail = 6; burst(P.x, P.z, 40, col, 20); }
  else if (id === 'EQ-09') { zone({ x: P.x, z: P.z, r: 100, life: 3, color: col, shield: true, follow: true, dome: true, fill: 0.3 }); }
  else if (id === 'EQ-10') { const [x, z] = ahead(120); struct(zone({ x, z, r: 30, life: 10, color: col, prop: 'lure', py: 2, fill: 0.4, decoy: true, fx: zn => { if (rnd() < 0.05) shockRing(zn.x, zn.z, 55, hexN(col)); } }), 'Манок', 200); log('Манок: мелкие и средние враги 10 секунд летят к нему', txt(col)); }
  else if (id === 'EQ-11') { struct(zone({ x: P.x, z: P.z, r: 200, life: 20, color: col, prop: 'tesla', py: 0, fill: 0.3, every: 0.5, tick: zn => { const m = strongest(zn.x, zn.z, 200); if (m) { bolt(zn.x, zn.z, m.x, m.z, col, 10); hitMob(m, 12, 4, c); } } }), 'Электромаяк', 250); }
  else if (id === 'EQ-12') { struct(zone({ x: P.x, z: P.z, r: 26, life: 20, color: col, prop: 'mortar', py: 2, fill: 0.3, every: 3, tick: zn => { const best = strongest(zn.x, zn.z, 420); if (best) zn.post.userData.aim = Math.atan2(best.x - zn.x, best.z - zn.z); if (best) fireMortar(best.x, best.z, 90, 50, col, zn.x, zn.z, 1.2); } }), 'Мортирная башня', 350); }
  else if (id === 'EQ-13') { const x = P.x, z = P.z; warnRing(x, z, blast(150), 4); zone({ x, z, r: 14, life: 4, color: col, prop: 'dynamite', py: 4, ps: 1.4, fill: 0.8, fx: zn => { if (rnd() < 0.5) fire.emit({ x: zn.x + (rnd() - 0.5) * 4, y: PLANE + 14, z: zn.z + (rnd() - 0.5) * 4, vx: (rnd() - 0.5) * 30, vy: 20 + rnd() * 30, vz: (rnd() - 0.5) * 30, life: 0.3, s0: 3.5, s1: 1, r: 2.2, g: 1.3, b: 0.3, a: 1 }); }, end: zn => { explosion(x, PLANE, z, 4.5, zn.g); for (const m of inR(x, z, blast(150))) hitMob(m, 260, 1, c); if (!P.dead && dist2(P.x, P.z, x, z) < blast(150)) damagePlayer(60, 'Свой динамит', 1); } }); }
  else if (id === 'EQ-14') { if (!target) { log('Ржавый рой: сначала выберите цель'); return false; } target.noheal = 10; burst(target.x, target.z, target.r + 20, col, 40); { const m = target; stick(FX.prop('marker', col), o => o.position.set(m.x, PLANE + m.r + 20, m.z), () => !m.dead && !m.gone && m.noheal > 0); } log(`Мехо-блохи: ${target.name} 10 секунд не может лечиться`, txt(col)); }
  else if (id === 'EQ-15') { P.turbo = 5; burst(P.x, P.z, 70, col, 40); shockRing(P.x, P.z, 120, hexN(col)); log('Турбо: пять секунд корабль летит втрое быстрее', txt(col)); }
  else if (id === 'EQ-16') { const m = target; if (!m) { const g = NET.players().filter(q => !q.dead).sort((a, b) => dist2(P.x, P.z, a.x, a.z) - dist2(P.x, P.z, b.x, b.z))[0], d = g ? dist2(P.x, P.z, g.x, g.z) : 1e9; if (g && d < 520 && d > 40) { const f = Math.min(700, d * 2.4); NET.toPeer(g.id, 'imp', [(P.x - g.x) / d * f, (P.z - g.z) / d * f]); bolt(P.x, P.z, g.x, g.z, col, 3, 1.6); log(`Лебёдка: тянем ${g.nick}`, txt(col)); return true; } log('Лебёдка: цель не выбрана, а союзников рядом нет', txt(col)); return false; } if (m.boss) { log(`Лебёдка: ${m.name} слишком тяжёл, его не сдвинуть`, txt(col)); return false; }
    const d = dist2(P.x, P.z, m.x, m.z) || 1; if (d > 520) { log('Лебёдка: цель слишком далеко'); return false; } const f = Math.min(900, d * 3.2) * (m.T.cls === 2 ? 0.45 : 1); m.kx = (P.x - m.x) / d * f; m.kz = (P.z - m.z) / d * f; m.slow = Math.max(m.slow, 1.5);
    bolt(P.x, P.z, m.x, m.z, col, 3, 1.6); burst(m.x, m.z, m.r + 14, col, 16); { let n = 0; stick(FX.prop('marker', col), o => o.position.set(m.x, PLANE + m.r + 16, m.z), () => !m.dead && !m.gone && n++ < 50); } }
  else if (id === 'EQ-17') { if (P.hp >= S.hp) { log('Ремкомплект: корпус цел, чинить нечего', txt(col)); return false; } P.kit = 5; ball(30, col, 'kit'); log('Ремкомплект: команда латает корпус', txt(col)); }
  else NET();
  return true; }
function useSkill(sl) { const id = sl.id, k = D.SKILLS[id], col = SKILL_COL[id] || '#ffd58a', c = { color: col }; const fx = () => burst(P.x, P.z, 60, col, 24);
  if (k.net) { if (NET.live && (id === 'S-07' || id === 'S-08' || id === 'S-21')) return netSkill(id, col); fx(); log(NET.live ? `${k.name}: пока только эффект` : `${k.name}: нужен союзник, работает в сетевой игре`, txt(col)); return true; }
  if (id === 'S-01') { P.rapid = 9; fx(); }
  else if (id === 'S-02') { P.pierce = true; fx(); log('Следующий залп пушек пробьёт броню'); }
  else if (id === 'S-03') { if (!target) { log('Метка: сначала выберите цель'); return false; } target.mark = 15; burst(target.x, target.z, target.r + 16, col, 20); const m = target; stick(FX.prop('marker', col), o => o.position.set(m.x, PLANE + m.r + 20, m.z), () => !m.dead && !m.gone && m.mark > 0); }
  else if (id === 'S-06') { P.will = 6; fx(); ball(36, '#9fb0c2', 'will'); }
  else if (id === 'S-09') { struct(zone({ x: P.x, z: P.z, r: 150, life: 18, color: col, prop: 'drone', py: 30, ps: 1.3, fill: 0.35, every: 0.5, tick: zn => { if (dist2(P.x, P.z, zn.x, zn.z) < 150 && P.hp < S.hp) { heal(2.5, true); bolt(zn.post.position.x, zn.post.position.z, P.x, P.z, col, 5, 0.7); } } }), 'Ремонтный дрон', 150); }
  else if (id === 'S-10') { P.tail = 9; fx(); }
  else if (id === 'S-11') { const [x, z] = aimPt(400); burst(x, z, 80, col, 20); zone({ x, z, r: 80, life: 4.5, color: col, prop: FX.netProp(80, col), py: 8, ps: 1, fill: 0.2 }); for (const m of inR(x, z, 80)) { if (m.boss) m.slow = 4.5; else m.stun = 4.5; } }
  else if (id === 'S-12') { P.probe = 22; fx(); stick(FX.prop('probe', col), onShip(52), () => P.probe > 0 && !P.dead); log('Разведзонд: обзор карты вдвое шире на 22 секунды'); }
  else if (id === 'S-13') { const [x, z] = edgePt(450, 200); zone({ x, z, r: 120, life: 9, color: col, prop: FX.cloudProp(115, 0x3b4150, col), py: 80, ps: 1, fill: 0.55, every: 0.5, tick: zn => { let n = 0; for (const m of inR(zn.x, zn.z, 120)) { if (n++ < 3) bolt(zn.x + (rnd() - 0.5) * 60, zn.z + (rnd() - 0.5) * 60, m.x, m.z, col, 30); hitMob(m, 12.5, 4, c); } if (!n && rnd() < 0.6) { const a = rnd() * 6.28, r = rnd() * 100; bolt(zn.x, zn.z, zn.x + Math.cos(a) * r, zn.z + Math.sin(a) * r, col, 26); } zn.post.userData.flash.material.opacity = 0.9; }, fx: (zn, dt) => { const f = zn.post.userData.flash.material; f.opacity = Math.max(0, f.opacity - dt * 4); } }); }
  else if (id === 'S-14') { burst(P.x, P.z, 200, col, 40); zone({ x: P.x, z: P.z, r: 200, life: 3, color: col, smoke: true, dens: 1.4, pcol: [1.25, 1.45, 1.55], fill: 0.5 }); for (const m of inR(P.x, P.z, 200)) { m.slow = 9; m.weak = 9; } }
  else if (id === 'S-15') { if (!target) { log('Цепная молния: сначала выберите цель'); return false; } chain(target, 120, 5, 0.85, col, 220); }
  else if (id === 'S-16' || id === 'S-31') { const n = id === 'S-16' ? 5 : 8, R = id === 'S-16' ? 500 : 450, dmg = id === 'S-16' ? 60 : 55; if (id === 'S-31' && Math.abs(P.speed) > 12) { log('Ракетный удар: нужно остановиться'); return false; } const list = inR(P.x, P.z, R); if (!list.length) { log(k.name + ': рядом нет целей'); return false; } for (let i = 0; i < n; i++) fireRocket(list[(rnd() * list.length) | 0], dmg, col, P.x, P.z, P.yaw + (i - n / 2) * 0.5); }
  else if (id === 'S-17') { P.aim = 100; fx(); }
  else if (id === 'S-18') { P.mirror = 4.5; zone({ x: P.x, z: P.z, r: 60, life: 4.5, color: col, follow: true, dome: 'ball', fill: 0.2 }); }
  else if (id === 'S-19') { P.anchor = 7.5; P.speed = 0; fx(); zone({ x: P.x, z: P.z, r: 34, life: 7.5, color: col, follow: true, fill: 0.8 }); }
  else if (id === 'S-20') { fx(); log('Аварийная пена: огонь, яд и замедление сняты'); }
  else if (id === 'S-22') { struct(zone({ x: P.x, z: P.z, r: 300, life: 22, color: col, prop: 'turret', py: 2, ps: 1.2, fill: 0.15, every: 0.5, tick: zn => { const best = strongest(zn.x, zn.z, 300); if (best) { zn.post.userData.aim = Math.atan2(best.x - zn.x, best.z - zn.z); bolt(zn.x, zn.z, best.x, best.z, col, 3, 0.6); hitMob(best, 10, 0, c); } } }), 'Турель', 300); }
  else if (id === 'S-23') { P.burn = 6; fx(); }
  else if (id === 'S-24') { const [x, z] = ahead(140); const gh = shipInst ? FX.ghost(shipInst, col) : null; if (gh) gh.rotation.y = P.yaw; struct(zone({ x, z, r: 30, life: 12, color: col, prop: gh, py: 0, ps: 1, fill: 0.4, decoy: true }), 'Обманка', 250); burst(x, z, 40, col, 14); }
  else if (id === 'S-25') { fx(); let [x, z] = ahead(250); if (obstacleAt(x, z, 20)) [x, z] = freeSpot(x, z, 30); P.x = x; P.z = z; burst(x, z, 60, col, 24); }
  else if (id === 'S-26') { const [x, z] = aimPt(400, 200); burst(x, z, 150, col, 30); zone({ x, z, r: 150, life: 1.6, color: col, spin: 1, fill: 0.8, prop: 'well', py: 10, ps: 1.4 }); for (const m of inR(x, z, 150)) if (!m.boss) { const d = dist2(x, z, m.x, m.z) || 1; m.kx = (x - m.x) / d * Math.min(400, d * 2.4); m.kz = (z - m.z) / d * Math.min(400, d * 2.4); } }
  else if (id === 'S-27') { const [x, z] = aimPt(450, 200); zone({ x, z, r: 120, life: 12, color: col, prop: FX.cloudProp(115, 0x5d6b3a, col), py: 80, ps: 1, fill: 0.6, every: 0.25, tick: zn => { for (const m of inR(zn.x, zn.z, 120)) m.acid = 0.5; } }); }
  else if (id === 'S-28') { burst(P.x, P.z, 220, col, 40); fire.emit({ x: P.x, y: PLANE + 20, z: P.z, life: 0.35, s0: 200, s1: 520, r: 3, g: 3, b: 2.6, a: 0.9 }); for (const m of inR(P.x, P.z, 220)) m.blind = 4.5; }
  else if (id === 'S-29') { for (let i = -1; i <= 1; i++) { const x = P.x - Math.sin(P.yaw) * 40 + Math.cos(P.yaw) * i * 50, z = P.z - Math.cos(P.yaw) * 40 - Math.sin(P.yaw) * i * 50; zone({ x, z, r: 36, life: 30, color: col, prop: 'mine', ps: 0.8, fill: 0.35, every: 0.2, tick: zn => { if (inR(zn.x, zn.z, 36).length) zn.dead = true; }, end: zn => { if (!zn.dead) return; explosion(zn.x, PLANE, zn.z, 2, zn.g); for (const m of inR(zn.x, zn.z, blast(80))) hitMob(m, 120, 1, c); } }); } }
  else if (id === 'S-30') { P.cry = 12; fx(); shockRing(P.x, P.z, 250, hexN(col)); }
  else if (id === 'S-32') { const [x, z] = aimPt(520, 240); for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 140; fireMortar(x + Math.cos(a) * r, z + Math.sin(a) * r, 80, 45, col, P.x, P.z, 1.3 + i * 0.25); } }
  else if (id === 'S-33') { P.dive = 7; for (const m of mobs) m.aggro = false; zone({ x: P.x, z: P.z, r: 36, life: 7, color: '#2f8fb5', follow: true, fill: 0.5 }); log('Корабль под облаками: 7 секунд его не видно и не достать', txt(col)); }
  else if (id === 'S-34') { P.gambit = 9; fx(); }
  else if (id === 'S-35') { P.dvx = Math.sin(P.yaw) * 520; P.dvz = Math.cos(P.yaw) * 520; P.bull = 0.5; P.dashT = 0.5; fx(); }
  else if (id === 'S-36') { for (const q of slots) if (q.kind === 'w') q.cd = 0; fx(); }
  else if (id === 'S-37') { P.yaw = target ? Math.atan2(target.x - P.x, target.z - P.z) : P.yaw + Math.PI; fx(); }
  else if (id === 'S-38') { P.bots = 15; fx(); const g = new THREE.Group(); const bs = [0, 1, 2, 3].map(i => { const b = FX.prop('bot', col); g.add(b); return b; }); stick(g, onShip(4), () => P.bots > 0 && !P.dead, () => { bs.forEach((b, i) => { const a = time * 2.2 + i * 1.5708; b.position.set(Math.cos(a) * 30, Math.sin(time * 3 + i) * 3, Math.sin(a) * 30); b.rotation.y = -a; }); }); }
  else fx();
  return true; }
const SKILL_COL = { 'S-01': '#FF7F50', 'S-02': '#B0C4DE', 'S-03': '#FF1493', 'S-04': '#4682B4', 'S-05': '#CD5C5C', 'S-06': '#708090', 'S-07': '#FFA500', 'S-08': '#98FB98', 'S-09': '#3CB371', 'S-10': '#87CEEB', 'S-11': '#DEB887', 'S-12': '#40E0D0', 'S-13': '#6A5ACD', 'S-14': '#B0E0E6', 'S-15': '#00BFFF', 'S-16': '#FF6347', 'S-17': '#FFD700', 'S-18': '#C0C0C0', 'S-19': '#8B4513', 'S-20': '#F8F8FF', 'S-21': '#7FFFD4', 'S-22': '#DAA520', 'S-23': '#FF8C00', 'S-24': '#DDA0DD', 'S-25': '#9370DB', 'S-26': '#5F9EA0', 'S-27': '#ADFF2F', 'S-28': '#FFFACD', 'S-29': '#DC143C', 'S-30': '#FF4040', 'S-31': '#E9573F', 'S-32': '#2E8B57', 'S-33': '#E0FFFF', 'S-34': '#F4C430', 'S-35': '#A0522D', 'S-36': '#F0E68C', 'S-37': '#87CEFA', 'S-38': '#778899' };

// ---------- объекты мира ----------
const objects = []; const glowMat = c => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 0.0 });
function addObjLabel(o, text) { o.lbl = mkLabel('obj', text, false); }
// маяки
[[300, -120], [-800, 300], [680, -1080]].forEach(([x, z], i) => { makeIsland({ x, y: 24, z, R: 34, hill: 8, depth: 70, seed: 200 + i, trees: 6 }); obstacles.push({ x, z, rad: () => 30 });
  const g = new THREE.Group(); const st = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.85 }); const tw = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 7.5, 62, 16), st); tw.position.y = 31; const band = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.7 })); band.position.y = 30; const gal = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 2, 16), darkMat); gal.position.y = 62; const lampM = glowMat(0xffd070); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 8, 12), lampM); lamp.position.y = 67; const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 7, 12), darkMat); roof.position.y = 74.5; g.add(tw, band, gal, lamp, roof); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.position.set(x, 30, z); scene.add(g);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(60, 420, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 210), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending })); beam.position.y = 67; beam.visible = false; g.add(beam);
  const o = { kind: 'beacon', x, z, r: 130, lit: false, lampM, beam, g }; addObjLabel(o, 'Маяк'); objects.push(o); });
// небесные жемчужницы: толкнуть кораблём, урона нет, вылетает добыча
const clamMat = new THREE.MeshPhysicalMaterial({ color: 0xf3e7e2, roughness: 0.2, metalness: 0.2, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.7 }), shellIn = new THREE.MeshStandardMaterial({ color: 0x3a2040, roughness: 0.4, emissive: 0xff7ac8, emissiveIntensity: 0.6, side: THREE.BackSide }), pearlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, emissive: 0xffd9f2, emissiveIntensity: 2.2 });
function domeGeo(top) { const g = new THREE.SphereGeometry(17, 40, 14, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.07 * Math.cos(a * 16) * Math.min(1, Math.hypot(x, z) / 10); p.setXYZ(i, x * k, y * 0.5, z * k); } g.computeVertexNormals(); return g; }
const DOME_T = domeGeo(true), DOME_B = domeGeo(false);
const SHELL_COLORS = [{ name: 'Красная', hex: 0xff3a30, shell: 0xf2c4bd, col: [3.4, 0.35, 0.25] }, { name: 'Золотая', hex: 0xffc23a, shell: 0xf3e3b8, col: [3.2, 2.0, 0.3] }, { name: 'Лазурная', hex: 0x3ad6ff, shell: 0xc4e6f2, col: [0.3, 2.2, 3.4] }, { name: 'Фиолетовая', hex: 0xb060ff, shell: 0xdccbf2, col: [1.8, 0.5, 3.4] }, { name: 'Изумрудная', hex: 0x40ff90, shell: 0xc8f0d6, col: [0.3, 3.0, 1.1] }, { name: 'Розовая', hex: 0xff7ac8, shell: 0xf3d6e6, col: [3.4, 1.0, 2.4] }];
[[-140, -260], [420, 520], [-620, 120], [900, 160], [-60, 760], [-1050, -620], [520, -900], [1250, -200], [80, 230], [-330, -80]].forEach(([x, z], si) => { const SC = SHELL_COLORS[si % SHELL_COLORS.length]; [x, z] = freeSpot(x, z, 70); const g = new THREE.Group(); const cm = clamMat.clone(); cm.color.setHex(SC.shell); const pm = pearlMat.clone(); pm.emissive.setHex(SC.hex); const bot = new THREE.Mesh(DOME_B, cm); const botIn = new THREE.Mesh(DOME_B, shellIn); botIn.scale.setScalar(0.96); const top = new THREE.Group(); top.position.set(0, 0, -17); const tm = new THREE.Mesh(DOME_T, cm); tm.position.set(0, 0, 17); const tin = new THREE.Mesh(DOME_T, shellIn); tin.position.set(0, 0, 17); tin.scale.setScalar(0.96); top.add(tm, tin); const pearl = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), pm); pearl.position.y = -2; g.add(bot, botIn, top, pearl); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.position.set(x, PLANE, z); g.rotation.y = rnd() * 6.28; scene.add(g); const o = { kind: 'shell', x, z, r: 30, g, top, pearl, cd: 0, col: SC.col, ci: si % SHELL_COLORS.length }; addObjLabel(o, SC.name + ' жемчужница'); objects.push(o); });
const SHELL_HEX = SHELL_COLORS.map(s => s.hex.toString(16).padStart(6, '0'));
const orbs = []; const lootAcc = { pearls: 0, gears: 0 };
function spawnOrbs(x, z, n, col) { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = 70 + rnd() * 90; const kind = rnd() < 0.85 ? 'pearls' : 'gears'; orbs.push({ x, y: PLANE + 4, z, vx: Math.cos(a) * v, vy: 50 + rnd() * 70, vz: Math.sin(a) * v, t: -i * 0.03, kind, val: 1, col: col.map(c => c * (0.8 + rnd() * 0.4)) }); } }
function updateOrbs(dt) { for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i]; o.t += dt; if (o.t < 0) continue;
    if (o.t < 0.7) { const f = Math.exp(-2.5 * dt); o.vx *= f; o.vz *= f; o.vy -= 110 * dt; } else { const dx = P.x - o.x, dy = PLANE + 4 - o.y, dz = P.z - o.z; const d = Math.hypot(dx, dy, dz) || 1; const sp = Math.min(420, 120 + (o.t - 0.7) * 500); o.vx = dx / d * sp; o.vy = dy / d * sp; o.vz = dz / d * sp; if (d < 16 || P.dead) { lootAcc[o.kind] += o.val; fire.emit({ x: o.x, y: o.y, z: o.z, life: 0.25, s0: 10, s1: 40, r: o.col[0], g: o.col[1], b: o.col[2], a: 0.9 }); orbs.splice(i, 1); continue; } }
    o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; fire.emit({ x: o.x, y: o.y, z: o.z, life: 0.1, s0: 13, s1: 11, r: o.col[0] + 1, g: o.col[1] + 1, b: o.col[2] + 1, a: 1 }); fire.emit({ x: o.x, y: o.y, z: o.z, life: 0.5, s0: 8, s1: 1, r: o.col[0], g: o.col[1], b: o.col[2], a: 0.8 }); }
  if (!orbs.length && (lootAcc.pearls || lootAcc.gears)) { if (lootAcc.pearls) gain('pearls', lootAcc.pearls); if (lootAcc.gears) coin('bronze', lootAcc.gears, P.x + 14, P.z); lootAcc.pearls = 0; lootAcc.gears = 0; } }
// гигантские деревья
const barkMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.95 }), leafMat = new THREE.MeshStandardMaterial({ color: 0x35602a, roughness: 0.9 });
[[-560, 60], [930, -170]].forEach(([x, z], i) => { makeIsland({ x, y: 22, z, R: 62, hill: 10, depth: 110, seed: 300 + i, trees: 20 }); obstacles.push({ x, z, rad: () => 40 });
  const g = new THREE.Group(); const tr = new THREE.CylinderGeometry(9, 17, 150, 18, 12); const p = tr.attributes.position; for (let k = 0; k < p.count; k++) { const px = p.getX(k), py = p.getY(k), pz = p.getZ(k); const d = 1 + 0.2 * perlin3(px * 0.08 + i, py * 0.03, pz * 0.08); p.setXYZ(k, px * d + 6 * Math.sin(py * 0.02 + i), py, pz * d); } tr.computeVertexNormals(); const trunk = new THREE.Mesh(tr, barkMat); trunk.position.y = 75; g.add(trunk);
  { const N = 300; const fol = new THREE.InstancedMesh(CLUMP_G, CLUMP_M, N); fol.customDepthMaterial = CLUMP_D; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), C = new THREE.Color(), E = new THREE.Euler();
    for (let k = 0; k < N; k++) { const tip = k % 7; const a = tip < 5 ? tip / 5 * 6.28 : rnd() * 6.28, tr0 = tip < 5 ? 52 : 14; const cx = Math.cos(a) * tr0, cz = Math.sin(a) * tr0, cy = tip < 5 ? 150 : 178; const u = rnd() * 6.28, w = Math.acos(rnd() * 1.6 - 0.6), rr = Math.pow(rnd(), 0.5) * 44; T.set(cx + Math.cos(u) * Math.sin(w) * rr, cy + Math.cos(w) * rr * 0.7, cz + Math.sin(u) * Math.sin(w) * rr); const s = 30 + rnd() * 26; S.set(s, s, s); E.set((rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.9); Q.setFromEuler(E); M.compose(T, Q, S); fol.setMatrixAt(k, M); C.setHSL(0.26 + rnd() * 0.07, 0.5, clamp(0.10 + (T.y - 120) * 0.0016 + rnd() * 0.05, 0.07, 0.26)); fol.setColorAt(k, C); }
    fol.instanceMatrix.needsUpdate = true; fol.instanceColor.needsUpdate = true; g.add(fol); }
  for (let k = 0; k < 5; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 5.5, 78, 8), barkMat); const a = k / 5 * 6.28; br.position.set(Math.cos(a) * 26, 122, Math.sin(a) * 26); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(br); }
  // гигантские деревья для рубки; первое — большой белый клён, Великое древо второй миссии
  applyModel(g, i === 0 ? 'world_maple' : 'world_bald_cypress'); if (i === 0) g.scale.setScalar(1.4); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.position.set(x, 26, z); scene.add(g); const o = { kind: 'tree', x, z, r: 170, cd: 0, vis: g }; addObjLabel(o, 'Гигантское дерево'); objects.push(o); });
// рыбные места: круглый пруд среди облаков, рыба неторопливо ходит под самой водой
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
const POND_Y = 13;
const pondMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
  fragmentShader: `uniform float uT; varying vec2 vUv;
    float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){ vec2 q = (vUv - 0.5)*2.0; float r = length(q); vec2 p = q*8.0;
      float rip = vn(p + vec2(uT*0.10, -uT*0.07))*0.6 + vn(p*2.6 - vec2(uT*0.13, uT*0.05))*0.4;
      vec3 col = mix(vec3(0.03, 0.22, 0.30), vec3(0.10, 0.42, 0.50), rip);
      col += vec3(0.5, 0.7, 0.75)*smoothstep(0.74, 0.92, rip)*0.35;                 // блики
      col = mix(col, vec3(0.78, 0.88, 0.92), smoothstep(0.80, 1.0, r));             // берег тает в тумане
      float a = (1.0 - smoothstep(0.88, 1.0, r))*mix(0.5, 0.92, smoothstep(0.55, 0.97, r));
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
waterfalls.push(pondMat);
const padGeo = new THREE.CircleGeometry(1, 14, 0.35, 5.6).rotateX(-Math.PI / 2), padMat = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.7 });
// рыба плывёт волной: тело изгибается от головы к хвосту, хвост бьёт сильнее. Фаза — от положения рыбы, чтобы не били в такт
const KOI_T = { value: 0 }; let koiPatched = false;
function koiSwim(m) { if (koiPatched) return; koiPatched = true; m.proto.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox, len = b.max.x - b.min.x;
    o.material.onBeforeCompile = sh => { sh.uniforms.uT = KOI_T; sh.uniforms.uHead = { value: b.max.x }; sh.uniforms.uLen = { value: len }; sh.vertexShader = 'uniform float uT; uniform float uHead; uniform float uLen;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float kt = clamp((uHead - position.x) / uLen, 0.0, 1.0); float ph = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.23; transformed.z += sin(uT * 6.5 + ph - kt * 4.2) * uLen * 0.09 * (0.15 + kt * kt);'); }; o.material.customProgramCacheKey = () => 'koi'; o.material.needsUpdate = true; }); }
function makePond(x, z) { const g = new THREE.Group(); const fish = [];
  for (let i = 0; i < 12; i++) { const f = new THREE.Group(); loadModel('world_koi').then(m => { if (m) { koiSwim(m); f.add(m.proto.clone()); } }); f.scale.setScalar(0.75 + rnd() * 0.6); f.userData = { a: rnd() * 6.28, r: 10 + rnd() * 36, ph: rnd() * 6.28, sp: (0.09 + rnd() * 0.1) * (rnd() < 0.5 ? -1 : 1) }; g.add(f); fish.push(f); }
  const water = new THREE.Mesh(new THREE.CircleGeometry(62, 48).rotateX(-Math.PI / 2), pondMat); water.position.y = POND_Y; water.renderOrder = 6; g.add(water);
  const pads = new THREE.InstancedMesh(padGeo, padMat, 9); const PM = new THREE.Matrix4(), PQ = new THREE.Quaternion(), PS = new THREE.Vector3(), PT = new THREE.Vector3(), UPY = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 16 + rnd() * 36, s = 2.6 + rnd() * 2.4; PT.set(Math.cos(a) * r, POND_Y + 0.25, Math.sin(a) * r); PQ.setFromAxisAngle(UPY, rnd() * 6.28); PS.set(s, 1, s); pads.setMatrixAt(i, PM.compose(PT, PQ, PS)); } pads.instanceMatrix.needsUpdate = true; pads.receiveShadow = true; g.add(pads);
  g.position.set(x, 0, z); scene.add(g); const o = { kind: 'fish', x, z, r: 120, cd: 0, fish, g }; addObjLabel(o, 'Рыбное место'); objects.push(o); return o; }
[[-180, -520], [460, 860], [-1050, 760]].forEach(([x, z]) => makePond(...freeSpot(x, z, 80)));
// дерево на островке: миссия ставит его перед боссом
// дерево у пруда перед боссом: такой же остров и размер, как у обычного гигантского дерева
let treeSeed = 0; function makeTreeSpot(x, z, model, life = 'stage') { const g = new THREE.Group(), il = islet(x, z, { R: 70, seed: 9 + (treeSeed++ % 6), life }), tr = new THREE.Group(); tr.position.set(x, il.top - 3, z); tr.scale.setScalar(0.9);
  loadModel(model).then(m => { if (m) { const q = m.proto.clone(); q.traverse(n => { if (n.isMesh) n.castShadow = true; }); tr.add(q); } }); g.add(il.g, tr); scene.add(g); const o = { kind: 'tree', x, z, r: 150, cd: 0, g }; addObjLabel(o, 'Дерево'); objects.push(o); return o; }
// обыск островов
for (const il of islands) if (il.collide) { const o = { kind: 'island', x: il.x, z: il.z, r: il.R * 1.3 + 90, cd: 0, il }; addObjLabel(o, (il.kind || 'Островок') + ': можно обыскать'); objects.push(o); }
objects.forEach((o, i) => { o.wid = i; });   // постоянные номера объектов мира: по ним капитаны в сети ссылаются на остров, пруд или дерево

let channel = null;
const PROMPT = () => { const e = keyName(KEY.act); return { beacon: e + ': зажечь маяк', tree: e + ': начать добычу древесины', fish: e + ': забросить сети', island: e + ': обыскать остров' }; };
function nearObj() { let best = null, bd = 1e9; for (const o of objects) { if (o.kind === 'shell' || o.off) continue; if (o.kind === 'beacon' && o.lit) continue; const d = dist2(P.x, P.z, o.x, o.z); if (d < o.r && d < bd) { best = o; bd = d; } } return best; }
// У рыбного места и дерева перерыв после добычи свой у каждого капитана (o.cd — перерыв этого игрока): ловить и пилить одновременно могут до десяти человек, и каждый получает свой эффект
function interact() { if (P.dead || channel) return; const o = nearObj(); if (!o) return; if (o.kind === 'island' && o.searched) return log('Этот остров уже обыскан: второй раз обыскать нельзя'); if (o.cd > 0) return log(o.kind === 'fish' || o.kind === 'tree' ? `Вы здесь уже ${o.kind === 'fish' ? 'ловили' : 'пилили'}: подождите ${Math.ceil(o.cd)} с. Остальные капитаны могут ${o.kind === 'fish' ? 'рыбачить' : 'пилить'} здесь и сейчас` : `Здесь пока пусто, подождите ${Math.ceil(o.cd)} с`);
  let dur = o.kind === 'mis' ? o.dur : { beacon: 3, tree: 12, fish: 10, island: 6 }[o.kind]; if (has('F-06')) dur /= 2;
  channel = { o, t: 0, dur, text: o.kind === 'mis' ? o.text : { beacon: 'Зажигаем маяк', tree: 'Пилим дерево', fish: 'Ловим рыбу', island: 'Обыскиваем остров' }[o.kind] }; if (o.onStart) o.onStart();
  if (o.kind === 'tree' && rnd() < 0.6) { log('На шум пилы прилетели мошки', '#ffb4a0'); for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; spawnMob('MOB-01', P.x + Math.cos(a) * 330, P.z + Math.sin(a) * 330, { respawn: false }); } }
  if (o.kind === 'fish' && rnd() < 0.45) { log('На приманку приплыл скат!', '#ffb4a0'); const a = rnd() * 6.28; spawnMob('MOB-09', P.x + Math.cos(a) * 340, P.z + Math.sin(a) * 340, { respawn: false, name: 'Скат-воришка' }); } }
// события обыска острова: доли заданы в data.js (SEARCH)
function searchRoll() { let r = rnd() * 100; for (const [w, code] of D.SEARCH) { if (r < w) return code; r -= w; } return 'stash'; }
// особая добыча выпадает ровно один раз за каждые три попытки (какая из трёх — случайно) и не повторяется, пока не выпадут все пять видов
const LUCK = { fish: { n: 0, at: 0, bag: [] }, wood: { n: 0, at: 0, bag: [] } };
function lucky(kind) { const q = LUCK[kind]; if (q.n % 3 === 0) q.at = (rnd() * 3) | 0; return (q.n++) % 3 === q.at; }
// особый улов: значок, имя и эффект на 3 секунды в той же плашке, что и монета
// у пруда перед боссом (лавка уже открыта) золотой окунь не ловится
function special(kind, noGold) { const q = LUCK[kind], isG = i => noGold && D.CATCH[kind][i][3] === 'gold'; const fill = () => { q.bag = [0, 1, 2, 3, 4]; for (let i = 4; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [q.bag[i], q.bag[j]] = [q.bag[j], q.bag[i]]; } };
  if (!q.bag.length || q.bag.every(isG)) fill(); let at = q.bag.length - 1; while (at > 0 && isG(q.bag[at])) at--; const [ic, name, text, eff, v] = D.CATCH[kind][q.bag.splice(at, 1)[0]]; if (eff === 'heal') heal(v); else if (eff === 'gold') { res.gold += v; if (NET.client && !shop.open) NET.req('gold', v); hudRes(); } else if (eff === 'gear') { for (const q of slots) if (q.kind === 'd') q.cd = 0; } else P[eff] = v;
  $('loot').innerHTML = `<img src="${LOOT[ic]}" alt="" width="56" height="56"><div><b>${name}</b><span>${text}</span></div>`; $('loot').style.display = 'flex'; lootT = 3; log(`${name}: ${text.charAt(0).toLowerCase() + text.slice(1)}`, '#ffe08a'); }
function finish(o) {
  if (o.kind === 'mis') return o.onDone();
  if (o.kind === 'beacon') { o.lit = true; o.lampM.emissiveIntensity = 9; o.beam.visible = true; o.lbl.firstChild.textContent = 'Маяк горит'; res.beacons++; coin('silver', 2, o.x, o.z); log('Маяк зажжён: туман вокруг рассеялся, корпус починен на 60', '#ffe08a'); heal(60); hudRes(); }
  else if (o.kind === 'tree') { const n = 18 + (rnd() * 10 | 0); gain('wood', n, P.x, P.z); log(`Добыто древесины: ${n}`, '#ffe08a'); o.cd = 60; if (lucky('wood')) special('wood', o.boss || shop.open); if (NET.client) NET.req('gather', [objRef(o), 0]); else MIS.onGather(o); }
  else if (o.kind === 'fish') { o.cd = 60; const n = 8 + (rnd() * 8 | 0); gain('fish', n, P.x, P.z); log(`Улов: ${n} рыбы`, '#ffe08a'); special('fish', o.boss || shop.open); if (NET.client) return NET.req('gather', [objRef(o), 1]); MIS.onGather(o); const cp = MIS.onCatch(o); if (cp) later(3.2, () => { $('loot').innerHTML = `<img src="${LOOT.compass}" alt="" width="56" height="56"><div><b>Рыба-компас</b><span>${cp}</span></div>`; $('loot').style.display = 'flex'; lootT = 3.5; }); }
  else { o.cd = 150; if (NET.client) return NET.req('search', o.wid); o.searched = true; NET.bcast('searched', o.wid); { const ms = MIS.onSearch(o); if (ms) return story(ms[0], ms[1], '#ffe08a'); } searchRest(o); } }
function searchRest(o) { { let ev = searchRoll(); if (ev === 'trap' && has('CREW-04')) ev = 'stash'; const ax = P.x + (P.x - o.x) * 0.35, az = P.z + (P.z - o.z) * 0.35;
    const tell = (got, color) => story(D.STORY[ev][(rnd() * D.STORY[ev].length) | 0], got, color);
    if (ev === 'stash') { const pe = 2 + (rnd() * 3 | 0), br = 2 + (rnd() * 3 | 0); gain('pearls', pe); const g0 = res.gold; coin('bronze', br); tell(`Нашли: жемчуг ×${pe}` + (res.gold > g0 ? ` и медные монеты ×${br} (+${fmt(res.gold - g0)} золота)` : ''), '#ffe08a'); }
    else if (ev === 'gold') { const g0 = res.gold; coin('silver', 3 + (rnd() * 3 | 0)); tell(shop.open ? 'Золото уже не в счёт: лавка открыта' : `Получили: ${fmt(res.gold - g0)} золота`, '#ffe08a'); }
    else if (ev === 'flies') { tell('Вылетели 4 облачные мошки', '#ffb4a0'); for (let i = 0; i < 4; i++) { const [fx, fz] = freeSpot(ax + (rnd() - 0.5) * 200, az + (rnd() - 0.5) * 200, 30); spawnMob('MOB-01', fx, fz, { respawn: false }); } }
    else if (ev === 'elder') { tell('Проснулся Старый Панцирник: втрое крепче обычного', '#ff7a66'); const [fx, fz] = freeSpot(ax + 160, az + 120, 60); spawnMob('MOB-16', fx, fz, { respawn: false, name: 'Старый Панцирник', hpMul: 3, dmgMul: 1.6, scale: 1.8 }); }
    else if (ev === 'trap') { const h0 = P.hp; damagePlayer(S.hp * 0.15, 'Обыск: сработала старая ловушка', 1, { raw: true }); explosion(P.x, PLANE, P.z, 1.2); tell(`Потеряли ${Math.round(h0 - P.hp)} прочности корпуса`, '#ff7a66'); }
    else if (ev === 'dock') { const h0 = P.hp; heal(Math.round(S.hp * 0.3)); tell(P.hp > h0 ? `Корпус починен на ${Math.round(P.hp - h0)}` : 'Корпус и так цел, чинить нечего', '#63dcb4'); }
    else if (ev === 'wind') { P.wind = 60; tell('Попутный ветер: скорость +30 % на минуту', '#63dcb4'); }
    else if (ev === 'arsenal') { for (const q of slots) q.cd = 0; tell('Всё оружие, техника и навыки перезаряжены', '#63dcb4'); }
    else if (ev === 'wpn20') { P.buffW = 180; burst(P.x, P.z, 70, '#FF4500'); tell('Урон вашего оружия +20 % на 3 минуты', '#ffb070'); }
    else if (ev === 'arm20') { P.buffA = 180; burst(P.x, P.z, 70, '#4682B4'); tell('Получаемый урон −20 % на 3 минуты', '#9fc4ff'); } }
}

// ---------- ввод ----------
const keys = new Set(); let helpOn = true, hangarOpen = false;
const actOf = c => { for (const a in KEY) if (KEY[a] === c) return a; return c === 'ShiftRight' && KEY.dash === 'ShiftLeft' ? 'dash' : null; };
const HEXK = { left: 'right', right: 'left', fwd: 'back', back: 'fwd' };   // сглаз: руль и тяга наоборот
const held = a => { if (P.sleep > 0 || P.rooted > 0) return false; if (P.hex > 0 && HEXK[a]) a = HEXK[a]; return keys.has(KEY[a]) || (a === 'dash' && KEY.dash === 'ShiftLeft' && keys.has('ShiftRight')); };
const DASH = { left: [1, 0], right: [-1, 0], fwd: [0, 1], back: [0, -1] };
addEventListener('keydown', e => { const c = e.code; if (modalOn) { e.preventDefault(); if (!e.repeat && (c === 'Enter' || c === 'Space' || c === 'NumpadEnter')) $('modal-ok').click(); return; } if (hangarOpen) { if (!e.repeat) hangar.key(e); return; } const a = actOf(c); if (a) e.preventDefault(); keys.add(c); if (e.repeat || !a) return; if (a === 'pause') { if (!hangarOpen) setPause(!paused); return; } if (paused) return; if (P.sleep > 0 && a !== 'menu' && a !== 'help') return;
  if (a.startsWith('slot')) { let n = +a.slice(4) - 1; if (P.hex > 0) { const cnt = slots.filter(q => q.kind !== 's').length; if (n < cnt) n = cnt - 1 - n; } if (held('swap')) swapSlot(n); else if (slots[n] && slots[n].kind !== 's') use(n); }
  else if (a.startsWith('skill')) { const n = slots.findIndex(q => q.kind === 's' && q.key === a); if (n >= 0) use(n); }
  else if (a === 'act') interact(); else if (a === 'target') cycleTarget(); else if (a === 'help') { helpOn = !helpOn; $('help').style.display = helpOn ? '' : 'none'; } else if (a === 'menu') openHangar();
  else if (a === 'swap') log(`Замена: держите ${keyName(KEY.swap)} и нажмите клавишу слота`);
  else if (DASH[a] && held('dash')) dash(...DASH[P.hex > 0 ? HEXK[a] : a]); else if (a === 'dash') { const h = Object.keys(DASH).filter(k => held(k)); if (h.length === 1) dash(...DASH[h[0]]); } });
addEventListener('keyup', e => { keys.delete(e.code); }); addEventListener('blur', () => { keys.clear(); });
function dash(side, fwd) { if (P.dead || P.dashCd > 0 || P.anchor > 0 || P.sleep > 0 || P.rooted > 0) return; if (NET.client) NET.req('dash', 1); for (const m of mobs) if (m.att) { m.att = false; m.cd = 5; m.kx = (rnd() - 0.5) * 300; m.kz = (rnd() - 0.5) * 300; } const lx = Math.cos(P.yaw) * side + Math.sin(P.yaw) * fwd, lz = -Math.sin(P.yaw) * side + Math.cos(P.yaw) * fwd; const v = 340 * (has('F-04') ? 2 : 1) * (1 + shopUp('spd') / 100); P.dvx = lx * v; P.dvz = lz * v; P.dashCd = (1.2 - (has('CREW-02') ? 0.3 : 0)) * (has('CREW-10') ? 0.8 : 1); P.dashT = 0.4; shockRing(P.x, P.z, 60, 0x8dff2a); if (P.flood > 0) flood(P.flood - 1);
  if (has('F-25')) { for (const m of inR(P.x, P.z, 70)) hitMob(m, 60, 4, { color: '#7DF9FF' }); burst(P.x, P.z, 70, '#7DF9FF', 16); }
  for (let i = 0; i < 26; i++) fire.emit({ x: P.x + (rnd() - 0.5) * 20, y: PLANE + (rnd() - 0.5) * 8, z: P.z + (rnd() - 0.5) * 20, vx: -lx * (40 + rnd() * 120), vy: (rnd() - 0.5) * 30, vz: -lz * (40 + rnd() * 120), life: 0.4 + rnd() * 0.3, s0: 16, s1: 3, r: 0.35, g: 2.2, b: 0.05, a: 1, drag: 2 }); }
function cycleTarget() { const list = mobs.filter(m => !m.dead && dist2(P.x, P.z, m.x, m.z) < 900).sort((a, b) => dist2(P.x, P.z, a.x, a.z) - dist2(P.x, P.z, b.x, b.z)); if (!list.length) return; const i = list.indexOf(target); target = list[(i + 1) % list.length]; inspect = target; inspDirty = true; if (!has('CREW-01')) P.aim = 0; }
let camYaw = 0, camPitch = 0.5, camDist = 400, drag = false, moved = 0, lx = 0, ly = 0;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { drag = e.button === 2; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly); if (drag) { camYaw -= (e.clientX - lx) * 0.005; camPitch = clamp(camPitch + (e.clientY - ly) * 0.004, 0.16, 1.35); } lx = e.clientX; ly = e.clientY; });
canvas.addEventListener('pointerup', e => { if (e.button === 0 && moved < 6) { let best = null, bd = 70; for (const m of mobs) { if (m.dead) continue; V.set(m.x, PLANE, m.z).project(camera); if (V.z > 1) continue; const d = Math.hypot((V.x * 0.5 + 0.5) * innerWidth - e.clientX, (-V.y * 0.5 + 0.5) * innerHeight - e.clientY); if (d < bd) { bd = d; best = m; } } if (best) { inspect = best; inspDirty = true; } if (best && best !== target) { target = best; if (!has('CREW-01')) P.aim = 0; } } drag = false; });
canvas.addEventListener('wheel', e => { e.preventDefault(); camDist = clamp(camDist * (1 + Math.sign(e.deltaY) * 0.1), 140, 1300); }, { passive: false });
// «Потоп» (BOSS-8): вода на экране. Первый толчок снимает половину, второй — всё. В тесте вместо союзника работает рывок
function flood(n) { P.flood = n; const el = $('flood'); el.className = n >= 2 ? 'f2' : n === 1 ? 'f1' : ''; $('flood-t').textContent = n >= 2 ? `Экран залит водой. В сети вас должен толкнуть союзник; в тесте сделайте рывок (${keyName(KEY.dash)} + направление)` : n === 1 ? 'Половина воды сошла. Нужен второй толчок' : ''; }
function helpText() { const k = a => `<b>${keyName(KEY[a])}</b>`; const sk = activeSkills(); $('help-body').innerHTML = `<div>${k('fwd')} разгон · ${k('back')} тормоз, затем задний ход · ${k('left')} ${k('right')} поворот</div><div>${k('dash')} + направление: рывок</div><div>Цель выбирается сама. <b>Клик</b> или ${k('target')}: сменить</div><div>${slots.filter(q => q.kind === 'w').map(q => k(q.key)).join(' ')} оружие · ${slots.filter(q => q.kind === 'd').map(q => k(q.key)).join(' ')} техустройства</div><div>${sk.length ? sk.map((_, i) => k('skill' + (i + 1))).join(' ') + ' навыки специальности' : 'Навыки откроются со второй миссии (этап в ангаре)'}</div><div>${k('swap')} + клавиша слота: заменить оружие или устройство</div><div>${k('act')} действие рядом с объектом · ${k('menu')} ангар</div><div><b>Правая кнопка мыши</b>: камера · <b>колесо</b>: приближение</div>`; }

// ---------- качество ----------
// ---------- качество ----------
const QUAL = [{ steps: 12, pr: 0.7, sh: 1024 }, { steps: 20, pr: 1.0, sh: 2048 }, { steps: 36, pr: 2.0, sh: 4096 }]; let q = 1;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const sc = h * renderer.getPixelRatio() * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); fire.mat.uniforms.uScale.value = sc; smoke.mat.uniforms.uScale.value = sc; }
function applyQ() { const c = QUAL[q]; cloudMat.defines.STEPS = c.steps; cloudMat.needsUpdate = true; renderer.setPixelRatio(q === 0 ? c.pr : Math.min(devicePixelRatio || 1, c.pr)); sun.shadow.mapSize.set(c.sh, c.sh); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } resize(); document.querySelectorAll('#q button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.q === q))); }
document.querySelectorAll('#q button').forEach(b => b.addEventListener('click', () => { q = +b.dataset.q; applyQ(); }));
addEventListener('resize', resize); applyQ();

// ---------- ярусы и вихри ----------
const TIERS = { '-2': { name: 'Ярус −2: бездна', exp: 0.27, sun: 1.6, hemi: 0.4, shade: [0.30, 0.24, 0.52], haze: [0.30, 0.27, 0.50], fog: 0x4a4478, hp: 2.6, dmg: 2.0, loot: 3 }, '-1': { name: 'Ярус −1: сумрак', exp: 0.37, sun: 2.5, hemi: 0.55, shade: [0.42, 0.38, 0.68], haze: [0.48, 0.48, 0.72], fog: 0x7c7fae, hp: 1.7, dmg: 1.5, loot: 2 }, '0': { name: 'Ярус 0: небо', exp: 0.5, sun: 3.6, hemi: 0.75, shade: [0.53, 0.54, 0.80], haze: [0.66, 0.77, 0.93], fog: 0xb4c8e4, hp: 1, dmg: 1, loot: 1 }, '1': { name: 'Ярус +1: верхнее небо', exp: 0.6, sun: 4.4, hemi: 0.9, shade: [0.70, 0.56, 0.60], haze: [0.95, 0.82, 0.62], fog: 0xe8cfa0, hp: 1.35, dmg: 1.25, loot: 1.5 } };
let tier = 0, portalCd = 0; const UP = { x: 1500, z: 900 };
// ---------- туман ----------
// k: 0 — ясно, 1 — видно на три сотни шагов. Задаёт миссия; туманник рядом сгущает его сам. Свет маяка, линзы или осветительной ракеты туман разгоняет.
const tierHaze = new THREE.Color(0.66, 0.77, 0.93), tierFog = new THREE.Color(0xb4c8e4);
const FOG = { want: 0, k: 0, vis: 0, col: new THREE.Color(0.8, 0.85, 0.9), cur: new THREE.Color(0.8, 0.85, 0.9), lights: [] }; const fogTmp = new THREE.Color();
function setFog(k, col) { FOG.want = k || 0; if (col) FOG.col.setRGB(...col); else FOG.col.setRGB(0.8, 0.85, 0.9); }
function segD(px, pz, s) { if (s.x2 == null) return dist2(px, pz, s.x, s.z); const ax = s.x2 - s.x, az = s.z2 - s.z, t = clamp(((px - s.x) * ax + (pz - s.z) * az) / (ax * ax + az * az || 1), 0, 1); return dist2(px, pz, s.x + ax * t, s.z + az * t); }
function updateFog(dt) { updateTier(dt); let w = FOG.want, clear = 0;
  if (w > 0 || fogNear) { for (const s of FOG.lights) { const d = segD(P.x, P.z, s), r = s.cr || s.r; clear = Math.max(clear, (s.cr ? 0.35 : 1) * (1 - clamp((d - r * 0.55) / (r * 0.45), 0, 1))); } for (const zn of zones) if (zn.prop === 'flare') { const d = dist2(P.x, P.z, zn.x, zn.z); clear = Math.max(clear, 1 - clamp((d - zn.r * 0.6) / (zn.r * 0.4), 0, 1)); } }
  w *= 1 - 0.88 * clear; if (fogNear) w = Math.max(w, 0.85 * (1 - 0.88 * clear), FOG.want);
  const a = 1 - Math.exp(-1.3 * dt); FOG.k += (w - FOG.k) * a; FOG.cur.lerp(FOG.col, a); const k = FOG.k < 0.004 ? 0 : FOG.k, c = Math.min(1, k * 2.5);
  const near = k > 0 ? Math.round(camera.position.distanceTo(ship.position) * 0.095) : 0;
  scene.fog.density = near + 0.00017 + k * 0.0040; scene.fog.color.copy(tierFog).lerp(FOG.cur, c);
  cloudMat.uniforms.uFogD.value = k * 0.0040; cloudMat.uniforms.uFogN.value = near * 10; cloudMat.uniforms.uHaze.value.copy(tierHaze); fogTmp.copy(scene.fog.color).convertLinearToSRGB(); cloudMat.uniforms.uFogC.value.copy(fogTmp);
  sky.material.uniforms.uFogA.value = Math.min(0.985, k * 1.6); sky.material.uniforms.uFogC.value.copy(fogTmp);
  FOG.vis = k > 0.25 ? 330 / k : 0; }

// ---------- особые приёмы мобов ----------
// У моба в data.js может стоять поле sp. Приём вызывается каждый кадр, пока моб видит корабль. Вернул [vx, vz, курс] — моб летит так; вернул null — летит как обычно.
let leechN = 0, fogNear = false; const webs = [], laters = [];
function later(t, fn) { laters.push({ t, fn }); }
const webGeo = new THREE.RingGeometry(0.12, 1, 14, 5).rotateX(-Math.PI / 2), webMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea, wireframe: true, transparent: true, opacity: 0.75, depthWrite: false });
function addWeb(x, z) { NET.fx('addWeb', [x, z]); const m = new THREE.Mesh(webGeo, webMat); m.position.set(x, PLANE - 3, z); m.scale.setScalar(85); m.rotation.y = rnd() * 6.28; m.renderOrder = 12; scene.add(m); webs.push({ x, z, r: 85, t: 12, m }); }
function updateWebs(dt) { let ins = false; for (let i = webs.length - 1; i >= 0; i--) { const w = webs[i]; w.t -= dt; const me = !P.dead && dist2(P.x, P.z, w.x, w.z) < w.r; if (me && (P.flame > 0 || P.trail > 0)) { w.t = 0; burst(w.x, w.z, w.r, '#FF8C00', 16); log('Паутина сгорела', '#ffb070'); } if (w.t <= 0) { scene.remove(w.m); webs.splice(i, 1); continue; } if (me) ins = true; } if (ins && !P.web) log('Корабль увяз в паутине: её сжигает огнемёт или зажигательный след', '#ffb4a0'); P.web = ins ? 1 : 0; }
function sleepNow(t) { if (P.dead || P.sleep > 0) return; P.sleep = t; P.speed *= 0.3; channel = null; log('Корабль уснул. В сети его будит толчок союзника, в одиночном полёте сон проходит сам', '#d8f07a'); }
const SP = {
  boom(m, dt, d, dm, spd, want) { const moving = Math.abs(TP.speed) > 18 || TP.dashT > 0;
    if (d < m.r + 26) { explosion(m.x, PLANE, m.z, 1.5, [3.4, 1.4, 0.3]); shockRing(m.x, m.z, 75, 0xff8a3a); hurt(m.T.dmg * 2.2 * dm, m.name + ': взрыв', 1, { from: m }); m.hp = 0; killMob(m); m.loot = null; m.lbl.firstChild.textContent = ''; return [0, 0]; }
    if (moving && rnd() < dt * 18) fire.emit({ x: m.x, y: PLANE + 2, z: m.z, life: 0.3, s0: 9, s1: 2, r: 3.2, g: 1.4, b: 0.2, a: 0.9 });
    const k = moving ? 1.6 : 0.18; return [Math.sin(want) * spd * k, Math.cos(want) * spd * k]; },
  leech(m, dt, d, dm) { if (m.att) { if (TP === P) leechN++; m.tick -= dt; if (m.tick <= 0) { m.tick = 1; hurt(m.T.dmg * dm * (has('F-29') ? 0.5 : 1), m.name, 2, { raw: true }); } const a = TP.yaw + m.ao; m.x = TP.x + Math.sin(a) * (m.r + 17); m.z = TP.z + Math.cos(a) * (m.r + 17); return [0, 0, TP.yaw]; }
    if (d < m.r + 24 && m.cd <= 0.5) { m.att = true; m.ao = rnd() * 6.28; m.tick = 1; tlog('Пиявка присосалась: стряхните её рывком', '#ff9c8a'); } return null; },
  thief(m, dt, d, dm, spd, want) { if (m.run > 0) { m.run -= dt; if (m.run <= 0 && m.stolen) { tlog('Ворюга ушёл с вашим золотом', '#ff9c8a'); m.dead = 1; m.fade = 0; m.mesh.visible = false; m.lbl.style.display = 'none'; later(0, () => removeMob(m)); } return [-Math.sin(want) * spd * 1.15, -Math.cos(want) * spd * 1.15, want + Math.PI]; }
    if (d < m.r + 26) { const g = shop.open ? 0 : Math.min(res.gold, 3); if (g > 0) { res.gold -= g; m.stolen = (m.stolen || 0) + g; hudRes(); floatText('−' + fmt(g) + ' золота', '#ff7a66', TP.x, PLANE + 30, TP.z); tlog('Ворюга украл золото: догоните и сбейте его, вернёте вдвое', '#ff9c8a'); } m.run = 14; return [0, 0]; }
    return [Math.sin(want) * spd * 1.2, Math.cos(want) * spd * 1.2]; },
  web(m, dt, d) { if (d < 460 && m.cd2 <= 0) { m.cd2 = 9; addWeb(TP.x + Math.sin(TP.yaw) * TP.speed * 0.9, TP.z + Math.cos(TP.yaw) * TP.speed * 0.9); } return null; },
  brood(m) { if (m.cd2 <= 0) { m.cd2 = 8; if (mobs.reduce((n, q) => n + (q.mom === m && !q.dead ? 1 : 0), 0) < 9) { for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, k = spawnMob('MOB-01', m.x + Math.cos(a) * 40, m.z + Math.sin(a) * 40, { respawn: false }); k.mom = m; k.kid = true; k.mis = m.mis; k.aggro = true; } burst(m.x, m.z, 50, '#ffd58a', 10); } } return null; },
  aim(m, dt, d, dm) { m.cd = 9; if (d > 560) { m.at = 0; return null; } m.at = (m.at || 0) + dt; if (TP.dashT > 0 && m.at > 0.3) { m.at = 0; floatText('прицел сбит', '#9fe8ff', m.x, PLANE + 30, m.z); }
    m.lt = (m.lt || 0) - dt; if (m.lt <= 0) { m.lt = 0.14; bolt(m.x, m.z, TP.x, TP.z, m.at > 2.2 ? '#ff3030' : '#ffb090', 0, 0.5); } if (m.at >= 3) { m.at = 0; enemyShot(m, m.T.dmg * 1.4 * dm, 460, 0); } return null; },
  tug(m, dt, d, dm, spd) { if (m.grab > 0) { m.grab -= dt; if (m.gh - m.hp >= 70 || TP.dead) { m.grab = 0; m.cd2 = 12; if (!TP.dead) tlog('Клещ отцепился', '#ffe08a'); return null; }
      const a = Math.atan2(m.x, m.z); m.tick -= dt; if (m.tick <= 0) { m.tick = 1; hurt(m.T.dmg * dm, m.name, 2, { from: m }); } TP.x = m.x - Math.sin(a) * (m.r + 22); TP.z = m.z - Math.cos(a) * (m.r + 22); TP.speed = 0; TP.dvx = 0; TP.dvz = 0; if (m.grab <= 0) m.cd2 = 12; return [Math.sin(a) * spd * 1.1, Math.cos(a) * spd * 1.1, a]; }
    if (d < m.r + 30 && m.cd2 <= 0) { m.grab = 6; m.gh = m.hp; m.tick = 1; tlog('Клещ вцепился и тащит прочь: нанесите ему 70 урона', '#ff9c8a'); } return null; },
  hex(m, dt, d) { if (m.cast > 0) { m.cast -= dt; m.lt = (m.lt || 0) - dt; if (m.lt <= 0) { m.lt = 0.12; bolt(m.x, m.z, TP.x, TP.z, '#c070ff', 10, 0.8); } if (m.cast <= 0 && !TP.dead) { TP.hex = 10; burst(TP.x, TP.z, 50, '#c070ff', 18); tlog('Сглаз: десять секунд руль, тяга и слоты работают наоборот', '#d9a0ff'); } }
    else if (d < 420 && m.cd2 <= 0 && !(TP.hex > 0)) { m.cast = 1.4; m.cd2 = 22; } return null; },
  sleep(m, dt, d) { if (d < 400 && m.cd2 <= 0 && !(TP.sleep > 0)) { m.cd2 = 20; const tp = TP, x = TP.x + Math.sin(TP.yaw) * TP.speed * 0.8, z = TP.z + Math.cos(TP.yaw) * TP.speed * 0.8; warnRing(x, z, 80, 1.6); bolt(m.x, m.z, x, z, '#d8f07a', 14, 0.8);
      later(1.6, () => { if (m.dead || tp.dead) return; burst(x, z, 80, '#d8f07a', 26); if (dist2(tp.x, tp.z, x, z) < 86) tsleep(tp, 5); }); } return null; },
  rot(m, dt, d, dm) { m.tick -= dt; if (m.tick <= 0) { m.tick = 0.5; m.rn = !m.rn; if (m.rn) shockRing(m.x, m.z, 150, 0x9be05a); if (d < 150) { hurt(5 * dm * (has('F-29') ? 0.5 : 1), m.name + ': разъедание', 0, { raw: true }); TP.rot = 1.2; } } return null; },
  jam(m, dt, d) { if (d < 380 && m.cd2 <= 0 && TP !== P) { m.cd2 = 11; bolt(m.x, m.z, TP.x, TP.z, '#ffcf5a', 12, 1.2); NET.tell(TP.id, 'jam', 0); } if (d < 380 && m.cd2 <= 0) { m.cd2 = 11; const ws = slots.filter(q => q.kind === 'w'), q = ws[(rnd() * ws.length) | 0]; if (q) { q.cd = Math.max(q.cd, 8); bolt(m.x, m.z, TP.x, TP.z, '#ffcf5a', 12, 1.2); tlog(`Глушитель: ${q.name} молчит восемь секунд`, '#ffe08a'); } } return null; },
  ink(m, dt, d) { if (d < m.r + 40 && m.cd2 <= 0) { m.cd2 = 14; TP.ink = 6; burst(TP.x, TP.z, 50, '#30304a', 20); tlog('Чернила: шесть секунд не видно ни неба, ни карты', '#b9b9d0'); } return null; },
  pull(m, dt, d) { if (m.pull > 0) { m.pull -= dt; if (d > m.r + 40) { TP.dvx -= (TP.x - m.x) / d * 440 * dt; TP.dvz -= (TP.z - m.z) / d * 440 * dt; } m.lt = (m.lt || 0) - dt; if (m.lt <= 0) { m.lt = 0.12; bolt(m.x, m.z, TP.x, TP.z, '#6aa0ff', 8, 1); } return [0, 0]; }
    if (d < 430 && d > 110 && m.cd2 <= 0) { m.pull = 2.6; m.cd2 = 10; warnRing(m.x, m.z, m.r + 20, 0.6); tlog('Магнитник тянет корабль к себе', '#9cc0ff'); } return null; },
  fog(m, dt, d, dm, spd, want) { const k = d < 190 ? -1 : d > 300 ? 1 : 0, sa = want + Math.PI / 2; return [(Math.sin(want) * k + Math.sin(sa) * 0.5) * spd, (Math.cos(want) * k + Math.cos(sa) * 0.5) * spd]; },
  mend(m, dt, d, dm, spd) { let near = null, nd = 1e9; for (const q of mobs) if (q !== m && !q.dead && q.T.sp !== 'mend') { const e = dist2(m.x, m.z, q.x, q.z); if (e < nd) { nd = e; near = q; } }
    const mv = near ? (nd > 150 ? [(near.x - m.x) / nd * spd, (near.z - m.z) / nd * spd] : [0, 0]) : null; m.tick -= dt; if (m.tick <= 0) { m.tick = 1.5; for (const q of mobs) if (q !== m && !q.dead && q.hp < q.max && !(q.noheal > 0) && dist2(m.x, m.z, q.x, q.z) < 240) { q.hp = Math.min(q.max, q.hp + q.max * (q.boss ? 0.004 : 0.06)); bolt(m.x, m.z, q.x, q.z, '#7dff8a', 8, 0.8); } } return mv; },
};

// цвет неба по ярусам: [зенит, горизонт]. Свет, дымка и небо перетекают к новому ярусу секунд за десять
const SKYT = { '-2': [[0.3, 0.25, 0.55], [0.5, 0.4, 0.75]], '-1': [[0.7, 0.55, 1.0], [0.95, 0.75, 0.95]], '0': [[1, 1, 1], [1, 1, 1]], '1': [[0.3, 0.38, 1.1], [1.25, 0.9, 0.6]] };
// миссия может перекрасить ярус (M-2: жёлтое небо под древом). Сила мобов и награда остаются от яруса
let tierLook = null; function setTierLook(o) { tierLook = o; }
function updateTier(dt) { const T = tierLook || TIERS[tier], K = (tierLook && tierLook.sky) || SKYT[tier], a = 1 - Math.exp(-0.3 * dt), u = sky.material.uniforms; renderer.toneMappingExposure += (T.exp - renderer.toneMappingExposure) * a; sun.intensity += (T.sun - sun.intensity) * a; hemi.intensity += (T.hemi - hemi.intensity) * a;
  cloudMat.uniforms.uShade.value.lerp(fogTmp.setRGB(...T.shade), a); tierHaze.lerp(fogTmp.setRGB(...T.haze), a); tierFog.lerp(fogTmp.setHex(T.fog), a); u.uTintZ.value.lerp(fogTmp.setRGB(...K[0]), a); u.uTintH.value.lerp(fogTmp.setRGB(...K[1]), a); }
function setTier(n) { tier = n; const T = TIERS[n]; if (NET.host && NET.live && !NET.mute) NET.bcast('tier', n);
  if (!NET.client) for (const m of mobs) { if (!m.respawn) { if (!m.added) { m.dead = 1; setTimeout(() => removeMob(m), 0); } continue; } m.max = m.baseMax * T.hp; m.hp = m.max; m.dmgMul = m.baseDmg * T.dmg; m.dead = 0; m.aggro = false; m.x = m.hx; m.z = m.hz; m.mesh.visible = true; }
  for (const s of shots) { scene.remove(s.mesh); if (s.mark) scene.remove(s.mark); } shots.length = 0; target = null; for (const zn of zones) zn.t = 1e9; $('r-tier').textContent = (n > 0 ? '+' : '') + n; log(T.name + (n === 0 ? '' : `: мобы сильнее, монеты ×${T.loot}`), '#ffd58a'); }
function travel(dir, fromX, fromZ) { if (NET.client && !NET.mute) { if (portalCd <= 0) { portalCd = 4; NET.req('travel', [dir, fromX, fromZ]); } return; } const n = tier + dir; if (NET.host && TIERS[n]) NET.bcast('travel', [dir, fromX, fromZ]); if (!TIERS[n]) { if (portalCd <= 0) { log(dir < 0 ? 'Глубже пути нет: это нижний ярус' : 'Выше пути нет: это верхний ярус'); portalCd = 3; } return; }
  const f = $('fade'); f.style.opacity = 1; portalCd = 4; P.speed = 0; P.dvx = 0; P.dvz = 0; setTimeout(() => { setTier(n); const a = Math.atan2(-fromX, -fromZ); const R = dir < 0 ? 470 : 330; P.x = fromX + Math.sin(a) * R; P.z = fromZ + Math.cos(a) * R; P.yaw = a; first = true; f.style.opacity = 0; }, STILL ? 0 : 450); }
// переход миссии на другой ярус: затемнение, ярус, корабль ставится в точку
function goTier(n, x, z) { if (NET.host) NET.bcast('goTier', [n, x, z]); if (NET.mute) { x += teamSlot() * 45; } const f = $('fade'); f.style.opacity = 1; portalCd = 4; P.speed = 0; P.dvx = 0; P.dvz = 0; const go = () => { setTier(n); P.x = x; P.z = z; first = true; f.style.opacity = 0; }; if (STILL) go(); else setTimeout(go, 450); }
function portalMesh(up, k = 0.5) { const m = (up ? tornado : whirl).clone(); m.userData.rec = ['portal', up, k]; m.scale.setScalar(k); if (up) m.position.y = 420 * k; m.visible = true; return m; }
function checkPortals() { portalCd = Math.max(0, portalCd - 1 / 60); const mis = MIS.on; tornado.visible = !mis; whirl.visible = !mis || MIS.id === 'M-3'; if (portalCd > 0.5) return; if (mis && MIS.id !== 'M-3') return; if (mis && dist2(P.x, P.z, UP.x, UP.z) < 70) return; if (dist2(P.x, P.z, vortex.x, vortex.y) < 85) travel(-1, vortex.x, vortex.y); else if (dist2(P.x, P.z, UP.x, UP.z) < 70) travel(1, UP.x, UP.z); }
// торнадо вверх
const tornadoMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec3 p = position; float k = (p.y + 450.0)/900.0; p.x += sin(k*5.0 + uT*1.3)*22.0*k; p.z += cos(k*4.0 + uT*1.1)*22.0*k; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }', fragmentShader: `uniform float uT; varying vec2 vUv; void main(){ float s = sin(vUv.x*31.416 + vUv.y*22.0 - uT*6.0); float s2 = sin(vUv.x*18.85 - vUv.y*9.0 - uT*3.0); float a = (0.55 + 0.35*s*s + 0.2*s2)*smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.45,vUv.y); gl_FragColor = vec4(mix(vec3(1.0,0.74,0.32), vec3(1.0,0.95,0.8), 0.5+0.5*s2)*1.7, clamp(a,0.0,0.95));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` });
const tornado = new THREE.Mesh(new THREE.CylinderGeometry(150, 34, 900, 40, 24, true), tornadoMat); tornado.position.set(UP.x, 420, UP.z); tornado.renderOrder = 13; scene.add(tornado);
const whirlMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: `uniform float uT; varying vec2 vUv; void main(){ vec2 p = vUv*2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
    float arms = 0.5 + 0.5*sin(a*4.0 + 9.0*log(r + 0.05) + uT*2.4); float arms2 = 0.5 + 0.5*sin(a*9.0 - 16.0*r + uT*3.6);
    vec3 col = mix(vec3(0.30,0.04,0.80), vec3(0.03,0.50,0.85), arms)*(0.22 + 0.9*arms*arms) + vec3(0.7,0.8,1.0)*pow(arms2, 7.0)*0.18;
    col = mix(col, vec3(0.015,0.0,0.05), smoothstep(0.30, 0.02, r));
    float al = smoothstep(1.0, 0.72, r)*(0.6 + 0.4*arms);
    gl_FragColor = vec4(col, clamp(al*1.15, 0.0, 0.96));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` });
const whirl = new THREE.Mesh(new THREE.CircleGeometry(250, 72).rotateX(-Math.PI / 2), whirlMat); whirl.position.set(vortex.x, -16, vortex.y); whirl.renderOrder = 8; scene.add(whirl);
const upLbl = mkLabel('obj', 'Торнадо: подъём на ярус выше', false), downLbl = mkLabel('obj', 'Водоворот: спуск на ярус ниже', false);
function updatePortalFx(dt) { tornadoMat.uniforms.uT.value = time; tornado.rotation.y = time * 0.7; whirlMat.uniforms.uT.value = time; if ((frameN & 1) && dist2(P.x, P.z, UP.x, UP.z) < 1100) { const a = rnd() * 6.28, h = rnd(), r = 40 + h * 110; fire.emit({ x: UP.x + Math.cos(a) * r, y: 10 + h * 500, z: UP.z + Math.sin(a) * r, vx: -Math.sin(a) * 90, vy: 90, vz: Math.cos(a) * 90, life: 1.2, s0: 10, s1: 2, r: 2.4, g: 1.9, b: 0.9, a: 0.8 }); }
  if (!MIS.on && dist2(P.x, P.z, UP.x, UP.z) < 700) place(upLbl, UP.x, 150, UP.z); else upLbl.style.display = 'none'; if ((!MIS.on || MIS.id === 'M-3') && dist2(P.x, P.z, vortex.x, vortex.y) < 800) place(downLbl, vortex.x, 60, vortex.y); else downLbl.style.display = 'none'; }

// ---------- логика ----------
let time = 0, turnNow = 0;
const dec = (k, dt) => { if (P[k] > 0) P[k] = Math.max(0, P[k] - dt); };
function update(dt) {
  time += dt;
  // игрок
  if (P.dead > 0) { P.dead -= dt; $('dead-t').textContent = Math.ceil(P.dead); if (P.dead <= 0) { P.dead = 0; P.hp = P.revive ? Math.round(S.hp * P.revive) : S.hp; if (!P.revive) { [P.x, P.z] = MIS.cp(); P.x += teamSlot() * 40; } P.revive = 0; P.speed = 0; P.dvx = 0; P.dvz = 0; P.second = false; ship.visible = true; $('dead').style.display = 'none'; for (const m of mobs) m.aggro = false; first = true; log('Корабль снова в строю'); } }
  else {
    for (const k of ['wind', 'buffW', 'buffA', 'cry', 'anchor', 'over', 'will', 'bots', 'gambit', 'dive', 'rapid', 'tail', 'burn', 'turbo', 'kit', 'fSpd', 'fArm', 'fDmg', 'wArm', 'wCd', 'wRep', 'mirror', 'bubble', 'shock', 'probe', 'bull', 'hex', 'sleep', 'ink', 'rot']) dec(k, dt);
    const sh = held('dash'); const turn = (sh || P.anchor > 0) ? 0 : (held('left') ? 1 : 0) - (held('right') ? 1 : 0); turnNow = turn;
    const maxSp = 125 * S.speed * (P.fSpd > 0 ? 1.2 : 1) * (P.wind > 0 ? 1.3 : 1) * (P.tail > 0 ? 1.4 : 1) * (P.burn > 0 ? 2 : 1) * (P.turbo > 0 ? 3 : 1) * (P.cry > 0 ? 1.15 : 1) * (P.over > 0 ? 1.15 : 1) * (has('F-30') && P.hp < S.hp * 0.25 ? 1.3 : 1) * (P.web > 0 ? 0.4 : 1) * (1 - 0.1 * Math.min(5, P.leech || 0)); const accel = held('fwd') && !held('back') && P.anchor <= 0;
    if (P.anchor > 0) P.speed = 0;
    else if (held('back')) P.speed = P.speed > 0 ? Math.max(0, P.speed - 140 * dt) : Math.max(-26, P.speed - 30 * dt);
    else if (accel) P.speed = Math.min(maxSp, P.speed + (P.speed < 0 ? 100 : 62) * (P.turbo > 0 ? 6 : P.burn > 0 ? 3 : 1) * dt); if (P.kit > 0) heal(14 * dt, true); if (P.wRep > 0) heal(2 * dt, true);
    else P.speed -= Math.sign(P.speed) * Math.min(Math.abs(P.speed), 7 * dt);
    if (P.speed > maxSp) P.speed = Math.max(maxSp, P.speed - 80 * dt);
    P.still = Math.abs(P.speed) < 4 && P.dashT <= 0 ? P.still + dt : 0;
    P.yaw += turn * (0.9 - 0.35 * Math.min(1, Math.abs(P.speed) / 125)) * (has('F-32') ? 1.4 : 1) * dt; P.bank = lerp(P.bank, -turn * 0.3 * Math.min(1, Math.abs(P.speed) / 40 + 0.3) - (P.dashT > 0 ? Math.sign(P.dvx * Math.cos(P.yaw) - P.dvz * Math.sin(P.yaw)) * 0.5 : 0), 1 - Math.exp(-5 * dt));
    P.x += (Math.sin(P.yaw) * P.speed + P.dvx) * dt; P.z += (Math.cos(P.yaw) * P.speed + P.dvz) * dt; { const f = Math.exp(-5 * dt); P.dvx *= f; P.dvz *= f; } P.hitCd -= dt; P.dashCd = Math.max(0, P.dashCd - dt); P.dashT = Math.max(0, P.dashT - dt);
    { const dv = P.dive > 0; if (dv !== P.wasDive) { P.wasDive = dv; splash(); } P.diveK += ((dv ? 1 : 0) - P.diveK) * (1 - Math.exp(-(dv ? 2.4 : 3.2) * dt)); if (dv) { P.wakeT -= dt; if (P.wakeT <= 0) { P.wakeT = 0.07; smoke.emit({ x: P.x + (rnd() - 0.5) * 10, y: 6, z: P.z + (rnd() - 0.5) * 10, vy: 6, life: 1.8, s0: 20, s1: 56, r: 0.78, g: 0.84, b: 1.0, a: 0.55 }); } } }
    P.thr = accel ? clamp(P.speed / 125, 0.15, 1) : Math.abs(P.speed) > 6 ? 0.12 : 0; P.boost = (P.dashT > 0 || P.burn > 0 || P.turbo > 0 || P.bull > 0) ? 1 : 0;
    ship.userData.engMat.emissive.setHex(accel || P.dashT > 0 ? 0x7dff1a : 0x4fd8ff); ship.userData.engMat.emissiveIntensity = 2 + Math.abs(P.speed) / 125 * 8;
    const dC = Math.hypot(P.x, P.z); if (dC > 3600) { P.x *= 3600 / dC; P.z *= 3600 / dC; if (P.hitCd <= 0) { log('Дальше сплошная буря, поворачивайте'); P.hitCd = 3; } }
    const sp0 = Math.abs(P.speed) + Math.hypot(P.dvx, P.dvz);
    const hit = obstacleAt(P.x, P.z, 14); if (hit) { P.x = hit.o.x + hit.nx * hit.r; P.z = hit.o.z + hit.nz * hit.r; if (sp0 > 10 && P.hitCd <= 0) { if (!has('F-02')) damagePlayer(Math.max(3, sp0 * 0.14), 'Столкновение', 0, { raw: true }); P.hitCd = 0.9; if (P.flood > 0) flood(P.flood - 1); for (let i = 0; i < 6; i++) puff(P.x - hit.nx * 12, PLANE, P.z - hit.nz * 12, 14, [0.5, 0.45, 0.4], 0.5, 1); } P.speed *= 0.3; }
    for (const m of mobs) if (!m.dead) { const d = dist2(P.x, P.z, m.x, m.z); const rr = m.r + 14; if (d < rr) { const nx = (P.x - m.x) / (d || 1), nz = (P.z - m.z) / (d || 1); if (m.T.cls === 2 || m.boss) { P.x = m.x + nx * rr; P.z = m.z + nz * rr; } else { m.x = P.x - nx * rr; m.z = P.z - nz * rr; }
        if (P.bull > 0 && !m.bullHit) { m.bullHit = time; hitMob(m, 160, 0, { color: '#A0522D' }); m.stun = 3; m.kx = -nx * 300; m.kz = -nz * 300; }
        else if (sp0 > 30 && P.hitCd <= 0) { const dm = sp0 * 0.2; if (has('F-02')) hitMob(m, 120, 0); else { damagePlayer(dm, 'Таран', 0, { raw: true }); hitMob(m, dm * 2.2, 0); } m.kx = -nx * sp0 * 1.5; m.kz = -nz * sp0 * 1.5; P.hitCd = 0.9; P.speed *= 0.5; if (P.flood > 0) flood(P.flood - 1); } } if (m.bullHit && time - m.bullHit > 1) m.bullHit = 0; }
    if (NET.live) shipBump(sp0);
    // пассивный ремонт: 1 в секунду; вне боя (30 с без урона и эффектов) — 3 в секунду
    { const calm = time - (P.lastHit ?? -99) > (has('CREW-03') ? 20 : D.REPAIR.calmAfter); if (P.hp < S.hp) P.hp = Math.min(S.hp, P.hp + ((calm ? D.REPAIR.calm * (has('CREW-03') ? 1.5 : 1) : D.REPAIR.base) + (has('F-26') ? 1.5 : 0)) * dt); P.calm = calm; }
    checkPortals();
    for (const o of objects) if (o.kind === 'shell') { o.cd = Math.max(0, o.cd - dt); o.g.position.y = PLANE + Math.sin(time * 0.8 + o.x) * 2; o.top.rotation.x = lerp(o.top.rotation.x, o.cd > 0 ? -1.15 : -0.12 - 0.05 * Math.sin(time * 1.5 + o.z), 1 - Math.exp(-4 * dt)); o.pearl.visible = o.cd <= 0;
      if (o.cd <= 0 && dist2(P.x, P.z, o.x, o.z) < o.r) { if (sp0 > 12) { o.cd = 75; spawnOrbs(o.x, o.z, 9 + (rnd() * 5 | 0), o.col); fire.emit({ x: o.x, y: PLANE, z: o.z, life: 0.35, s0: 40, s1: 160, r: o.col[0], g: o.col[1], b: o.col[2], a: 0.8 }); log('Жемчужница раскрылась!', '#ffd9f2'); } else if (P.hitCd <= 0) { log('Жемчужницу нужно толкнуть на ходу'); P.hitCd = 2; } } }
    // действие
    if (channel) { const o = channel.o; if (dist2(P.x, P.z, o.x, o.z) > o.r + 20) { log('Действие прервано: вы отошли слишком далеко'); channel = null; } else { channel.t += dt; if (channel.t >= channel.dur) { finish(o); channel = null; } } }
    // огнемёт и зажигательный след
    if (P.flame > 0) { P.flame -= dt; P.flameT -= dt; const col = D.WEAPONS['W-5'].color, R = wRange('W-5'); spray(P.yaw, 0.42, R * 1.9, col, 5, 0.5); if (P.flameT <= 0) { P.flameT = 0.25; for (const m of inCone(R, 0.45)) { hitMob(m, 45 * 0.25, 3, { color: col }); m.burn = 5; } } }
    if (P.trail > 0) P.trail -= dt; updateTrail(dt);
    // прицел: копят только пушки
    const cs = slots.find(q => q.id === 'W-1' && q.kind === 'w'); const cR = wRange('W-1');
    if (target && (target.dead || dist2(P.x, P.z, target.x, target.z) > cR * 2)) target = null;
    if (target && FOG.vis && dist2(P.x, P.z, target.x, target.z) > FOG.vis * 1.15) target = null;
    if (!target) { let bd = FOG.vis ? Math.min(625, FOG.vis) : 625; for (const m of mobs) if (!m.dead) { const d = dist2(P.x, P.z, m.x, m.z); if (d < bd) { bd = d; target = m; } } if (target && !has('CREW-01')) P.aim = 0; }
    if (cs && target && cs.cd <= 0 && dist2(P.x, P.z, target.x, target.z) < cR + target.r) P.aim = Math.min(100, P.aim + 34 * (has('F-14') ? 1.4 : 1) * dt); else if (!cs || !target || cs.cd <= 0) P.aim = Math.max(0, P.aim - 60 * dt);
  }
  for (const q of slots) q.cd = Math.max(0, q.cd - dt * (q.kind === 'w' ? (P.rapid > 0 ? 2 : 1) * (P.wCd > 0 ? 1.18 : 1) : 1));
  for (const o of objects) if (o.kind !== 'shell') o.cd = Math.max(0, o.cd - dt);
  updateOrbs(dt); if (lootT > 0) { lootT -= dt; if (lootT <= 0) $('loot').style.display = 'none'; } if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.display = 'none'; } if (storyT > 0) { storyT -= dt; if (storyT <= 0) $('story').style.display = 'none'; }
  updateAuto(); updateZones(dt); updateAttach(dt); updateWebs(dt); for (let i = laters.length - 1; i >= 0; i--) { const q = laters[i]; q.t -= dt; if (q.t <= 0) { laters.splice(i, 1); q.fn(); } } MIS.tick(dt);
  const hidden = P.dive > 0 || zones.some(zn => zn.hide && dist2(P.x, P.z, zn.x, zn.z) < zn.r + 10); const decoy = zones.find(zn => zn.decoy && !zn.dead);
  // мобы
  leechN = 0; fogNear = false;
  if (NET.client) clientMobs(dt); else for (const m of mobs) {
    if (m.dead) { if (m.fade !== 0) corpse(m, dt); if (m.gone) continue; if (m.respawn) { m.rt -= dt; if (m.rt <= 0 && m.fade === 0 && dist2(TP.x, TP.z, m.hx, m.hz) > 500) { m.dead = 0; m.hp = m.max; m.x = m.hx; m.z = m.hz; m.aggro = false; m.mesh.visible = true; m.mesh.rotation.z = 0; m.mesh.scale.setScalar(m.sc); m.lbl.firstChild.textContent = m.name; m.lbl.classList.remove('loot'); pauseModel(m.mesh, false); m.far = null; } } continue; }
    TP = NET.live ? pickTarget(m) : P;
    const T = m.T, ai = T.ai; for (const k of ['stun', 'slow', 'mark', 'acid', 'blind', 'weak', 'noheal', 'open', 'shell']) if (m[k] > 0) m[k] -= dt;
    if (m.still) { if (m.burn > 0) { m.burn -= dt; m.bt -= dt; if (m.bt <= 0) { m.bt = 0.5; hitMob(m, 5, 3, { dot: true, color: '#FF4500' }); } } if (!m.dead) { m.mesh.position.set(m.x, PLANE + 10, m.z); m.aggro = false; } continue; }
    if (m.burn > 0) { m.burn -= dt; m.bt -= dt; if (m.bt <= 0) { m.bt = 0.5; hitMob(m, 5, 3, { dot: true, color: '#FF4500' }); if (m.dead) continue; } fire.emit({ x: m.x + (rnd() - 0.5) * m.r, y: PLANE + rnd() * m.r * 0.5, z: m.z + (rnd() - 0.5) * m.r, vy: 30, life: 0.5, s0: 12, s1: 3, r: 3, g: 1, b: 0.1, a: 0.9 }); }
    const dx = TP.x - m.x, dz = TP.z - m.z; const d = Math.hypot(dx, dz); { const far = d > 1300, hm = !!m.mesh.userData.model; if (far !== m.far || hm !== m.hm) { m.far = far; m.hm = hm; pauseModel(m.mesh, far); } } const dm = m.dmgMul * (m.weak > 0 ? 0.8 : 1); const pd = { from: m }; if (T.sp === 'fog' && d < 420) fogNear = true; m.mesh.visible = !FOG.vis || d < FOG.vis + 40;
    if (!SEE || (m.aggro && (TP.dead || (TP === P ? hidden : TP.hide) || d > 1000))) m.aggro = false;
    let vx = 0, vz = 0, want = m.yaw; m.cd -= dt; m.cd2 -= dt; const spd = T.speed * (m.slow > 0 ? (m.boss ? 0.5 : 0.6) : 1);
    if (m.aggro && !m.boss && (!m.tgt || m.tgt.struct)) { if (m.tgt && (m.tgt.dead || m.tgt.hp <= 0)) m.tgt = null; m.zt = (m.zt || 0) - dt; if (m.zt <= 0) { m.zt = 1.5; let best = null, bd = Math.min(d, 280); for (const zn of zones) if (zn.struct && !zn.dead && !zn.decoy) { const q = Math.hypot(zn.x - m.x, zn.z - m.z); if (q < bd) { bd = q; best = zn; } } m.tgt = best; } }
    if (m.stun > 0) { m.lunge = 0; m.wind = 0; m.slam = 0; m.beam = 0; m.cast = 0; m.grab = 0; m.pull = 0; m.at = 0; }
    else if (m.aggro && decoy && !m.boss && T.cls < 2) { want = Math.atan2(decoy.x - m.x, decoy.z - m.z); if (dist2(m.x, m.z, decoy.x, decoy.z) > m.r + 20) { vx = Math.sin(want) * spd; vz = Math.cos(want) * spd; } else if (decoy.struct && (m.tcd = (m.tcd || 0) - dt) <= 0) { m.tcd = 1.5; decoy.hp -= Math.max(8, T.dmg * 0.5) * dm; bolt(m.x, m.z, decoy.x, decoy.z, '#ff8a6a', 6, 0.8); } }
    else if (m.aggro && m.tgt && m.tgt.hp > 0) { const tx = m.tgt.x - m.x, tz = m.tgt.z - m.z, td = Math.hypot(tx, tz) || 1, reach = m.r + (ai === 'shoot' || ai === 'beam' ? 220 : 55); want = Math.atan2(tx, tz); m.tcd = (m.tcd || 0) - dt;
      if (td > reach) { vx = tx / td * spd; vz = tz / td * spd; } else if (m.tcd <= 0 && m.stun <= 0) { m.tcd = 1.5; m.tgt.hp -= Math.max(8, T.dmg * 0.5) * dm; bolt(m.x, m.z, m.tgt.x, m.tgt.z, '#ff8a6a', 6, 0.8); } }
    else if (m.aggro) { want = Math.atan2(dx, dz); const ov = SP[T.sp] ? SP[T.sp](m, dt, d, dm, spd, want) : null;
      if (ov) { vx = ov[0]; vz = ov[1]; if (ov.length > 2) want = ov[2]; }
      else if (ai === 'none') { vx = -Math.sin(want) * spd; vz = -Math.cos(want) * spd; want += Math.PI; }
      else if (ai === 'bite') {                              // укус и бросок
        if (m.lunge > 0) { m.lunge -= dt; vx = Math.sin(m.la) * spd * 3.2; vz = Math.cos(m.la) * spd * 3.2; want = m.la; fire.emit({ x: m.x, y: PLANE, z: m.z, life: 0.25, s0: 10, s1: 2, r: 2.2, g: 0.5, b: 1.6, a: 0.9 }); if (d < m.r + 22 && !m.bit) { hurt(T.dmg * 2 * dm, m.name, T.atk, { from: m, melee: true }); m.bit = true; } }
        else if (m.wind > 0) { m.wind -= dt; if (m.wind <= 0) { m.lunge = 0.55; m.la = want; m.bit = false; } }
        else { const a = want + Math.sin(time * 2 + m.hx) * 0.5; const go = d > m.r + 24 ? 1 : 0; vx = Math.sin(a) * spd * go; vz = Math.cos(a) * spd * go; if (d < m.r + 30 && m.cd <= 0 && m.blind <= 0) { hurt(T.dmg * 0.7 * dm, m.name, T.atk, { from: m, melee: true }); m.cd = 0.9; } if (d > 90 && d < 260 && m.cd2 <= 0) { m.wind = 0.5; m.cd2 = 5 + rnd() * 3; warnRing(m.x, m.z, m.r + 7, 0.5); } } }
      else { const ideal = ai === 'shoot' ? 250 : ai === 'beam' ? 210 : 300; const radial = clamp((d - ideal) / 60, -1, 1); const sa = want + m.strafe * Math.PI / 2; vx = (Math.sin(want) * radial + Math.sin(sa) * 0.7) * spd; vz = (Math.cos(want) * radial + Math.cos(sa) * 0.7) * spd;
        if (ai === 'shoot' && d < 520 && m.cd <= 0) { m.n = (m.n || 0) + 1; if (m.n % 3 === 0) { for (let k = -2; k <= 2; k++) enemyShot(m, T.dmg * 0.8 * dm, 170, k * 0.17); m.cd = 3.4; } else { enemyShot(m, T.dmg * 1.05 * dm, 210, 0); m.cd = 2.4; } }
        if (ai === 'heavy') { const sr = 150 + m.r;                  // очередь, удар по площади, тяжёлая бомба
          if (m.slam > 0) { m.slam -= dt; vx = 0; vz = 0; if (m.slam <= 0) { explosion(m.x, PLANE, m.z, 2.2, [2.6, 0.4, 1.2]); shockRing(m.x, m.z, sr, 0xff5a70); if (d < sr + 10) hurt(T.dmg * dm, m.name + ': удар', T.atk, pd); if (T.sp === 'belly') m.open = 3; } }
          else if (d < sr - 25 && m.cd2 <= 0) { m.slam = 1.3; m.cd2 = 7; warnRing(m.x, m.z, sr, 1.3); }
          else if (d < 520 && m.cd <= 0) { m.n = (m.n || 0) + 1; if (m.n % 5 === 0) { enemyBomb(m, T.dmg * 0.85 * dm); m.cd = 3; } else { enemyShot(m, T.dmg * 0.45 * dm, 170, 0); m.burst++; if (m.burst >= 3) { m.burst = 0; m.cd = 4.2; } else m.cd = 0.35; } } }
        if (ai === 'beam') {                                 // молния, пока вы рядом
          if (m.beam > 0) { m.beam -= dt; m.tick -= dt; if (d < 330 && m.tick <= 0) { m.tick = 0.3; bolt(m.x, m.z, TP.x, TP.z); if (m.blind <= 0) hurt(T.dmg * 0.15 * dm, m.name, T.atk, pd); } }
          else if (d < 300 && m.cd <= 0) { m.beam = 1.8; m.tick = 0.45; m.cd = 5; warnRing(m.x, m.z, m.r + 26, 0.45); } } } }
    else { m.wt -= dt; if (m.wt <= 0) { m.wander = Math.atan2(m.hx - m.x, m.hz - m.z) + (rnd() - 0.5) * 2.4; m.wt = 2 + rnd() * 3; } const hd = dist2(m.x, m.z, m.hx, m.hz); const sp = hd > 90 ? spd * 0.5 : spd * 0.22; vx = Math.sin(m.wander) * sp; vz = Math.cos(m.wander) * sp; want = m.wander; m.lunge = 0; m.wind = 0; m.slam = 0; m.beam = 0; m.att = false; m.grab = 0; m.cast = 0; }
    m.x += (vx + m.kx) * dt; m.z += (vz + m.kz) * dt; const f = Math.exp(-2.2 * dt); m.kx *= f; m.kz *= f;
    const ob = obstacleAt(m.x, m.z, m.r); if (ob) { m.x = ob.o.x + ob.nx * ob.r; m.z = ob.o.z + ob.nz * ob.r; }
    let dy = want - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); { const tr = (T.sp === 'shield' ? 0.5 : 3) * dt; m.yaw += clamp(dy, -tr, tr) * (m.stun > 0 ? 0 : 1); }
    m.mesh.position.set(m.x, PLANE + Math.sin(time * 1.3 + m.hx) * 2.5 + (ai === 'heavy' && !m.boss ? -4 : 0) + (m.wind > 0 ? 6 : 0), m.z); m.mesh.rotation.y = m.yaw;
  }
  TP = P;
  P.leech = leechN; updateFog(dt);
  updateShots(dt);
  for (let i = warns.length - 1; i >= 0; i--) { const w = warns[i]; w.t += dt; w.m.material.opacity = 0.35 + 0.55 * Math.abs(Math.sin(w.t * 14)); if (w.t >= w.dur) { scene.remove(w.m); warns.splice(i, 1); } }
  updateWorldFx(dt);
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; if (r.bolt) { r.m.material.opacity = 1 - r.t / 0.28; if (r.t > 0.28) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); } } else { const k = Math.min(1, r.t / 0.6), e = 1 - (1 - k) * (1 - k); r.m.scale.setScalar(Math.max(1, r.r * (0.2 + 0.8 * e))); r.m.material.uniforms.uK.value = k; if (k >= 1) { scene.remove(r.m); FX.release(r.m); rings.splice(i, 1); } } }
  KOI_T.value = time; for (const o of objects) { if (o.kind === 'fish') for (const f of o.fish) { const u = f.userData; u.a += u.sp * dt * (0.55 + 0.6 * Math.max(0, Math.sin(time * 0.6 + u.ph * 3))); const w = time * 0.11 + u.ph, rr = u.r + Math.sin(w) * 8, dr = Math.cos(w) * 0.88, ca = Math.cos(u.a), sa = Math.sin(u.a); f.position.set(ca * rr, POND_Y - 2.4 + Math.sin(time * 0.4 + u.ph) * 0.3, sa * rr); f.rotation.set(0, Math.atan2(-sa * rr * u.sp + ca * dr, ca * rr * u.sp + sa * dr) + Math.sin(time * 6.5 + u.ph) * 0.05, 0); } if (o.kind === 'beacon' && o.lit) o.beam.rotation.y = time * 0.9; }
  fire.update(dt); smoke.update(dt);
}

// ---------- отрисовка ----------
renderer.shadowMap.autoUpdate = false; let frameN = 0;
const camC = new THREE.Vector3(), tmp = new THREE.Vector3(); let camFollow = P.yaw, first = true; const map = $('map'), mctx = map.getContext('2d');
function drawMap() { const c = mctx, Sz = 200, H = 100, wide = has('F-05') || P.probe > 0, k = 92 / (wide ? 2500 : 1250); c.fillStyle = '#0a0c0b'; c.fillRect(0, 0, Sz, Sz); if (P.ink > 0) return; c.save(); c.translate(H, H);
  const px = (x, z) => [(x - P.x) * k, -(z - P.z) * k];
  c.strokeStyle = '#17231c'; c.lineWidth = 1; c.beginPath(); for (let g = -100; g <= 100; g += 25) { c.moveTo(g, -100); c.lineTo(g, 100); c.moveTo(-100, g); c.lineTo(100, g); } c.stroke();
  c.strokeStyle = '#2c4636'; c.beginPath(); for (const rr of [wRange('W-1') * k, 625 * k]) { c.moveTo(rr, 0); c.arc(0, 0, rr, 0, 6.2832); } c.moveTo(-100, 0); c.lineTo(100, 0); c.moveTo(0, -100); c.lineTo(0, 100); c.stroke();
  c.lineWidth = 1.5; for (const il of islands) { if (!il.collide || il.off) continue; const [a, b] = px(il.x, il.z); if (Math.abs(a) > 130 || Math.abs(b) > 130) continue; c.beginPath(); for (let i = 0; i <= 20; i++) { const th = i / 20 * 6.2832, rr = il.R * il.outline(th) * k; const X = a + Math.cos(th) * rr, Y = b - Math.sin(th) * rr; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); } c.fillStyle = '#1d2b22'; c.fill(); c.strokeStyle = '#7d9a78'; c.stroke(); }
  c.fillStyle = '#8a8f8c'; for (const s of spires) { const [a, b] = px(s.x, s.z); c.beginPath(); c.moveTo(a, b - 4); c.lineTo(a + 3.5, b); c.lineTo(a, b + 4); c.lineTo(a - 3.5, b); c.fill(); }
  c.lineWidth = 2; { const [a, b] = px(vortex.x, vortex.y); c.strokeStyle = '#a06aff'; c.beginPath(); c.arc(a, b, 9, 0, 4.6); c.stroke(); c.beginPath(); c.arc(a, b, 4.5, 2, 6.6); c.stroke(); }
  { const [a, b] = px(UP.x, UP.z); c.strokeStyle = '#e0a23a'; c.beginPath(); c.moveTo(a - 6, b + 6); c.lineTo(a, b - 7); c.lineTo(a + 6, b + 6); c.stroke(); }
  c.lineWidth = 1.5; for (const o of objects) { if (o.kind === 'island' || o.off) continue; const [a, b] = px(o.x, o.z); if (Math.abs(a) > 104 || Math.abs(b) > 104) continue; c.strokeStyle = c.fillStyle = '#e0a23a';
    if (o.kind === 'beacon') { if (o.lit) c.fillRect(a - 3.5, b - 3.5, 7, 7); else c.strokeRect(a - 3.5, b - 3.5, 7, 7); }
    else if (o.kind === 'tree') { c.beginPath(); c.moveTo(a, b - 5); c.lineTo(a + 4.5, b + 4); c.lineTo(a - 4.5, b + 4); c.closePath(); c.stroke(); }
    else if (o.kind === 'fish') { c.beginPath(); c.moveTo(a - 5, b); c.lineTo(a, b - 3); c.lineTo(a + 5, b); c.lineTo(a, b + 3); c.closePath(); c.stroke(); }
    else { c.globalAlpha = o.cd > 0 ? 0.35 : 1; c.fillStyle = '#' + SHELL_HEX[o.ci]; c.fillRect(a - 2, b - 2, 4, 4); c.globalAlpha = 1; } }
  MIS.map(c, px); NET.mapDraw(c, px);
  for (const m of mobs) if (m.dead && m.loot) { const [a, b] = px(m.x, m.z); if (Math.abs(a) > 104 || Math.abs(b) > 104) continue; c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(a, b, 3, 0, 6.3); c.fill(); }
  for (const m of mobs) if (!m.dead) { const [a, b] = px(m.x, m.z); if (Math.abs(a) > 104 || Math.abs(b) > 104 || (FOG.vis && dist2(P.x, P.z, m.x, m.z) > FOG.vis)) continue; const s = m.boss ? 7 : m.T.cls === 2 ? 5 : 3.4; c.fillStyle = m.boss ? '#ffb030' : m.aggro ? '#ff3a2a' : '#b8473c'; c.beginPath(); c.moveTo(a, b - s); c.lineTo(a + s, b + s); c.lineTo(a - s, b + s); c.fill(); if (m === target) { c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.strokeRect(a - 7, b - 7, 14, 14); } }
  c.save(); c.rotate(P.yaw); c.fillStyle = '#f2f2ee'; c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 2.5); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.restore(); c.restore();
  c.fillStyle = '#6b7073'; for (const [x, y] of [[5, 5], [195, 5], [5, 195], [195, 195]]) { c.beginPath(); c.arc(x, y, 2.4, 0, 6.2832); c.fill(); }
  c.font = '700 10px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#9fb8a4'; c.textAlign = 'center'; c.fillText('С', 100, 12); c.fillText('Ю', 100, 196); c.textAlign = 'left'; c.fillText('З', 4, 104); c.textAlign = 'right'; c.fillText('В', 196, 104); c.textAlign = 'left'; c.fillStyle = '#5f7566'; c.fillText('ЯРУС ' + (tier > 0 ? '+' : '') + tier, 12, 196); }
let uiT = 1; const NORENDER = /[?&]norender/.test(location.search);   // для проверки сети без видеокарты
const BUFFS = [['calm', 'ремонт ×3'], ['fSpd', 'искрохвост: скорость +20 %'], ['fArm', 'панцирный карп: урон по вам −15 %'], ['fDmg', 'огнепёр: урон +15 %'], ['wArm', 'железное дерево: урон по вам −10 %'], ['wCd', 'смолистая сосна: перезарядка быстрее'], ['wRep', 'лунный клён: ремонт +2'], ['buffW', 'урон +20 %'], ['buffA', 'урон по вам −20 %'], ['wind', 'попутный ветер'], ['rapid', 'беглый огонь'], ['will', 'стальная воля'], ['tail', 'ветер'], ['burn', 'форсаж'], ['cry', 'боевой клич'], ['anchor', 'якорь'], ['gambit', 'гамбит'], ['dive', 'под облаками'], ['bots', 'бронеботы'], ['mirror', 'зеркало'], ['over', 'перегрузка'], ['probe', 'зонд'], ['hex', 'сглаз: управление наоборот'], ['sleep', 'сон'], ['ink', 'чернила'], ['rot', 'разъедание'], ['web', 'паутина: скорость −60 %'], ['leech', 'пиявки']];
function render(dt) { MIS.render();
  { const k = P.diveK * P.diveK * (3 - 2 * P.diveK); ship.position.set(P.x, PLANE + Math.sin(time * 0.9) * 0.8 - 70 * k, P.z); ship.rotation.set(0, P.yaw, 0); ship.rotateZ(P.bank); ship.rotateX(0.5 * Math.sin(Math.PI * P.diveK) * (P.dive > 0 ? 1 : -1));
    diveShade.visible = P.diveK > 0.02; diveShade.position.set(P.x, 2.5, P.z); diveShade.rotation.y = P.yaw; diveShade.material.uniforms.uFade.value = P.diveK;
    for (const f of flames) f.userData.set(P.dead ? 0 : P.thr, P.boost, time); }
  if (target) { tRing.visible = true; tRing.position.set(target.x, PLANE - 8, target.z); tRing.scale.setScalar(target.r + 12); tRing.rotation.y = -time; } else tRing.visible = false;
  // камера: сглаживание привязано ко времени, а не к числу кадров, поэтому при повороте картинка не дрожит
  if (first) { camFollow = P.yaw; camC.set(P.x, PLANE, P.z); first = false; } else { let dy = P.yaw - camFollow; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); camFollow += dy * (1 - Math.exp(-6 * dt)); tmp.set(P.x, PLANE, P.z); camC.lerp(tmp, 1 - Math.exp(-14 * dt)); if (camC.distanceTo(tmp) > 400) camC.copy(tmp); }
  const cy = camFollow + Math.PI + camYaw; camera.position.set(camC.x + Math.sin(cy) * Math.cos(camPitch) * camDist, camC.y + Math.sin(camPitch) * camDist, camC.z + Math.cos(cy) * Math.cos(camPitch) * camDist); const la = camDist * 0.22; camera.lookAt(camC.x - Math.sin(cy) * la, PLANE + 22, camC.z - Math.cos(cy) * la); if (P.lost > 0 && !P.dead) { const k = 2 + (10 - P.lost) * 1.1; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k; }
  sun.target.position.set(P.x, PLANE, P.z); sun.position.set(P.x, PLANE, P.z).addScaledVector(sunDir, 1800); cloud.position.set(camera.position.x, 0, camera.position.z); sky.position.copy(camera.position); cloudMat.uniforms.uTime.value = STILL ? 12 : time;
  // тени: пока корабль поворачивает или кренится, обновляем каждый кадр, иначе тень на корпусе отстаёт на кадр и рябит
  frameN++; renderer.shadowMap.needsUpdate = (frameN & 1) === 0 || frameN < 3 || turnNow !== 0 || Math.abs(P.bank) > 0.01 || P.dashT > 0;
  if (!NORENDER) renderer.render(scene, camera);
  if (window.__want) { window.__shot = canvas.toDataURL('image/jpeg', 0.9); window.__want = false; }
  // подписи
  if (NET.role) NET.drawGhostLabels();
  if (!P.dead) { place(meLbl, P.x, PLANE + 26, P.z); meLbl.querySelector('i').style.width = (P.hp / S.hp * 100) + '%'; } else meLbl.style.display = 'none';
  for (const m of mobs) { if (m.dead) { if (m.loot && m.fade < 0 && dist2(P.x, P.z, m.x, m.z) < 700) place(m.lbl, m.x, PLANE + m.r + 6, m.z); else m.lbl.style.display = 'none'; continue; } if (dist2(P.x, P.z, m.x, m.z) > (FOG.vis || 1100)) { m.lbl.style.display = 'none'; continue; } if (place(m.lbl, m.x, PLANE + m.r + 10, m.z)) { m.lbl.querySelector('i').style.width = Math.max(0, m.hp / m.max * 100) + '%'; m.lbl.style.color = m === target ? '#ffd24a' : m.aggro ? '#ff9c8a' : m.boss ? '#ffcf8a' : '#ffffff'; } }
  for (const o of objects) { const d = dist2(P.x, P.z, o.x, o.z); if (o.kind === 'fish' || o.kind === 'shell') o.g.visible = !o.off && (!FOG.vis || d < FOG.vis + 60); if (o.off || (o.kind === 'island' ? d > o.r : d > 380) || (FOG.vis && d > FOG.vis && !(o.kind === 'beacon' && o.lit))) { o.lbl.style.display = 'none'; continue; } place(o.lbl, o.x, o.kind === 'tree' ? 250 : o.kind === 'beacon' ? 125 : o.kind === 'island' ? o.il.y + 120 : PLANE + 30, o.z); }
  // интерфейс: текст, карта и карточки обновляются 10 раз в секунду, этого хватает глазу и не тратит кадр
  uiT += dt; if (uiT < 0.1 && !window.__want) return; uiT = 0; drawInspect();
  $('hp-t').textContent = Math.ceil(P.hp) + ' / ' + S.hp + ' · броня ' + String(Math.round(S.armor * 100) / 100).replace('.', ','); $('hp-f').style.width = (P.hp / S.hp * 100) + '%';
  $('buffs').textContent = BUFFS.filter(([k]) => k === 'calm' ? P.calm && P.hp < S.hp : P[k] > 0).map(([k, n]) => k === 'calm' || k === 'web' ? n : k === 'leech' ? `${n} ×${P.leech}` : `${n} ${Math.ceil(P[k])} с`).join(' · ');
  { const v = P.dead ? '' : P.lost > 0 ? 'lost' : P.sleep > 0 ? 'zz' : P.ink > 0 ? 'ink' : P.hex > 0 ? 'hex' : '', el = $('veil'), tx = v === 'lost' ? `Вы сбились с пути. Вернитесь к свету: ${Math.ceil(P.lost)}` : v === 'zz' ? 'Корабль спит' : v === 'hex' ? 'Сглаз: управление наоборот' : ''; if (el.className !== v) el.className = v; if (el.dataset.t !== tx) { el.dataset.t = tx; $('veil-t').textContent = tx; } }
  for (const sl of slots) { { const au = !!(L.auto && L.auto.includes(autoKey(sl))); if (sl.au !== au) { sl.au = au; sl.el.dataset.auto = au ? '1' : ''; } } sl.cdEl.style.height = (sl.cd / sl.max * 100) + '%'; if (sl.id === 'W-1' && sl.kind === 'w') { sl.st.textContent = sl.cd > 0 ? sl.cd.toFixed(1) + ' с' : 'прицел ' + Math.round(P.aim) + '%'; sl.el.className = 'slot' + (sl.cd > 0 ? '' : P.aim > 0 ? ' aim' : ' ready'); } else { sl.st.textContent = sl.cd > 0 ? sl.cd.toFixed(1) + ' с' : 'готово'; sl.el.className = 'slot' + (sl.cd > 0 ? '' : ' ready'); } }
  if (target) { $('target').style.display = 'block'; const T = target.T; $('t-name').textContent = `${target.name} · ${D.ARMOR[target.arm].name}`; $('t-hp').style.width = Math.max(0, target.hp / target.max * 100) + '%'; const d = dist2(P.x, P.z, target.x, target.z); const cR = wRange('W-1'); const hasC = slots.some(q => q.id === 'W-1' && q.kind === 'w'); $('t-aim').textContent = `${Math.max(0, Math.ceil(target.hp))} / ${Math.round(target.max)} · ${Math.round(d)} м` + (hasC ? (d > cR + target.r ? ` · далеко для пушек (${Math.round(cR)})` : ` · прицел ${Math.round(P.aim)}%`) : ''); } else $('target').style.display = 'none';
  const pr = $('prompt'); if (channel) { pr.style.display = 'block'; $('p-text').textContent = channel.text + '…'; $('p-bar').style.display = 'block'; $('p-fill').style.width = (channel.t / channel.dur * 100) + '%'; } else { const o = P.dead ? null : nearObj(); if (o) { pr.style.display = 'block'; $('p-bar').style.display = 'none'; $('p-text').textContent = o.cd > 0 ? `Здесь пока пусто (${Math.ceil(o.cd)} с)` : (o.kind === 'mis' ? keyName(KEY.act) + ': ' + o.prompt : PROMPT()[o.kind]); } else pr.style.display = 'none'; }
  drawMap();
}

// ---------- корабль и ангар ----------
let shipTok = 0, shipInst = null; const flames = []; const diveShade = FX.shade(); diveShade.visible = false; scene.add(diveShade);
// пламя ставится в сопла модели: координаты заданы для каждого корабля в data.js (noz)
function buildFlames() { for (const f of flames) { ship.remove(f); FX.release(f); } flames.length = 0; if (!shipInst) return; const s = D.SHIPS[L.ship]; for (const [x, y, z, r] of s.noz || []) { const f = FX.flame(s.fl || '#8fe0ff', r); f.position.set(x, y, z); f.userData.fx = true; f.traverse(o => { if (o.material) o.userData.own = [o.material]; }); ship.add(f); flames.push(f); } }
function setShipModel() { const key = D.SHIPS[L.ship].model; const tok = ++shipTok; const vis = () => { for (const ch of ship.children) if (!ch.userData.fx) ch.visible = shipInst ? ch === shipInst : true; buildFlames(); }; if (shipInst) { ship.userData.model = shipInst; dropModel(ship); shipInst = null; } vis();
  applyModel(ship, key).then(inst => { if (!inst) return vis(); if (tok !== shipTok) { ship.userData.model = inst; dropModel(ship); } else shipInst = inst; ship.userData.model = shipInst; inst.traverse(o => { for (const mt of [].concat(o.material || [])) if (mt.fog) { mt.fog = false; mt.needsUpdate = true; } }); vis(); }); }
function buy(id) { const it = D.SHOP.find(q => q.id === id); if (!it || !shop.open) return 'Лавка откроется после двух третей миссии'; const lv = id === 'fix' ? 0 : shop.lv[id]; if (id !== 'fix' && lv >= it.max) return 'Улучшение уже на максимуме'; const price = it.price[Math.min(lv, it.price.length - 1)] * (has('CREW-07') ? 0.8 : 1); if (res.gold + 1e-6 < price) return 'Не хватает золота'; res.gold -= price; if (id === 'fix') heal(S.hp * 0.4); else { shop.lv[id]++; recompute(false); if (id === 'hp') heal(60, true); } hudRes(); return ''; }
// куда переносить корабль из раздела «Острова и породы»
function places() { const kinds = {}, rocks = []; for (const il of islands) { if (il.off) continue; if (il.kind && !kinds[il.kind]) kinds[il.kind] = il; if (il.rock != null && il.collide && (!rocks[il.rock] || (il.kind && !rocks[il.rock].kind))) rocks[il.rock] = il; }
  kinds['Малые островки'] = islands.find(il => !il.kind && il.collide && il.R < 60); kinds['Остров маяка'] = { x: 300, z: -120, R: 34 }; kinds['Остров гигантского дерева'] = { x: -560, z: 60, R: 62 }; kinds['Каменные шпили'] = { x: 290, z: 300, R: 130 }; return { kinds, rocks }; }
function goTo(il) { if (!il) return; if (tier !== 0) setTier(0); const a = Math.atan2(-il.x, -il.z); const [px, pz] = freeSpot(il.x + Math.sin(a) * (il.R + 170), il.z + Math.cos(a) * (il.R + 170), 50); P.x = px; P.z = pz; P.yaw = Math.atan2(il.x - px, il.z - pz); P.speed = 0; P.dvx = 0; P.dvz = 0; first = true; log('Корабль перенесён к острову', '#e9e3cf'); }
// Прогрев: один раз отрисовать мир во все стороны в маленький буфер. Шейдеры собираются, а модели и текстуры уходят в видеокарту заранее,
// поэтому первый поворот не подтормаживает.
const warmRT = new THREE.WebGLRenderTarget(64, 36);
// модели миссии грузятся и прогреваются до отсчёта, чтобы при первом появлении не мелькала заглушка и не было рывка на компиляции
const PRELOAD = { 'M-1': ['MOB-01', 'MOB-02', 'MOB-04', 'MOB-05', 'MOB-06', 'MOB-09', 'MOB-10', 'MOB-14', 'MOB-16', 'MOB-17', 'BOSS-1', 'world_bald_cypress', 'world_angel_statue', 'world_koi'],
  'M-2': ['MOB-01', 'MOB-02', 'MOB-04', 'MOB-05', 'MOB-07', 'MOB-08', 'MOB-10', 'MOB-11', 'MOB-12', 'MOB-13', 'MOB-15', 'MOB-16', 'MOB-17', 'MOB-19', 'MOB-22', 'MOB-23', 'MOB-27', 'BOSS-2', 'world_maple', 'world_bald_cypress', 'world_koi'],
  'M-3': ['MOB-01', 'MOB-02', 'MOB-03', 'MOB-04', 'MOB-05', 'MOB-08', 'MOB-09', 'MOB-10', 'MOB-16', 'MOB-17', 'MOB-21', 'MOB-24', 'MOB-25', 'MOB-26', 'BOSS-3', 'world_maple', 'world_bald_cypress', 'world_koi'] };
function preload(id) { const keys = new Set(); for (const k of PRELOAD[id] || []) { const T = D.MOBS[k] || D.BOSSES[k]; if (T) { if (T.model) keys.add(T.model); } else keys.add(k); }
  if (!keys.size) return Promise.resolve();
  const hold = [...keys].map(() => new THREE.Group());
  return Promise.all([...keys].map((k, i) => applyModel(hold[i], k, { hide: false }).catch(() => null))).then(() => { const g = new THREE.Group(); g.position.set(P.x, PLANE + 40, P.z + 60); for (const h of hold) g.add(h); scene.add(g); warm(); scene.remove(g); for (const h of hold) dropModel(h); });
}
function warm() { try { renderer.compile(scene, camera); const q = camera.quaternion.clone(), p = camera.position.clone(); renderer.setRenderTarget(warmRT); for (let k = 0; k < 8; k++) { camera.position.set(P.x, PLANE + 120, P.z); camera.rotation.set(-0.35, k * Math.PI / 4, 0, 'YXZ'); camera.updateMatrixWorld(); renderer.render(scene, camera); } renderer.setRenderTarget(null); camera.position.copy(p); camera.quaternion.copy(q); camera.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true; } catch (e) { renderer.setRenderTarget(null); } }
// перед боссом лавочник скупает все припасы. Курс: древесина 0,1, рыба 0,15, жемчуг 0,5 золота за штуку
const RATE = { wood: 0.1, fish: 0.15, pearls: 0.5 }, RES_RU = { wood: 'древесина', fish: 'рыба', pearls: 'жемчуг' };
function sellAll() { let g = 0; const parts = []; for (const k in RATE) { const n = res[k] || 0; if (n <= 0) continue; const v = Math.round(n * RATE[k] * 100) / 100; g += v; parts.push(`${RES_RU[k]} ${n} → ${fmt(v)}`); res[k] = 0; } if (!g) return; res.gold += g; hudRes(); floatText('+' + fmt(g) + ' золота', '#ffd24a', P.x, PLANE + 30, P.z); return `Лавочник скупил припасы: ${parts.join(', ')} золота`; }
function resetRun() { for (const o of objects) if (o.kind === 'island') { o.searched = false; o.cd = 0; } res.gold = 0; for (const k of ['hex', 'sleep', 'ink', 'rot', 'lost']) P[k] = 0; while (webs.length) scene.remove(webs.pop().m); for (const k in LUCK) Object.assign(LUCK[k], { n: 0, at: 0, bag: [] }); shop.open = false; for (const k in shop.lv) shop.lv[k] = 0; for (const k of ['buffW', 'buffA', 'wind', 'fSpd', 'fArm', 'fDmg', 'wArm', 'wCd', 'wRep']) P[k] = 0; for (const q of slots) q.cd = 0; recompute(false); hudRes(); }
// ---------- сетевая игра: склейка с net.js ----------
// TP — капитан, по которому сейчас действует моб (свой корабль или прокси союзника). ACTOR — кто нажал действие у точки миссии
let TP = P, ACTOR = null, bumpT = -9, respT = -99, worldIdSent = null;
function teamPlayers(alive) { const a = []; if (!alive || !P.dead) a.push(P); for (const g of NET.ghosts.values()) if (!alive || !g.dead) a.push(g.proxy); return a; }
function hurtP(tp, dmg, why, type = 0, o = {}) { if (!tp || tp === P) return damagePlayer(dmg, why, type, o); if (tp.dead || tp.dive > 0) return; NET.tell(tp.id, 'hurt', [Math.round(dmg * 10) / 10, why, type, o.raw ? 1 : 0, o.melee ? 1 : 0, (o.from && o.from.nid) || 0]); }
function hurt(dmg, why, type, o) { return hurtP(TP, dmg, why, type, o); }
function tlogP(tp, text, color) { if (!tp || tp === P) log(text, color); else NET.tell(tp.id, 'log', [text, color]); }
function tlog(text, color) { tlogP(TP, text, color); }
function tsleep(tp, t) { if (!tp || tp === P) sleepNow(t); else NET.tell(tp.id, 'sleep', t); }
// цель моба: ближайший живой капитан. К тому, в кого он вцепился (пиявка, клещ, сглаз, магнит), моб держится до конца приёма
function pickTarget(m) { const cur = m.tid === 'H' ? P : m.tid && NET.ghosts.get(m.tid) ? NET.ghosts.get(m.tid).proxy : null;
  if (cur && !cur.dead && (m.att || m.grab > 0 || m.cast > 0 || m.pull > 0)) return cur;
  let best = null, bd = 1e9; for (const q of teamPlayers(true)) { const d = dist2(q.x, q.z, m.x, m.z) - (q === cur ? 80 : 0); if (d < bd) { bd = d; best = q; } }
  if (!best) return P; m.tid = best === P ? 'H' : best.id; return best; }
const teamSlot = () => { const i = NET.lobby.findIndex(q => q.id === NET.id); return i > 0 ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) : 0; };
const waitRevive = () => NET.live && MIS.on && !MIS.busy;
const objRef = o => o.wid != null ? 'w' + o.wid : 'n' + o.nid;
const objByRef = r => r[0] === 'w' ? objects.find(o => o.wid === +r.slice(1)) : objects.find(o => o.nid === +r.slice(1));
const inShield = () => zones.some(zn => zn.shield && dist2(P.x, P.z, zn.x, zn.z) < zn.r);
const hiddenMe = () => P.dive > 0 || zones.some(zn => zn.hide && dist2(P.x, P.z, zn.x, zn.z) < zn.r + 10);
function unObj(o) { const i = objects.indexOf(o); if (i >= 0) objects.splice(i, 1); if (o.lbl) o.lbl.remove(); if (channel && channel.o === o) channel = null; }
// корабли капитанов не проходят друг сквозь друга; толчок на ходу будит уснувшего, смывает воду «Потопа» и выталкивает из корней
function shipBump(sp0) { for (const g of NET.ghosts.values()) { if (g.dead || g.dive > 0 || P.dive > 0) continue; const d = dist2(P.x, P.z, g.x, g.z); if (d > 30 || d < 0.01) continue; const nx = (P.x - g.x) / d, nz = (P.z - g.z) / d; P.x = g.x + nx * 30; P.z = g.z + nz * 30;
    if (sp0 > 15 && time - bumpT > 0.6) { bumpT = time; const f = Math.min(260, sp0 * 1.6); NET.toPeer(g.id, 'nudge', [-nx * f, -nz * f]); } } }
// сбитый союзник: у обломков можно поднять его, держа действие 10 секунд (с навыком «Подъём» — 4). Стоит пятую часть своей прочности
function ghostDead(g) { if (g.dead) { if (NET.host) MIS.onDeath(); if (g.obj) unObj(g.obj); g.obj = { kind: 'mis', ally: g.id, x: g.x, z: g.z, r: 80, cd: 0, dur: 10, prompt: 'поднять союзника: ' + g.nick, text: 'Поднимаем союзника', onDone() { revive(g); } }; addObjLabel(g.obj, 'Сбит: ' + g.nick); objects.push(g.obj); }
  else if (g.obj) { unObj(g.obj); g.obj = null; } }
function revive(g) { if (!g.dead) return; const cost = Math.round(S.hp * 0.2 * (has('CREW-06') ? 0.5 : 1)); P.hp = Math.max(1, P.hp - cost); P.lastHit = time; floatText('-' + cost, '#ff7a66', P.x, PLANE + 22, P.z); NET.toPeer(g.id, 'revive', 0.3); log(`${g.nick} поднят. Это стоило ${cost} прочности`, '#63dcb4'); burst(g.x, g.z, 60, '#98FB98', 20); }
function respawnAll() { if (time - respT < 6) return; respT = time; const t = 'Сбиты все: команда возвращается у последней отметки'; if (P.dead) { P.revive = 0; P.dead = 0.001; } for (const g of NET.ghosts.values()) NET.tell(g.id, 'respawn', 1); log(t, '#ffb4a0'); NET.bcast('log', [t, '#ffb4a0']); }
// навыки, которым нужен союзник
function netSkill(id, col) { const near = (dead, R) => { let b = null, bd = R; for (const g of NET.ghosts.values()) { if (!!g.dead !== dead) continue; const d = dist2(P.x, P.z, g.x, g.z); if (d < bd) { bd = d; b = g; } } return b; };
  if (id === 'S-08') { const g = near(true, 250); if (!g || !g.obj) { log('Подъём: рядом нет сбитых союзников'); return false; } channel = { o: g.obj, t: 0, dur: 4, text: 'Поднимаем союзника' }; return true; }
  const g = near(false, id === 'S-07' ? 300 : 250); if (!g) { log(`${D.SKILLS[id].name}: рядом нет союзников`); return false; }
  const [give, cost] = id === 'S-07' ? [120, 40] : [100, 100]; P.hp = Math.max(1, P.hp - cost); bolt(P.x, P.z, g.x, g.z, col, 6, 1.4); burst(g.x, g.z, 40, col, 14); NET.toPeer(g.id, 'xfer', give); log(`${D.SKILLS[id].name}: ${g.nick} +${give} прочности`, txt(col)); return true; }
// --- ведущий ---
function netHit([nid, dmg, type, crit, dot, melt], from) { const m = NET.byNid.get(nid); if (!m || m.dead) return; let k = 1; if (m.boss && MIS.bossBright()) k *= 1.15; if (m.boss && MIS.bossDim()) k *= 0.5;
  if (melt && m.shell > 0) { m.shell = 0; burst(m.x, m.z, m.r + 30, '#ffb030', 24); log('Огонь растопил смоляной панцирь', '#ffe08a'); }
  m.hp -= Math.max(1, Math.round(dmg * k)); if (SEE) m.aggro = true; if (m.hp <= 0) killMob(m, true); }
function netReq(t, d, from) { const g = NET.ghosts.get(from), gp = g && g.proxy;
  switch (t) {
    case 'spawn': { const [id, x, z, o] = d; if (D.MOBS[id] || D.BOSSES[id]) spawnMob(id, x, z, Object.assign({}, o || {}, { net: false })); return; }
    case 'act': case 'actStart': { const o = objects.find(q => q.pid === d); if (!o) return; ACTOR = gp; try { if (t === 'act') o.onDone(); else if (o.onStart) o.onStart(); } finally { ACTOR = null; } return; }
    case 'search': { const o = objects.find(q => q.wid === d); if (!o) return; if (o.searched) return NET.tell(from, 'log', ['Этот остров уже обыскан: второй раз обыскать нельзя']); o.searched = true; o.cd = 150; NET.bcast('searched', d);
      let ms; ACTOR = gp; try { ms = MIS.onSearch(o); } finally { ACTOR = null; } if (ms) NET.tell(from, 'story', [ms[0], ms[1], '#ffe08a']); else NET.tell(from, 'searchGo', d); return; }
    case 'gather': { const o = objByRef(d[0]); if (!o) return; ACTOR = gp; try { MIS.onGather(o); if (d[1]) { const cp = MIS.onCatch(o); if (cp) NET.tell(from, 'compass', cp); } } finally { ACTOR = null; } return; }
    case 'gold': if (!shop.open && d > 0 && d < 300) { res.gold += d; hudRes(); } return;
    case 'travel': return travel(d[0], d[1], d[2]);
    case 'dash': for (const m of mobs) if (m.att && m.tid === from) { m.att = false; m.cd = 1.5; } return;
    case 'ok': if (modalCur && modalCur.mid === d) modalAck(modalCur, from); return;
    case 'pause': return setPause(!!d);
  } }
let hsLast = {}; const mfire = [], REC = new Set(), OBST = []; let pidC = 0, recC = 0, oidC = 0;
function hostState() { const send = (k, v) => { const j = JSON.stringify(v); if (hsLast[k] !== j) { hsLast[k] = j; NET.bcast(k, v); } };
  send('world', { w: worldId, fog: [FOG.want, FOG.col.r, FOG.col.g, FOG.col.b].map(v => Math.round(v * 1000) / 1000), look: tierLook, tier, v: [Math.round(vortex.x), Math.round(vortex.y), Math.round(vortex.z)], lights: FOG.lights.map(l => [Math.round(l.x), Math.round(l.z), Math.round(l.r), l.x2 == null ? null : Math.round(l.x2), l.z2 == null ? null : Math.round(l.z2), l.cr || 0]) });
  send('mis', MIS.netExport());
  send('pts', objects.filter(o => o.kind === 'mis' && o.pid).map(o => [o.pid, Math.round(o.x), Math.round(o.z), o.r, o.dur, o.label, o.prompt, o.text, o.cd > 0 ? Math.round(o.cd) : 0, o.onStart ? 1 : 0]));
  for (const o of [...REC]) if (!objects.includes(o)) REC.delete(o); send('recs', [...REC].map(o => [o.nid, ...o.rec, o.mis ? 1 : 0, o.boss ? 1 : 0]));
  send('obst', OBST.filter(o => obstacles.includes(o)).map(o => [o.oid, Math.round(o.x), Math.round(o.z), o.r, o.life]));
  if (mfire.length) NET.bcast('fx', ['pemit', [mfire.splice(0)]]);
  if (MIS.on && !MIS.busy && P.dead && NET.players().length && NET.players().every(g => g.dead)) respawnAll(); }
function lateJoin(id) { NET.tell(id, 'launch', { mission: MIS.on ? MIS.id : 'M-0', late: true }); NET.tell(id, 'tp', [P.x + 50, P.z + 30]); NET.fullMobs(id); NET.repFullTo(id); for (const o of objects) if (o.kind === 'island' && o.searched) NET.tell(id, 'searched', o.wid); hsLast = {}; }
// миссия у ведущего: всё, что она делает с миром, расходится по команде
const mscene = { add(...o) { scene.add(...o); for (const x of o) NET.repAdd(x); return mscene; }, remove(...o) { scene.remove(...o); for (const x of o) NET.repRemove(x); return mscene; } };
function missionNet() { return {
  scene: mscene, realScene: scene,
  fire: { emit(o) { fire.emit(o); if (NET.live && !MIS.busy && mfire.length < 300) mfire.push([o.x, o.y, o.z, o.vx || 0, o.vy || 0, o.vz || 0, o.life, o.s0, o.s1, o.r, o.g, o.b, o.a, o.drag || 0].map(v => Math.round(v * 10) / 10)); } },
  log(t, col) { log(t, col); NET.bcast('log', [t, col]); }, story(a, b, col) { story(a, b, col); NET.bcast('story', [a, b, col]); },
  heal(n) { if (ACTOR && ACTOR !== P) NET.tell(ACTOR.id, 'heal', n); else heal(n); },
  kill(p) { p = p || P; if (p === P) { if (!P.dead) die(); } else NET.tell(p.id, 'kill', 1); },
  sleep(t, p) { tsleep(p || P, t); }, hurtP, tlogP, players: teamPlayers, actor: () => ACTOR || P, pid: () => ++pidC, teamSize: () => NET.size(),
  near: (x, z, r) => teamPlayers(true).some(p => dist2(p.x, p.z, x, z) < r),
  focus(x, z) { let b = null, bd = 1e9; for (const p of teamPlayers(true)) { const d = dist2(p.x, p.z, x, z); if (d < bd) { bd = d; b = p; } } return b || P; },
  area(x, z, r, fn) { for (const p of teamPlayers(true)) if (dist2(p.x, p.z, x, z) < r) fn(p); },
  teleportAll(x, z) { P.x = x; P.z = z; P.speed = 0; P.dvx = 0; P.dvz = 0; first = true; let i = 0; for (const g of NET.ghosts.values()) { i++; NET.tell(g.id, 'tp', [x + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 45, z]); } },
  makePond(x, z) { const o = makePond(x, z); o.nid = ++recC; o.rec = ['fish', Math.round(x), Math.round(z)]; REC.add(o); return o; },
  makeTreeSpot(x, z, model, life) { const o = makeTreeSpot(x, z, model, life); o.nid = ++recC; o.rec = ['tree', Math.round(x), Math.round(z), model, life || 'stage']; REC.add(o); return o; },
  addObst(x, z, r, life) { const o = { x, z, r, rad: () => r, life, oid: ++oidC }; obstacles.push(o); OBST.push(o); return o; },
  openShop(v) { if (!v) { NET.bcast('shopClose', 1); shop.open = false; for (const k in shop.lv) shop.lv[k] = 0; recompute(false); return; } const n = NET.size(), chest = res.gold, share = Math.floor(chest / n * 100) / 100; NET.bcast('shop', [chest, n, share]); return shopOpen(chest, n, share); },
  nicks: () => NET.nicks(), bcast: (t, d) => NET.bcast(t, d),
  toMenu() { if (NET.host && NET.live) { NET.bcast('end', 1); } NET.inGame = false; NET.sendMe(); hangarOpen = true; keys.clear(); hangar.start(); } }; }
function shopOpen(chest, n, share) { shop.open = true; res.team = chest; res.gold = share; const sold = sellAll(); hudRes(); return [sold, `Золото команды (${fmt(chest)}) поделено поровну на ${n === 1 ? 'одного капитана' : n + ' капитанов'}: у каждого ${fmt(share)}. Своё золото можно передать другому капитану в лавке`].filter(Boolean).join('. '); }
// --- гость ---
function netSpawn([nid, id, x, z, name, sc, max, fl, hp]) { if (NET.byNid.has(nid) || !(D.MOBS[id] || D.BOSSES[id])) return; const m = spawnMob(id, x, z, { net: true, name, scale: sc, respawn: !!(fl & 8), added: !!(fl & 16) });
  m.nid = nid; NET.byNid.set(nid, m); m.max = max; m.hp = hp; m.mis = !!(fl & 1); m.still = !!(fl & 2); m.kid = !!(fl & 4); m.nx = x; m.nz = z; m.nyaw = m.yaw; m._net = {}; }
function netMobs(list) { for (const [nid, x, z, yaw, hp, fl, st, max] of list) { const m = NET.byNid.get(nid); if (!m) continue; m.nx = x; m.nz = z; m.nyaw = yaw; m.hp = hp; m.max = max; m.aggro = !!(fl & 2); m.nwind = !!(fl & 32); m.nvis = !!(fl & 16); m.still = !!(fl & 64); m._net = m._net || {};
    for (const k of NET.ST) { m[k] = st[k] || 0; m._net[k] = m[k]; }
    const dead = !!(fl & 1); if (dead && !m.dead) NET.quiet(() => clientKill(m, !!(fl & 4))); else if (!dead && m.dead) clientRevive(m);
    if (m.dead) { if (!(fl & 4) && m.loot) { m.loot = null; m.lbl.firstChild.textContent = ''; } if ((fl & 8) && m.fade < 0) m.fade = 0.5; } } }
function clientKill(m, loot) { m.dead = 1; m.x = m.nx; m.z = m.nz; explosion(m.x, PLANE, m.z, m.boss ? 1.6 : m.T.cls === 2 ? 1.1 : 0.6); m.loot = loot ? ['bronze', 1] : null; m.ct = 0; m.fade = -1; m.cside = rnd() < 0.5 ? 1 : -1; m.cy = m.mesh.position.y; pauseModel(m.mesh, true); m.far = null;
  m.lbl.firstChild.textContent = loot ? 'Добыча: пролетите над телом' : ''; m.lbl.classList.add('loot'); if (target === m) target = null; }
function clientRevive(m) { m.dead = 0; m.fade = -1; m.loot = null; m.x = m.nx; m.z = m.nz; m.mesh.visible = true; m.mesh.rotation.z = 0; m.mesh.scale.setScalar(m.sc); m.lbl.firstChild.textContent = m.name; m.lbl.classList.remove('loot'); pauseModel(m.mesh, false); m.far = null; }
// мобы у гостя: положение и состояние приходят от ведущего, здесь только плавное движение и отрисовка
function clientMobs(dt) { const kk = 1 - Math.exp(-9 * dt);
  for (const m of mobs) { if (m.dead) { if (m.fade !== 0) corpse(m, dt); continue; }
    for (const k of NET.ST) if (m[k] > 0) m[k] = Math.max(0, m[k] - dt); if (m._net) for (const k in m._net) m._net[k] -= dt;
    if (m.nx == null) { m.nx = m.x; m.nz = m.z; m.nyaw = m.yaw; }
    if (Math.hypot(m.nx - m.x, m.nz - m.z) > 400) { m.x = m.nx; m.z = m.nz; } else { m.x += (m.nx - m.x) * kk; m.z += (m.nz - m.z) * kk; }
    let dy = m.nyaw - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.yaw += dy * kk;
    const d = dist2(P.x, P.z, m.x, m.z); if (m.T.sp === 'fog' && d < 420) fogNear = true; m.mesh.visible = m.nvis !== false && (!FOG.vis || d < FOG.vis + 40);
    { const far = d > 1300, hm = !!m.mesh.userData.model; if (far !== m.far || hm !== m.hm) { m.far = far; m.hm = hm; pauseModel(m.mesh, far); } }
    if (m.burn > 0 && rnd() < 0.5) fire.emit({ x: m.x + (rnd() - 0.5) * m.r, y: PLANE + rnd() * m.r * 0.5, z: m.z + (rnd() - 0.5) * m.r, vy: 30, life: 0.5, s0: 12, s1: 3, r: 3, g: 1, b: 0.1, a: 0.9 });
    m.mesh.position.set(m.x, PLANE + (m.still ? 10 : Math.sin(time * 1.3 + m.hx) * 2.5 + (m.T.ai === 'heavy' && !m.boss ? -4 : 0) + (m.nwind ? 6 : 0)), m.z); m.mesh.rotation.y = m.yaw; } }
// гость сам наложил на моба оглушение, замедление и т. п. или отбросил его — сообщаем ведущему
function clientDiff() { for (const m of mobs) { if (!m.nid || m.dead) continue; const b = m._net || (m._net = {});
    for (const k of NET.ST) { if (k === 'shell') continue; const v = m[k] || 0; if (v > (b[k] || 0) + 0.15) { NET.req('mst', [m.nid, k, Math.round(v * 10) / 10]); b[k] = v; } }
    if (Math.hypot(m.kx || 0, m.kz || 0) > 30) NET.req('mk', [m.nid, Math.round(m.kx), Math.round(m.kz)]); m.kx = 0; m.kz = 0; } }
const netPts = new Map(), netRecs = new Map(), netObst = new Map();
function syncPoints(list) { const seen = new Set(); for (const [pid, x, z, r, dur, label, prompt, text, cd, st] of list) { seen.add(pid); let o = netPts.get(pid);
    if (!o) { o = { kind: 'mis', pid, onStart() { if (this.st) NET.req('actStart', pid); }, onDone() { NET.req('act', pid); } }; addObjLabel(o, label); o.label = label; objects.push(o); netPts.set(pid, o); }
    Object.assign(o, { x, z, r, dur, prompt, text, st }); if (cd > o.cd + 1) o.cd = cd; if (o.label !== label) { o.label = label; o.lbl.firstChild.textContent = label; } }
  for (const [pid, o] of netPts) if (!seen.has(pid)) { unObj(o); netPts.delete(pid); } }
function syncRecs(list) { const seen = new Set(); for (const [nid, kind, x, z, model, life, mis, boss] of list.map(r => r[1] === 'fish' ? [r[0], r[1], r[2], r[3], null, null, r[4], r[5]] : r)) { seen.add(nid); if (netRecs.has(nid)) continue;
    const o = kind === 'fish' ? makePond(x, z) : makeTreeSpot(x, z, model, life); o.nid = nid; o.mis = !!mis; o.boss = !!boss; netRecs.set(nid, o); }
  for (const [nid, o] of netRecs) if (!seen.has(nid)) { scene.remove(o.g); unObj(o); netRecs.delete(nid); } }
function syncObst(list) { const seen = new Set(); for (const [oid, x, z, r, life] of list) { seen.add(oid); let o = netObst.get(oid); if (!o) { o = { x, z, rad: () => r, life }; obstacles.push(o); netObst.set(oid, o); } o.x = x; o.z = z; }
  for (const [oid, o] of netObst) if (!seen.has(oid)) { const i = obstacles.indexOf(o); if (i >= 0) obstacles.splice(i, 1); netObst.delete(oid); } }
function applyWorld(d) { if (d.w !== worldId) setWorld(d.w); setFog(d.fog[0], d.fog.slice(1)); setTierLook(d.look); if (d.tier !== tier) NET.quiet(() => setTier(d.tier)); vortex.set(d.v[0], d.v[1], d.v[2]);
  FOG.lights.length = 0; for (const [x, z, r, x2, z2, cr] of d.lights) { const q = { x, z, r, keep: true }; if (x2 != null) { q.x2 = x2; q.z2 = z2; } if (cr) q.cr = cr; FOG.lights.push(q); } }
function netMsg(t, d) { switch (t) {
  case 'hurt': return damagePlayer(d[0], d[1], d[2], { raw: !!d[3], melee: !!d[4], from: NET.byNid.get(d[5]) });
  case 'log': return log(d[0], d[1]);
  case 'story': return story(d[0], d[1], d[2]);
  case 'sleep': return sleepNow(d);
  case 'kill': if (!P.dead) die(); return;
  case 'heal': return heal(d);
  case 'jam': { const ws = slots.filter(q => q.kind === 'w'), q = ws[(rnd() * ws.length) | 0]; if (q) { q.cd = Math.max(q.cd, 8); log(`Глушитель: ${q.name} молчит восемь секунд`, '#ffe08a'); } return; }
  case 'pset': for (const k in d) { if (k === 'dvx' || k === 'dvz') P[k] += d[k]; else P[k] = d[k]; } return;
  case 'loot': { const [k, n, v] = d; lootToast(k, n, v); floatText(`+${n} ${COIN_N[k][0]} (${fmt(v)})`, COIN_N[k][1], P.x, PLANE + 30, P.z); return; }
  case 'compass': return later(3.2, () => { $('loot').innerHTML = `<img src="${LOOT.compass}" alt="" width="56" height="56"><div><b>Рыба-компас</b><span>${d}</span></div>`; $('loot').style.display = 'flex'; lootT = 3.5; });
  case 'searchGo': { const o = objects.find(q => q.wid === d); if (o) searchRest(o); return; }
  case 'searched': { const o = objects.find(q => q.wid === d); if (o) o.searched = true; return; }
  case 'tier': return NET.quiet(() => setTier(d));
  case 'travel': return NET.quiet(() => travel(d[0], d[1], d[2]));
  case 'goTier': return NET.quiet(() => goTier(d[0], d[1], d[2]));
  case 'pause': return setPause(!!d, true);
  case 'modal': return modal(d[1], d[2], d[3], null, d[0]);
  case 'mclose': return modalClose(d);
  case 'launch': return netLaunch(d);
  case 'end': return netEnd();
  case 'shop': { const tx = shopOpen(d[0], d[1], d[2]); story(tx, 'Лавка открыта', '#ffd24a'); if (!STILL) openHangar(); return; }
  case 'shopClose': shop.open = false; for (const k in shop.lv) shop.lv[k] = 0; recompute(false); return;
  case 'fin': return MIS.netFin(d);
  case 'mis': return MIS.netState(d);
  case 'pts': return syncPoints(d);
  case 'recs': return syncRecs(d);
  case 'world': return applyWorld(d);
  case 'dropObst': return dropObst(d);
  case 'obst': return syncObst(d);
  case 'respawn': if (P.dead) { P.revive = 0; P.dead = 0.001; } return;
  case 'tp': P.x = d[0]; P.z = d[1]; P.speed = 0; P.dvx = 0; P.dvz = 0; first = true; return;
} }
function netPeer(from, t, d) { const g = NET.ghosts.get(from), nick = g ? g.nick : 'Союзник';
  if (t === 'nudge') { if (P.dead) return; P.dvx += d[0]; P.dvz += d[1]; if (P.rooted > 0) { P.x += d[0] * 0.12; P.z += d[1] * 0.12; } if (P.sleep > 0) { P.sleep = 0; log(`${nick} разбудил корабль толчком`, '#d8f07a'); } if (P.flood > 0) flood(P.flood - 1); return; }
  if (t === 'revive') { if (!P.dead) return; P.revive = d; P.dead = 0.001; log(`${nick} поднял ваш корабль`, '#63dcb4'); return; }
  if (t === 'xfer') { heal(d); log(`${nick}: +${d} прочности`, '#7FFFD4'); return; }
  if (t === 'imp') { P.dvx += d[0]; P.dvz += d[1]; return; }
  if (t === 'gift') { res.gold += d; hudRes(); log(`${nick} передал вам ${fmt(d)} золота`, '#ffd24a'); } }
function clientPrep(id) { L.mission = id; NET.inGame = true; MIS.end(true); NET.repReset(); clearMobs(); NET.byNid.clear(); resetRun();
  for (const o of netPts.values()) unObj(o); netPts.clear(); for (const o of netRecs.values()) { scene.remove(o.g); unObj(o); } netRecs.clear(); for (const o of netObst.values()) { const i = obstacles.indexOf(o); if (i >= 0) obstacles.splice(i, 1); } netObst.clear();
  const mis = id && id !== 'M-0'; setWorld(mis ? id : null); SEE = mis; FOG.lights.length = 0; setFog(0); setTierLook(null); if (tier !== 0) NET.quiet(() => setTier(0));
  P.x = teamSlot() * 60; P.z = 0; P.yaw = 0.6; P.speed = 0; P.dvx = 0; P.dvz = 0; P.hp = S.hp; P.dead = 0; P.revive = 0; P.lost = 0; ship.visible = true; $('dead').style.display = 'none'; first = true; MIS.mirror(mis ? id : null); NET.sendMe(); }
function netLaunch(d) { if (!NET.client) return; L.mission = d.mission; if (D.MISSIONS[d.mission] && D.MISSIONS[d.mission].stage) L.stage = D.MISSIONS[d.mission].stage; recompute(true); clientPrep(d.mission); hangar.netGo(!!d.late); }
function netEnd() { NET.inGame = false; MIS.end(true); modalQ.length = 0; modalCur = null; nextModal(); NET.sendMe(); hangarOpen = true; keys.clear(); hangar.start(); }
function fxPlay(name, a) { switch (name) {
  case 'explosion': return explosion(...a); case 'shockRing': return shockRing(...a); case 'warnRing': return warnRing(...a); case 'bolt': return bolt(...a); case 'burst': return burst(...a); case 'addWeb': return addWeb(...a);
  case 'zone': return zone(Object.assign({}, a[0]));
  case 'eShotVis': return eShotVis(a[0], a[1], a[2], a[3], true, null, 0);
  case 'eBombVis': return eBombVis(a[0], a[1], a[2], a[3], true, null, 0);
  case 'rockVis': return fireRocket(NET.byNid.get(a[0]) || null, 0, a[1], a[2], a[3], a[4], true);
  case 'mortVis': return fireMortar(a[0], a[1], 0, a[2], a[3], a[4], a[5], a[6], true);
  case 'cannVis': { const t = NET.byNid.get(a[0]); if (!t) return; const [x, z, yaw] = [a[1], a[2], a[3]], col = D.WEAPONS['W-1'].color, g = glow(col); const side = Math.sign(Math.sin(Math.atan2(t.x - x, t.z - z) - yaw)) || 1, rx = Math.cos(yaw) * side, rz = -Math.sin(yaw) * side;
    for (let i = 0; i < 4; i++) { const off = (i - 1.5) * 7, sx = x + rx * 9 + Math.sin(yaw) * off, sz = z + rz * 9 + Math.cos(yaw) * off, d = Math.hypot(t.x - sx, t.z - sz), ang = Math.atan2(t.x - sx, t.z - sz); const mesh = new THREE.Mesh(shellGeo, flat(col)); scene.add(mesh);
      shots.push({ kind: 'shell', vis: true, mesh, g, col, x: sx, y: PLANE + 4, z: sz, vx: Math.sin(ang) * 560, vz: Math.cos(ang) * 560, life: d / 560, hit: true, t, dmg: 0, delay: i * 0.07 }); fire.emit({ x: sx, y: PLANE + 4, z: sz, life: 0.16, s0: 14, s1: 48, r: g[0], g: g[1], b: g[2], a: 1 }); } return; }
  case 'pemit': for (const v of a[0]) fire.emit({ x: v[0], y: v[1], z: v[2], vx: v[3], vy: v[4], vz: v[5], life: v[6], s0: v[7], s1: v[8], r: v[9], g: v[10], b: v[11], a: v[12], drag: v[13] }); return;
} }
function recipe([kind, ...a]) { if (kind === 'islet') return islet(a[0], a[1], { R: a[2], seed: a[3], life: a[4] }).g;
  if (kind === 'portal') return portalMesh(a[0], a[1]);
  if (kind === 'model') { const g = new THREE.Group(); loadModel(a[0]).then(m => { if (m) { const q = m.proto.clone(); q.traverse(n => { if (n.isMesh) n.castShadow = true; }); g.add(q); } }); return g; } return null; }
for (const [k, v] of Object.entries(BM)) NET.reg('BM.' + k, v); for (const [k, v] of Object.entries(BLD.M)) NET.reg('BLD.' + k, v); ROCKS.forEach((r, i) => { NET.reg('R0.' + i, r[0]); NET.reg('R1.' + i, r[1]); }); NET.reg('mobSkin', mobSkin);
function modalAck(m, id) { m.acks.add(id); if (NET.client) { if (id === NET.id) { NET.req('ok', m.mid); $('modal-ok').disabled = true; $('modal-ok').textContent = 'Ждём остальных…'; } return; } modalCheck(); }
function modalCheck() { const m = modalCur; if (!m || !m.mid || !modalOn || !NET.host) return; const wait = [...(m.need || [])].filter(id => NET.ghosts.has(id) && !m.acks.has(id));
  if (m.acks.has('H') && !wait.length) { NET.bcast('mclose', m.mid); modalCur = null; nextModal(); if (m.ok) m.ok(); return; }
  if (m.acks.has('H')) { $('modal-ok').disabled = true; $('modal-ok').textContent = 'Ждём: ' + wait.map(id => NET.ghosts.get(id).nick).join(', '); } }
function modalClose(mid) { if (modalCur && modalCur.mid === mid) { modalCur = null; nextModal(); } else { const i = modalQ.findIndex(q => q.mid === mid); if (i >= 0) modalQ.splice(i, 1); } }
NET.init({ P, S, L, D, scene, mobs, PLANE, mkLabel, place, applyModel, dropModel, time: () => time, log, removeMob, recipe, unObj, ghostDead, inShield, hidden: hiddenMe, clientDiff, hostState, lateJoin, fxPlay, netHit, netReq, netMsg, netPeer, netMobs, netSpawn,
  get ready() { return hangar.ready; }, teamInfo: () => ({ g: shop.open ? null : Math.round(res.gold * 100) / 100, s: SEE ? 1 : 0 }), teamRes(t) { if (t.g != null && !shop.open) { res.gold = t.g; hudRes(); } SEE = !!t.s; },
  modalCheck, setMission(id) { L.mission = id; const q = D.MISSIONS[id]; if (q && q.stage) L.stage = q.stage; recompute(false); hangar.redraw(); },
  netGone(was, quiet) { if (was === 'host') { for (const g of NET.ghosts.values()) if (g.obj) unObj(g.obj); } hangar.redraw(); },
  hostLost(inGame) { if (!inGame) return hangar.redraw(); MIS.end(true); clearMobs(); NET.repReset(); for (const o of netPts.values()) unObj(o); netPts.clear(); spawnStart(); modalQ.length = 0; modalCur = null; nextModal(); story('Связь с ведущим потеряна. Вы снова в одиночной игре: создайте комнату заново или войдите по коду.', 'Сеть', '#ffb4a0'); hangarOpen = true; keys.clear(); hangar.start(); } });
const MIS = initMission(Object.assign({ THREE, D, P, S, res, mobs, objects, scene, PLANE, BLD, BM, camera, vortex, fire, KEY, keyName, fmt, freeSpot, spawnMob, removeMob, clearMobs, spawnStart, addObjLabel, enemyShot, warnRing, log, story, explosion, damagePlayer, shockRing, burst, heal, coin, resetRun, setWorld, islet, dropObst, makePond, makeTreeSpot, loadModel, obstacles, segD, kill() { if (!P.dead) die(); }, showShop() { if (!STILL) openHangar(); }, setFog, fogLights: FOG.lights, fogVis: () => FOG.vis, zones, sleep: sleepNow, ROCKS, addObst(x, z, r, life) { const o = { x, z, rad: () => r, life }; obstacles.push(o); return o; },
  openShop(v) { shop.open = v; if (!v) { for (const k in shop.lv) shop.lv[k] = 0; recompute(false); return; } const sold = sellAll(), n = MIS.team(); res.team = res.gold; res.gold = Math.floor(res.gold / n * 100) / 100; hudRes(); return [sold, `Золото команды (${fmt(res.team)}) поделено поровну на ${n === 1 ? 'одного капитана' : n + ' капитанов'}: у каждого ${fmt(res.gold)}. Своё золото можно передать другому капитану в лавке`].filter(Boolean).join('. '); }, time: () => time, blocked: (x, z, pad) => !!obstacleAt(x, z, pad), snap() { first = true; }, setSee(v) { SEE = v; if (!v) for (const m of mobs) m.aggro = false; }, tier: () => tier, setTier, goTier, modal, bolt, cloudVortex, setTierLook, portalMesh,
  nicks: () => [L.nick || 'Капитан'], toMenu() { hangarOpen = true; keys.clear(); hangar.start(); } }, missionNet()));
NET.reg('glowTex', MIS.glowTex);
function openHangar() { hangarOpen = true; keys.clear(); hangar.open(); }
const hangar = initHangar({ ICONS, SKILL_COL, D, L, KEY, shop, res, S, keyName, fmt, countMob, addMob, removeMobOf, clearMobs, buy, flood, activeFeats, activeSkills,
  rocks: ROCK_VARIANTS, places, goTo,
  resetMobs() { clearMobs(); spawnStart(); }, get see() { return SEE; }, set see(v) { SEE = v; if (!v) for (const m of mobs) m.aggro = false; },
  apply(shipChanged) { recompute(shipChanged); if (shipChanged) setShipModel(); }, saveKeys() { LS.set('keys', KEY); buildSlots(); helpText(); },
  openShop(v) { shop.open = v; if (!v) { for (const k in shop.lv) shop.lv[k] = 0; recompute(false); } },
  team: () => [{ nick: L.nick || 'Капитан', me: true }, ...NET.players().map(g => ({ nick: g.nick, id: g.id }))], give(to, n) { if (!(n > 0)) return 'Укажите, сколько золота передать'; if (n > res.gold + 1e-6) return 'У вас столько нет'; const g = NET.players().find(q => q.nick === to || q.id === to); if (!g) return 'Такого капитана нет в команде'; res.gold -= n; hudRes(); NET.toPeer(g.id, 'gift', n); return `Передано ${fmt(n)} золота: ${g.nick}`; }, NET,
  mission: MIS, launch() { if (NET.client) return preload(L.mission).then(warm); if (NET.host) { NET.inGame = true; NET.bcast('launch', { mission: L.mission }); NET.sendMe(); } if (L.mission && L.mission !== 'M-0') MIS.start(L.mission); else { MIS.end(true); setWorld(null); if (!mobs.length) spawnStart(); } return preload(L.mission).then(warm); }, afterLaunch() { warm(); setTimeout(warm, 1500); },
  onClose() { hangarOpen = false; last = performance.now(); if (!modalOn && modalQ.length) nextModal(); } });
$('btn-hangar').addEventListener('click', openHangar);
$('r-coin').src = COINS.gold;
if (!STILL || /[?&]menu/.test(location.search)) { hangarOpen = true; hangar.start(); }   // перед вылетом — подготовка по шагам
$('in-close').addEventListener('click', () => { inspect = null; drawInspect(); });
recompute(true); setShipModel();

let last = performance.now(), frames = 0, fpsT = 0;
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (window.__freeze) { requestAnimationFrame(frame); return; } if (!window.__pause && (!hangarOpen || (NET.live && NET.inGame)) && !paused && !modalOn) update(dt); render(dt); NET.tick(dt); frames++; fpsT += dt; if (fpsT > 0.5) { $('fps').textContent = Math.round(frames / fpsT) + ' к/с'; frames = 0; fpsT = 0; } window.__frames = (window.__frames || 0) + 1; requestAnimationFrame(frame); }
log(`Мобы и боссы пока вас не видят. ${keyName(KEY.menu)}: ангар — корабль, умения, техника, мобы, лавка, клавиши.`);
if (STILL) { window.__pause = true; window.__g = { info: renderer.info, MIS, makeTreeSpot, makePond, okAll() { let n = 0; while (modalOn && n++ < 20) $('modal-ok').click(); return n; }, get modalOn() { return modalOn; }, warm, interact, trail, fire, smoke, islands, goTo, places, setTier, get tier() { return tier; }, P, S, L, D, KEY, slots: () => slots, mobs, objects, res, shots, zones, attach, FOG, setFog, sleepNow, webs, cloud, sun, scene, keys, use, setShip(id) { L.ship = id; recompute(true); setShipModel(); }, get flames() { return flames.length; }, setQ(n) { q = n; applyQ(); }, useSkill(id) { return useSkill({ id }); }, useDevice(id) { return useDevice({ id }); }, fireWeapon(id) { return fireWeapon({ id }); }, story, get inspect() { return inspect; }, set inspect(m) { inspect = m; inspDirty = true; }, interact, cycleTarget, dash, orbs, addMob, hitMob, damagePlayer, finish, recompute, swapSlot, openHangar, hangar, shop, flood, camera, sim(n, dt = 1 / 30) { for (let i = 0; i < n; i++) update(dt); }, render, cam(y, p, d) { camYaw = y; camPitch = p; camDist = d; first = true; }, get target() { return target; }, set target(m) { target = m; }, get channel() { return channel; }, set see(v) { SEE = v; } }; }
window.__net = { NET, P, S, L, mobs, hitMob, get target() { return target; }, objects, MIS, res, shop, get tier() { return tier; }, get modalOn() { return modalOn; }, get paused() { return paused; }, use, interact, finish, damagePlayer, keys, get channel() { return channel; }, zones, FOG };
requestAnimationFrame(frame);
