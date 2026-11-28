// Сетевая игра: комната по коду, до 20 капитанов, без своего сервера.
// Браузеры соединяются напрямую (WebRTC через PeerJS). Создатель комнаты — ведущий: у него считаются мобы, миссия, общее золото.
// Остальные летят на своём корабле, бьют мобов (урон уходит ведущему) и видят мир, который присылает ведущий.
// Без комнаты всё работает как одиночная игра: ведущий без гостей.
import * as THREE from 'three';

const PREFIX = 'sky3d-v1-';
export const VERSION = '28.11 16:20';                 // ставится при выкладке: дата и время сборки                 // имя комнаты на сервере-своднике: префикс + код
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SEND_HZ = 15, REP_HZ = 10;
const qs = new URLSearchParams(location.search);
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

// адресная строка всегда показывает текущую комнату: её можно копировать и отправлять
function roomUrl(code) { try { const u = new URL(location.href); if (code) u.searchParams.set('room', code); else u.searchParams.delete('room'); history.replaceState(null, '', u.toString()); } catch (e) {} }
export const NET = {
  version: VERSION,
  role: null,          // null — одиночная игра; 'host' — ведущий; 'client' — гость
  id: 'H',             // мой номер в комнате: у ведущего 'H'
  code: '',
  inGame: false,       // идёт вылет (миссия или свободный полёт)
  peers: new Map(),    // у ведущего: id → { conn, ... }
  ghosts: new Map(),   // чужие корабли: id → призрак
  lobby: [],           // состав команды для зала ожидания
  mute: 0,             // > 0: эффект пришёл по сети, обратно не рассылаем
  status: '',
  get host() { return this.role === 'host'; },
  get client() { return this.role === 'client'; },
  get live() { return this.role === 'client' || (this.role === 'host' && this.peers.size > 0); },
};
let A = null;                       // доступ к игре (game.js передаёт в init)
let peer = null, hostConn = null, onLobby = () => {}, onStatus = () => {};
let sendT = 0, repT = 0, nidC = 0, ptC = 0, seq = 0;
const out = new Map();              // очередь сообщений по адресатам (батч раз в кадр)
const byNid = new Map();            // моб по сетевому номеру
NET.byNid = byNid;

// ---------- транспорт ----------
// Ретранслятор (TURN) нужен, когда браузеры не могут соединиться напрямую: строгий роутер, мобильный интернет, VPN.
// Ключ бесплатного Metered Open Relay: ссылка выдаёт список серверов с временными паролями. Пусто — только прямое соединение
const TURN_API = 'https://skygame-jokkervlad.metered.live/api/v1/turn/credentials?apiKey=c151cda11e800489d9dbcbe60eb4f3e0a65d';   // бесплатный план 500 МБ в месяц
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
let ICE = STUN, iceP = null;
function loadIce() { if (!TURN_API) return Promise.resolve(); if (!iceP) iceP = fetch(TURN_API).then(r => r.json()).then(list => { if (Array.isArray(list) && list.length) ICE = STUN.concat(list); }).catch(() => { iceP = null; }); return iceP; }
NET.relay = () => ICE.some(q => [].concat(q.urls).some(u => u.startsWith('turn')));
function peerOpts() { const o = { debug: qs.get('netdebug') ? 3 : 0, config: { iceServers: ICE } };
  const p = qs.get('peer'); if (p) { const [host, port] = p.split(':'); Object.assign(o, { host, port: +port || 9000, path: '/', secure: false }); } return o; }
function makeCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0]; return s; }
function q(to, msg) { if (!out.has(to)) out.set(to, []); out.get(to).push(msg); }
// Большие пачки сообщений режем на куски и склеиваем на той стороне
const CHUNK = 7000;   // PeerJS не пропускает JSON-сообщение больше 16 КБ (в байтах UTF-8)
 let partN = 0; const parts = new Map();
function sendTo(conn, list) { const str = JSON.stringify(list); if (str.length < CHUNK) return conn.send(list); const id = ++partN, n = Math.ceil(str.length / CHUNK); for (let i = 0; i < n; i++) conn.send({ p: id, i, n, s: str.slice(i * CHUNK, (i + 1) * CHUNK) }); }
function unchunk(from, d) { if (Array.isArray(d)) return d; if (!d || d.p == null) return null; const k = from + ':' + d.p; let b = parts.get(k); if (!b) { b = { n: d.n, got: 0, s: [] }; parts.set(k, b); } if (b.s[d.i] == null) { b.s[d.i] = d.s; b.got++; } if (b.got < b.n) return null; parts.delete(k); try { return JSON.parse(b.s.join('')); } catch (e) { return null; } }
function flush() { for (const [to, list] of out) { if (!list.length) continue; const conn = to === 'H' ? hostConn : NET.peers.get(to) && NET.peers.get(to).conn; if (conn && conn.open) { try { sendTo(conn, list); } catch (e) { console.error('net send', e); } } } out.clear(); }
// всем гостям (у ведущего) или ведущему (у гостя)
function toAll(msg, except) { if (NET.host) { for (const id of NET.peers.keys()) if (id !== except) q(id, msg); } else if (NET.client) q('H', msg); }
NET.send = (to, msg) => q(to, msg);

NET.create = function (cb) { NET.leave(true); const code = makeCode(); NET.status = 'Создаём комнату…'; onStatus();
  loadIce().then(() => hostOpen(code, cb)); };
function hostOpen(code, cb) {
  peer = new window.Peer(PREFIX + code, peerOpts());
  peer.on('open', () => { NET.role = 'host'; NET.id = 'H'; NET.code = code; NET.status = ''; roomUrl(code); lobbyChanged(); cb && cb(null, code); });
  peer.on('connection', conn => { conn.on('open', () => hostAccept(conn)); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); return NET.create(cb); } NET.status = netErr(e); onStatus(); if (!NET.role) cb && cb(NET.status); });
  peer.on('disconnected', () => { if (peer && !peer.destroyed) try { peer.reconnect(); } catch (e) {} }); }
NET.join = function (code, cb) { NET.leave(true); code = code.trim().toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(code)) return cb && cb('Код комнаты — 4 буквы или цифры');
  NET.status = 'Подключаемся к комнате ' + code + '…'; onStatus();
  loadIce().then(() => guestOpen(code, cb)); };
function guestOpen(code, cb) {
  peer = new window.Peer(undefined, peerOpts());
  peer.on('open', () => { NET.status = `Сервер-сводник на связи. Ждём ответа ведущего комнаты ${code}…`; onStatus(); const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }); let ok = false;
    // ведущий ответил, но браузеры не пробились друг к другу — это не «нет комнаты», а сеть: говорим, что делать
    const NOPATH = 'Комната нашлась, но браузеры не смогли соединиться напрямую. Так бывает со строгим роутером, мобильным интернетом или VPN. Выключите VPN у обоих, поменяйтесь ролями (комнату создаёт другой) или подключитесь через другую сеть, например раздачу с телефона';
    let bad = 0, answered = false; const fail = msg => { if (ok) return; ok = true; clearTimeout(t); clearInterval(w); NET.status = msg; onStatus(); cb && cb(msg); NET.leave(true); };
    const w = setInterval(() => { const pc = conn.peerConnection; if (!pc) return; if (pc.remoteDescription && !answered) { answered = true; NET.status = 'Ведущий ответил. Соединяемся напрямую…'; onStatus(); } const st = pc.iceConnectionState; bad = st === 'failed' || st === 'disconnected' ? bad + 1 : 0; if (bad >= 4 && !NET.relay()) fail(NOPATH); else if (bad >= 8) fail(NOPATH); }, 1000);
    const t = setTimeout(() => fail(answered ? NOPATH : `Ведущий комнаты ${code} не ответил. Проверьте, что код свежий (он виден у ведущего в блоке «Комната»), что у ведущего открыта игра и он не закрыл комнату`), 25000);
    conn.on('open', () => { ok = true; clearTimeout(t); clearInterval(w); hostConn = conn; NET.role = 'client'; NET.code = code; NET.status = ''; roomUrl(code); q('H', ['hello', helloInfo()]); flush(); cb && cb(null, code); });
    conn.on('data', d => recvList('H', d)); conn.on('close', () => hostGone()); conn.on('error', () => hostGone()); });
  peer.on('error', e => { NET.status = e.type === 'peer-unavailable' ? `Комнаты ${code} нет: её закрыли или код неверный. Попросите у ведущего свежую ссылку из блока «Комната»` : netErr(e); onStatus(); cb && cb(NET.status); NET.leave(true); }); }
function netErr(e) { return e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'Нет связи с сервером-сводником. Проверьте интернет' : e.type === 'browser-incompatible' ? 'Браузер не поддерживает прямое соединение' : 'Ошибка связи: ' + e.type; }
NET.leave = function (quiet) { const was = NET.role; roomUrl(null); if (NET.host) for (const p of NET.peers.values()) try { p.conn.close(); } catch (e) {}
  if (hostConn) try { hostConn.close(); } catch (e) {} hostConn = null; if (peer) try { peer.destroy(); } catch (e) {} peer = null;
  NET.peers.clear(); for (const g of NET.ghosts.values()) dropGhost(g); NET.ghosts.clear(); NET.role = null; NET.code = ''; NET.inGame = false; NET.lobby = []; byNid.clear();
  if (A) A.netGone(was, quiet); if (!quiet) lobbyChanged(); };
function hostGone() { if (!NET.client) return; const inG = NET.inGame; NET.leave(true); NET.status = 'Связь с ведущим потеряна'; onStatus(); lobbyChanged(); if (A) A.hostLost(inG); }
NET.onLobby = f => { onLobby = f; }; NET.onStatus = f => { onStatus = f; };
NET.link = () => location.origin + location.pathname + '?room=' + NET.code;

// ---------- ведущий: приём гостей ----------
function hostAccept(conn) { if (NET.peers.size >= 19) { conn.send([['full']]); setTimeout(() => conn.close(), 500); return; }
  const id = 'c' + (++ptC); const p = { id, conn, nick: '…', ship: null, ready: false, info: {} }; NET.peers.set(id, p);
  conn.on('data', d => recvList(id, d)); conn.on('close', () => peerGone(id)); conn.on('error', () => peerGone(id)); }
function peerGone(id) { const p = NET.peers.get(id); if (!p) return; NET.peers.delete(id); const g = NET.ghosts.get(id); if (g) { dropGhost(g); NET.ghosts.delete(id); } if (A && p.nick) A.log(`${p.nick} покинул комнату`, '#ffb4a0'); toAll(['left', id]); lobbyChanged(); if (A) A.modalCheck(); }
function helloInfo() { const L = A.L; return { v: VERSION, nick: L.nick || 'Капитан', ship: L.chosen ? L.ship : null, spec: L.spec, weapons: L.weapons, stage: L.stage, ready: !!A.ready }; }
NET.sendMe = () => { if (NET.client) q('H', ['me', helloInfo()]); else if (NET.host) lobbyChanged(); };
function lobbyChanged() { if (NET.host) { const me = Object.assign({ id: 'H', host: true }, helloInfo()); NET.lobby = [me, ...[...NET.peers.values()].filter(p => p.hello).map(p => Object.assign({ id: p.id }, p.info))]; toAll(['lobby', { list: NET.lobby, mission: A.L.mission, inGame: NET.inGame }]); } onLobby(); }

// ---------- приём ----------
function recvList(from, raw) { const list = unchunk(from, raw); if (!Array.isArray(list)) return; for (const m of list) { try { recv(from, m); } catch (e) { console.error('net', m && m[0], e); } } }
function recv(from, [t, d, e]) {
  if (NET.host && from !== 'H') { const p = NET.peers.get(from); if (!p) return;
    switch (t) {
      case 'hello': if (d.v !== VERSION) { q(from, ['oldver', VERSION]); if (A) A.log(`У капитана ${d.nick} другая версия игры: пусть обновит страницу (Ctrl+F5)`, '#ffb4a0'); } p.hello = true; p.info = d; p.nick = d.nick; q(from, ['welcome', { id: from, mission: A.L.mission, inGame: NET.inGame, code: NET.code }]); lobbyChanged(); if (NET.inGame) A.lateJoin(from); A.log(`${d.nick} в комнате`, '#d6f23a'); return;
      case 'me': p.info = d; p.nick = d.nick; lobbyChanged(); return;
      case 'ps': return ghostState(from, d);
      case 'hit': return A.netHit(d, from);
      case 'mst': { const m = byNid.get(d[0]); if (m && !m.dead) m[d[1]] = Math.max(m[d[1]] || 0, d[2]); return; }
      case 'mk': { const m = byNid.get(d[0]); if (m && !m.dead) { m.kx = d[1]; m.kz = d[2]; } return; }
      case 'fx': toAll(['fx', d], from); return playFx(d);
      case 'to': if (d === 'H') return A.netPeer(from, e[0], e[1]); q(d, ['from', from, e]); return;    // гость → гость через ведущего
      default: return A.netReq(t, d, from, e);
    } }
  // гость получает от ведущего
  switch (t) {
    case 'welcome': NET.id = d.id; A.L.mission = d.mission || A.L.mission; lobbyChanged(); return;
    case 'lobby': NET.lobby = d.list; if (d.mission && !NET.inGame) { A.L.mission = d.mission; A.setMission(d.mission); } onLobby(); return;
    case 'full': NET.status = 'Комната заполнена: в ней уже 20 капитанов'; onStatus(); return;
    case 'oldver': NET.status = `У вас и у ведущего разные версии игры (у вас ${VERSION}, у ведущего ${d}). Обновите страницу: Ctrl+F5`; onStatus(); return;
    case 'left': { const g = NET.ghosts.get(d); if (g) { dropGhost(g); NET.ghosts.delete(d); } return; }
    case 'pl': return playersState(d);
    case 'ms': return A.netMobs(d);
    case 'mspawn': return A.netSpawn(d);
    case 'mrm': { const m = byNid.get(d); if (m) A.removeMob(m); return; }
    case 'mn': { const m = byNid.get(d[0]); if (m) { m.name = d[1]; if (m.lbl && !m.dead) m.lbl.firstChild.textContent = d[1]; } return; }
    case 'fx': return playFx(d);
    case 'from': return recvPeer(d, e);
    case 'rep': return repApply(d);
    default: return A.netMsg(t, d, e);
  } }
// сообщение от другого гостя (через ведущего); у ведущего — от гостя напрямую
function recvPeer(from, m) { A.netPeer(from, m[0], m[1]); }
NET.toPeer = (id, t, d) => { if (id === NET.id) return A.netPeer(NET.id, t, d); if (NET.host) q(id, ['from', 'H', [t, d]]); else q('H', ['to', id, [t, d]]); };
NET.req = (t, d, e) => { if (NET.client) q('H', [t, d, e]); };
NET.tell = (id, t, d) => { if (id === 'H' || id === NET.id) return A.netMsg(t, d); q(id, [t, d]); };
NET.bcast = (t, d) => { if (NET.host) toAll([t, d]); };

// ---------- призраки: чужие корабли ----------
function ghostOf(id) { let g = NET.ghosts.get(id); if (g) return g;
  g = { id, nick: '', x: 0, z: 0, yaw: 0, tx: 0, tz: 0, tyaw: 0, speed: 0, bank: 0, hp: 600, max: 600, dead: false, dive: 0, mirror: 0, sh: 0, hide: 0, ship: null, t: 0, fresh: true };
  g.mesh = new THREE.Group(); A.scene.add(g.mesh); g.lbl = A.mkLabel('ally', ''); g.proxy = makeProxy(g); NET.ghosts.set(id, g); return g; }
function dropGhost(g) { A.ghostFx(g, 0, true); if (g.mesh) { A.dropModel(g.mesh); A.scene.remove(g.mesh); } if (g.lbl) g.lbl.remove(); if (g.obj) A.unObj(g.obj); }
function setGhostShip(g, ship) { if (g.ship === ship) return; g.ship = ship; A.dropModel(g.mesh); const key = A.D.SHIPS[ship] && A.D.SHIPS[ship].model; if (key) A.applyModel(g.mesh, key).then(inst => { if (inst) inst.traverse(o => { for (const mt of [].concat(o.material || [])) if (mt.fog) { mt.fog = false; mt.needsUpdate = true; } }); }); }
function ghostState(id, d) { const g = ghostOf(id); const was = g.dead;
  Object.assign(g, { tx: d[0], tz: d[1], tyaw: d[2], speed: d[3], bank: d[4], hp: d[5], max: d[6], dead: !!d[7], dive: d[8], mirror: d[9], sh: d[10], hide: d[11], nick: d[12], lost: d[14] || 0, fl: d[16] || 0, t: 0 });
  setGhostShip(g, d[13]); if (g.fresh) { g.x = g.tx; g.z = g.tz; g.yaw = g.tyaw; g.fresh = false; } if (was !== g.dead) A.ghostDead(g); }
function playersState(list) { const seen = new Set(); for (const d of list) { if (d[15] === '#team') { A.teamRes(d[16]); continue; } if (d[15] === NET.id) continue; seen.add(d[15]); ghostState(d[15], d); } for (const [id, g] of NET.ghosts) if (!seen.has(id)) { dropGhost(g); NET.ghosts.delete(id); } }
function myState() { const P = A.P; return [r1(P.x), r1(P.z), r2(P.yaw), r1(P.speed), r2(P.bank), Math.round(P.hp), A.S.hp, P.dead ? 1 : 0, P.dive > 0 ? 1 : 0, P.mirror > 0 ? 1 : 0, A.inShield() ? 1 : 0, A.hidden() ? 1 : 0, A.L.nick || 'Капитан', A.L.ship, P.lost > 0 ? r1(P.lost) : 0, NET.id, A.myFlags()]; }
function updateGhosts(dt) { const k = 1 - Math.exp(-10 * dt);
  for (const g of NET.ghosts.values()) { g.t += dt; let dy = g.tyaw - g.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.yaw += dy * k;
    // гость присылает положение 15 раз в секунду: досчитываем по скорости, чтобы корабль не дёргался
    const ex = g.tx + Math.sin(g.tyaw) * g.speed * Math.min(g.t, 0.2), ez = g.tz + Math.cos(g.tyaw) * g.speed * Math.min(g.t, 0.2);
    if (Math.hypot(ex - g.x, ez - g.z) > 300) { g.x = ex; g.z = ez; } else { g.x += (ex - g.x) * k; g.z += (ez - g.z) * k; }
    const vis = !g.dead && !(g.dive > 0); g.mesh.visible = vis; g.mesh.position.set(g.x, A.PLANE + Math.sin(A.time() * 0.9 + g.x) * 0.8, g.z); g.mesh.rotation.set(0, g.yaw, 0); g.mesh.rotateZ(g.bank || 0);
    if (g.obj) { g.obj.x = g.x; g.obj.z = g.z; } A.ghostFx(g, dt); } }
NET.drawGhostLabels = function () { const P = A.P; for (const g of NET.ghosts.values()) { const t = g.dead ? `${g.nick} · сбит` : g.nick; if (g.lbl.dataset.t !== t) { g.lbl.dataset.t = t; g.lbl.firstChild.textContent = t; } g.lbl.classList.toggle('down', g.dead);
    if (A.place(g.lbl, g.x, A.PLANE + 30, g.z)) g.lbl.querySelector('i').style.width = Math.max(0, g.hp / (g.max || 1) * 100) + '%'; } };
NET.mapDraw = function (c, px) { for (const g of NET.ghosts.values()) { let [a, b] = px(g.x, g.z); const qq = Math.max(Math.abs(a), Math.abs(b)) / 96; if (qq > 1) { a /= qq; b /= qq; } c.fillStyle = g.dead ? '#ff7a66' : '#5fe8ff'; c.beginPath(); c.arc(a, b, 4, 0, 6.3); c.fill(); c.strokeStyle = '#0a0c0b'; c.lineWidth = 1; c.stroke(); } };
// все капитаны для ИИ ведущего: свой корабль и призраки
NET.players = () => [...NET.ghosts.values()];
NET.nicks = () => [A.L.nick || 'Капитан', ...[...NET.ghosts.values()].map(g => g.nick)];
NET.size = () => 1 + NET.ghosts.size;

// Прокси призрака: ИИ ведущего пишет в него как в свой корабль (P.hex = 10, P.speed = 0, P.dvx += …),
// а запись уходит этому капитану. Толчки (dvx, dvz) складываются, остальное — последнее значение
const PSET = new Set(['x', 'z', 'speed', 'hex', 'ink', 'rot', 'lost', 'rooted', 'web', 'leech', 'yaw']);
const pset = new Map();
function makeProxy(g) { return new Proxy(g, { get(t, k) { if (k === 'isGhost') return true; return k in t ? t[k] : 0; },
  set(t, k, v) { if (k === 'dvx' || k === 'dvz') { const p = pend(t.id); p[k] = (p[k] || 0) + (v - (t[k] || 0)); t[k] = 0; return true; } t[k] = v; if (PSET.has(k)) pend(t.id)[k] = v; return true; } }); }
function pend(id) { if (!pset.has(id)) pset.set(id, {}); return pset.get(id); }
function flushPset() { for (const [id, o] of pset) { for (const k in o) if (typeof o[k] === 'number') o[k] = r2(o[k]); q(id, ['pset', o]); } pset.clear(); }

// ---------- эффекты по сети ----------
// Взрыв, молния, кольцо и т. п. у одного — видят все. name — имя функции в game.js, args — её аргументы
NET.fx = (name, args) => { if (!NET.live || NET.mute) return; toAll(['fx', [name, args.map(v => typeof v === 'number' ? r1(v) : v)]]); };
function playFx([name, args]) { NET.mute++; try { A.fxPlay(name, args); } finally { NET.mute--; } }
NET.quiet = fn => { NET.mute++; try { return fn(); } finally { NET.mute--; } };

// ---------- мобы (ведущий) ----------
NET.mobNid = m => { m.nid = ++nidC; byNid.set(m.nid, m); };
NET.mobSpawned = (m, o) => { if (!NET.live) return; toAll(['mspawn', spawnInfo(m)]); };
function spawnInfo(m) { return [m.nid, m.id, r1(m.x), r1(m.z), m.name, r2(m.sc), Math.round(m.max), (m.mis ? 1 : 0) | (m.still ? 2 : 0) | (m.kid ? 4 : 0) | (m.respawn ? 8 : 0) | (m.added ? 16 : 0), Math.round(m.hp)]; }
NET.mobRemoved = m => { if (!m.nid) return; byNid.delete(m.nid); if (NET.host && NET.live && m._sp) toAll(['mrm', m.nid]); };
const ST = ['stun', 'slow', 'mark', 'acid', 'blind', 'weak', 'noheal', 'open', 'shell', 'burn'];
NET.ST = ST;
function mobRows() { const rows = []; for (const m of A.mobs) { if (!m.nid || m.gone) continue; if (!m._sp) { m._sp = true; toAll(['mspawn', spawnInfo(m)]); } const st = {}; for (const k of ST) if (m[k] > 0.05) st[k] = Math.round(m[k]);
    const fl = (m.dead ? 1 : 0) | (m.aggro ? 2 : 0) | (m.loot ? 4 : 0) | (m.fade >= 0 && m.dead ? 8 : 0) | (m.mesh.visible ? 16 : 0) | (m.wind > 0 ? 32 : 0) | (m.still ? 64 : 0);
    rows.push({ m, row: [m.nid, Math.round(m.x), Math.round(m.z), r1(m.yaw), Math.round(m.hp), fl, st, Math.round(m.max)] }); if (m.name !== m._sn) { m._sn = m.name; if (m._snd) toAll(['mn', [m.nid, m.name]]); m._snd = true; } }
  return rows; }
function mobSnapFor(p, rows) { const g = NET.ghosts.get(p.id), last = p.ms || (p.ms = new Map()), full = seq % 45 === 0, slow = seq % 15 === 0, list = [];
  for (const { m, row } of rows) { const key = row.slice(1).join(',') + JSON.stringify(row[6]); if (!full && last.get(m.nid) === key) continue; if (!full && !slow && g && !m.dead && Math.hypot(g.x - m.x, g.z - m.z) > 1800) continue; last.set(m.nid, key); list.push(row); }
  return list; }
NET.fullMobs = id => { for (const m of A.mobs) if (m.nid && !m.gone && m._sp) q(id, ['mspawn', spawnInfo(m)]); };

// ---------- сцена миссии: повтор объектов у гостей ----------
// Ведущий отдаёт всё, что миссия ставит в сцену (маяки, баржи, кольца, столбы…): форму, материалы и движение.
// Тяжёлые части (островки, модели, воронки) идут рецептом: гость строит их сам из тех же данных.
const REP = { roots: new Map(), byObj: new Map(), next: 1, geo: new Map(), mat: new Map(), tex: new Map(), sentDefs: new Set() };
const REG = new Map(), REGN = new Map();   // общие материалы и текстуры: объект ↔ имя
NET.reg = (name, obj) => { if (!obj) return; REG.set(obj, name); REGN.set(name, obj); };
NET.repAdd = obj => { if (!NET.host || REP.byObj.has(obj)) return; const id = REP.next++; const r = { id, obj, sig: '', last: [] }; REP.roots.set(id, r); REP.byObj.set(obj, r); r.dirty = true; };
NET.repRemove = obj => { const r = REP.byObj.get(obj); if (!r) return; REP.byObj.delete(obj); REP.roots.delete(r.id); if (NET.live) toAll(['rep', ['del', r.id]]); };
NET.repClear = () => { REP.roots.clear(); REP.byObj.clear(); if (NET.live) toAll(['rep', ['clear']]); };
const b64 = arr => { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function geoDef(g) { const a = {}; for (const k of ['position', 'normal', 'uv']) { const at = g.attributes[k]; if (at && !at.isInterleavedBufferAttribute) a[k] = [at.itemSize, b64(new Float32Array(at.array))]; }
  const ix = g.index ? (g.index.array instanceof Uint32Array ? ['u32', b64(g.index.array)] : ['u16', b64(new Uint16Array(g.index.array))]) : null; return { a, ix, gr: g.groups.length > 1 ? g.groups.map(q => [q.start, q.count, q.materialIndex]) : null }; }
function texDef(t) { if (REG.has(t)) return { reg: REG.get(t) }; const img = t.image; if (img && img.toDataURL) return { url: img.toDataURL() }; return null; }
function matDef(m) { if (REG.has(m)) return { reg: REG.get(m) };
  const ty = m.isSpriteMaterial ? 'sprite' : m.isMeshBasicMaterial ? 'basic' : m.isMeshStandardMaterial ? 'std' : 'basic';
  const d = { ty, c: m.color ? m.color.getHex() : 0xffffff, ck: m.color && (m.color.r > 1 || m.color.g > 1 || m.color.b > 1) ? [m.color.r, m.color.g, m.color.b] : null, tr: m.transparent, op: m.opacity, dw: m.depthWrite, bl: m.blending, sd: m.side, tm: m.toneMapped, fg: m.fog, wf: !!m.wireframe, vis: m.visible };
  if (ty === 'std') Object.assign(d, { e: m.emissive.getHex(), ei: m.emissiveIntensity, ro: m.roughness, me: m.metalness });
  if (m.map) { const id = m.map.uuid; if (!REP.tex.has(id)) REP.tex.set(id, texDef(m.map)); d.map = id; } return d; }
function defGeo(g, defs) { const id = g.uuid; if (!REP.geo.has(id)) REP.geo.set(id, geoDef(g)); if (!defs.g[id]) defs.g[id] = REP.geo.get(id); return id; }
function defMat(m, defs) { const id = m.uuid; if (!REP.mat.has(id)) REP.mat.set(id, matDef(m)); const d = REP.mat.get(id); if (!defs.m[id]) { defs.m[id] = d; if (d.map) defs.t[d.map] = REP.tex.get(d.map); } return id; }
// дерево объекта: [тип, положение, поворот, масштаб, видимость, порядок, данные, дети]
function ser(o, defs, flat) { flat.push(o); const rec = o.userData.rec;
  const base = [null, [r2(o.position.x), r2(o.position.y), r2(o.position.z)], [r2(o.rotation.x), r2(o.rotation.y), r2(o.rotation.z), o.rotation.order === 'XYZ' ? 0 : o.rotation.order], [r2(o.scale.x), r2(o.scale.y), r2(o.scale.z)], o.visible ? 1 : 0, o.renderOrder];
  if (rec) { base[0] = 'R'; base.push(rec); return base; }
  if (o.isInstancedMesh) { base[0] = 'G'; base.push(null, []); return base; }
  if (o.isMesh || o.isSprite) { base[0] = o.isSprite ? 'S' : 'M'; const mats = [].concat(o.material); base.push({ g: o.isSprite ? null : defGeo(o.geometry, defs), m: mats.map(m => defMat(m, defs)), cs: o.castShadow ? 1 : 0, fc: o.frustumCulled ? 1 : 0 }); }
  else { base[0] = 'G'; base.push(null); }
  base.push(o.children.map(ch => ser(ch, defs, flat))); return base; }
function dyn(o) { const m = o.isMesh || o.isSprite ? [].concat(o.material)[0] : null; return [r2(o.position.x), r2(o.position.y), r2(o.position.z), r2(o.rotation.x), r2(o.rotation.y), r2(o.rotation.z), r2(o.scale.x), r2(o.scale.y), r2(o.scale.z), o.visible ? 1 : 0, m ? r2(m.opacity) : 0, m && m.emissiveIntensity != null ? r2(m.emissiveIntensity) : 0, m && m.color ? m.color.getHex() : 0]; }
function sigOf(flat) { let s = ''; for (const o of flat) s += o.id + ','; return s; }
function flatten(o, flat) { flat.push(o); if (o.userData.rec || o.isInstancedMesh) return flat; for (const ch of o.children) flatten(ch, flat); return flat; }
function repFull(r) { const defs = { g: {}, m: {}, t: {} }, flat = []; const tree = ser(r.obj, defs, flat); r.flat = flat; r.sig = sigOf(flat); r.last = flat.map(dyn); return ['set', r.id, tree, defs]; }
function repTick() { if (!NET.live) return; const ups = [];
  for (const r of REP.roots.values()) { const flat = flatten(r.obj, []); if (r.dirty || sigOf(flat) !== r.sig) { r.dirty = false; toAll(['rep', repFull(r)]); continue; }
    for (let i = 0; i < flat.length; i++) { const d = dyn(flat[i]), l = r.last[i]; let ch = false; for (let k = 0; k < d.length; k++) if (d[k] !== l[k]) { ch = true; break; } if (ch) { r.last[i] = d; ups.push([r.id, i, d]); } } }
  if (ups.length) toAll(['rep', ['upd', ups]]); }
NET.repFullTo = id => { q(id, ['rep', ['clear']]); for (const r of REP.roots.values()) q(id, ['rep', repFull(r)]); };
// гость: сборка
const CR = { roots: new Map(), geo: new Map(), mat: new Map(), tex: new Map(), gd: new Map(), md: new Map(), td: new Map() };
function cGeo(id) { if (CR.geo.has(id)) return CR.geo.get(id); const d = CR.gd.get(id); const g = new THREE.BufferGeometry(); if (d) { for (const k in d.a) g.setAttribute(k, new THREE.BufferAttribute(unb64(d.a[k][1], Float32Array), d.a[k][0])); if (d.ix) g.setIndex(new THREE.BufferAttribute(unb64(d.ix[1], d.ix[0] === 'u32' ? Uint32Array : Uint16Array), 1)); if (d.gr) for (const [s, c2, mi] of d.gr) g.addGroup(s, c2, mi); g.computeBoundingSphere(); } CR.geo.set(id, g); return g; }
function cTex(id) { if (CR.tex.has(id)) return CR.tex.get(id); const d = CR.td.get(id); let t = null; if (d && d.reg) t = REGN.get(d.reg) || null; else if (d && d.url) { const img = new Image(); t = new THREE.Texture(img); img.onload = () => { t.needsUpdate = true; }; img.src = d.url; t.colorSpace = THREE.SRGBColorSpace; } CR.tex.set(id, t); return t; }
function cMat(id) { if (CR.mat.has(id)) return CR.mat.get(id); const d = CR.md.get(id) || { ty: 'basic', vis: false }; let m;
  if (d.reg) m = REGN.get(d.reg) || new THREE.MeshStandardMaterial({ color: 0x888888 });
  else { const C = d.ty === 'sprite' ? THREE.SpriteMaterial : d.ty === 'std' ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial; m = new C({ transparent: d.tr, opacity: d.op, depthWrite: d.dw, blending: d.bl, toneMapped: d.tm, fog: d.fg });
    if (d.ty !== 'sprite') { m.side = d.sd; m.wireframe = d.wf; } if (d.ck) m.color.setRGB(...d.ck); else m.color.setHex(d.c); m.visible = d.vis !== false;
    if (d.ty === 'std') { m.emissive.setHex(d.e); m.emissiveIntensity = d.ei; m.roughness = d.ro; m.metalness = d.me; } if (d.map) m.map = cTex(d.map); }
  CR.mat.set(id, m); return m; }
function build(n, flat) { const [ty, p, r, s, v, ro, data, kids] = n; let o;
  if (ty === 'R') o = A.recipe(data) || new THREE.Group();
  else if (ty === 'M') { const mats = data.m.map(cMat); o = new THREE.Mesh(cGeo(data.g), mats.length > 1 ? mats : mats[0]); o.castShadow = !!data.cs; o.frustumCulled = !!data.fc; }
  else if (ty === 'S') o = new THREE.Sprite(cMat(data.m[0]));
  else o = new THREE.Group();
  o.position.set(p[0], p[1], p[2]); if (r[3]) o.rotation.order = r[3]; o.rotation.set(r[0], r[1], r[2]); o.scale.set(s[0], s[1], s[2]); o.visible = !!v; o.renderOrder = ro || 0; flat.push(o);
  if (kids && ty !== 'R') for (const k of kids) o.add(build(k, flat)); return o; }
function repApply(d) { const [op] = d;
  if (op === 'clear') { for (const r of CR.roots.values()) A.scene.remove(r.obj); CR.roots.clear(); return; }
  if (op === 'del') { const r = CR.roots.get(d[1]); if (r) { A.scene.remove(r.obj); CR.roots.delete(d[1]); } return; }
  if (op === 'set') { const [, id, tree, defs] = d; for (const k in defs.g) CR.gd.set(k, defs.g[k]); for (const k in defs.m) CR.md.set(k, defs.m[k]); for (const k in defs.t) CR.td.set(k, defs.t[k]);
    const old = CR.roots.get(id); if (old) A.scene.remove(old.obj); const flat = []; const obj = build(tree, flat); A.scene.add(obj); CR.roots.set(id, { obj, flat }); return; }
  if (op === 'upd') for (const [id, i, v] of d[1]) { const r = CR.roots.get(id); const o = r && r.flat[i]; if (!o) continue; o.position.set(v[0], v[1], v[2]); o.rotation.set(v[3], v[4], v[5]); o.scale.set(v[6], v[7], v[8]); o.visible = !!v[9];
    if ((o.isMesh || o.isSprite) && !REG.has([].concat(o.material)[0])) { const m = [].concat(o.material)[0]; m.opacity = v[10]; if (m.emissiveIntensity != null) m.emissiveIntensity = v[11]; if (m.color && v[12] !== m.color.getHex() && !(m.color.r > 1)) m.color.setHex(v[12]); } } }
NET.repReset = () => { for (const r of CR.roots.values()) A.scene.remove(r.obj); CR.roots.clear(); };

// ---------- кадр ----------
NET.init = api => { A = api; };
NET.tick = function (dt) { if (!NET.role) return; updateGhosts(dt);
  sendT += dt; repT += dt;
  if (sendT >= 1 / SEND_HZ) { sendT = 0; seq++;
    if (NET.client) { if (NET.inGame) q('H', ['ps', myState()]); A.clientDiff(); }
    else if (NET.live && NET.inGame) { const all = [myState(), ...[...NET.ghosts.values()].map(g => [r1(g.tx), r1(g.tz), r2(g.tyaw), r1(g.speed), r2(g.bank), g.hp, g.max, g.dead ? 1 : 0, g.dive, g.mirror, g.sh, g.hide, g.nick, g.ship, g.lost, g.id, g.fl])];
      const team = A.teamInfo(); for (const id of NET.peers.keys()) q(id, ['pl', all.concat([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', null, 0, '#team', team]])]); if (seq % 3 !== 0) { const rows = mobRows(); for (const p of NET.peers.values()) { const l = mobSnapFor(p, rows); if (l.length) q(p.id, ['ms', l]); } } flushPset(); A.hostState(); } }
  if (repT >= 1 / REP_HZ) { repT = 0; if (NET.host && NET.inGame) repTick(); }
  flush(); };
NET.flush = flush;
