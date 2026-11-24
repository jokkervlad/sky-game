// Загрузка 3D-моделей (.glb) и подмена ими процедурных заглушек.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// size — длина по самой длинной горизонтальной оси в игровых единицах (tall: по высоте);
// rot — поворот вокруг Y, чтобы нос смотрел в +Z; rx/rz — доворот лежащих на боку моделей;
// y — какая доля высоты уходит под точку привязки (0.5 = центр, 0 = стоит на точке);
// drop — имена лишних частей (подставки, камни, небо); auto — выбросить «землю/воду» автоматически; anim: false — не проигрывать анимацию.
const H = Math.PI / 2;
export const MODELS = {
  ship_kharon2: { size: 52, rot: H, drop: /ground|particles/ }, ship_ancient_airship: { size: 52, rot: Math.PI }, ship_ancient_colony: { size: 56, rot: Math.PI }, ship_carguero: { size: 52, rot: 0 },
  ship_colony_tactical: { size: 54, rot: Math.PI }, ship_corbeta: { size: 52, rot: -H }, ship_fragata: { size: 54, rot: 0.72 }, ship_dvergr: { size: 50, rot: 0 },
  ship_heavy_vtol: { size: 50, rot: 0 }, ship_mjolnir: { size: 52, rot: Math.PI }, ship_rusty_diplomatic: { size: 52, rot: -H }, ship_rusty: { size: 50, rot: 0 },
  ship_rusty_orange: { size: 50, rot: 0 }, ship_in_clouds: { size: 52, rot: -Math.PI / 4, drop: /Sky|Cloud/ }, ship_cargo_transporter: { size: 60, rot: 0 }, ship_cargo: { size: 60, rot: 0 }, ship_spaceship: { size: 52, rot: 0 },
  mob_wasp: { size: 22, rot: 0 }, mob02_dragonfly: { size: 26, rot: Math.PI }, mob03_lamprey: { size: 22, rot: 0 }, mob05_manta_small: { size: 30, rot: 0 }, mob07_bat: { size: 34, rot: -H },
  mob09_cownose_ray: { size: 40, rot: -H }, mob10_jellyfish: { size: 30, rot: 0, rz: H, y: 0.6, tall: true }, mob11_spider: { size: 40, rot: 0 }, mob15_isopod: { size: 44, rot: H }, mob16_crab: { size: 60, rot: 0 },
  mob17_golem: { size: 70, rot: 0, y: 0.35, tall: true }, mob18_whale: { size: 140, rot: 0, drop: /^Object_4$/ }, mob19_pirate_ship: { size: 120, rot: 0, y: 0.22 }, mob20_serpent: { size: 130, rot: 0, auto: true },
  boss1_manta: { size: 160, rot: 0 }, boss2_treant: { size: 150, rot: 0, y: 0.35, tall: true }, boss3_leviathan: { size: 240, rot: 0, tall: true, y: 0.45 }, boss5_turret: { size: 24, rot: H, y: 0 }, boss7_guardian: { size: 150, rot: 0, y: 0.35, tall: true },
  mob08_crystal: { size: 26, rot: 0 }, mob13_beehive: { size: 46, rot: 0, tall: true }, boss8_octopus: { size: 200, rot: 0 }, boss9_harpy: { size: 190, rot: 0 },
  world_maple: { size: 240, rot: 0, rx: -H, y: 0, tall: true, base: 'shu_gan' }, world_mushroom_tree: { size: 200, rot: 0, y: 0, tall: true }, world_angel_statue: { size: 60, rot: 0, y: 0, tall: true },
  world_bald_cypress: { size: 240, rot: 0, y: 0, tall: true }, world_koi: { size: 9, rot: -H }, world_shell1: { size: 30, rot: 0 }, world_shell2: { size: 30, rot: 0 },
  ph_island_tree_01: { size: 200, y: 0, tall: true }, ph_island_tree_02: { size: 200, y: 0, tall: true }, ph_island_tree_03: { size: 200, y: 0, tall: true }, ph_jacaranda_tree: { size: 200, y: 0, tall: true },
  ph_root_cluster_01: { size: 80 }, ph_root_cluster_02: { size: 80 }, ph_pine_roots: { size: 80 }, ph_rock_face_01: { size: 80 }, ph_rock_moss_set_01: { size: 60 }, ph_coast_land_rocks_02: { size: 120 },
};

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const V = new THREE.Vector3();

// Старый формат материалов (specular-glossiness) three.js больше не читает: модель выходит серой. Возвращаем цвет и текстуру вручную.
async function fixSpecGloss(gltf) {
  const jobs = [], seen = new Set();
  gltf.scene.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m || seen.has(m)) continue; seen.add(m); const sg = m.userData && m.userData.gltfExtensions && m.userData.gltfExtensions.KHR_materials_pbrSpecularGlossiness; if (!sg) continue;
    if (sg.diffuseFactor) { m.color.fromArray(sg.diffuseFactor); if (sg.diffuseFactor[3] < 1) m.opacity = sg.diffuseFactor[3]; }
    m.metalness = 0; m.roughness = 1 - (sg.glossinessFactor ?? 0.5) * 0.8;
    if (sg.diffuseTexture && !m.map) jobs.push(gltf.parser.getDependency('texture', sg.diffuseTexture.index).then(t => { t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.needsUpdate = true; }).catch(() => {})); } });
  await Promise.all(jobs);
}
// Размер одной части с учётом скелета.
function meshBox(o) { return new THREE.Box3().setFromObject(o, true); }

export function loadModel(key) {
  if (!cache.has(key)) cache.set(key, import(`./m/${key}.js`).then(mod => { const b = atob(mod.default); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return loader.parseAsync(u.buffer, './'); }).then(async gltf => {
    const root = gltf.scene; const cfg = MODELS[key] || { size: 30 }; await fixSpecGloss(gltf);
    if (cfg.drop) { const rm = []; root.traverse(o => { if (o.isMesh && cfg.drop.test(o.name)) rm.push(o); }); rm.forEach(o => o.parent.remove(o)); }
    // поза первого кадра анимации: по ней меряем размер, иначе анимированные модели выходят не того масштаба и не по центру
    const clips = cfg.anim === false ? [] : gltf.animations;
    if (clips.length) { const mx = new THREE.AnimationMixer(root); mx.clipAction(clips[0]).play(); mx.setTime(0.01); mx.stopAllAction(); mx.uncacheRoot(root); }
    const pose = () => { root.updateMatrixWorld(true); root.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.frustumCulled = false; } }); };
    pose();
    if (cfg.auto) { // выбрасываем плоскости воды/земли и части, которые намного больше всего остального
      const parts = []; root.traverse(o => { if (o.isMesh) { const s = meshBox(o).getSize(new THREE.Vector3()); parts.push({ o, s, big: Math.max(s.x, s.y, s.z), thin: Math.min(s.x, s.y, s.z) }); } });
      if (parts.length > 1) { const bigs = parts.map(p => p.big).sort((a, b) => a - b); const med = bigs[bigs.length >> 1]; const rm = parts.filter(p => /sea|water|ocean|plane|ground|floor|sky|cloud|backdrop|base/i.test(p.o.name) || (p.big > med * 6 && p.thin < p.big * 0.03)); if (rm.length < parts.length) rm.forEach(p => p.o.parent.remove(p.o)); }
    }
    const pre = new THREE.Group(); pre.add(root); pre.rotation.set(cfg.rx || 0, 0, cfg.rz || 0); pre.updateMatrixWorld(true); pose();
    const box = new THREE.Box3().setFromObject(pre, true); const s = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    // base: модель ставится на нижнюю точку ствола (у дерева с изогнутым стволом низ рамки — свисающая ветка, а не корни)
    if (cfg.base) { let mesh = null; root.traverse(o => { if (o.isMesh && o.name === cfg.base) mesh = o; }); if (mesh) { const p = mesh.geometry.attributes.position, v = new THREE.Vector3(), pts = []; let lo = 1e9, hi = -1e9; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pts.push(v.clone()); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
      const low = pts.filter(q => q.y < lo + (hi - lo) * 0.04); c.x = low.reduce((a, q) => a + q.x, 0) / low.length; c.z = low.reduce((a, q) => a + q.z, 0) / low.length; box.min.y = lo; } }
    const span = cfg.tall ? s.y : Math.max(s.x, s.z); const k = cfg.size / (span || 1);
    const yk = cfg.y ?? 0.5;
    const pivot = new THREE.Group(); const hold = new THREE.Group(); hold.position.set(-c.x, -(box.min.y + s.y * yk), -c.z); hold.add(pre); pivot.add(hold);
    const out = new THREE.Group(); pivot.scale.setScalar(k); pivot.rotation.y = cfg.rot || 0; out.add(pivot);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.side = o.material.transparent ? THREE.DoubleSide : o.material.side; } } });
    return { proto: out, clips, dims: s.multiplyScalar(k) };
  }).catch(e => { console.warn('model', key, e); return null; }));
  return cache.get(key);
}

const mixers = new Set();
// Кладёт модель внутрь group. hide: спрятать прежние меши заглушки.
export function applyModel(group, key, opts = {}) {
  return loadModel(key).then(m => {
    if (!m) return null;
    const inst = SkeletonUtils.clone(m.proto);
    if (opts.scale) inst.scale.setScalar(opts.scale);
    if (opts.hide !== false) for (const ch of group.children) ch.visible = false;
    if (opts.tint) inst.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(opts.tint)); if (opts.glow) { o.material.emissive = new THREE.Color(opts.glow); o.material.emissiveIntensity = 0.6; } } });
    if (m.clips && m.clips.length) { const mx = new THREE.AnimationMixer(inst); mx.clipAction(m.clips[0]).play(); mx.timeScale = 0.8 + Math.random() * 0.4; mx.update(0.02 + Math.random() * 0.5); mixers.add(mx); inst.userData.mixer = mx; }   // поза анимации сразу, а не исходная поза скелета в первом кадре
    group.add(inst); group.userData.model = inst; return inst;
  });
}
// Снять модель (при удалении моба или смене корабля), чтобы анимации не копились.
export function dropModel(group) { const inst = group.userData.model; if (!inst) return; if (inst.userData.mixer) mixers.delete(inst.userData.mixer); group.remove(inst); group.userData.model = null; }
// Остановить или продолжить анимацию модели (далёкие мобы не анимируются: это экономит кадр).
export function pauseModel(group, paused) { const inst = group.userData.model; const mx = inst && inst.userData.mixer; if (!mx) return; if (paused) mixers.delete(mx); else mixers.add(mx); }
let last = performance.now();
(function tick(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; for (const mx of mixers) mx.update(dt); requestAnimationFrame(tick); })(last);
