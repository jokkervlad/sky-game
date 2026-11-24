import * as THREE from 'three';
// Туман: в целой части плотности передаём (в десятках единиц) расстояние, с которого он начинается. Так вокруг корабля чисто при любом отдалении камеры.
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(/float fogFactor = 1\.0 - exp\([^;]*\);/, 'float fogX = fract( fogDensity ) * max( 0.0, vFogDepth - floor( fogDensity ) * 10.0 ); float fogFactor = 1.0 - exp( - fogX * fogX );');

// ---------- noise ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const P = new Uint8Array(512);
{ const r = rng(1337); const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad3(h, x, y, z) { h &= 15; const u = h < 8 ? x : y; const v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
function perlin3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z); const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(lerp(lerp(grad3(P[AA], x, y, z), grad3(P[BA], x - 1, y, z), u), lerp(grad3(P[AB], x, y - 1, z), grad3(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad3(P[AA + 1], x, y, z - 1), grad3(P[BA + 1], x - 1, y, z - 1), u), lerp(grad3(P[AB + 1], x, y - 1, z - 1), grad3(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
function fbm3(x, y, z, oct = 5) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * perlin3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
function ridged3(x, y, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(perlin3(x * f, y * f, z * f)); s += a * v * v; n += a; a *= 0.5; f *= 2.1; } return s / n; }
// tiling 2D perlin
function pperlin2(x, y, per) {
  const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi; const u = fade(xf), v = fade(yf);
  const h = (i, j) => P[P[((i % per) + per) % per] + (((j % per) + per) % per)];
  const g = (hh, dx, dy) => { const a = hh * 0.3927; return Math.cos(a) * dx + Math.sin(a) * dy; };
  return lerp(lerp(g(h(xi, yi), xf, yf), g(h(xi + 1, yi), xf - 1, yf), u), lerp(g(h(xi, yi + 1), xf, yf - 1), g(h(xi + 1, yi + 1), xf - 1, yf - 1), u), v);
}
function makeNoiseTexture(N = 512) {
  const d = new Uint8Array(N * N * 4); let mnR = 1e9, mxR = -1e9, mnG = 1e9, mxG = -1e9; const R = new Float32Array(N * N), G = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i / N, y = j / N; let a = 0.5, per = 5, r = 0, g = 0;
    for (let o = 0; o < 6; o++) { const n = pperlin2(x * per, y * per, per); r += a * (o < 2 ? (n * 0.5 + 0.5) : Math.abs(n) * 1.6); g += a * n; a *= 0.5; per *= 2; }
    const k = j * N + i; R[k] = r; G[k] = g; mnR = Math.min(mnR, r); mxR = Math.max(mxR, r); mnG = Math.min(mnG, g); mxG = Math.max(mxG, g);
  }
  for (let k = 0; k < N * N; k++) { d[k * 4] = 255 * (R[k] - mnR) / (mxR - mnR); d[k * 4 + 1] = 255 * (G[k] - mnG) / (mxG - mnG); d[k * 4 + 2] = 0; d[k * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
}

// ---------- renderer ----------
const canvas = document.getElementById('c');
const STILL = new URLSearchParams(location.search).has('still');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: STILL }); } catch (e) { document.getElementById('err').style.display = 'flex'; throw e; }
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 2, 60000);

const HAZE = new THREE.Color(0.66, 0.77, 0.93);
const CLOUD_SHADE = new THREE.Color(0.50, 0.55, 0.82);
scene.fog = new THREE.FogExp2(0xb4c8e4, 0.00017);

// sky + sun
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 31), THREE.MathUtils.degToRad(-128));
function skyMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sunDir }, uFogA: { value: 0 }, uFogC: { value: new THREE.Color(0.8, 0.85, 0.9) }, uTintZ: { value: new THREE.Color(1, 1, 1) }, uTintH: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uSun; uniform float uFogA; uniform vec3 uFogC; uniform vec3 uTintZ; uniform vec3 uTintH; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.0);
      vec3 zen = vec3(0.10,0.27,0.72), mid = vec3(0.30,0.52,0.90), hor = vec3(0.66,0.77,0.93);
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h)); col = mix(col, zen, smoothstep(0.15, 0.85, h));
      float s = max(dot(d, uSun), 0.0);
      col += vec3(1.0,0.82,0.58)*pow(s, 14.0)*0.38 + vec3(1.0,0.9,0.75)*pow(s, 220.0)*1.2 + vec3(1.0,0.97,0.9)*smoothstep(0.99955, 0.9998, s)*60.0;
      col *= mix(uTintH, uTintZ, smoothstep(0.0, 0.32, normalize(vD).y));   // ярус перекрашивает небо: свой цвет у горизонта и в зените
      col *= 1.5;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, uFogA);   // туман кладём после тонирования, как у остальных материалов
    }` });
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(40000, 48, 24), skyMaterial()); sky.renderOrder = -10; scene.add(sky);
{ const pm = new THREE.PMREMGenerator(renderer); const s2 = new THREE.Scene(); s2.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial())); const gnd = new THREE.Mesh(new THREE.CircleGeometry(100, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.9, 1.0).multiplyScalar(1.4) })); gnd.position.y = -6; s2.add(gnd); const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; scene.environment = pm.fromScene(s2, 0.03, 1, 500).texture; renderer.toneMapping = tm; pm.dispose(); }

const sun = new THREE.DirectionalLight(0xffe9cf, 3.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const SC = sun.shadow.camera; SC.left = -520; SC.right = 520; SC.top = 520; SC.bottom = -520; SC.near = 50; SC.far = 4000; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xa9c4f0, 0xcfd8e6, 0.75); scene.add(hemi);

const noiseTex = makeNoiseTexture(512);

// ---------- cloud sea ----------
const AMP = 150;
const vortex = new THREE.Vector3(-640, 520, 330); // x, z, radius
const cloudMat = new THREE.ShaderMaterial({
  defines: { STEPS: 20 },
  uniforms: { uNoise: { value: noiseTex }, uSun: { value: sunDir }, uTime: { value: 0 }, uVortex: { value: vortex }, uHaze: { value: HAZE }, uShade: { value: CLOUD_SHADE }, uFogD: { value: 0 }, uFogN: { value: 0 }, uFogC: { value: new THREE.Color(0.8, 0.85, 0.9) } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
  precision highp float;
  uniform sampler2D uNoise; uniform vec3 uSun; uniform float uTime; uniform vec3 uVortex; uniform vec3 uHaze; uniform vec3 uShade; uniform float uFogD; uniform float uFogN; uniform vec3 uFogC;
  varying vec3 vW;
  const float AMP = ${AMP.toFixed(1)};
  float vort(vec2 p){ return length(p - uVortex.xy)/uVortex.z; }
  float Hfin(vec2 p, float h){
    h = smoothstep(0.12, 0.9, h);
    float r = vort(p);
    if(r < 1.0){ float f = smoothstep(0.0, 1.0, r); vec2 dv = p - uVortex.xy; float sp = 0.5 + 0.5*sin(atan(dv.y, dv.x)*3.0 + log(max(r,0.02))*7.0 - uTime*0.9); h = mix(0.74 + 0.10*sp*(1.0-f), h, f*f*f); }
    return h;
  }
  float H(vec2 p, float lod){
    vec2 w = p + uTime*vec2(5.0, 2.0);
    float h = texture2D(uNoise, w/9500.0).r*0.6 + texture2D(uNoise, w/3100.0 + 0.37).r*0.4;
    if(lod < 1.0){ h += (texture2D(uNoise, w/900.0 + 0.71).r - 0.5)*0.15*(1.0-lod); h += (texture2D(uNoise, w/260.0 + 0.13).g - 0.5)*0.018*(1.0-lod); }
    return Hfin(p, h);
  }
  // Верхняя граница высоты облака по двум крупным слоям шума: мелкие слои добавляют не больше 0,085.
  // По ней шагаем дёшево, а полную высоту считаем только там, где луч мог войти в облако. Картинка та же, выборок из текстуры меньше.
  float Hup(vec2 p){
    vec2 w = p + uTime*vec2(5.0, 2.0);
    return Hfin(p, texture2D(uNoise, w/9500.0).r*0.6 + texture2D(uNoise, w/3100.0 + 0.37).r*0.4 + 0.085);
  }
  float surf(vec2 p, float lod){ return -AMP*(1.0 - H(p, lod)); }
  void main(){
    vec3 rd = normalize(vW - cameraPosition);
    float d0 = length(vW - cameraPosition);
    float lod = clamp((d0 - 2500.0)/6000.0, 0.0, 1.0);
    float tmax = min(AMP*2.7/max(-rd.y, 0.03), 2600.0);
    float t = 0.0, tp = 0.0; vec3 p = vW; bool hit = false;
    for(int i=1;i<=STEPS;i++){
      float k = float(i)/float(STEPS); tp = t; t = tmax*k*sqrt(k); p = vW + rd*t;
      if(p.y < -AMP*(1.0 - Hup(p.xz))){ if(p.y < surf(p.xz, lod)){ hit = true; break; } }
    }
    if(hit){ float a = tp, b = t; for(int i=0;i<6;i++){ float m = 0.5*(a+b); vec3 q = vW + rd*m; if(q.y < surf(q.xz, lod)) b = m; else a = m; } t = 0.5*(a+b); p = vW + rd*t; }
    float dist = d0 + t;
    float hp = H(p.xz, lod);
    float e = 11.0 + dist*0.015;
    float hx = H(p.xz + vec2(e,0.0), lod) - H(p.xz - vec2(e,0.0), lod);
    float hz = H(p.xz + vec2(0.0,e), lod) - H(p.xz - vec2(0.0,e), lod);
    vec3 n = normalize(vec3(-hx*AMP, 2.0*e*1.0, -hz*AMP));
    float sh = 0.0;
    for(int k=1;k<=4;k++){ vec3 q = p + uSun*(float(k)*46.0); sh += clamp((surf(q.xz, lod) - q.y)/90.0, 0.0, 1.0); }
    float light = mix(exp(-sh*1.1), 1.0, 0.12);
    float ndl = dot(n, uSun);
    float diff = clamp(ndl*0.72 + 0.28, 0.0, 1.0);
    float ao = mix(0.42, 1.0, smoothstep(0.0, 0.9, hp));
    vec3 sunCol = vec3(1.0, 0.93, 0.82)*1.6;
    vec3 col = uShade*0.78*ao + sunCol*diff*light*ao;
    float fw = pow(max(dot(rd, uSun), 0.0), 6.0);
    col += vec3(1.0,0.85,0.65)*fw*light*0.5;
    // vortex glow
    float r = vort(p.xz);
    if(r < 1.25){
      vec2 dv = p.xz - uVortex.xy; float ang = atan(dv.y, dv.x);
      float arms = 0.5 + 0.5*sin(ang*3.0 + log(max(r,0.02))*7.0 - uTime*0.9);
      float core = smoothstep(1.1, 0.0, r);
      vec3 vc = mix(vec3(0.10,0.55,0.60), vec3(0.55,0.25,0.95), smoothstep(0.75,0.1,r));
      float wv = smoothstep(1.15, 0.7, r);
      col = mix(col, col*(0.25 + 0.5*arms)*vec3(0.55,0.8,0.9) + vc*(0.08 + 0.9*arms*arms*arms)*core, wv);
    }
    float f = 1.0 - exp(-dist*0.000155); float fx = uFogD*max(0.0, dist - uFogN); float fogF = 1.0 - exp(-fx*fx);
    col = mix(col, uHaze*1.5, clamp(f,0.0,1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, fogF);
  }`
});
const cloud = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000, 1, 1).rotateX(-Math.PI / 2), cloudMat); cloud.frustumCulled = false; cloud.renderOrder = 5; scene.add(cloud);

// ---------- island material ----------
const ROCK_VARIANTS = [
  { name: 'гранит', a: [0.155, 0.125, 0.10], b: [0.30, 0.245, 0.19], c: [0.085, 0.075, 0.07], sf: 0.21, ss: 0.45, gA: [0.045, 0.085, 0.022], gB: [0.115, 0.15, 0.045], dry: [0.20, 0.18, 0.085], rough: 0.94 },
  { name: 'красный песчаник', a: [0.33, 0.12, 0.055], b: [0.52, 0.25, 0.11], c: [0.66, 0.44, 0.25], sf: 0.46, ss: 0.8, gA: [0.13, 0.10, 0.03], gB: [0.24, 0.17, 0.05], dry: [0.34, 0.22, 0.07], rough: 0.96 },
  { name: 'чёрный базальт', a: [0.03, 0.032, 0.04], b: [0.085, 0.085, 0.10], c: [0.015, 0.015, 0.02], sf: 0.1, ss: 0.25, col: 1, gA: [0.03, 0.06, 0.03], gB: [0.07, 0.11, 0.05], dry: [0.10, 0.10, 0.06], rough: 0.7 },
  { name: 'белый известняк', a: [0.46, 0.43, 0.36], b: [0.74, 0.71, 0.62], c: [0.33, 0.30, 0.25], sf: 0.3, ss: 0.4, gA: [0.05, 0.11, 0.03], gB: [0.14, 0.20, 0.06], dry: [0.26, 0.24, 0.10], rough: 0.9 },
  { name: 'лёд', a: [0.36, 0.52, 0.66], b: [0.72, 0.83, 0.92], c: [0.20, 0.36, 0.55], sf: 0.14, ss: 0.35, gA: [0.72, 0.78, 0.86], gB: [0.93, 0.95, 0.98], dry: [0.80, 0.86, 0.94], rough: 0.45 },
  { name: 'мшистый сланец', a: [0.09, 0.12, 0.10], b: [0.19, 0.23, 0.17], c: [0.05, 0.07, 0.065], sf: 0.7, ss: 0.55, moss: 1, gA: [0.03, 0.09, 0.02], gB: [0.09, 0.17, 0.035], dry: [0.12, 0.16, 0.05], rough: 0.97 },
  { name: 'вулканическая порода', a: [0.035, 0.03, 0.03], b: [0.10, 0.08, 0.075], c: [0.012, 0.01, 0.01], sf: 0.16, ss: 0.4, vein: [3.0, 0.75, 0.10], gA: [0.045, 0.04, 0.04], gB: [0.09, 0.08, 0.075], dry: [0.13, 0.09, 0.07], rough: 0.85 },
  { name: 'пустыня', a: [0.42, 0.30, 0.17], b: [0.62, 0.47, 0.28], c: [0.33, 0.22, 0.12], sf: 0.38, ss: 0.6, gA: [0.50, 0.31, 0.11], gB: [0.70, 0.46, 0.18], dry: [0.60, 0.38, 0.14], rough: 0.97 },
  { name: 'горы со снегом', a: [0.155, 0.135, 0.12], b: [0.31, 0.28, 0.25], c: [0.085, 0.08, 0.08], sf: 0.21, ss: 0.45, snowY: 150, gA: [0.045, 0.085, 0.022], gB: [0.115, 0.15, 0.045], dry: [0.20, 0.18, 0.085], rough: 0.94 },
  { name: 'обсидиан с жилами', a: [0.018, 0.018, 0.028], b: [0.06, 0.05, 0.085], c: [0.008, 0.008, 0.014], sf: 0.18, ss: 0.3, vein: [0.25, 1.5, 2.3], gA: [0.03, 0.05, 0.05], gB: [0.06, 0.10, 0.09], dry: [0.10, 0.10, 0.12], rough: 0.32 },
];
const v3 = a => `vec3(${a.map(x => x.toFixed(4)).join(',')})`;
function rockMaterial(grassOn, vi) {
  const v = ROCK_VARIANTS[vi];
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: v.rough, metalness: 0.0 });
  m.customProgramCacheKey = () => 'rock3' + grassOn + '_' + vi;
  m.onBeforeCompile = (s) => {
    s.uniforms.uNoise = { value: noiseTex }; s.uniforms.uCloudCol = { value: new THREE.Color(0.86, 0.90, 0.97) };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix*vec4(transformed,1.0)).xyz; vWNrm = normalize(mat3(modelMatrix)*objectNormal);');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm; uniform sampler2D uNoise; uniform vec3 uCloudCol;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wn = normalize(vWNrm);
        vec3 bl = abs(wn); bl = bl*bl; bl /= (bl.x+bl.y+bl.z);
        float n1 = texture2D(uNoise, vWPos.xz/90.0).g*bl.y + texture2D(uNoise, vWPos.xy/90.0).g*bl.z + texture2D(uNoise, vWPos.zy/90.0).g*bl.x;
        float n2 = texture2D(uNoise, vWPos.xz/14.0).g*bl.y + texture2D(uNoise, vWPos.xy/14.0).g*bl.z + texture2D(uNoise, vWPos.zy/14.0).g*bl.x;
        float n3 = texture2D(uNoise, vWPos.xz/340.0).r;
        float strata = 0.5 + 0.5*sin(vWPos.y*${v.sf.toFixed(3)} + n1*${v.col ? '1.5' : '7.0'});
        ${v.col ? 'float cols = 0.5 + 0.5*sin((vWPos.x*0.8 + vWPos.z*0.55)*0.42 + n1*2.5); strata = mix(strata, cols, 0.85*(1.0 - bl.y));' : ''}
        vec3 rockA = ${v3(v.a)}, rockB = ${v3(v.b)}, rockC = ${v3(v.c)};
        vec3 rock = mix(rockA, rockB, smoothstep(0.3,0.75,n1));
        rock = mix(rock, rockC, smoothstep(0.55,0.9,strata)*${v.ss.toFixed(2)});
        rock *= 0.6 + 0.8*n2;
        ${v.moss ? 'rock = mix(rock, vec3(0.05,0.13,0.03)*(0.6+0.8*n2), smoothstep(0.42,0.7,n3)*smoothstep(-0.5,0.4,wn.y)*0.8);' : ''}
        rock *= mix(0.5, 1.0, smoothstep(-0.9, 0.35, wn.y));
        float veinM = 0.0;
        ${v.vein ? 'veinM = smoothstep(0.035, 0.0, abs(n1 - 0.5))*smoothstep(0.25, 0.6, n3 + n2*0.3);' : ''}
        vec3 grassA = ${v3(v.gA)}, grassB = ${v3(v.gB)}, dry = ${v3(v.dry)};
        vec3 grass = mix(grassA, grassB, smoothstep(0.25,0.8,n3));
        grass = mix(grass, dry, smoothstep(0.62,0.9,n1)*0.5);
        grass *= 0.75 + 0.5*n2;
        float gm = smoothstep(0.66, 0.9, wn.y + (n1-0.5)*0.22) * ${grassOn.toFixed(1)};
        diffuseColor.rgb = mix(rock, grass, gm);
        ${v.snowY ? `{ float sn = smoothstep(${v.snowY.toFixed(1)}, ${(v.snowY + 45).toFixed(1)}, vWPos.y + n1*40.0)*smoothstep(0.3, 0.65, wn.y); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.89,0.94)*(0.85+0.3*n2), sn); gm = max(gm, sn); }` : ''}
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float bh = n1*2.4 + n2*1.1; vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(bh), dhy = dFdy(bh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 sg = sign(det)*(dhx*r1 + dhy*r2);
          normal = normalize(abs(det)*normal - (1.0 - gm*0.7)*1.6*sg); }
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${v.vein ? `totalEmissiveRadiance += ${v3(v.vein)}*veinM*(1.0 - gm);` : ''}`)
      .replace('#include <opaque_fragment>', `float ck = smoothstep(38.0, -20.0, vWPos.y); outgoingLight = mix(outgoingLight, uCloudCol*0.95, ck*ck*0.95);\n#include <opaque_fragment>`);
  };
  return m;
}
const ROCKS = ROCK_VARIANTS.map((_, i) => [rockMaterial(1, i), rockMaterial(0, i)]);
const ROCK = ROCKS[0][0], ROCK_BARE = ROCKS[0][1];

// ---------- trees: textured cards ----------
function mergeGeos(list) { let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index.count; } const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni); let o = 0, oi = 0; for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; o += g.attributes.position.count; oi += g.index.count; } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const g255 = v => { const c = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${c},${c},${c})`; };
const firTex = canvasTex(256, 512, (x, w, h) => { const r = rng(11); x.lineCap = 'round';
  x.fillStyle = g255(70); x.fillRect(w / 2 - 5, h * 0.80, 10, h * 0.2);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 1500; i++) { const t = Math.pow(r(), 0.75); const y = h * (0.03 + t * 0.84); const half = 5 + t * 112 * (0.84 + 0.16 * Math.sin(t * 46)); const sx = (r() * 2 - 1); const px = w / 2 + sx * half * 0.9; const len = 10 + r() * 20 + t * 10; const ang = Math.PI / 2 - sx * (0.95 + r() * 0.4);
    const lum = [58, 104, 168][pass] + (r() - 0.5) * 46 - sx * 20 * (pass > 0 ? 1 : 0) - (1 - Math.abs(sx)) * 12; x.strokeStyle = g255(lum); x.lineWidth = [5, 3.4, 2.2][pass]; x.globalAlpha = pass === 2 ? 0.75 : 1; x.beginPath(); x.moveTo(px, y); x.lineTo(px + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.75); x.stroke(); } });
const leafTex = canvasTex(384, 384, (x, w, h) => { const r = rng(23); x.lineCap = 'round';
  x.strokeStyle = g255(62); x.lineWidth = 15; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2 + 4, h * 0.56); x.stroke(); x.lineWidth = 7; for (const [dx, dy] of [[-76, -70], [72, -84], [-24, -116], [36, -40]]) { x.beginPath(); x.moveTo(w / 2 + 2, h * 0.68); x.lineTo(w / 2 + dx, h * 0.6 + dy); x.stroke(); }
  const clumps = [[0.5, 0.36, 0.3], [0.28, 0.46, 0.2], [0.72, 0.44, 0.21], [0.4, 0.22, 0.19], [0.62, 0.24, 0.18], [0.5, 0.54, 0.2], [0.2, 0.34, 0.12], [0.81, 0.31, 0.12]];
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 1700; i++) { const c = clumps[(r() * clumps.length) | 0]; const a = r() * 6.28, d = Math.sqrt(r()) * c[2] * w; const px = c[0] * w + Math.cos(a) * d, py = c[1] * h + Math.sin(a) * d * 0.85; const rel = (py - c[1] * h) / (c[2] * h);
    const lum = [54, 104, 170][pass] + (r() - 0.5) * 50 - rel * 34 - (px / w - 0.5) * 26; if (pass === 2 && rel > 0.15) continue; x.fillStyle = g255(lum); x.globalAlpha = pass === 2 ? 0.8 : 1; x.beginPath(); x.ellipse(px, py, 4 + r() * 5, 2.4 + r() * 3, r() * 3.14, 0, 6.28); x.fill(); } });
const clumpTex = canvasTex(256, 256, (x, w, h) => { const r = rng(37);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 1300; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.6) * w * 0.46 * (0.82 + 0.18 * Math.sin(a * 5)); const px = w / 2 + Math.cos(a) * d, py = h / 2 + Math.sin(a) * d; const rel = (py - h / 2) / (h / 2);
    const lum = [58, 112, 178][pass] + (r() - 0.5) * 52 - rel * 40; if (pass === 2 && rel > 0.2) continue; x.fillStyle = g255(lum); x.globalAlpha = pass === 2 ? 0.8 : 1; x.beginPath(); x.ellipse(px, py, 5 + r() * 6, 3 + r() * 3.5, r() * 3.14, 0, 6.28); x.fill(); } });
// crossed planes, both windings, normals mostly up so foliage lights evenly
function cardGeo(planes, centered) { const pos = [], nor = [], uv = [], idx = []; let b = 0; const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => { pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); for (const [px, pz] of [[ax, az], [bx, bz], [cx, cz], [dx, dz]]) { const l = Math.hypot(px * 0.7, 1, pz * 0.7); nor.push(px * 0.7 / l, 1 / l, pz * 0.7 / l); } uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2); b += 4; };
  const y0 = centered ? -0.5 : 0, y1 = centered ? 0.5 : 1;
  for (let i = 0; i < planes; i++) { const a = i / planes * Math.PI, c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5; quad(-c, y0, -s, c, y0, s, c, y1, s, -c, y1, -s); }
  if (centered) quad(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; }
const CARD_G = cardGeo(3, false), CLUMP_G = cardGeo(2, true);
function foliageMat(map) { return new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, roughness: 1, metalness: 0 }); }
function foliageDepth(map) { return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4 }); }
const FIR_M = foliageMat(firTex), LEAF_M = foliageMat(leafTex), CLUMP_M = foliageMat(clumpTex), FIR_D = foliageDepth(firTex), LEAF_D = foliageDepth(leafTex), CLUMP_D = foliageDepth(clumpTex);
// palettes: [hue, sat, light] ranges for conifers and broadleaf per mood
const TREE_MOODS = {
  summer: { fir: [0.30, 0.05, 0.45, 0.21], leaf: [0.24, 0.08, 0.5, 0.30], firShare: 0.6 },
  autumn: { fir: [0.27, 0.05, 0.4, 0.2], leaf: [0.03, 0.10, 0.8, 0.38], firShare: 0.25 },
  winter: { fir: [0.50, 0.06, 0.16, 0.62], leaf: [0.56, 0.05, 0.10, 0.74], firShare: 0.9 },
  tropic: { fir: [0.33, 0.05, 0.6, 0.22], leaf: [0.29, 0.10, 0.75, 0.33], firShare: 0.12 },
  dark: { fir: [0.38, 0.06, 0.3, 0.13], leaf: [0.30, 0.08, 0.35, 0.17], firShare: 0.7 },
  conifer: { fir: [0.30, 0.05, 0.42, 0.19], leaf: [0.25, 0.07, 0.42, 0.25], firShare: 0.92 },
};

// ---------- island generator ----------
const islands = [];
function makeIsland({ x, y, z, R, hill = 40, depth = 200, seed = 1, trees = 600, peak = 0, collide = false, rock = 0, mood = 'summer', shape = null, noTrees = null, kind = '', set = '', detached = false }) {
  const NR = Math.round(THREE.MathUtils.clamp(R / 4.6, 18, 60)), NS = Math.round(THREE.MathUtils.clamp(R * 0.62, 44, 150)); const o = seed * 37.13; const pos = [], idx = [];
  const outline = th => 1 + 0.26 * fbm3(Math.cos(th) * 1.3 + o, Math.sin(th) * 1.3, o, 4) + 0.07 * perlin3(Math.cos(th) * 5 + o, Math.sin(th) * 5, 1.7);
  const topY = (lx, lz, r) => {
    const edge = THREE.MathUtils.smoothstep(1 - r, 0.0, 0.2);
    let h = 6 + hill * (0.5 + 0.5 * fbm3(lx / (R * 0.7) + o, 0.3, lz / (R * 0.7), 4)) + hill * 0.12 * perlin3(lx / 22 + o, 2.1, lz / 22);
    if (peak) { const d = Math.hypot(lx - R * 0.15, lz + R * 0.1) / (R * 0.42); h += peak * Math.max(0, 1 - d) ** 1.6 * (0.7 + 0.6 * ridged3(lx / 60 + o, 0.5, lz / 60)); }
    if (shape) h = shape(lx, lz, h, r);
    return h * edge + (1 - edge) * -4 * (1 - r) + (shape ? 1.0 : 3.5) * perlin3(lx / 9, o, lz / 9) * edge;
  };
  const botY = (lx, lz, r) => {
    const core = Math.pow(Math.max(0, 1 - r * r), 0.62);
    const rg = ridged3(lx / (R * 0.5) + o, 3.3, lz / (R * 0.5), 4);
    const sp = Math.max(0, perlin3(lx / 34 + o, 7.7, lz / 34)) ** 1.5;
    const cr = ridged3(lx / 26 + o, 1.1, lz / 26, 3);
    return -depth * core * (0.45 + 0.75 * rg + 0.9 * sp) * (0.82 + 0.36 * cr) - (16 + 0.05 * depth) * (1 - r) ** 0.3 * (0.4 + 0.9 * cr) - 2;
  };
  const push = (fn, flip) => {
    const base = pos.length / 3;
    for (let i = 0; i <= NR; i++) { const r = Math.pow(i / NR, 0.8); for (let j = 0; j < NS; j++) { const th = j / NS * Math.PI * 2; const rr = r * R * outline(th); const lx = Math.cos(th) * rr, lz = Math.sin(th) * rr; pos.push(lx, fn(lx, lz, r), lz); } }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = base + i * NS + j, b = base + i * NS + (j + 1) % NS, c = base + (i + 1) * NS + j, d = base + (i + 1) * NS + (j + 1) % NS; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  };
  push(topY, false); push(botY, true);
  // weld rim: bottom rim takes top rim position
  { const top0 = NR * NS, bot0 = (NR + 1) * NS + NR * NS; for (let j = 0; j < NS; j++) { for (let k = 0; k < 3; k++) pos[(bot0 + j) * 3 + k] = pos[(top0 + j) * 3 + k]; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, ROCKS[rock][0]); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; if (!detached) scene.add(mesh);
  // trees
  const rnd = rng(seed * 991); const tsc = R < 70 ? 0.6 : 1; const md = TREE_MOODS[mood];
  const nCon = Math.floor(trees * md.firShare), nBlob = trees - nCon;
  const con = new THREE.InstancedMesh(CARD_G, FIR_M, Math.max(1, nCon)), blob = new THREE.InstancedMesh(CARD_G, LEAF_M, Math.max(1, nBlob)); con.customDepthMaterial = FIR_D; blob.customDepthMaterial = LEAF_D;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0); let ic = 0, ib = 0, guard = 0;
  while ((ic < nCon || ib < nBlob) && guard++ < trees * 40) {
    const r = Math.sqrt(rnd()) * 0.86, th = rnd() * Math.PI * 2; const rr = r * R * outline(th); const lx = Math.cos(th) * rr, lz = Math.sin(th) * rr;
    if (noTrees && noTrees(lx, lz)) continue;
    const dens = fbm3(lx / 70 + o, 9.1, lz / 70, 3); if (dens < -0.08 + rnd() * 0.12) continue;
    const h0 = topY(lx, lz, r), hx = topY(lx + 3, lz, r), hz = topY(lx, lz + 3, r); if (Math.hypot(hx - h0, hz - h0) > 2.6) continue;
    const isCon = (dens + rnd() * 0.3 > 0.22) ? ic < nCon : !(ib < nBlob);
    T.set(lx, h0 - 0.8, lz); Q.setFromAxisAngle(UP, rnd() * 6.28);
    if (isCon && ic < nCon) { const hgt = (15 + rnd() * 13) * tsc; S.set(hgt * 0.52, hgt, hgt * 0.52); M.compose(T, Q, S); con.setMatrixAt(ic, M); const p = md.fir; C.setHSL(p[0] + rnd() * p[1], p[2], p[3] * (0.75 + rnd() * 0.5)); con.setColorAt(ic++, C); }
    else if (ib < nBlob) { const hgt = (12 + rnd() * 10) * tsc; S.set(hgt * 1.05, hgt, hgt * 1.05); M.compose(T, Q, S); blob.setMatrixAt(ib, M); const p = md.leaf; C.setHSL(p[0] + rnd() * p[1], p[2], p[3] * (0.75 + rnd() * 0.5)); blob.setColorAt(ib++, C); }
  }
  con.count = ic; blob.count = ib; for (const t of [con, blob]) { t.position.copy(mesh.position); t.castShadow = false; t.receiveShadow = true; t.instanceMatrix.needsUpdate = true; if (t.instanceColor) t.instanceColor.needsUpdate = true; if (!detached) scene.add(t); }
  const heightAt = (lx, lz) => { const th = Math.atan2(lz, lx); const r = Math.min(1, Math.hypot(lx, lz) / (R * outline(th))); return y + topY(lx, lz, r); };
  // отдельный островок (под маяк или постамент миссии): в общий список не попадает, его ставит и убирает миссия
  if (detached) { const grp = new THREE.Group(); grp.add(mesh, con, blob); return { g: grp, top: heightAt(0, 0), R }; }
  // set — набор миссии: такие острова скрыты, пока миссия их не включит
  if (set) for (const p of [mesh, con, blob]) p.visible = false;
  islands.push({ mesh, R, x, y, z, topY, outline, collide, rock, heightAt, kind, mood, set, parts: [mesh, con, blob], extra: [], off: !!set });
  return mesh;
}
const spires = [];
function makeSpire({ x, z, h, r, seed, rock = 0 }) {
  const g = new THREE.CylinderGeometry(r * 0.16, r, h, 44, 70, false); const p = g.attributes.position; const o = seed * 11.7;
  for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i); const t = (py + h / 2) / h; const rad = Math.hypot(px, pz) || 1e-3; const nrm = 1 + 0.42 * fbm3(px / 40 + o, py / 55, pz / 40, 4) + 0.16 * ridged3(px / 14, py / 9 + o, pz / 14, 3) + 0.10 * Math.sin(py * 0.16 + o) * (1 - t); const k = nrm * (1 + 0.25 * (1 - t) ** 2); p.setXYZ(i, px * k + 12 * perlin3(o, py / 90, 1.3), py, pz * k + 12 * perlin3(2.2, py / 90, o)); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, ROCKS[rock][1]); m.position.set(x, h / 2 - 150, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); spires.push({ x, z, r: r * 0.62, mesh: m, rock }); return m;
}

export { ridged3, hemi, HAZE, ROCKS, ROCK_VARIANTS, CARD_G, CLUMP_G, CLUMP_M, CLUMP_D, THREE, scene, camera, renderer, canvas, sunDir, sun, cloud, cloudMat, sky, noiseTex, islands, spires, makeIsland, makeSpire, rng, perlin3, fbm3, STILL, vortex, mergeGeos, ROCK, ROCK_BARE };
