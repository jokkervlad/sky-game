// Звуки игры. Всё синтезируется в браузере (Web Audio), без файлов: ничего не скачивается и нет лицензий.
// Каждый звук — набор слоёв (тон, шум, фильтр, огибающая). У каждого оружия, устройства, навыка, моба и босса свой голос,
// плюс случайный разброс высоты, чтобы повторы не звучали одинаково. Громкость и панорама — по положению на экране.
// M — включить или выключить звук.

let ac = null, master = null, comp = null, noiseBuf = null, verb = null, muteEx = 0, on = true, vol = 0.7;
let cam = null, lx = 0, lz = 0, live = 0;
const last = new Map();                 // ключ → время последнего запуска (чтобы не было каши)
const MAXV = 28;                        // не больше стольких звуков разом
try { const s = localStorage.getItem('sky-sfx'); if (s) { const o = JSON.parse(s); on = o.on !== false; vol = o.vol ?? vol; } } catch (e) {}

function init() { if (ac) return ac; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  ac = new C(); comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ac.createGain(); master.gain.value = on ? vol : 0; master.connect(comp); comp.connect(ac.destination);
  // эхо пространства: искусственный отклик неба (стерео-шум с затуханием), чтобы звуки не были «сухими»
  { const len = ac.sampleRate * 2.6, ir = ac.createBuffer(2, len, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 600 ? i / 600 : 1); } }
    verb = ac.createConvolver(); verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.55; const vf = ac.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 5200; verb.connect(vf); vf.connect(vg); vg.connect(master); }
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ac; }
const unlock = () => { if (init() && ac.state !== 'running') ac.resume(); };
addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);

const R = (a, b) => a + Math.random() * (b - a);
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// один слой: osc — тон (sine/square/sawtooth/triangle), noise — шум; f0→f1 — скольжение частоты; lp/hp/bp — фильтр со скольжением
function layer(out, t, o) {
  const dur = o.d || 0.3, a = o.a ?? 0.005, g = ac.createGain(); let src, filt = null;
  if (o.n) { src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1; }
  else { src = ac.createOscillator(); src.type = o.w || 'sine'; src.frequency.setValueAtTime(o.f0, t); if (o.f1) src.frequency.exponentialRampToValueAtTime(Math.max(8, o.f1), t + (o.fd || dur));
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vd || o.f0 * 0.05; l.connect(lg); lg.connect(src.frequency); l.start(t); l.stop(t + dur + 0.05); } }
  if (o.ft) { filt = ac.createBiquadFilter(); filt.type = o.ft; filt.Q.value = o.q || 1; filt.frequency.setValueAtTime(o.c0 || 1000, t); if (o.c1) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.c1), t + dur); src.connect(filt); filt.connect(g); }
  else src.connect(g);
  const v = o.v ?? 0.5; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
  if (o.hold) g.gain.setValueAtTime(v, t + a + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(out);
  src.start(t + (o.at || 0)); src.stop(t + dur + 0.05);
}
// громкость и панорама по положению: точка проецируется на экран, слышно примерно до 1500
function where(x, z) { if (x == null || !cam) return [1, 0]; const d = Math.hypot(x - lx, z - lz); const k = Math.max(0, 1 - d / 1500); if (k <= 0) return [0, 0];
  let p = 0; try { const v = { x, y: 36, z }; const e = cam.matrixWorldInverse.elements; const vx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], vz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]; p = Math.max(-1, Math.min(1, vx / Math.max(60, Math.abs(vz)) * 0.9)); } catch (e) {}
  return [k * k * 0.85 + 0.15 * (d < 60 ? 1 : 0), p]; }
function play(key, layers, o = {}) {
  if (!on || !ac || ac.state !== 'running' || live >= MAXV) return;
  const now = ac.currentTime, gap = o.gap ?? 0.045, lk = last.get(key) || -1; if (now - lk < gap) return; last.set(key, now);
  const [k, p] = where(o.x, o.z); const v = (o.v ?? 1) * k; if (v < 0.015) return;
  const bus = ac.createGain(); bus.gain.value = v; const pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.value = p; bus.connect(pan); pan.connect(master); } else bus.connect(master);
  if (verb) { const sg = ac.createGain(); sg.gain.value = o.rev ?? 0.28; bus.connect(sg); sg.connect(verb); setTimeout(() => { try { sg.disconnect(); } catch (e) {} }, (3.2 + 0.3) * 1000 + 2000); }
  const sh = o.pitch ?? R(0.93, 1.07); let end = 0;
  for (const L of layers) { const q = Object.assign({}, L); if (q.f0) q.f0 *= sh; if (q.f1) q.f1 *= sh; if (q.c0 && !q.n) q.c0 *= sh; if (q.n && q.rate) q.rate *= sh; layer(bus, now + (L.at || 0), q); end = Math.max(end, (L.at || 0) + (L.d || 0.3)); }
  live++; setTimeout(() => { live--; try { bus.disconnect(); } catch (e) {} }, (end + 2.9) * 1000);
}

// ---------- кирпичики ----------
const boom = (f, d, v = 0.9) => [{ w: 'sine', f0: f * 2.2, f1: f * 0.5, d, v }, { n: 1, ft: 'lowpass', c0: f * 30, c1: f * 3, d: d * 1.2, v: v * 0.8 }];
const zap = (f, d, v = 0.4) => [{ w: 'sawtooth', f0: f, f1: f * 0.4, d, v: v * 0.5, ft: 'bandpass', c0: f * 3, q: 3 }, { n: 1, ft: 'highpass', c0: 2500, d: d * 0.8, v: v * 0.5, rate: 1.6 }];
const whoosh = (c0, c1, d, v = 0.5) => [{ n: 1, ft: 'bandpass', c0, c1, q: 1.4, d, a: d * 0.35, v }];
// россыпь мелких щелчков: осколки, камешки, искры
const debris = (n, t0, span, c = 2500, v = 0.12) => Array.from({ length: n }, () => ({ n: 1, ft: 'bandpass', c0: c * R(0.6, 1.6), q: 6, d: R(0.03, 0.08), v: v * R(0.4, 1), at: t0 + Math.random() * span, rate: R(0.8, 1.5) }));
// хор: несколько слегка расстроенных голосов вместо одного — звук «толще» и живее
const chorus = (L, n = 3, det = 0.012) => Array.from({ length: n }, (_, i) => L.map(l => ({ ...l, f0: l.f0 && l.f0 * (1 + (i - (n - 1) / 2) * det), f1: l.f1 && l.f1 * (1 + (i - (n - 1) / 2) * det), v: (l.v ?? 0.5) / Math.sqrt(n) }))).flat();
const chime = (f, d = 0.9, v = 0.3) => [{ w: 'sine', f0: f, d, v }, { w: 'sine', f0: f * 2.01, d: d * 0.7, v: v * 0.35 }, { w: 'triangle', f0: f * 3.02, d: d * 0.4, v: v * 0.15 }];

// ---------- оружие ----------
// разрывы снарядов: у каждого оружия свой
const IMPACT = {
  // ядро пушки: сухой металлический удар, короткий гул и звон обшивки
  'W-1': () => [{ n: 1, ft: 'highpass', c0: 1800, d: 0.06, v: 0.55, rate: 0.9 }, { w: 'triangle', f0: 190, f1: 70, d: 0.28, v: 0.45 }, { n: 1, ft: 'lowpass', c0: 2200, c1: 300, d: 0.35, v: 0.45 }, { w: 'sine', f0: 1240, d: 0.5, v: 0.05, at: 0.01, vib: 9, vd: 8 }, { w: 'sine', f0: 1873, d: 0.35, v: 0.035, at: 0.01 }, ...debris(5, 0.04, 0.25, 3200, 0.07)],
  // ракета: резкий хлопок, огненный «вздох» и треск догорающего топлива
  'W-2': () => [{ n: 1, ft: 'highpass', c0: 900, d: 0.05, v: 0.8 }, ...boom(58, 0.9, 1), { n: 1, ft: 'bandpass', c0: 700, c1: 200, q: 0.8, d: 1.1, a: 0.04, v: 0.45, rate: 0.6 }, { w: 'sawtooth', f0: 95, f1: 40, d: 0.6, v: 0.12, ft: 'lowpass', c0: 500 }, ...debris(12, 0.15, 0.9, 1800, 0.08)],
  // мортира: тяжёлый глубокий разрыв, раскат и осыпающиеся обломки
  'W-3': () => [...boom(34, 1.6, 1.25), { n: 1, ft: 'lowpass', c0: 450, c1: 60, d: 2.2, a: 0.05, v: 0.7, rate: 0.35 }, { w: 'sine', f0: 48, f1: 26, d: 1.8, v: 0.5 }, { n: 1, ft: 'bandpass', c0: 900, c1: 250, q: 1.2, d: 1.4, v: 0.25, at: 0.25, a: 0.2 }, ...debris(18, 0.4, 1.4, 1400, 0.09)],
};
const WPN = {
                                         // пушки: четыре выстрела бортом


  'W-4': () => [{ w: 'square', f0: 220, f1: 90, d: 0.22, v: 0.25, ft: 'lowpass', c0: 1800 }, { w: 'sine', f0: 420, f1: 380, d: 0.6, v: 0.2, vib: 28, vd: 20 }, { n: 1, ft: 'highpass', c0: 3000, d: 0.12, v: 0.3 }], // гарпун: щелчок и звон троса
  'W-6': () => [...zap(140, 0.5, 0.6), { w: 'square', f0: 60, d: 0.45, v: 0.18, ft: 'lowpass', c0: 900, vib: 50, vd: 30 }],                                     // тесла-дуга: треск
  'W-7': () => [{ n: 1, ft: 'lowpass', c0: 5000, c1: 400, d: 0.45, v: 0.9 }, ...boom(85, 0.3, 0.7), { n: 1, ft: 'highpass', c0: 4000, d: 0.08, v: 0.4, rate: 0.7 }],   // картечница: рваный залп
};
// ---------- устройства (у каждого свой звук) ----------
const DEV = {
  'EQ-01': () => zap(90, 0.7, 0.8),
  'EQ-02': () => [...boom(40, 1.1, 1), ...whoosh(300, 2500, 0.6, 0.5)],
  'EQ-03': () => [{ n: 1, ft: 'lowpass', c0: 1600, c1: 300, d: 1.6, a: 0.1, v: 0.6, rate: 0.6 }, { w: 'sine', f0: 120, f1: 70, d: 0.3, v: 0.3 }],
  'EQ-04': () => [...boom(70, 0.6, 0.6), ...chime(1700, 1.2, 0.18), { n: 1, ft: 'highpass', c0: 6000, d: 0.9, v: 0.25, at: 0.05 }],
  'EQ-05': () => [{ w: 'square', f0: 880, d: 0.06, v: 0.15 }, { w: 'square', f0: 880, d: 0.06, v: 0.15, at: 0.15 }, { w: 'sine', f0: 55, f1: 110, d: 0.7, v: 0.3, vib: 9, vd: 12 }],
  'EQ-06': () => [{ w: 'sine', f0: 400, f1: 40, d: 1.4, v: 0.5 }, { n: 1, ft: 'bandpass', c0: 2000, c1: 120, q: 3, d: 1.4, v: 0.4 }],
  'EQ-07': () => [{ n: 1, ft: 'bandpass', c0: 600, c1: 4000, q: 1.5, d: 0.6, v: 0.4 }, { w: 'sine', f0: 1400, f1: 2200, d: 0.4, v: 0.08, at: 0.5 }, { n: 1, ft: 'highpass', c0: 3500, d: 1.4, v: 0.15, at: 0.55, a: 0.2 }],
  'EQ-08': () => [{ n: 1, ft: 'lowpass', c0: 900, d: 1.2, a: 0.15, v: 0.55, rate: 0.5 }, { w: 'sawtooth', f0: 70, d: 1.0, v: 0.1, ft: 'lowpass', c0: 300 }],
  'EQ-09': () => [...chime(990, 0.8, 0.25), ...chime(1320, 0.8, 0.18).map(l => ({ ...l, at: 0.06 })), { w: 'sine', f0: 200, f1: 600, d: 0.3, v: 0.2 }],
  'EQ-10': () => [{ w: 'sine', f0: 700, f1: 1100, d: 0.25, v: 0.2, vib: 14, vd: 60 }, { w: 'sine', f0: 900, f1: 600, d: 0.35, v: 0.2, at: 0.28, vib: 14, vd: 60 }],
  'EQ-11': () => [{ w: 'square', f0: 1200, d: 0.08, v: 0.12 }, { w: 'square', f0: 1600, d: 0.08, v: 0.12, at: 0.12 }, ...zap(220, 0.5, 0.4).map(l => ({ ...l, at: 0.2 }))],
  'EQ-12': () => [{ w: 'square', f0: 140, f1: 70, d: 0.15, v: 0.25, ft: 'lowpass', c0: 900 }, { w: 'square', f0: 120, f1: 60, d: 0.15, v: 0.25, at: 0.18, ft: 'lowpass', c0: 900 }, ...boom(60, 0.6, 0.6).map(l => ({ ...l, at: 0.35 }))],
  'EQ-13': () => [{ n: 1, ft: 'highpass', c0: 2500, d: 0.9, a: 0.02, v: 0.18, rate: 1.4 }, { w: 'square', f0: 3000, d: 0.02, v: 0.05, at: 0.1 }],     // фитиль; взрыв — отдельно
  'EQ-14': () => [{ w: 'sawtooth', f0: 210, d: 1.4, v: 0.15, vib: 31, vd: 25, ft: 'bandpass', c0: 800, q: 2 }, { w: 'sawtooth', f0: 260, d: 1.2, v: 0.1, vib: 37, vd: 30, at: 0.1, ft: 'bandpass', c0: 1000, q: 2 }, { n: 1, ft: 'bandpass', c0: 1800, q: 5, d: 1.3, v: 0.15 }],
  'EQ-15': () => [{ w: 'sawtooth', f0: 90, f1: 380, d: 0.9, v: 0.25, ft: 'lowpass', c0: 600, c1: 3000 }, ...whoosh(400, 3000, 0.9, 0.4)],
  'EQ-16': () => [{ w: 'square', f0: 70, d: 0.9, v: 0.15, vib: 22, vd: 15, ft: 'lowpass', c0: 700 }, { n: 1, ft: 'bandpass', c0: 3000, q: 8, d: 0.9, v: 0.15 }, { w: 'triangle', f0: 600, f1: 300, d: 0.15, v: 0.2 }],
  'EQ-17': () => [{ w: 'square', f0: 900, d: 0.05, v: 0.12 }, { w: 'square', f0: 700, d: 0.05, v: 0.12, at: 0.12 }, { w: 'square', f0: 1100, d: 0.05, v: 0.12, at: 0.24 }, ...chime(660, 0.7, 0.2).map(l => ({ ...l, at: 0.32 }))],
};
// ---------- навыки: голос по характеру навыка ----------
const SK_KIND = { 'S-01': 'gun', 'S-02': 'heavy', 'S-03': 'mark', 'S-04': 'shield', 'S-05': 'engine', 'S-06': 'buff', 'S-07': 'beam', 'S-08': 'heal', 'S-09': 'drone', 'S-10': 'wind', 'S-11': 'net', 'S-12': 'scan', 'S-13': 'storm', 'S-14': 'ice', 'S-15': 'zap', 'S-16': 'rockets', 'S-17': 'mark', 'S-18': 'shield', 'S-19': 'anchor', 'S-20': 'foam', 'S-21': 'heal', 'S-22': 'drone', 'S-23': 'engine', 'S-24': 'decoy', 'S-25': 'blink', 'S-26': 'wind', 'S-27': 'acid', 'S-28': 'flash', 'S-29': 'mine', 'S-30': 'horn', 'S-31': 'rockets', 'S-32': 'heavy', 'S-33': 'dive', 'S-34': 'gamble', 'S-35': 'ram', 'S-36': 'reload', 'S-37': 'turn', 'S-38': 'buff' };
const SKV = {
  // беглый огонь: частая дробь залпов с эхом
  gun: p => [0, 0.07, 0.13, 0.2, 0.26, 0.33].flatMap((t, i) => [...boom(R(80, 100) * p, 0.3, 0.45), { n: 1, ft: 'highpass', c0: 2500, d: 0.04, v: 0.3 }].map(l => ({ ...l, at: t }))).concat(debris(6, 0.1, 0.5, 3000, 0.05)),
  // тяжёлый залп / бронебойный / артиллерия: взвод, пауза, мощный удар с раскатом
  heavy: p => [{ w: 'square', f0: 220, d: 0.04, v: 0.12 }, { n: 1, ft: 'bandpass', c0: 2500, q: 5, d: 0.08, v: 0.25, at: 0.04 }, ...boom(40 * p, 1.4, 1.1).map(l => ({ ...l, at: 0.18 })), { n: 1, ft: 'lowpass', c0: 400, c1: 60, d: 1.8, v: 0.5, at: 0.2, rate: 0.35 }, { w: 'sawtooth', f0: 82 * p, f1: 41, d: 1.1, v: 0.15, ft: 'lowpass', c0: 500, at: 0.18 }],
  // метка / точный расчёт: звонкий прицельный писк с отзвуком
  mark: p => [...chime(1568 * p, 0.25, 0.18), ...chime(2093 * p, 0.9, 0.2).map(l => ({ ...l, at: 0.12 })), { w: 'sine', f0: 3000 * p, f1: 4200 * p, d: 0.15, v: 0.05, at: 0.12 }],
  // заслон / зеркало: поднимается гудящий купол, мажорный звон
  shield: p => [...chorus([{ w: 'sine', f0: 130 * p, f1: 196 * p, fd: 0.4, d: 1.4, a: 0.15, v: 0.35 }]), ...chorus([{ w: 'triangle', f0: 392 * p, d: 1.3, a: 0.2, v: 0.12 }]), ...chime(784 * p, 1.4, 0.14).map(l => ({ ...l, at: 0.3 })), ...chime(988 * p, 1.4, 0.1).map(l => ({ ...l, at: 0.38 })), ...whoosh(400, 2200, 0.6, 0.25)],
  // рёв двигателей / форсаж: нарастающий рык турбины и рывок воздуха
  engine: p => [...chorus([{ w: 'sawtooth', f0: 55 * p, f1: 165 * p, d: 1.3, a: 0.2, v: 0.35, ft: 'lowpass', c0: 400, c1: 2400 }], 3, 0.02), { n: 1, ft: 'bandpass', c0: 300, c1: 3500, q: 1, d: 1.3, a: 0.3, v: 0.45 }, { w: 'sine', f0: 900 * p, f1: 2400 * p, d: 1.1, a: 0.5, v: 0.05 }],
  // стальная воля / бронеботы: торжественный мажорный аккорд и металлический удар
  buff: p => [...boom(70 * p, 0.4, 0.4), ...[262, 330, 392, 523].flatMap((f, i) => chorus([{ w: 'triangle', f0: f * p, d: 1.3, a: 0.05, v: 0.2, at: i * 0.06 }], 2, 0.006)), { n: 1, ft: 'bandpass', c0: 2400, q: 12, d: 1, v: 0.15 }],
  // сварочный луч: шипение дуги с потрескиванием
  beam: p => [{ w: 'sawtooth', f0: 220 * p, d: 1.4, v: 0.12, vib: 47, vd: 30, ft: 'bandpass', c0: 1700, q: 5 }, { n: 1, ft: 'highpass', c0: 4500, d: 1.4, a: 0.05, v: 0.25, rate: 1.4 }, ...debris(16, 0.05, 1.3, 5000, 0.07)],
  // ремонт / перелив: тёплое восходящее арпеджио с переливом
  heal: p => [523, 659, 784, 1046, 1318].flatMap((f, i) => chorus([{ w: 'sine', f0: f * p, d: 1.1, v: 0.16, at: i * 0.07 }], 2, 0.004)).concat([{ n: 1, ft: 'highpass', c0: 6000, d: 1.2, a: 0.3, v: 0.06 }]),
  // ремонтный дрон / турель: механический взвод, жужжание сервоприводов
  drone: p => [{ w: 'square', f0: 900 * p, d: 0.04, v: 0.12 }, { w: 'square', f0: 1200 * p, d: 0.04, v: 0.12, at: 0.08 }, { w: 'sawtooth', f0: 180 * p, f1: 320 * p, d: 0.7, v: 0.12, vib: 55, vd: 12, ft: 'bandpass', c0: 1400, q: 3, at: 0.12 }, { n: 1, ft: 'bandpass', c0: 2800, q: 8, d: 0.6, v: 0.12, at: 0.12 }, ...chime(1318 * p, 0.5, 0.1).map(l => ({ ...l, at: 0.75 }))],
  // попутный ветер / вихрь: порыв, закручивающийся по высоте
  wind: p => [{ n: 1, ft: 'bandpass', c0: 250 * p, c1: 1800 * p, q: 2.5, d: 1.6, a: 0.5, v: 0.55 }, { n: 1, ft: 'bandpass', c0: 1400 * p, c1: 400, q: 4, d: 1.4, a: 0.4, v: 0.3, at: 0.2 }, { w: 'sine', f0: 600 * p, f1: 900 * p, d: 1.2, a: 0.5, v: 0.04, vib: 3, vd: 80 }],
  // сеть: выстрел пружины и разворачивающаяся сетка
  net: p => [{ n: 1, ft: 'bandpass', c0: 1800, q: 3, d: 0.06, v: 0.5 }, { w: 'triangle', f0: 280 * p, f1: 140, d: 0.2, v: 0.25 }, ...whoosh(2200 * p, 600, 0.45, 0.35), ...debris(8, 0.3, 0.3, 1200, 0.07)],
  // разведзонд: пуск и мерные посылки сонара
  scan: p => [...whoosh(800, 3000, 0.3, 0.3), ...[0.3, 0.8, 1.3].flatMap(t => chime(1760 * p, 0.6, 0.12).map(l => ({ ...l, at: t })))],
  // гроза: тяжёлый гром и треск разряда
  storm: p => [...zap(180 * p, 0.35, 0.6), { n: 1, ft: 'lowpass', c0: 800, c1: 80, d: 2.4, a: 0.08, v: 0.9, rate: 0.3, at: 0.1 }, ...boom(32 * p, 1.8, 0.7).map(l => ({ ...l, at: 0.15 })), ...debris(10, 0.05, 0.4, 5000, 0.09)],
  // ледяной туман: хрустальный перезвон и холодный шелест
  ice: p => [{ n: 1, ft: 'highpass', c0: 4000, d: 1.6, a: 0.3, v: 0.25 }, ...[2093, 2637, 3136, 2349, 2794].flatMap((f, i) => chime(f * p, 1.2, 0.07).map(l => ({ ...l, at: i * 0.09 }))), { w: 'sine', f0: 200 * p, f1: 120, d: 1.4, a: 0.3, v: 0.12 }],
  // цепная молния: удары, перескакивающие всё выше
  zap: p => [0, 0.09, 0.17, 0.24, 0.3].flatMap((t, i) => zap((180 + i * 90) * p, 0.2, 0.5).map(l => ({ ...l, at: t }))).concat(boom(60, 0.5, 0.4)),
  // шквал ракет / ракетный удар: очередь пусков со свистом
  rockets: p => [0, 0.11, 0.2, 0.32, 0.41, 0.52].flatMap(t => [{ n: 1, ft: 'bandpass', c0: 900 * p, c1: 3800, q: 2, d: 0.5, a: 0.03, v: 0.3, at: t }, { w: 'sine', f0: 1800 * p, f1: 900, d: 0.4, v: 0.04, at: t }]),
  // якорь: лязг цепи и тяжёлый удар
  anchor: p => [...debris(14, 0, 0.5, 3500, 0.1), ...boom(40 * p, 1, 0.9).map(l => ({ ...l, at: 0.5 })), { n: 1, ft: 'bandpass', c0: 1100, q: 20, d: 1.4, v: 0.18, at: 0.5 }, { n: 1, ft: 'bandpass', c0: 1650, q: 20, d: 1.1, v: 0.12, at: 0.5 }],
  // аварийная пена: шипение баллона и лопающиеся пузыри
  foam: p => [{ n: 1, ft: 'highpass', c0: 2500, d: 1.2, a: 0.03, v: 0.35, rate: 1.2 }, ...Array.from({ length: 12 }, () => ({ w: 'sine', f0: R(400, 1000) * p, f1: R(1200, 2000), d: 0.06, v: 0.1, at: R(0.1, 1.1) }))],
  // обманка: призрачный двойник — эхо-голос, расходящийся в стороны
  decoy: p => [...chorus([{ w: 'triangle', f0: 440 * p, f1: 466 * p, d: 1.1, a: 0.1, v: 0.18, vib: 5, vd: 6 }], 4, 0.02), { n: 1, ft: 'bandpass', c0: 1500, q: 8, d: 1, a: 0.3, v: 0.12 }],
  // прыжок: сжатие, щелчок перехода и отзвук
  blink: p => [{ w: 'sine', f0: 200 * p, f1: 3000 * p, d: 0.18, v: 0.3 }, { n: 1, ft: 'highpass', c0: 3000, d: 0.04, v: 0.5, at: 0.18 }, { w: 'sine', f0: 1500 * p, f1: 300 * p, d: 0.5, v: 0.2, at: 0.2 }, ...chime(1175 * p, 0.6, 0.08).map(l => ({ ...l, at: 0.22 }))],
  // кислотный дождь: шипящие капли
  acid: p => [{ n: 1, ft: 'bandpass', c0: 3000, q: 1, d: 1.8, a: 0.4, v: 0.2 }, ...Array.from({ length: 18 }, () => ({ n: 1, ft: 'bandpass', c0: R(2000, 5000), q: 8, d: R(0.05, 0.15), v: 0.1, at: R(0, 1.6) }))],
  // вспышка: хлопок магния и звон в ушах
  flash: p => [{ n: 1, ft: 'highpass', c0: 1500, d: 0.15, v: 0.8 }, ...boom(90, 0.25, 0.4), { w: 'sine', f0: 3520 * p, d: 1.6, a: 0.05, v: 0.06 }],
  // мина-ловушка: три постановки с щелчком взвода
  mine: p => [0, 0.22, 0.44].flatMap(t => [{ w: 'triangle', f0: 160 * p, f1: 90, d: 0.15, v: 0.3, at: t }, { w: 'square', f0: 2400 * p, d: 0.02, v: 0.08, at: t + 0.1 }]),
  // боевой клич: два рога в квинту с нарастанием и барабан
  horn: p => [...chorus([{ w: 'sawtooth', f0: 147 * p, d: 1.4, a: 0.15, v: 0.25, ft: 'lowpass', c0: 900 }], 3, 0.008), ...chorus([{ w: 'sawtooth', f0: 220 * p, d: 1.3, a: 0.2, v: 0.18, ft: 'lowpass', c0: 1100, at: 0.15 }], 3, 0.008), ...boom(55, 0.4, 0.6), ...boom(55, 0.4, 0.5).map(l => ({ ...l, at: 0.3 }))],
  // уход под облака: погружение в вату, гул глубины
  dive: p => [{ n: 1, ft: 'lowpass', c0: 2500, c1: 150, d: 1.6, v: 0.55 }, { w: 'sine', f0: 220 * p, f1: 55, d: 1.5, v: 0.25 }, ...chorus([{ w: 'sine', f0: 110 * p, d: 1.8, a: 0.6, v: 0.12, at: 0.4 }])],
  // гамбит: раскрутка рулетки и щелчок
  gamble: p => Array.from({ length: 10 }, (_, i) => ({ w: 'triangle', f0: (i % 2 ? 1318 : 988) * p, d: 0.05, v: 0.14, at: Math.pow(i / 10, 1.6) * 0.9 })).concat(chime(1568 * p, 0.8, 0.15).map(l => ({ ...l, at: 1 }))),
  // удар быка: разгон, рёв и таранный удар
  ram: p => [{ w: 'sawtooth', f0: 70 * p, f1: 140, d: 0.4, v: 0.2, ft: 'lowpass', c0: 800 }, ...whoosh(300, 2400, 0.4, 0.5), ...boom(42 * p, 0.9, 1.1).map(l => ({ ...l, at: 0.35 })), ...debris(10, 0.38, 0.5, 2000, 0.1)],
  // тактический залп: быстрая перезарядка всех стволов
  reload: p => [0, 0.08, 0.16, 0.24].flatMap(t => [{ n: 1, ft: 'bandpass', c0: 3200, q: 6, d: 0.05, v: 0.3, at: t }, { w: 'square', f0: 260 * p, d: 0.04, v: 0.1, at: t + 0.03 }]).concat(chime(1046 * p, 0.6, 0.12).map(l => ({ ...l, at: 0.34 }))),
  // разворот: свист воздуха по дуге
  turn: p => [{ n: 1, ft: 'bandpass', c0: 2400 * p, c1: 500, q: 3, d: 0.5, a: 0.1, v: 0.45 }, { w: 'sine', f0: 900 * p, f1: 500, d: 0.4, v: 0.05 }],
};
// ---------- мобы: семейство голоса и его высота ----------
const MOBV = { 'MOB-01': ['buzz', 1.6], 'MOB-02': ['buzz', 1.1], 'MOB-03': ['squelch', 1], 'MOB-04': ['buzz', 2.1], 'MOB-05': ['flap', 1.4], 'MOB-06': ['ghost', 1], 'MOB-07': ['screech', 1.5],
  'MOB-08': ['crystal', 1], 'MOB-09': ['flap', 0.9], 'MOB-10': ['crystal', 1.5], 'MOB-11': ['click', 1], 'MOB-12': ['metal', 1], 'MOB-13': ['buzz', 0.6], 'MOB-14': ['metal', 0.8], 'MOB-15': ['squelch', 0.6],
  'MOB-16': ['rock', 1.2], 'MOB-17': ['rock', 0.7], 'MOB-18': ['whale', 1], 'MOB-19': ['metal', 0.55], 'MOB-20': ['hiss', 0.8], 'MOB-21': ['ghost', 1.5], 'MOB-22': ['ghost', 0.7], 'MOB-23': ['squelch', 1.4],
  'MOB-24': ['click', 1.6], 'MOB-25': ['squelch', 0.85], 'MOB-26': ['crystal', 0.6], 'MOB-27': ['screech', 0.8] };
const FAM = {   // выстрел, укус/удар, крик (агрессия/смерть)
  buzz: [p => [{ w: 'sawtooth', f0: 400 * p, f1: 250 * p, d: 0.18, v: 0.18, vib: 70, vd: 40, ft: 'bandpass', c0: 1500 * p, q: 3 }], p => [{ w: 'sawtooth', f0: 220 * p, d: 0.25, v: 0.25, vib: 90, vd: 60, ft: 'lowpass', c0: 2000 }], p => [{ w: 'sawtooth', f0: 300 * p, f1: 120 * p, d: 0.5, v: 0.2, vib: 80, vd: 80, ft: 'bandpass', c0: 1400, q: 2 }]],
  squelch: [p => [{ n: 1, ft: 'bandpass', c0: 700 * p, c1: 250, q: 5, d: 0.25, v: 0.4 }], p => [{ w: 'sine', f0: 180 * p, f1: 90, d: 0.2, v: 0.4 }, { n: 1, ft: 'lowpass', c0: 900, d: 0.25, v: 0.3, rate: 0.5 }], p => [{ w: 'sine', f0: 160 * p, f1: 60, d: 0.6, v: 0.3, vib: 12, vd: 30 }]],
  flap: [p => [...whoosh(800 * p, 2200 * p, 0.25, 0.3), { w: 'sine', f0: 900 * p, f1: 500 * p, d: 0.15, v: 0.12 }], p => [0, 0.12].flatMap(t => whoosh(300 * p, 900, 0.14, 0.4).map(l => ({ ...l, at: t }))), p => [{ w: 'sine', f0: 700 * p, f1: 300 * p, d: 0.7, v: 0.18, vib: 7, vd: 50 }]],
  ghost: [p => [{ w: 'sine', f0: 500 * p, f1: 800 * p, d: 0.4, v: 0.18, vib: 5, vd: 30 }], p => [{ w: 'triangle', f0: 250 * p, f1: 150, d: 0.5, v: 0.2, vib: 4, vd: 20 }], p => [{ w: 'sine', f0: 330 * p, f1: 180 * p, d: 1.2, v: 0.2, vib: 3, vd: 25 }, { n: 1, ft: 'bandpass', c0: 900 * p, q: 6, d: 1.2, a: 0.4, v: 0.12 }]],
  screech: [p => [{ w: 'square', f0: 1400 * p, f1: 900 * p, d: 0.15, v: 0.1, ft: 'bandpass', c0: 2500, q: 3 }], p => [{ w: 'sawtooth', f0: 900 * p, f1: 500, d: 0.2, v: 0.15, ft: 'bandpass', c0: 2000, q: 2 }], p => [{ w: 'sawtooth', f0: 1600 * p, f1: 700 * p, d: 0.5, v: 0.15, vib: 25, vd: 120, ft: 'bandpass', c0: 2500, q: 2 }]],
  crystal: [p => [...chime(1300 * p, 0.35, 0.18), ...zap(400 * p, 0.15, 0.2)], p => chime(700 * p, 0.4, 0.25), p => [0, 0.05, 0.1, 0.16].flatMap(t => chime(R(1500, 2600) * p, 0.5, 0.1).map(l => ({ ...l, at: t })))],
  click: [p => [0, 0.05, 0.1].map(t => ({ w: 'square', f0: 2200 * p, d: 0.02, v: 0.12, at: t })), p => [{ n: 1, ft: 'bandpass', c0: 3000 * p, q: 6, d: 0.1, v: 0.35 }, { w: 'square', f0: 400 * p, d: 0.04, v: 0.15 }], p => [0, 0.04, 0.08, 0.12, 0.16].map(t => ({ w: 'square', f0: 1500 * p, d: 0.02, v: 0.12, at: t }))],
  metal: [p => boom(90 * p, 0.35, 0.6), p => [{ n: 1, ft: 'bandpass', c0: 1800 * p, q: 8, d: 0.4, v: 0.35 }, ...boom(70, 0.3, 0.4)], p => [{ w: 'sawtooth', f0: 80 * p, f1: 50, d: 1.0, v: 0.25, ft: 'lowpass', c0: 600 }, { n: 1, ft: 'bandpass', c0: 1200 * p, q: 10, d: 1, v: 0.15 }]],
  rock: [p => [...boom(55 * p, 0.5, 0.7), { n: 1, ft: 'lowpass', c0: 1200, d: 0.4, v: 0.4, rate: 0.4 }], p => boom(38 * p, 0.7, 1), p => [{ n: 1, ft: 'lowpass', c0: 700, c1: 150, d: 1.4, v: 0.7, rate: 0.35 }, { w: 'sine', f0: 50 * p, f1: 30, d: 1.2, v: 0.4 }]],
  whale: [p => [{ w: 'sine', f0: 220 * p, f1: 160 * p, d: 0.6, v: 0.3, vib: 4, vd: 10 }], p => boom(35 * p, 0.9, 0.8), p => [{ w: 'sine', f0: 180 * p, f1: 420 * p, fd: 0.8, d: 2, a: 0.3, v: 0.35, vib: 3, vd: 8 }, { w: 'sine', f0: 270 * p, f1: 630 * p, fd: 0.8, d: 2, a: 0.3, v: 0.12 }]],
  hiss: [p => [{ n: 1, ft: 'highpass', c0: 3000 * p, d: 0.35, v: 0.3 }, ...zap(250 * p, 0.3, 0.3)], p => [{ n: 1, ft: 'bandpass', c0: 2500 * p, q: 2, d: 0.4, v: 0.4 }], p => [{ n: 1, ft: 'highpass', c0: 2200 * p, d: 1.2, a: 0.2, v: 0.35 }, ...boom(40, 1, 0.4)]],
};
// ---------- боссы: свой рёв и свой удар ----------
const BOSSV = {
  'BOSS-1': [p => [{ w: 'sawtooth', f0: 520 * p, f1: 180 * p, d: 1.6, a: 0.1, v: 0.3, vib: 6, vd: 70, ft: 'lowpass', c0: 2500 }, ...whoosh(300, 2500, 1.4, 0.4)], p => [...whoosh(2400, 300, 0.9, 0.6), ...boom(50, 0.8, 0.8).map(l => ({ ...l, at: 0.6 }))]],
  'BOSS-2': [p => [{ n: 1, ft: 'lowpass', c0: 500, c1: 120, d: 2.2, a: 0.3, v: 0.8, rate: 0.3 }, { w: 'sawtooth', f0: 55 * p, f1: 35, d: 2, v: 0.3, ft: 'lowpass', c0: 300 }, { n: 1, ft: 'bandpass', c0: 1500, q: 12, d: 1.5, v: 0.2, at: 0.3 }], p => [...boom(32 * p, 1.2, 1), { n: 1, ft: 'bandpass', c0: 900, c1: 300, q: 4, d: 0.8, v: 0.4 }]],
  'BOSS-3': [p => [{ w: 'sine', f0: 90 * p, f1: 240 * p, fd: 1.2, d: 3, a: 0.5, v: 0.5, vib: 2.5, vd: 6 }, { w: 'sine', f0: 135 * p, f1: 360 * p, fd: 1.2, d: 3, a: 0.5, v: 0.18 }, { n: 1, ft: 'lowpass', c0: 400, d: 3, a: 0.6, v: 0.3, rate: 0.3 }], p => [...boom(28 * p, 1.6, 1), ...whoosh(200, 900, 1.5, 0.5)]],
  'BOSS-4': [p => [0, 0.1, 0.2, 0.3].flatMap(t => chime(R(600, 1400) * p, 1.4, 0.14).map(l => ({ ...l, at: t }))), p => zap(110 * p, 0.9, 0.8)],
  'BOSS-5': [p => [{ w: 'sawtooth', f0: 73 * p, d: 2, a: 0.1, v: 0.35, ft: 'lowpass', c0: 800 }, { w: 'sawtooth', f0: 110 * p, d: 2, a: 0.1, v: 0.25, ft: 'lowpass', c0: 800 }], p => [0, 0.15, 0.3, 0.45].flatMap(t => boom(55 * p, 0.6, 0.7).map(l => ({ ...l, at: t })))],
  'BOSS-6': [p => [{ n: 1, ft: 'lowpass', c0: 900, c1: 200, d: 2, a: 0.2, v: 0.8, rate: 0.25 }, { w: 'sine', f0: 45 * p, f1: 28, d: 2, v: 0.5 }], p => [...boom(30 * p, 1.4, 1.1), { n: 1, ft: 'lowpass', c0: 2500, c1: 300, d: 1, v: 0.5, rate: 0.5 }]],
  'BOSS-7': [p => [0, 0.25, 0.5, 0.75].map(t => ({ w: 'square', f0: 1100 * p, d: 0.04, v: 0.2, at: t })).concat([{ w: 'triangle', f0: 110 * p, d: 1.2, v: 0.3, at: 0.8 }]), p => [...boom(60 * p, 0.6, 0.8), { n: 1, ft: 'bandpass', c0: 2200, q: 15, d: 0.8, v: 0.3 }]],
  'BOSS-8': [p => [{ w: 'sine', f0: 70 * p, f1: 50, d: 2.2, a: 0.4, v: 0.5, vib: 5, vd: 10 }, { n: 1, ft: 'lowpass', c0: 1200, c1: 400, d: 2, a: 0.5, v: 0.5, rate: 0.5 }], p => [{ n: 1, ft: 'lowpass', c0: 3000, c1: 500, d: 1.6, v: 0.7, rate: 0.7 }, ...boom(40 * p, 1, 0.6)]],
  'BOSS-9': [p => [{ w: 'sine', f0: 880 * p, f1: 1320 * p, d: 1.5, a: 0.2, v: 0.22, vib: 6, vd: 30 }, { w: 'sine', f0: 1320 * p, f1: 1760 * p, d: 1.5, a: 0.3, v: 0.12, vib: 6.5, vd: 30 }], p => [{ w: 'sawtooth', f0: 1800 * p, f1: 600, d: 0.6, v: 0.18, ft: 'bandpass', c0: 2500, q: 2 }, ...whoosh(3000, 600, 0.6, 0.4)]],
};
const mv = m => { const id = m && m.T && m.T.id || m && m.id || ''; const b = m && m.boss && BOSSV[m.bid || m.T && m.T.id]; return { id, b }; };
function mobKey(m) { if (!m) return null; for (const k of ['id', 'tid', 'type', 'code']) if (m[k] && (MOBV[m[k]] || BOSSV[m[k]])) return m[k]; if (m.T) { for (const k of ['id', 'code']) if (m.T[k] && (MOBV[m.T[k]] || BOSSV[m.T[k]])) return m.T[k]; if (m.T.name) for (const [k, v] of Object.entries(NAMEMAP)) if (v === m.T.name) return k; } return null; }
let NAMEMAP = {};

// ---------- двигатель и огнемёт: постоянные звуки ----------
let eng = null, flame = null;
function loop(make) { const g = ac.createGain(); g.gain.value = 0; g.connect(master); return make(g); }
// двигатель: мягкий музыкальный гул — основной тон, квинта и октава с лёгким хором и «дыханием»; с разгоном тон поднимается на кварту, добавляется свист воздуха
function engineTick(speed, max, dash, alive) {
  if (!ac || ac.state !== 'running') return;
  if (!eng) eng = loop(g => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; f.frequency.value = 500; f.connect(g);
    const vs = [[1, 'triangle', 0.5, -4], [1, 'triangle', 0.5, 4], [1.5, 'sine', 0.32, 0], [2, 'sine', 0.16, 3], [0.5, 'sine', 0.45, 0]].map(([m, w, v, det]) => { const o = ac.createOscillator(); o.type = w; o.detune.value = det; const og = ac.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(); return { o, m }; });
    const trem = ac.createOscillator(), tg = ac.createGain(), tb = ac.createGain(); trem.frequency.value = 0.35; tg.gain.value = 0.18; tb.gain.value = 1; trem.connect(tg); tg.connect(tb.gain); f.disconnect(); f.connect(tb); tb.connect(g); trem.start();
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 0.5; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 0.6; const ng = ac.createGain(); ng.gain.value = 0; n.connect(nf); nf.connect(ng); ng.connect(g); n.start();
    if (verb) { const sg = ac.createGain(); sg.gain.value = 0.35; g.connect(sg); sg.connect(verb); }
    return { g, f, vs, nf, ng }; });
  const k = alive ? Math.min(1, Math.abs(speed) / (max || 100)) : 0, t = ac.currentTime, root = 73.4 * Math.pow(2, (5 * k + (dash ? 2 : 0)) / 12);   // ре большой октавы → соль
  for (const v of eng.vs) v.o.frequency.setTargetAtTime(root * v.m, t, 0.35);
  eng.f.frequency.setTargetAtTime(380 + 520 * k + (dash ? 700 : 0), t, 0.25);
  eng.nf.frequency.setTargetAtTime(500 + 1200 * k + (dash ? 1800 : 0), t, 0.2); eng.ng.gain.setTargetAtTime(0.05 + 0.25 * k + (dash ? 0.5 : 0), t, 0.2);
  eng.g.gain.setTargetAtTime(on && alive ? 0.016 + 0.024 * k + (dash ? 0.025 : 0) : 0, t, 0.3); }
function flameTick(active) { if (!ac || ac.state !== 'running') return;
  if (!flame) flame = loop(g => { const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 0.7; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const o = ac.createOscillator(); o.frequency.value = 7; const og = ac.createGain(); og.gain.value = 500; o.connect(og); og.connect(f.frequency); n.connect(f); f.connect(g); n.start(); o.start(); return { g }; });
  flame.g.gain.setTargetAtTime(on && active ? 0.45 : 0, ac.currentTime, active ? 0.05 : 0.15); }

// ---------- общий интерфейс ----------
export const SFX = {
  setCamera(c) { cam = c; }, names(D) { NAMEMAP = {}; for (const [k, v] of Object.entries(D.MOBS || {})) NAMEMAP[k] = v.name; for (const [k, v] of Object.entries(D.BOSSES || {})) NAMEMAP[k] = v.name; },
  listener(x, z) { lx = x; lz = z; },
  get on() { return on; },
  toggle() { on = !on; init(); if (master) master.gain.value = on ? vol : 0; try { localStorage.setItem('sky-sfx', JSON.stringify({ on, vol })); } catch (e) {} return on; },
  tick(o) { engineTick(o.speed, o.max, o.dash, o.alive); flameTick(o.flame); },
  weapon(id) { const f = WPN[id]; if (f) play('w' + id, f(), { v: 0.8, gap: 0.03 }); },
  device(id) { const f = DEV[id]; if (f) play('d' + id, f(), { v: 0.85 }); },
  skill(id) { const k = SK_KIND[id] || 'buff', p = 0.85 + hash(id) * 0.35; play('s' + id, SKV[k](p), { v: 0.85, rev: 0.4 }); },
  dash() { play('dash', [...whoosh(300, 2600, 0.45, 0.6), { w: 'sawtooth', f0: 90, f1: 260, d: 0.35, v: 0.15, ft: 'lowpass', c0: 900 }], { v: 0.8 }); },
  // моб стреляет, кусает или кричит (kind: 0 — выстрел, 1 — ближний удар, 2 — крик)
  mob(m, kind = 0, x, z) { const k = mobKey(m); if (!k) return; const b = BOSSV[k]; if (b) { play('b' + k + kind, b[kind === 2 ? 0 : 1](0.95 + hash(k) * 0.1), { x: x ?? m.x, z: z ?? m.z, v: 1, gap: kind === 2 ? 2 : 0.25 }); return; }
    const [fam, p] = MOBV[k] || ['buzz', 1]; play('m' + k + kind, FAM[fam][Math.min(2, kind)](p), { x: x ?? m.x, z: z ?? m.z, v: kind === 2 ? 0.7 : 0.6, gap: kind === 2 ? 0.8 : 0.09 }); },
  // особые приёмы мобов
  special(sp, x, z) { const L = {
      boom: [{ w: 'square', f0: 880, d: 0.08, v: 0.15 }, { w: 'square', f0: 880, d: 0.08, v: 0.15, at: 0.2 }, { w: 'square', f0: 1200, d: 0.08, v: 0.15, at: 0.35 }],
      leech: [{ n: 1, ft: 'bandpass', c0: 400, q: 6, d: 0.5, v: 0.4, rate: 0.5 }, { w: 'sine', f0: 100, f1: 70, d: 0.5, v: 0.2, vib: 6, vd: 15 }],
      thief: [...chime(1800, 0.2, 0.12), ...whoosh(2000, 600, 0.3, 0.3)],
      web: [{ n: 1, ft: 'bandpass', c0: 2500, c1: 900, q: 8, d: 0.6, v: 0.3 }, { w: 'triangle', f0: 500, f1: 250, d: 0.4, v: 0.15 }],
      brood: [0, 0.1, 0.2].flatMap(t => [{ w: 'sawtooth', f0: R(300, 500), d: 0.3, v: 0.08, vib: 90, vd: 50, at: t, ft: 'bandpass', c0: 1400, q: 3 }]),
      hex: [{ w: 'sine', f0: 220, f1: 207, d: 1.5, a: 0.3, v: 0.25, vib: 5, vd: 12 }, { w: 'sine', f0: 311, f1: 293, d: 1.5, a: 0.3, v: 0.2 }, { n: 1, ft: 'bandpass', c0: 600, q: 10, d: 1.5, v: 0.15 }],
      sleep: [{ w: 'sine', f0: 523, f1: 392, d: 1.2, a: 0.2, v: 0.2 }, { w: 'sine', f0: 392, f1: 261, d: 1.4, a: 0.3, v: 0.15, at: 0.3 }],
      rot: [{ n: 1, ft: 'lowpass', c0: 600, d: 0.5, v: 0.25, rate: 0.4 }, { w: 'sine', f0: 90, f1: 60, d: 0.4, v: 0.15 }],
      jam: [{ w: 'square', f0: 2000, d: 0.5, v: 0.08, vib: 40, vd: 800 }, { n: 1, ft: 'highpass', c0: 1500, d: 0.5, v: 0.2 }],
      ink: [{ n: 1, ft: 'lowpass', c0: 900, c1: 200, d: 0.8, v: 0.5, rate: 0.6 }, { w: 'sine', f0: 140, f1: 60, d: 0.5, v: 0.25 }],
      pull: [{ w: 'sine', f0: 60, f1: 140, d: 1.2, v: 0.3, vib: 9, vd: 20 }, { w: 'sawtooth', f0: 120, d: 1.2, v: 0.06, ft: 'lowpass', c0: 400 }],
      mend: [523, 784].map((f, i) => ({ w: 'sine', f0: f * 0.8, d: 0.6, v: 0.12, at: i * 0.1 })),
      fog: [{ n: 1, ft: 'lowpass', c0: 800, d: 1.4, a: 0.4, v: 0.3, rate: 0.4 }],
      aim: [{ w: 'sine', f0: 1400, d: 0.12, v: 0.12 }, { w: 'sine', f0: 1400, d: 0.12, v: 0.12, at: 0.3 }, { w: 'sine', f0: 1800, d: 0.3, v: 0.15, at: 0.6 }],
      tug: [{ w: 'square', f0: 60, d: 0.8, v: 0.15, vib: 18, vd: 10, ft: 'lowpass', c0: 400 }, { n: 1, ft: 'bandpass', c0: 2000, q: 10, d: 0.6, v: 0.15 }],
      slam: [{ w: 'sine', f0: 60, f1: 120, d: 1.2, a: 0.8, v: 0.3 }],
      beam: zap(160, 1.6, 0.4),
    }[sp]; if (L) play('sp' + sp, L, { x, z, v: 0.7, gap: 0.3 }); },
  // попадание по мобу: звук зависит от типа урона (0 кин., 1 взр., 2 пробив., 3 огонь, 4 ток)
  hit(type, crit, x, z, big) { const L = [
      [{ n: 1, ft: 'bandpass', c0: 1800, q: 2, d: 0.08, v: 0.35 }, { w: 'square', f0: 300, f1: 150, d: 0.05, v: 0.12 }],
      [{ n: 1, ft: 'lowpass', c0: 1500, c1: 300, d: 0.25, v: 0.45 }],
      [{ w: 'triangle', f0: 1100, f1: 700, d: 0.12, v: 0.2 }, { n: 1, ft: 'highpass', c0: 3000, d: 0.06, v: 0.25 }],
      [{ n: 1, ft: 'lowpass', c0: 1100, d: 0.18, v: 0.25, rate: 0.7 }],
      [{ n: 1, ft: 'highpass', c0: 4000, d: 0.1, v: 0.3, rate: 1.5 }, { w: 'square', f0: 120, d: 0.08, v: 0.08 }],
    ][type] || []; const c = crit ? [{ w: 'sine', f0: 1760, d: 0.2, v: 0.12 }, { w: 'sine', f0: 2637, d: 0.25, v: 0.08, at: 0.04 }] : [];
    play('h' + type + (crit ? 'c' : ''), [...L, ...c], { x, z, v: big ? 0.7 : 0.45, gap: 0.06 }); },
  // взрыв: размер задаёт глубину
  impact(id, x, z) { const f = IMPACT[id]; if (!f) return; muteEx = ac ? ac.currentTime + 0.03 : 0; play('i' + id, f(), { x, z, v: 1, gap: id === 'W-1' ? 0.05 : 0.08, rev: id === 'W-3' ? 0.5 : 0.35 }); },
  shell(x, z) { play('shell', [{ n: 1, ft: 'bandpass', c0: 1300, q: 3, d: 0.12, v: 0.6 }, { w: 'triangle', f0: 320, f1: 180, d: 0.25, v: 0.35 }, ...[0.08, 0.14, 0.19, 0.26, 0.31, 0.4, 0.47, 0.55].map((t, i) => ({ w: 'sine', f0: R(2200, 3600), d: R(0.25, 0.5), v: 0.12 - i * 0.008, at: t })), { n: 1, ft: 'highpass', c0: 6000, d: 0.8, a: 0.1, v: 0.08, at: 0.1 }], { x, z, v: 0.9, rev: 0.4, gap: 0.3 }); },
  explode(s, x, z) { if (ac && ac.currentTime < muteEx) return; const f = 70 / Math.sqrt(Math.max(0.3, s)); play('ex' + Math.round(s * 3), [...boom(f, 0.5 + s * 0.4, Math.min(1.2, 0.5 + s * 0.3)), { n: 1, ft: 'lowpass', c0: 3500, c1: 200, d: 0.4 + s * 0.4, v: 0.5, rate: 0.6 + 0.4 / s }], { x, z, v: 1, gap: 0.04 }); },
  kill(m) { SFX.mob(m, 2); },
  hurt(type, dmg) { const big = dmg > 60; play('hurt' + type, [...boom(big ? 45 : 70, big ? 0.6 : 0.3, big ? 0.9 : 0.6), { n: 1, ft: 'bandpass', c0: [1500, 900, 2400, 800, 3500][type] || 1500, q: 3, d: 0.3, v: 0.4 }, { w: 'square', f0: 140, f1: 70, d: 0.25, v: 0.12, ft: 'lowpass', c0: 1000 }], { v: 0.75, gap: 0.12 }); },
  death() { play('death', [...boom(30, 2.2, 1.2), { n: 1, ft: 'lowpass', c0: 4000, c1: 120, d: 2.5, v: 0.8 }, { w: 'sawtooth', f0: 200, f1: 30, d: 2, v: 0.2, ft: 'lowpass', c0: 1200 }], { v: 1 }); },
  revive() { play('rev', [392, 523, 659, 784, 1046].map((f, i) => ({ w: 'triangle', f0: f, d: 0.8, v: 0.15, at: i * 0.09 })), { v: 0.9 }); },
  coin(kind) { const f = kind === 'gold' ? 1568 : kind === 'silver' ? 1318 : 1046; play('coin', [{ w: 'square', f0: f, d: 0.07, v: 0.08 }, { w: 'sine', f0: f * 1.5, d: 0.5, v: 0.18, at: 0.06 }, { w: 'sine', f0: f * 2, d: 0.35, v: 0.06, at: 0.06 }], { v: 0.6, gap: 0.08 }); },
  pickup(k) { const L = { wood: [{ n: 1, ft: 'bandpass', c0: 900, q: 4, d: 0.12, v: 0.4 }, { w: 'triangle', f0: 220, f1: 160, d: 0.2, v: 0.2 }], fish: [{ n: 1, ft: 'bandpass', c0: 1600, q: 2, d: 0.25, v: 0.35 }, { w: 'sine', f0: 700, f1: 400, d: 0.2, v: 0.15 }], pearls: [0, 0.05, 0.1].flatMap(t => chime(R(2000, 3000), 0.4, 0.08).map(l => ({ ...l, at: t }))) }[k]; if (L) play('pk' + k, L, { v: 0.6, gap: 0.1 }); },
  // взаимодействие с объектами мира: начало и итог
  start(kind) { const L = { fish: [{ w: 'square', f0: 900, d: 0.03, v: 0.1 }, ...whoosh(2000, 500, 0.4, 0.3), { n: 1, ft: 'lowpass', c0: 1500, d: 0.3, v: 0.3, at: 0.4 }],
      tree: [0, 0.3, 0.6].flatMap(t => [{ n: 1, ft: 'bandpass', c0: 1100, q: 3, d: 0.1, v: 0.5, at: t }, { w: 'triangle', f0: 180, f1: 120, d: 0.15, v: 0.25, at: t }]),
      island: [{ n: 1, ft: 'bandpass', c0: 700, c1: 1400, q: 1.5, d: 0.7, v: 0.3, rate: 0.7 }, { w: 'triangle', f0: 260, d: 0.1, v: 0.15, at: 0.2 }, { w: 'triangle', f0: 200, d: 0.1, v: 0.15, at: 0.45 }],
      beacon: [{ w: 'square', f0: 300, d: 0.05, v: 0.15 }, { n: 1, ft: 'highpass', c0: 2500, d: 0.5, v: 0.15, at: 0.05 }] }[kind] || [{ w: 'sine', f0: 600, d: 0.15, v: 0.15 }]; play('st' + kind, L, { v: 0.7, gap: 0.3 }); },
  done(kind, good = true) { const L = { fish: [{ n: 1, ft: 'lowpass', c0: 2500, c1: 500, d: 0.6, v: 0.5 }, ...chime(880, 0.6, 0.15).map(l => ({ ...l, at: 0.2 }))],
      tree: [{ n: 1, ft: 'lowpass', c0: 1400, c1: 200, d: 1.1, v: 0.6, rate: 0.5 }, { w: 'triangle', f0: 120, f1: 50, d: 0.9, v: 0.3, at: 0.3 }, ...boom(45, 0.6, 0.6).map(l => ({ ...l, at: 0.9 }))],
      island: good ? [523, 659, 784].map((f, i) => ({ w: 'triangle', f0: f, d: 0.5, v: 0.15, at: i * 0.08 })) : [{ w: 'sawtooth', f0: 220, f1: 110, d: 0.6, v: 0.15, ft: 'lowpass', c0: 1000 }, { w: 'sawtooth', f0: 233, f1: 116, d: 0.6, v: 0.1, ft: 'lowpass', c0: 1000 }] }[kind]; if (L) play('dn' + kind, L, { v: 0.8, gap: 0.3 }); },
  special2(kind) { play('rare', [784, 988, 1175, 1568].map((f, i) => ({ w: 'sine', f0: f, d: 0.9, v: 0.16, at: i * 0.07 })).concat([{ n: 1, ft: 'highpass', c0: 6000, d: 1, a: 0.2, v: 0.1 }]), { v: 0.8 }); },
  // маяк: разгорается с гулом и звоном
  beacon(x, z, off) { if (off) return play('bcoff', [{ w: 'sine', f0: 400, f1: 120, d: 0.9, v: 0.25 }, { n: 1, ft: 'lowpass', c0: 1500, c1: 200, d: 0.8, v: 0.3 }], { x, z, v: 0.9 });
    play('bcon', [{ n: 1, ft: 'lowpass', c0: 300, c1: 3000, d: 1.4, a: 0.5, v: 0.4 }, { w: 'sine', f0: 110, f1: 220, d: 1.6, a: 0.4, v: 0.3 }, ...chime(659, 2, 0.2).map(l => ({ ...l, at: 0.6 })), ...chime(988, 2, 0.14).map(l => ({ ...l, at: 0.75 }))], { x, z, v: 1, gap: 0.4 }); },
  modal() { play('modal', [{ w: 'sine', f0: 587, d: 0.6, v: 0.15 }, { w: 'sine', f0: 880, d: 0.8, v: 0.12, at: 0.12 }], { v: 0.7, gap: 0.5 }); },
  ok() { play('ok', [{ w: 'triangle', f0: 880, d: 0.12, v: 0.15 }, { w: 'triangle', f0: 1318, d: 0.2, v: 0.12, at: 0.06 }], { v: 0.6 }); },
  click() { play('click', [{ w: 'square', f0: 1400, d: 0.025, v: 0.06 }, { n: 1, ft: 'bandpass', c0: 3000, q: 4, d: 0.03, v: 0.1 }], { v: 0.5, gap: 0.03 }); },
  warn(x, z) { play('warn', [{ w: 'square', f0: 660, d: 0.1, v: 0.08 }, { w: 'square', f0: 660, d: 0.1, v: 0.08, at: 0.18 }], { x, z, v: 0.6, gap: 0.6 }); },
  portal() { play('portal', [{ w: 'sine', f0: 120, f1: 900, d: 1.6, a: 0.3, v: 0.25, vib: 4, vd: 40 }, ...whoosh(200, 2500, 1.6, 0.5)], { v: 0.9, gap: 1 }); },
  bolt(x, z) { play('bolt', zap(R(150, 300), 0.2, 0.25), { x, z, v: 0.5, gap: 0.12 }); },
  ring(x, z) { play('ring', whoosh(250, 1200, 0.5, 0.35), { x, z, v: 0.6, gap: 0.2 }); },
  shop() { play('shop', [0, 0.06, 0.12].flatMap(t => [{ w: 'square', f0: 2000, d: 0.04, v: 0.06, at: t }]).concat(chime(1046, 0.8, 0.15).map(l => ({ ...l, at: 0.18 }))), { v: 0.7 }); },
  fanfare() { play('fan', [523, 659, 784, 1046, 784, 1046].map((f, i) => ({ w: 'triangle', f0: f, d: i === 5 ? 1.5 : 0.3, v: 0.18, at: [0, 0.15, 0.3, 0.45, 0.75, 0.9][i] })), { v: 1, pitch: 1 }); },
  firework(x, z) { play('fw', [{ n: 1, ft: 'highpass', c0: 1500, c1: 5000, d: 0.5, v: 0.15 }, ...boom(60, 0.6, 0.6).map(l => ({ ...l, at: 0.5 })), { n: 1, ft: 'highpass', c0: 5000, d: 1.2, v: 0.15, at: 0.6, a: 0.1 }], { x, z, v: 0.8, gap: 0.15 }); },
};
