// Постройки островов: руины замка, колокольня с церковью, дозорная башня, статуи атлантов, вода.
// Всё собирается из простых тел и склеивается bake() в один кусок на материал, поэтому на частоту кадров почти не влияет.
// Кладка, кирпич и штукатурка рисуются шейдером по координатам точки: текстурные координаты после склейки не нужны.
import * as THREE from 'three';

const lin = hex => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };
const f = x => Number(x).toFixed(3);

// Материал кладки. sz — размер камня (ширина, высота), mw — шов, vary — разброс тона, grime — потёки, moss — мох (0..1), mossY — до какой высоты мох у земли
export function masonry(o) {
  const q = Object.assign({ col: 0xa8946f, col2: 0x7e6c50, mix2: 0.45, mort: 0x6a5c48, sz: [3.6, 1.7], mw: 0.1, jit: 0.6, vary: 0.3, grime: 0.42, moss: 0.6, mossY: 12, bump: 0.55, rough: 0.93, metal: 0, grain: 0.28, tone: 0.5 }, o);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: q.rough, metalness: q.metal });
  m.customProgramCacheKey = () => 'mas' + JSON.stringify(q);
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP; varying vec3 vMN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position; vMN = normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMP; varying vec3 vMN; float gMH;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      vec2 brick(vec2 uv, vec2 sz, float mw){ float row = floor(uv.y/sz.y); float u = uv.x/sz.x + 0.5*mod(row, 2.0) + h21(vec2(row, 7.0))*${f(q.jit)}; vec2 id = vec2(floor(u), row); vec2 fr = vec2(fract(u), fract(uv.y/sz.y));
        float e = min(min(fr.x, 1.0 - fr.x)*sz.x, min(fr.y, 1.0 - fr.y)*sz.y); float px = fwidth(uv.y) + fwidth(uv.x); float mo = 1.0 - smoothstep(mw*0.5, mw + px, e); mo *= 1.0 - smoothstep(sz.y*0.3, sz.y*1.1, px); return vec2(mo, h21(id)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 an = abs(normalize(vMN)); float wx = an.x*an.x, wz = an.z*an.z; float sw = wx + wz + 1e-4; vec2 SZ = vec2(${f(q.sz[0])}, ${f(q.sz[1])});
        vec2 bA = brick(vec2(vMP.z, vMP.y), SZ, ${f(q.mw)}), bB = brick(vec2(vMP.x, vMP.y), SZ, ${f(q.mw)}), bT = brick(vMP.xz, SZ.xx*0.9, ${f(q.mw)});
        vec2 b = mix((bA*wx + bB*wz)/sw, bT, smoothstep(0.5, 0.8, an.y));
        float big = vn(vMP.xy*0.06 + vMP.zy*0.05), fine = vn((vMP.xy + vMP.zx)*1.7);
        vec3 col = ${lin(q.col)}*(1.0 + ${f(q.vary)}*(b.y - 0.5)); col = mix(col, ${lin(q.col2)}, smoothstep(0.55, 0.95, b.y)*${f(q.mix2)}); col *= 1.0 + ${f(q.grain)}*(fine - 0.5); col *= 1.0 + ${f(q.tone)}*(big - 0.5);
        col = mix(col, ${lin(q.mort)}, b.x);
        float streak = vn(vec2(vMP.x*0.35 + vMP.z*0.31, vMP.y*0.045)); col *= 1.0 - ${f(q.grime)}*smoothstep(0.45, 0.9, streak);
        float ms = smoothstep(0.45, 0.78, big + 0.25*fine)*${f(q.moss)}*(smoothstep(${f(q.mossY)}, 0.0, vMP.y)*0.9 + smoothstep(0.6, 0.9, an.y)*step(0.0, vMN.y)*0.85);
        col = mix(col, vec3(0.06, 0.12, 0.03)*(0.7 + 0.6*fine), clamp(ms, 0.0, 0.85));
        diffuseColor.rgb = col; gMH = ((1.0 - b.x)*${f(q.bump)} + fine*${f(q.grain)})*(1.0 - smoothstep(0.4, 2.0, fwidth(vMP.y) + fwidth(vMP.x))); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(gMH), dhy = dFdy(gMH); vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        vec3 sg = sign(det)*(dhx*r1 + dhy*r2); normal = normalize(abs(det)*normal - sg); }`);
  };
  return m;
}

// Вода одного ровного цвета с рябью: не зеркалит небо, поэтому не «мигает» белым и голубым.
// mode: 'flow' — река (uv.y вдоль русла), 'lake' — круг, 'ring' — кольцевой канал (r0, r1)
export function waterMat(mode, a = 0, b = 0) {
  if (mode === 'ice') return new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying vec3 vP;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){ vec2 p = vP.xz*0.05; float a = vn(p), b = vn(p*2.7 + 5.0), c = vn(p*0.45 + 9.0);
        vec3 col = mix(vec3(0.42, 0.62, 0.72), vec3(0.74, 0.88, 0.93), smoothstep(0.25, 0.8, c*0.6 + b*0.4));
        float cr = smoothstep(0.035, 0.0, abs(a - 0.5)) + 0.6*smoothstep(0.03, 0.0, abs(b - 0.48)); col = mix(col, vec3(0.93, 0.97, 1.0), clamp(cr, 0.0, 1.0)*0.55);
        float e = 1.0 - length(vUv - 0.5)*2.0; col = mix(col, vec3(0.9, 0.94, 0.98), smoothstep(0.3, 0.0, e + 0.1*(b - 0.5)));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const edge = mode === 'flow' ? 'min(vUv.x, 1.0 - vUv.x)*2.0' : mode === 'lake' ? '(1.0 - length(vUv - 0.5)*2.0)*2.4' : `min(length(vP.xz) - ${f(a)}, ${f(b)} - length(vP.xz))/${f((b - a) / 2)}`;
  const p = mode === 'flow' ? `vec2(vUv.x*2.4, vUv.y*${f(a * 0.11)} - uT*0.5)` : 'vP.xz*0.11';
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: true, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vP;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){ vec2 p = ${p}; float r1 = vn(p + vec2(uT*0.12, -uT*0.09)), r2 = vn(p*2.3 - vec2(uT*0.17, uT*0.06)), r3 = vn(p*6.0 + vec2(-uT*0.3, uT*0.22)); float rip = r1*0.55 + r2*0.3 + r3*0.15;
        vec3 deep = vec3(0.012, 0.105, 0.17), mid = vec3(0.03, 0.235, 0.31), lite = vec3(0.24, 0.52, 0.58);
        vec3 col = mix(deep, mid, smoothstep(0.3, 0.72, rip)); col = mix(col, lite, smoothstep(0.66, 0.8, r2*0.5 + r3*0.5)*0.4);
        float e = ${edge}; col = mix(col, mid*1.5, smoothstep(0.55, 0.0, e)*0.5);
        ${mode === 'flow' ? 'col = mix(col, vec3(0.78, 0.88, 0.9), smoothstep(0.2, 0.0, e - 0.1*r3)*0.75);' : ''}
        gl_FragColor = vec4(col, 0.95);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}

export function initBuild({ scene, put, bake, BM, std, rng }) {
  const M = {
    castle: masonry({}), castleDark: masonry({ col: 0x8d7c5e, col2: 0x6a5a42, grime: 0.55 }),
    rubble: masonry({ col: 0x9c8a6a, col2: 0x76664c, sz: [2.3, 1.8], jit: 1, vary: 0.4, mw: 0.15, moss: 0.75, mossY: 16 }),
    brick: masonry({ col: 0x9b4631, col2: 0x76301f, mix2: 0.6, mort: 0xb9a78d, sz: [1.5, 0.62], mw: 0.085, jit: 0.1, vary: 0.4, grime: 0.3, moss: 0.3, mossY: 6, bump: 0.5 }),
    plaster: masonry({ grain: 0.07, tone: 0.2, col: 0x9cc4d6, col2: 0x86b2c6, mix2: 0.2, mort: 0x86a9b8, sz: [60, 60], mw: 0, vary: 0.05, grime: 0.28, moss: 0.25, mossY: 4, bump: 0.2, rough: 0.85 }),
    white: masonry({ grain: 0.07, tone: 0.2, col: 0xefeadf, col2: 0xdcd5c6, mix2: 0.2, mort: 0xcfc8b8, sz: [60, 60], mw: 0, vary: 0.04, grime: 0.22, moss: 0.15, mossY: 3, bump: 0.2, rough: 0.8 }),
    roof: masonry({ grain: 0.1, tone: 0.3, col: 0x4f6f5c, col2: 0x3f5b4b, mix2: 0.4, mort: 0x2e4338, sz: [60, 60], mw: 0, jit: 0, vary: 0.25, grime: 0.35, moss: 0, bump: 1.2, rough: 0.6, metal: 0.35 }),
    slate: masonry({ col: 0x414b57, col2: 0x2f3740, mix2: 0.6, mort: 0x1c2126, sz: [1.3, 0.9], mw: 0.09, jit: 0.2, vary: 0.5, grime: 0.3, moss: 0.35, mossY: 0, bump: 1.4, rough: 0.7 }),
    marble: masonry({ grain: 0.07, tone: 0.2, col: 0xe6e0d2, col2: 0xcfc8b8, mix2: 0.3, mort: 0xbdb6a6, sz: [80, 80], mw: 0, vary: 0.04, grime: 0.2, moss: 0.2, mossY: 5, bump: 0.25, rough: 0.45 }),
    sand: masonry({ col: 0xc9a468, col2: 0xa98448, mix2: 0.5, mort: 0x8a6a3a, sz: [3.4, 2.2], mw: 0.12, jit: 0.5, vary: 0.3, grime: 0.35, moss: 0, bump: 0.6 }),
    marbleB: masonry({ col: 0xe4ddcd, col2: 0xcbc3b1, mix2: 0.35, mort: 0xa9a292, sz: [5, 2.4], mw: 0.07, jit: 0.3, vary: 0.14, grime: 0.38, moss: 0.4, mossY: 9, bump: 0.35, rough: 0.55, grain: 0.1, tone: 0.3 }),
    copper: masonry({ col: 0x3f8f86, col2: 0x2f6f6a, mix2: 0.5, mort: 0x2a5a55, sz: [60, 60], mw: 0, vary: 0.1, grime: 0.5, moss: 0, bump: 0.2, rough: 0.55, metal: 0.4, grain: 0.14, tone: 0.45 }),
    dark: std(0x0b0a09, 1), silver: std(0xc6cad1, 0.28, 1), ivy: std(0x2c3f1f, 1), ivy2: std(0x3d5226, 1),
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const ico = new THREE.IcosahedronGeometry(1, 0), ico1 = new THREE.IcosahedronGeometry(1, 1);
  const group = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; };

  // арочный проём: тёмная ниша на стене, смотрит вдоль +Z своей системы
  const archCache = {}; function archGeo(w, h, d) { const k = w + '_' + h + '_' + d; if (!archCache[k]) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); archCache[k] = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -d / 2); } return archCache[k]; }
  function arch(g, x, y, z, ry, w, h, frame) { if (frame) put(g, archGeo(w + 0.9, h + 0.6, 0.5), frame, x, y - 0.15, z, ry); return put(g, archGeo(w, h, 0.8), M.dark, x + Math.sin(ry) * 0.12, y, z + Math.cos(ry) * 0.12, ry); }
  // камни-обломки и пучки зелени
  function stones(g, r, n, at, mat = M.rubble, s0 = 1, s1 = 4) { for (let i = 0; i < n; i++) { const [x, z] = at(r), s = s0 + r() * (s1 - s0); const b = put(g, ico, mat, x, s * 0.3, z, r() * 6.28); b.scale.set(s, s * (0.45 + r() * 0.4), s * (0.6 + r() * 0.6)); b.rotation.x = (r() - 0.5) * 0.7; } }
  function tuft(g, r, x, y, z, s) { const b = put(g, ico1, r() < 0.5 ? M.ivy : M.ivy2, x, y, z, r() * 6.28); b.scale.set(s * (0.6 + r() * 0.5), s * (0.45 + r() * 0.4), s * (0.6 + r() * 0.5)); b.rotation.x = r() * 0.6; b.castShadow = false; }
  // разрушенная стена: ряд блоков с рваным верхом. hf(t) — высота вдоль стены, 0 = пролом
  function ruinWall(g, r, x0, z0, x1, z1, thick, hf, mat = M.castle, y0 = 0) { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.max(2, Math.round(len / 2.4)), ry = Math.atan2(dx, dz), sl = len / n;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; let h = hf(t); if (h <= 0.5) continue; h = Math.max(1.2, Math.round(h * (0.86 + 0.28 * r()) / 1.2) * 1.2); const x = x0 + dx * t, z = z0 + dz * t;
      put(g, box(thick, h, sl + 0.06), mat, x, y0 + h / 2, z, ry);
      if (r() < 0.55) { const s = 0.7 + r() * 0.9; put(g, box(thick * (0.5 + r() * 0.4), s, sl * (0.4 + r() * 0.5)), mat, x + (r() - 0.5) * 0.6, y0 + h + s / 2, z + (r() - 0.5) * 0.6, ry); }
      if (r() < 0.22) tuft(g, r, x, y0 + h + 0.3, z, 1.2 + r() * 1.2); } }
  // квадратная башня: целая до h0, выше — рваные остатки стен (tops: высоты четырёх сторон)
  function sqTower(g, r, x, z, w, d, h0, tops, mat = M.castle) {
    put(g, box(w + 2.6, 4, d + 2.6), M.castleDark, x, 2, z); put(g, box(w, h0, d), mat, x, h0 / 2, z);
    for (const yy of [h0 * 0.36, h0 * 0.7, h0 - 0.5]) put(g, box(w + 1.1, 0.8, d + 1.1), M.castleDark, x, yy, z);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = (k % 2 ? w : d) / 2, side = (k % 2 ? d : w);
      for (const [lv, ww, hh] of [[0.18, 1.1, 4.2], [0.44, 2.2, 5.2], [0.76, 2.4, 5.6]]) if (r() < 0.85) { const off = (r() - 0.5) * side * 0.3; arch(g, x + nx * (half + 0.02) + nz * off, h0 * lv, z + nz * (half + 0.02) - nx * off, a, ww, hh); }
      // остатки верхнего яруса с зубцами
      const th = tops[k]; if (th > 0) { const ax = x + nx * (half - 0.9), az = z + nz * (half - 0.9), tx = nz, tz = -nx, L = side / 2;
        ruinWall(g, r, ax - tx * L, az - tz * L, ax + tx * L, az + tz * L, 1.8, t => th * (0.55 + 0.45 * Math.sin((t * 1.3 + k * 0.37) * 3.1)) * (r() < 0.12 ? 0.3 : 1), mat, h0);
        if (th > 9) arch(g, x + nx * (half + 0.02), h0 + 2.2, z + nz * (half + 0.02), a, 2.2, 4.6); } }
    put(g, box(w - 3.4, 0.5, d - 3.4), M.dark, x, h0 + 0.3, z); for (let i = 0; i < 4; i++) tuft(g, r, x + (r() - 0.5) * (w - 4), h0 + 0.7, z + (r() - 0.5) * (d - 4), 1.6 + r() * 1.6); }

  // ---------- руины средневекового замка ----------
  function castle(il, y) { const g = group(il.x, y, il.z, 0.5), r = rng(909);
    // две башни донжона и перемычка с воротами
    sqTower(g, r, -15, -3, 17, 17, 48, [17, 13, 5, 10]); sqTower(g, r, 9, 1, 14, 15, 38, [13, 3, 10, 6]);
    put(g, box(9, 31, 11), M.castle, -2.5, 15.5, -1); arch(g, -2.5, 0, 4.52, 0, 5.4, 11); arch(g, -2.5, 17, 4.52, 0, 2.2, 5); ruinWall(g, r, -6.5, -1, 1.5, -1, 9, t => 3 + 3 * t, M.castle, 31);
    // западное крыло: стена сходит на нет
    ruinWall(g, r, -24, -6, -68, 6, 3.2, t => 30 * Math.pow(1 - t, 1.5) + 3 + (t > 0.3 && t < 0.42 ? -30 : 0)); for (const t of [0.12, 0.24]) arch(g, -24 - 44 * t + 0.45, 11, -6 + 12 * t + 1.62, Math.atan2(-44, 12) + Math.PI / 2, 2.2, 5.4);
    // восточный обломок стены: высокий, слоистый, с провалом
    ruinWall(g, r, 17, 5, 54, 21, 3.6, t => t < 0.12 ? 26 : t < 0.5 ? 34 * (0.7 + 0.3 * Math.sin(t * 9)) : t < 0.62 ? 9 : 22 * (1.25 - t)); put(g, box(4.4, 15, 5), M.castleDark, 30, 7.5, 13.5, 1.16); put(g, box(4.4, 10, 5), M.castleDark, 47, 5, 21, 1.16);
    // северная стена с круглой угловой башней и проломом
    ruinWall(g, r, -62, -34, 50, -38, 3.2, t => (t > 0.38 && t < 0.52) ? 0 : 9 + 9 * Math.abs(Math.sin(t * 7.3)));
    put(g, new THREE.CylinderGeometry(8.4, 9.6, 27, 20, 1, false, 0.5, 4.5), M.castle, 55, 13.5, -36); put(g, new THREE.CylinderGeometry(6.9, 7.4, 26.6, 20, 1, true, 0.5, 4.5), M.dark, 55, 13.5, -36);
    for (let k = 0; k < 9; k++) { const a = 0.6 + k * 0.5; if (r() < 0.75) put(g, box(2.4, 2 + r() * 3, 1.6), M.castle, 55 + Math.sin(a) * 8.1, 27.5 + r(), -36 + Math.cos(a) * 8.1, a); }
    // южный двор: низкие остатки стен и хозяйственной постройки
    ruinWall(g, r, -56, 36, 44, 42, 2.8, t => (t > 0.44 && t < 0.56) ? 0 : 3 + 6 * Math.abs(Math.sin(t * 5.1 + 1))); ruinWall(g, r, -66, 8, -58, 36, 2.8, t => 4 + 5 * t); ruinWall(g, r, 54, 23, 46, 42, 2.8, t => 12 * (1 - t) + 2);
    ruinWall(g, r, -44, 12, -44, 30, 2.2, t => 7 + 4 * Math.sin(t * 3), M.castleDark); ruinWall(g, r, -44, 30, -24, 30, 2.2, t => t < 0.4 ? 9 : 4, M.castleDark); arch(g, -34, 0, 31.2, 0, 2.6, 6);
    // обломки у стен и зелень
    stones(g, r, 70, q => { const a = q() * 6.28, d = 10 + q() * 62; return [Math.cos(a) * d, Math.sin(a) * d * 0.72]; }); stones(g, r, 26, q => [-30 - q() * 30, -2 + q() * 12], M.castle, 0.8, 2.6); stones(g, r, 22, q => [22 + q() * 30, 10 + q() * 12], M.castle, 0.8, 3);
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 14 + r() * 56; tuft(g, r, Math.cos(a) * d, 0.4, Math.sin(a) * d * 0.7, 2 + r() * 2.5); }
    bake(g); }

  // ---------- колокольня из красного кирпича и голубая церковь с золотыми главами ----------
  const onionPts = [[0.5, 0], [0.62, 0.05], [0.86, 0.16], [1, 0.34], [0.97, 0.5], [0.8, 0.7], [0.52, 0.9], [0.24, 1.08], [0.08, 1.24], [0.02, 1.36]];
  function onion(g, x, y, z, R, mat) { put(g, new THREE.LatheGeometry(onionPts.map(p => new THREE.Vector2(p[0] * R, p[1] * R * 1.25)), 20), mat, x, y, z); const t = y + R * 1.7;
    put(g, new THREE.SphereGeometry(R * 0.16, 8, 6), BM.gold, x, t, z); put(g, box(R * 0.09, R * 1.3, R * 0.09), BM.gold, x, t + R * 0.65, z); put(g, box(R * 0.62, R * 0.09, R * 0.09), BM.gold, x, t + R * 0.86, z); put(g, box(R * 0.34, R * 0.08, R * 0.08), BM.gold, x, t + R * 1.08, z); const b = put(g, box(R * 0.4, R * 0.08, R * 0.08), BM.gold, x, t + R * 0.45, z); b.rotation.z = 0.5; }
  function chapel(il, lx, lz) { const g = group(il.x + lx, il.heightAt(lx, lz) - 0.6, il.z + lz, 0.4), r = rng(77);
    // колокольня: два четверика, два восьмерика, шатёр, глава
    const tx = 17, B = M.brick;
    put(g, box(15.4, 1.6, 15.4), M.white, tx, 0.8, 0); put(g, box(13.6, 17, 13.6), B, tx, 9.5, 0);
    for (const s of [-1, 1]) for (const q of [-1, 1]) put(g, box(2, 17, 2), B, tx + s * 6.5, 9.5, q * 6.5);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a); arch(g, tx + nx * 6.82, 1.6, nz * 6.82, a, 5, 10.5); put(g, archGeo(7, 12, 0.5), B, tx + nx * 6.9, 1.4, nz * 6.9, a); }
    put(g, box(15.2, 0.9, 15.2), B, tx, 18.4, 0); put(g, box(14.4, 0.7, 14.4), M.white, tx, 19.2, 0);
    put(g, box(11.4, 13, 11.4), B, tx, 26, 0); for (const s of [-1, 1]) for (const q of [-1, 1]) { put(g, box(1.6, 13, 1.6), B, tx + s * 5.5, 26, q * 5.5); put(g, new THREE.ConeGeometry(1.1, 2.6, 4).rotateY(0.785), B, tx + s * 6.3, 20.8, q * 6.3); }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a); arch(g, tx + nx * 5.72, 21.5, nz * 5.72, a, 3.4, 7.6); for (const s of [-1, 1]) arch(g, tx + nx * 5.72 + nz * s * 3.6, 22.5, nz * 5.72 - nx * s * 3.6, a, 1, 4); put(g, new THREE.CylinderGeometry(2.7, 2.7, 0.5, 12, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), B, tx + nx * 5.8, 29.6, nz * 5.8, a); }
    put(g, box(12.6, 0.9, 12.6), B, tx, 32.9, 0); put(g, box(12, 0.6, 12), M.white, tx, 33.6, 0);
    const oct = (rt, rb, h, y, mat = B) => put(g, new THREE.CylinderGeometry(rt, rb, h, 8), mat, tx, y, 0, Math.PI / 8);
    oct(5.4, 5.4, 12, 39.9); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (k % 2 === 0) arch(g, tx + Math.sin(a) * 5.02, 35.4, Math.cos(a) * 5.02, a, 2.6, 7.4); else arch(g, tx + Math.sin(a) * 5.02, 37, Math.cos(a) * 5.02, a, 0.9, 4); }
    oct(6.1, 6.1, 0.9, 46.3); oct(5.6, 5.6, 0.5, 47, M.white);
    oct(4, 4, 8.5, 51.5); for (let k = 0; k < 8; k += 2) { const a = k * Math.PI / 4; arch(g, tx + Math.sin(a) * 3.72, 48.6, Math.cos(a) * 3.72, a, 1.6, 4.6); }
    oct(4.6, 4.6, 0.8, 56.1); oct(1.5, 4.2, 6.5, 59.7, M.roof); oct(1.6, 1.6, 2.4, 64.1); onion(g, tx, 65.3, 0, 2.9, M.silver);
    // церковь: голубые стены, белые лопатки и наличники, зелёная кровля, золотые главы
    const cx = -9, P = M.plaster, W = M.white;
    put(g, box(25, 1.4, 16.4), W, cx, 0.7, 0); put(g, box(24, 13, 15.4), P, cx, 7.9, 0); put(g, box(24.8, 0.9, 16.2), W, cx, 14.6, 0); put(g, box(24.4, 0.5, 15.8), W, cx, 9.2, 0);
    for (const s of [-1, 1]) { for (const px of [-11.6, -3.9, 3.9, 11.6]) put(g, box(1.1, 13, 0.5), W, cx + px, 7.9, s * 7.75); for (const px of [-7.75, 0, 7.75]) { arch(g, cx + px, 3.4, s * 7.72, s > 0 ? 0 : Math.PI, 2, 5.2, W); arch(g, cx + px, 10.4, s * 7.72, s > 0 ? 0 : Math.PI, 1.3, 2.8, W); } }
    put(g, new THREE.ConeGeometry(1, 4.6, 4).rotateY(Math.PI / 4).scale(17.4, 1, 11.4), M.roof, cx, 17.3, 0);
    // алтарная апсида и притвор к колокольне
    put(g, new THREE.CylinderGeometry(5.6, 5.6, 10, 16, 1, false, Math.PI, Math.PI), P, cx - 12, 6.4, 0); put(g, new THREE.CylinderGeometry(6, 6, 0.8, 16, 1, false, Math.PI, Math.PI), W, cx - 12, 11.8, 0); put(g, new THREE.ConeGeometry(5.9, 4, 16, 1, false, Math.PI, Math.PI), M.roof, cx - 12, 14.2, 0); arch(g, cx - 17.56, 3.4, 0, -Math.PI / 2, 1.6, 4.6, W);
    put(g, box(7, 9.5, 9), P, cx + 15.2, 6.1, 0); put(g, box(7.4, 0.7, 9.6), W, cx + 15.2, 11.2, 0); put(g, new THREE.ConeGeometry(1, 2.6, 4).rotateY(Math.PI / 4).scale(5.4, 1, 6.9), M.roof, cx + 15.2, 12.8, 0); for (const s of [-1, 1]) arch(g, cx + 15.2, 3.2, s * 4.52, s > 0 ? 0 : Math.PI, 1.6, 4.4, W);
    // главы: большая в центре и малая над алтарём
    put(g, new THREE.CylinderGeometry(3.3, 3.3, 6.5, 16), P, cx + 1, 21.4, 0); put(g, new THREE.CylinderGeometry(3.7, 3.7, 0.7, 16), W, cx + 1, 24.9, 0); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; arch(g, cx + 1 + Math.sin(a) * 3.28, 19.4, Math.cos(a) * 3.28, a, 0.9, 3.6, W); } onion(g, cx + 1, 25.2, 0, 3.9, BM.gold);
    put(g, new THREE.CylinderGeometry(1.8, 1.8, 4.6, 12), P, cx - 8.6, 18.6, 0); put(g, new THREE.CylinderGeometry(2.1, 2.1, 0.5, 12), W, cx - 8.6, 21.1, 0); onion(g, cx - 8.6, 21.3, 0, 2.2, BM.gold);
    // двор: плиты и зелень
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 22 + r() * 16; tuft(g, r, Math.cos(a) * d, 0.5, Math.sin(a) * d * 0.7, 1.8 + r() * 2); }
    bake(g); }

  // ---------- дозорная башня у озера ----------
  function watchTower(il, lx, lz) { const g = group(il.x + lx, il.heightAt(lx, lz) - 1.2, il.z + lz, 0.9), r = rng(31), R = M.rubble, H = 40;
    put(g, new THREE.CylinderGeometry(9.6, 11, 5, 22), M.castleDark, 0, 2.5, 0); put(g, new THREE.CylinderGeometry(7.6, 8.8, H, 26), R, 0, H / 2 + 2, 0);
    put(g, new THREE.CylinderGeometry(8.5, 8.5, 0.8, 26), M.castleDark, 0, H * 0.55, 0);
    arch(g, 0, 4.4, 8.62, 0, 2.6, 6); put(g, box(5.6, 0.7, 4), M.castleDark, 0, 4.2, 10); put(g, box(5.6, 2.4, 3), M.castleDark, 0, 2.6, 10.4);
    for (let k = 0; k < 7; k++) { const a = 0.9 + k * 1.15, y = 9 + k * 4.4, rr = 8.6 - (y / H) * 1.1; arch(g, Math.sin(a) * rr, y, Math.cos(a) * rr, a, 0.7, 3.2); }
    // выносной боевой ход на кронштейнах, зубцы, шатровая кровля
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283; put(g, box(1, 2, 1.6), M.castleDark, Math.sin(a) * 8.1, H + 0.6, Math.cos(a) * 8.1, a); }
    put(g, new THREE.CylinderGeometry(9.3, 8.9, 1.2, 26), R, 0, H + 2.2, 0); put(g, new THREE.CylinderGeometry(9.3, 9.3, 3, 26, 1, true), R, 0, H + 4.3, 0);
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; put(g, box(2.4, 2.2, 1.2), R, Math.sin(a) * 9, H + 6.8, Math.cos(a) * 9, a); }
    put(g, new THREE.CylinderGeometry(7, 7, 5, 22), R, 0, H + 5.2, 0); put(g, new THREE.ConeGeometry(8.6, 14, 22), M.slate, 0, H + 14.6, 0); put(g, new THREE.SphereGeometry(0.7, 8, 6), BM.gold, 0, H + 22, 0); put(g, box(0.25, 5, 0.25), M.castleDark, 0, H + 24, 0); const fl = put(g, box(3.6, 1.9, 0.1), BM.flag, 1.9, H + 25.3, 0); fl.castShadow = false;
    // лестничная башенка сбоку
    put(g, new THREE.CylinderGeometry(3.1, 3.5, H + 7, 14), R, -8.2, (H + 7) / 2 + 1, -2.4); put(g, new THREE.ConeGeometry(3.9, 7.5, 14), M.slate, -8.2, H + 11.7, -2.4); for (let k = 0; k < 4; k++) arch(g, -8.2 - 3.3, 8 + k * 9, -2.4, -Math.PI / 2, 0.6, 2.6);
    stones(g, r, 16, q => { const a = q() * 6.28, d = 11 + q() * 9; return [Math.cos(a) * d, Math.sin(a) * d]; }, M.rubble, 1, 3.2); for (let i = 0; i < 10; i++) { const a = r() * 6.28; tuft(g, r, Math.cos(a) * 11, 0.8, Math.sin(a) * 11, 1.6 + r() * 1.6); }
    bake(g); }

  // ---------- статуя атланта: держит на плечах небесную сферу ----------
  const UP = new THREE.Vector3(0, 1, 0);
  function limb(g, a, b, r0) { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), m = put(g, new THREE.CapsuleGeometry(r0, d.length(), 4, 10), M.marble, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m; }
  function atlas(parent, x, y, z, ry, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g); const ball = (px, py, pz, r0, sx = 1, sy = 1, sz = 1) => { const b = put(g, new THREE.SphereGeometry(r0, 14, 10), M.marble, px, py, pz); b.scale.set(sx, sy, sz); return b; };
    put(g, box(7.4, 1, 7.4), M.marble, 0, 0.5, 0); put(g, box(6, 4.6, 6), M.marble, 0, 3.3, 0); put(g, box(6.8, 0.8, 6.8), M.marble, 0, 6, 0); const F = 6.4;
    // ноги: левая опорная, правая согнута в колене и выставлена вперёд
    limb(g, [-1, F + 5.4, 0], [-1.1, F + 2.9, 0.2], 0.85); limb(g, [-1.1, F + 2.7, 0.2], [-1.1, F + 0.5, -0.1], 0.66); ball(-1.1, F + 0.3, 0.5, 0.7, 0.9, 0.5, 1.7);
    limb(g, [1, F + 5.4, 0], [1.3, F + 3.6, 1.9], 0.85); limb(g, [1.3, F + 3.4, 1.9], [1.3, F + 0.6, 1.5], 0.66); ball(1.3, F + 0.3, 2.1, 0.7, 0.9, 0.5, 1.7);
    // таз, торс с наклоном вперёд, плечи, голова
    ball(0, F + 5.8, 0, 1.5, 1.2, 0.8, 0.85); const torso = put(g, new THREE.CylinderGeometry(2.05, 1.4, 3.6, 14), M.marble, 0, F + 7.7, 0.25); torso.scale.z = 0.66; torso.rotation.x = 0.16; ball(0, F + 9.3, 0.55, 2.1, 1.08, 0.62, 0.7); ball(-0.75, F + 8.9, 1.2, 0.8, 1, 0.8, 0.5); ball(0.75, F + 8.9, 1.2, 0.8, 1, 0.8, 0.5);
    ball(-2.2, F + 9.6, 0.4, 0.92); ball(2.2, F + 9.6, 0.4, 0.92); limb(g, [0, F + 9.9, 0.7], [0, F + 10.6, 1.2], 0.55); ball(0, F + 11.3, 1.55, 0.95, 0.92, 1.05, 1); ball(0, F + 11.05, 2.2, 0.6, 0.9, 0.8, 0.6);
    // руки подняты и держат сферу
    limb(g, [-2.3, F + 9.7, 0.4], [-3.4, F + 11.5, 0.1], 0.6); limb(g, [-3.4, F + 11.6, 0.1], [-2.6, F + 13.6, -0.5], 0.5); ball(-2.5, F + 13.9, -0.5, 0.55); limb(g, [2.3, F + 9.7, 0.4], [3.4, F + 11.5, 0.1], 0.6); limb(g, [3.4, F + 11.6, 0.1], [2.6, F + 13.6, -0.5], 0.5); ball(2.5, F + 13.9, -0.5, 0.55);
    put(g, new THREE.SphereGeometry(3.3, 22, 16), M.marble, 0, F + 14.4, -0.9); for (const [rx, rz] of [[Math.PI / 2, 0], [0.4, 0.5], [1.2, -0.6]]) { const t = put(g, new THREE.TorusGeometry(3.42, 0.13, 6, 36), BM.gold, 0, F + 14.4, -0.9); t.rotation.set(rx, 0, rz); }
    return g; }

  // ---------- пирамида: ряды блоков песчаника, выветренные углы, вход ----------
  function pyramid(g, x, y, z, s, h, seed) { const r = rng(seed), n = Math.max(8, Math.round(h / 2.4)), lh = h / n;
    for (let i = 0; i < n; i++) { const t = i / n, w = s * 1.34 * (1 - t) + 2.4; put(g, box(w, lh + 0.05, w), M.sand, x, y + lh * (i + 0.5), z);
      if (i > 1 && r() < 0.35) { const a = 0.785 + (r() * 4 | 0) * Math.PI / 2, d = w * 0.707 - 1; const b = put(g, ico, M.sand, x + Math.sin(a) * d, y + lh * (i + 0.2), z + Math.cos(a) * d, r() * 6); b.scale.set(1.6 + r() * 2, 1 + r(), 1.6 + r() * 2); } }
    put(g, new THREE.ConeGeometry(2.2, 3.4, 4), BM.gold, x, y + h + 1.2, z, 0.785);
    const fa = 0, fd = s * 0.67 + 1.6; put(g, box(9, 11, 5), M.sand, x + Math.sin(fa) * fd, y + 5.5, z + Math.cos(fa) * fd, fa); arch(g, x + Math.sin(fa) * (fd + 2.55), y, z + Math.cos(fa) * (fd + 2.55), fa, 3.6, 8);
    stones(g, r, 14, q => { const a = q() * 6.28, d = s * (0.8 + q() * 0.45); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; }, M.sand, 1, 3.4); g.children.slice(-14).forEach(c => { c.position.y += y; }); }
  function obelisk(g, x, y, z) { put(g, box(5.4, 2, 5.4), M.sand, x, y + 1, z); put(g, new THREE.CylinderGeometry(1.5, 2.3, 25, 4), M.sand, x, y + 14.5, z, 0.785); put(g, new THREE.ConeGeometry(2.1, 4, 4), BM.gold, x, y + 29, z, 0.785); }
  return { M, castle, chapel, watchTower, atlas, arch, ruinWall, stones, pyramid, obelisk };
}
