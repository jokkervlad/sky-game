// Меню: подготовка к вылету по шагам (корабль → оружие → способности → спецтехника → команда)
// и то же меню в полёте по Esc — с вкладками и разделами полигона.
import { THUMBS } from './thumbs.js?v=202611241617';
import { COINS } from './coins.js?v=202611241617';
import { LOOT } from './loot.js?v=202611241617';

const NAMES = { mission: 'Миссия', lobby: 'Зал ожидания', ship: 'Корабль', weapons: 'Оружие', skills: 'Способности', gear: 'Спецтехника', crew: 'Команда', mobs: 'Мобы и боссы', shop: 'Лавка', catch: 'Улов и древесина', world: 'Острова и породы', keys: 'Управление' };
const DT = ['Кинетический урон', 'Взрывной урон', 'Пробивной урон', 'Огонь', 'Ток'];
const DTS = ['КИН', 'ВЗР', 'ПРБ', 'ОГН', 'ТОК'];
const KINDS = [
  ['Горный остров', 'Пик со снегом, хвойный лес', 1], ['Остров с замком', 'Руины замка: две башни донжона, обвалившиеся стены, осенний лес', 1], ['Джунгли', 'Колокольня из красного кирпича и голубая церковь с золотыми главами', 1],
  ['Озёрный остров', 'Озеро, река, водопад с края, дозорная башня', 1], ['Ледяной остров', 'Снег, ледяные склоны, зимний лес', 1], ['Вулкан', 'Конус с кратером, лава, дым и искры', 1],
  ['Атлантида', 'Плато, кольцевые каналы, купол с колоннадой, храмы, мосты, статуи атлантов', 1], ['Пустыня', 'Барханы, три пирамиды, обелиски', 1], ['Малые островки', 'Десять штук, у каждого своя порода', 1],
  ['Остров маяка', 'Башня маяка: зажигается за 3 секунды', 0], ['Остров гигантского дерева', 'Дерево высотой с гору, добыча древесины', 0], ['Каменные шпили', 'Скалы-столбы, препятствие', 0],
];
const ROCK_NOTES = ['Серо-коричневый, зелёная трава', 'Рыжие слои', 'Тёмные шестигранные колонны', 'Светлые слои', 'Голубой, вместо травы снег', 'Тёмный камень в пятнах мха', 'Чёрная с огненными жилами', 'Песок, без травы и деревьев', 'Гранит со снежными вершинами', 'Чёрное стекло с голубыми жилами'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Таблица «во сколько раз сильнее или слабее»: имя сверху, шкала под ним. Зелёная шкала — бьёт сильнее обычного, красная — слабее.
export const dmgTable = cols => `<div class="dmgt">${cols.map(([n, v]) => `<div class="${v >= 1.1 ? 'g' : v <= 0.9 ? 'r' : ''}"><b>${n}</b><span class="mt"><i style="width:${Math.min(100, v / 1.6 * 100)}%"></i></span><span>×${num(v)}</span></div>`).join('')}</div>`;
const css = a => `rgb(${a.map(x => Math.round(255 * Math.pow(Math.min(1, x), 1 / 2.2))).join(',')})`;

export function initHangar(api) {
  const { D, L, KEY, shop, res, S, keyName, fmt } = api;
  const $ = id => document.getElementById(id);
  const root = $('hangar'), body = $('hg-body'), tabsEl = $('hg-tabs'), foot = $('hg-foot');
  let openX = null, devOpen = false;      // раскрытый список у плюса: { k: что выбираем, f: у какой строки }
  const DEV = ['ship_ancient_colony', 'ship_cargo', 'ship_cargo_transporter', 'ship_carguero', 'ship_heavy_vtol', 'ship_in_clouds', 'ship_rusty_diplomatic', 'ship_rusty_orange', 'ship_spaceship'];
  let mode = 'tabs', tab = 'ship', picker = null, keysBack = null, capture = null, msg = '', pick = { w: [], d: [], c: [] };

  const ic = (id, c = '#ece6d3') => api.ICONS[id] ? `<svg class="hic" viewBox="0 0 512 512" aria-hidden="true"><path fill="color-mix(in srgb, ${c} 70%, white)" d="${api.ICONS[id]}"/></svg>` : '<span class="hic"></span>';
  const net = o => o.net ? ' <i class="net">нужен союзник</i>' : '';
  const nW = () => D.SHIPS[L.ship].w + (api.activeFeats().includes('F-07') ? 1 : 0);
  const nD = () => D.SHIPS[L.ship].d + (api.activeFeats().includes('F-11') ? 1 : 0);
  const LIM = { w: nW, d: nD, c: () => 2 };   // оружие: любой набор, одно и то же можно ставить в несколько слотов
  const barrels = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'слот' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'слота' : 'слотов'}`;
  const IDS = { w: () => D.WEAPON_IDS, d: () => D.DEVICE_IDS, c: () => Object.keys(D.CREW) };
  const ARR = { w: 'weapons', d: 'devices', c: 'crew' };
  const build = () => ['ship', 'weapons', ...(L.stage >= 2 ? ['skills'] : []), 'gear', 'crew'];
  const steps = () => ['mission', ...build(), 'lobby'];
  const tabList = () => mode === 'wizard' ? [...steps(), 'keys'] : api.mission.on ? [shop.open ? 'shop' : 'keys'] : [...build(), ...(api.mission.on ? [] : ['mobs']), 'shop', 'catch', 'world', 'keys'];
  let count = 0, timer = null, ready = false;
  const NET = api.NET;
  // ---------- игра с друзьями: комната по коду ----------
  const roomCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 4);
  let joinCode = roomCode, netBusy = false, copied = false;
  function vRoom() { const st = (NET.status ? `<p class="msg net-st" role="status">${esc(NET.status)}</p>` : '') + `<p class="lab net-v">Версия игры ${esc(NET.version)}</p>`;
    if (!NET.role) return `<section class="room"><h3 class="sec">Игра с друзьями</h3><p class="lead">Один создаёт комнату и отправляет друзьям код или ссылку. Остальные входят по коду. Сервер не нужен: браузеры соединяются напрямую. До 20 капитанов.</p>
      <div class="room-row"><button type="button" class="btn" data-act="room-new"${netBusy ? ' disabled' : ''}>Создать комнату</button><span class="or">или</span><label class="code"><span class="lab">Код комнаты</span><input id="hg-code" type="text" maxlength="4" autocomplete="off" spellcheck="false" value="${esc(joinCode)}" placeholder="ABCD"></label><button type="button" class="btn ghost" data-act="room-join"${netBusy ? ' disabled' : ''}>Войти</button></div>${st}</section>`;
    const n = NET.lobby.length || 1;
    // кто в комнате: имя, ведущий, корабль и готовность. Обновляется, когда кто-то входит, выходит или жмёт «Готов»
    const list = `<ul class="room-list" aria-label="Капитаны в комнате">${team().map(p => `<li${p.me ? ' class="me"' : ''}><span class="nm"><b>${esc(p.nick || 'Капитан')}</b>${p.host ? '<small>ведущий</small>' : ''}${p.me ? '<small>вы</small>' : ''}</span><span class="sh">${p.ship && D.SHIPS[p.ship] ? esc(D.SHIPS[p.ship].name) : 'корабль не выбран'}</span><span class="st">${esc(p.st)}</span></li>`).join('')}</ul>`;
    if (NET.host) return `<section class="room on"><h3 class="sec">Комната <b class="fig">${NET.code}</b> · вы ведущий · капитанов: ${n}</h3><p class="lead">Отправьте друзьям код <b>${NET.code}</b> или ссылку. Миссию выбираете вы, корабль и снаряжение каждый выбирает сам.</p>
      ${list}<div class="room-row"><input id="hg-link" type="text" readonly value="${esc(NET.link())}" aria-label="Ссылка на комнату"><button type="button" class="btn ghost" data-act="room-copy">${copied ? 'Скопировано' : 'Скопировать ссылку'}</button><button type="button" class="btn ghost" data-act="room-leave">Закрыть комнату</button></div>${st}</section>`;
    return `<section class="room on"><h3 class="sec">Комната <b class="fig">${NET.code}</b> · капитанов: ${n}</h3><p class="lead">Миссию выбирает ведущий${NET.lobby[0] ? ': ' + esc(NET.lobby[0].nick) : ''}. Выберите корабль и снаряжение, в зале ожидания нажмите «Готов».</p>${list}<div class="room-row"><button type="button" class="btn ghost" data-act="room-leave">Выйти из комнаты</button></div>${st}</section>`; }
  NET.onLobby(() => { const a = document.activeElement; if (root.style.display !== 'none' && mode === 'wizard' && !count && !(a && a.tagName === 'INPUT' && root.contains(a))) draw(); else if (root.style.display !== 'none') drawFoot(); });
  NET.onStatus(() => { netBusy = false; if (root.style.display !== 'none') draw(); });
  function roomJoin() { const c = ($('hg-code') ? $('hg-code').value : joinCode).trim().toUpperCase(); joinCode = c; if (!L.nick.trim()) { msg = 'Сначала введите имя капитана'; return; } netBusy = true; ready = false; NET.join(c, err => { netBusy = false; if (err) msg = err; draw(); }); }
  if (roomCode && L.nick.trim()) setTimeout(() => { if (!NET.role) { netBusy = true; NET.join(roomCode, err => { netBusy = false; if (err) msg = err; draw(); }); } }, 300);

  function syncPick() { for (const k of 'wdc') { const n = LIM[k](), out = []; for (const id of L[ARR[k]]) if (out.length < n && IDS[k]().includes(id) && !out.includes(id)) out.push(id); pick[k] = out; } }
  function commit(k) { const ids = IDS[k](), p = pick[k]; L[ARR[k]] = [...p]; api.apply(false); }
  function wAdd(id) { const p = pick.w, n = nW(); if (p.length >= n) { msg = `Все слоты заняты (${n}). Снимите оружие со слота: нажмите на него вверху или «−» в строке.`; return; } p.push(id); if (p.length === n) commit('w'); }
  function wDel(i) { if (i >= 0) pick.w.splice(i, 1); }
  function toggle(k, id) { if (k === 'w') return wAdd(id); const p = pick[k], n = LIM[k](), i = p.indexOf(id);
    if (i >= 0) p.splice(i, 1); else if (p.length < n) p.push(id); else if (n === 1) p[0] = id; else { msg = `Все места заняты (${n}). Снимите выбор с одной строки, чтобы взять другую.`; return; }
    if (p.length === n) commit(k); }
  // навыки специальности, выбранные на втором этапе (там открыты два из трёх)
  const sk2 = () => L.spec ? (L.skills2 || []).filter(s => D.SPECS[L.spec].skills.includes(s)).slice(0, 2) : [];
  // чего не хватает на шаге: пустая строка, если всё выбрано
  function need(t = tab) { const q = D.SHIPS[L.ship];
    if (t === 'mission') return !L.mission ? (NET.client ? 'Ведущий ещё не выбрал миссию' : 'Выберите миссию') : !L.nick.trim() ? 'Введите имя капитана' : '';
    if (t === 'lobby') return '';
    if (t === 'ship') return !L.chosen ? 'Выберите корабль' : L.stage === 2 && q.feats.length && !q.feats.slice(1).includes(L.feat2) ? 'Выберите умение корабля' : L.stage >= 3 && !L.featX ? 'Выберите дополнительное умение' : '';
    if (t === 'skills') { if (!L.spec) return 'Выберите специальность'; const n = 2 - sk2().length; return L.stage === 2 && n > 0 ? (n === 2 ? 'Выберите 2 навыка' : 'Выберите ещё 1 навык') : L.stage >= 3 && !L.skillX ? 'Выберите дополнительный навык' : ''; }
    const k = { weapons: 'w', gear: 'd', crew: 'c' }[t]; if (!k) return ''; const n = LIM[k]() - (t === tab ? pick[k].length : L[ARR[k]].slice(0, LIM[k]()).length); return n > 0 ? `Выберите ещё ${n}` : ''; }

  // ---------- миссия и зал ожидания ----------
  const recRow = (ids, must = {}) => ids.length ? `<p class="lab rec-l">Рекомендуем</p><ul class="rec">${ids.map(id => { const it = D.WEAPONS[id] || D.DEVICES[id]; return `<li${must[id] ? ' class="must"' : ''}>${ic(id, it.color)}<span>${esc(it.name)}${must[id] ? `<small>${esc(must[id])}</small>` : ''}</span></li>`; }).join('')}</ul>` : '';
  function vMission() { return `${vRoom()}<label class="nick"><span class="lab">Имя капитана</span><input id="hg-nick" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="${esc(L.nick)}" placeholder="Как вас звать в артели"></label>
    <div class="list${NET.client ? ' ro' : ''}" role="radiogroup" aria-label="Миссии">${Object.entries(D.MISSIONS).filter(([id]) => !NET.client || id === L.mission).map(([id, q]) => `<div class="pick mis" role="radio" tabindex="0" aria-checked="${id === L.mission}" data-mission="${id}"><div class="c1"><p class="lab">${id === 'M-0' ? 'Без целей' : 'Миссия ' + id.slice(2)}</p><h3>${esc(q.name)}</h3><p class="lab">${esc(q.theme)} · ${esc(q.time)}</p></div><div class="desc"><p>${esc(q.story)}</p>${recRow(q.rec, q.must)}</div></div>`).join('')}</div>`; }
  function vLobby() { const q = D.MISSIONS[L.mission] || D.MISSIONS['M-0'], sh = D.SHIPS[L.ship], bad = steps().find(t => need(t));
    return `<div class="brief"><p class="lab">${L.mission === 'M-0' ? 'Свободный полёт' : 'Миссия ' + L.mission.slice(2) + ' · ' + esc(q.theme)}</p><h3 class="big">${esc(q.name)}</h3><p class="lead">${esc(q.story)}</p>${recRow(q.rec, q.must)}</div>
    <h3 class="sec">Команда${NET.role ? ' · комната ' + NET.code : ''}</h3><table><thead><tr><th>Капитан</th><th>Корабль</th><th>Специальность</th><th>Оружие</th><th>Статус</th></tr></thead><tbody>${team().map(p => `<tr><td><b>${esc(p.nick || 'Капитан')}</b>${p.host ? ' <small>ведущий</small>' : ''}${p.me ? ' <small>вы</small>' : ''}</td><td>${p.ship && D.SHIPS[p.ship] ? esc(D.SHIPS[p.ship].name) : 'не выбран'}</td><td>${p.spec && (p.stage || 1) >= 2 && D.SPECS[p.spec] ? esc(D.SPECS[p.spec].name) : 'нет'}</td><td>${(p.weapons || []).filter(w => D.WEAPONS[w]).map(w => esc(D.WEAPONS[w].name)).join(', ') || 'не выбрано'}</td><td><b>${p.st}</b></td></tr>`).join('')}</tbody></table>
    <p class="lab wait">${count ? '' : !NET.role ? 'Вы летите один. Чтобы играть с друзьями, создайте комнату на первом шаге «Миссия».' : NET.host ? (allReady() ? 'Все готовы: можно начинать вылет.' : 'Вылет можно начать, когда все капитаны нажмут «Готов».') : ready ? 'Ждём, пока ведущий начнёт вылет.' : 'Нажмите «Готов», когда соберёте корабль.'}</p>${count > 0 ? `<p class="countdown" role="status">Вылет через <b class="fig">${count}</b></p>` : count < 0 ? '<p class="countdown" role="status">Готовим небо к вылету…</p>' : ''}`; }
  function team() { const bad = steps().find(t => need(t)), me = { nick: L.nick, ship: L.chosen ? L.ship : null, spec: L.spec, stage: L.stage, weapons: L.weapons, me: true, host: NET.host };
    me.st = count ? 'Вылет' : NET.client ? (ready ? 'Готов' : bad ? 'Собирается' : 'Не нажал «Готов»') : bad ? 'Собирается' : 'Готов';
    if (!NET.role) return [me]; return NET.lobby.map(p => p.id === NET.id ? me : Object.assign({}, p, { st: p.host ? 'Ведущий' : p.ready ? 'Готов' : 'Собирается' })); }
  const allReady = () => NET.lobby.every(p => p.id === NET.id || p.host || p.ready);


  // ---------- корабли ----------
  function featsOf(id) { const f = D.SHIPS[id].feats, me = id === L.ship && L.chosen, X = L.featX && !f.includes(L.featX) ? [[L.featX, 1, 'x']] : []; if (!f.length) return L.stage >= 3 ? X : [];
    if (L.stage <= 1) return [[f[0], 1], [f[1], 0, 2], [f[2], 0, 3]];
    if (L.stage === 2) { const c = me && f.slice(1).includes(L.feat2) ? L.feat2 : null; return c ? [[f[0], 1], [c, 1, 'p'], [f.slice(1).find(q => q !== c), 0, 3]] : [[f[0], 1], [f[1], 0, 'c'], [f[2], 0, 'c']]; }
    return [...f.map(q => [q, 1]), ...X]; }
  function vShip() { return `<p class="lead">Корабль задаёт корпус, скорость, броню и число мест под оружие и спецтехнику. Специальность выбирается отдельно.</p><div class="list" role="radiogroup" aria-label="Корабли">${Object.entries(D.SHIPS).map(([id, q]) => { const fs = featsOf(id), me = id === L.ship && L.chosen, on = fs.filter(q => q[1]).map(q => q[0]);
      const fb = (f, why) => L.stage === 2 && (why === 'c' || why === 'p') ? `<button type="button" class="btn ghost addx" data-feat2="${id}:${why === 'p' ? '' : f}" aria-label="${why === 'p' ? 'Убрать умение' : 'Взять умение'}" title="${why === 'p' ? 'Убрать умение' : 'Взять умение'}">${why === 'p' ? '−' : '+'}</button>` : why === 'x' ? plusBtn('featX', id, `data-for="${id}"`, 'Выбрать другое дополнительное умение') : '';
      const addX = L.stage >= 3 && !fs.some(q => q[2] === 'x') ? `<li class="off"><span class="hic"></span><span><b>Дополнительное умение</b><br>Одно из запаса: нажмите плюс справа</span>${plusBtn('featX', id, `data-for="${id}"`, 'Выбрать дополнительное умение')}</li>` : '';
      return `<div class="pick ship" role="radio" tabindex="0" aria-checked="${me}" data-ship="${id}">
        <div class="c1">${THUMBS[q.model] ? `<img src="${THUMBS[q.model]}" alt="" width="240" height="150">` : ''}<h3>${esc(q.name)}</h3><p class="lab">${esc(cap(q.role))}</p></div>
        <dl class="stats"><div><dt>Корпус</dt><dd>${q.hp}</dd></div><div><dt>Скорость</dt><dd>${Math.round(q.speed * 100)} %</dd></div><div><dt>Броня</dt><dd>${num(q.armor)}</dd></div><div><dt>Класс брони</dt><dd class="txt">${esc(D.ARMOR[q.arm].name)}</dd></div><div><dt>Оружие</dt><dd>${q.w + (on.includes('F-07') ? 1 : 0)}</dd></div><div><dt>Спецтехника</dt><dd>${q.d + (on.includes('F-11') ? 1 : 0)}</dd></div></dl>
        <div class="c3"><p class="lab">Умения корабля</p>${fs.length ? `<ul class="feats">${fs.map(([f, on, why]) => `<li class="${on || why === 'c' ? 'on' : 'off'}">${ic(f)}<span><b>${esc(D.FEATS[f].name)}</b>${why === 'x' ? ' <i class="tag">дополнительное</i>' : why === 'p' ? ' <i class="tag">выбрано</i>' : why === 'c' ? ' <i class="tag">на выбор</i>' : ''}${net(D.FEATS[f])}<br>${esc(D.FEATS[f].note)}${on || why === 'c' ? '' : `<br><i class="hint">${why === 2 ? 'Откроется со второй миссии' : L.stage === 2 ? 'Все три откроются с третьей миссии' : 'Откроется с третьей миссии'}</i>`}</span>${fb(f, why)}</li>`).join('')}${addX}</ul>` : addX ? `<ul class="feats">${addX}</ul>` : `<p class="lab">У учебного корабля своих умений нет.</p>`}
        </div>${L.stage >= 3 ? inl('featX', id) : ''}</div>`; }).join('')}</div>
    <button type="button" class="devrow" data-act="dev" aria-expanded="${devOpen}"><span><b>В разработке</b> · ещё ${DEV.length} кораблей без имён, характеристик и умений</span><span aria-hidden="true">${devOpen ? '−' : '+'}</span></button>
    ${devOpen ? `<div class="devgrid">${DEV.map((k, i) => `<figure>${THUMBS[k] ? `<img src="${THUMBS[k]}" alt="" width="240" height="150">` : ''}<figcaption><b>Корабль ${i + 7}</b><i class="tag">в разработке</i></figcaption></figure>`).join('')}</div>` : ''}`; }
  // плюс справа от умений и список, который он раскрывает прямо в строке
  const plusBtn = (k, f, attr, label) => { const on = !!openX && openX.k === k && openX.f === f; return `<button type="button" class="btn ghost addx" data-plus="${k}" ${attr} aria-expanded="${on}" aria-label="${label}" title="${label}">${on ? '−' : '+'}</button>`; };
  const inl = (k, f) => { if (!openX || openX.k !== k || openX.f !== f) return ''; const p = PICK[k], T = p.T(), cur = p.cur();
    return `<div class="sub" role="radiogroup" aria-label="${p.title}"><p class="lab">${p.title}. ${p.lead}</p>${p.ids().map(id => `<div class="pick" role="radio" tabindex="0" aria-checked="${id === cur}" data-choose="${id}"><div class="c1 row">${ic(id, api.SKILL_COL[id])}<div><h3>${esc(T[id].name)}</h3>${T[id].net ? '<p class="lab">Нужен союзник</p>' : ''}</div></div><p class="desc">${esc(T[id].note)}${T[id].cd ? ` Перезарядка ${num(T[id].cd)} с.` : ''}</p></div>`).join('')}</div>`; };

  // ---------- выбор из списка (умение корабля, дополнительное умение, дополнительный навык) ----------
  const PICK = { feat2: { title: 'Второе умение корабля', lead: 'На второй миссии открыто одно из двух оставшихся умений корабля.', ids: () => D.SHIPS[L.ship].feats.slice(1), cur: () => L.feat2, T: () => D.FEATS },
    featX: { title: 'Дополнительное умение', lead: 'С третьей миссии к трём умениям корабля добавляется одно из запаса. В сетевой игре каждое достаётся только одному игроку.', ids: () => D.SPARE_FEATS.filter(f => !D.SHIPS[L.ship].feats.includes(f)), cur: () => L.featX, T: () => D.FEATS },
    skillX: { title: 'Дополнительный навык', lead: 'С третьей миссии к трём навыкам специальности добавляется один из запаса. В сетевой игре каждый достаётся только одному игроку.', ids: () => D.SPARE_SKILLS, cur: () => L.skillX, T: () => D.SKILLS } };
  function vPicker() { const p = PICK[picker], T = p.T(), cur = p.cur(); return `<p class="lead">${p.lead}</p><div class="list" role="radiogroup" aria-label="${p.title}">${p.ids().map(id => `<div class="pick" role="radio" tabindex="0" aria-checked="${id === cur}" data-choose="${id}"><div class="c1 row">${ic(id, api.SKILL_COL[id])}<div><h3>${esc(T[id].name)}</h3>${T[id].net ? '<p class="lab">Нужен союзник</p>' : ''}</div></div><p class="desc">${esc(T[id].note)}${T[id].cd ? ` Перезарядка ${num(T[id].cd)} с.` : ''}</p></div>`).join('')}</div>`; }

  // ---------- оружие, спецтехника, команда ----------
  const counter = (k, what) => { const n = LIM[k](), h = pick[k].length; return `<p class="count"><b class="fig">${h}</b> из ${n} ${what}${h < n ? ` · <span class="todo">выберите ещё ${n - h}</span>` : ''}</p>`; };
  const rows = (k, label, line) => `<div class="list" role="group" aria-label="${label}">${IDS[k]().map(id => { const on = pick[k].includes(id), [color, name, sub, desc] = line(id); return `<div class="pick" role="${k === 'w' ? 'button' : 'checkbox'}" tabindex="0" ${k === 'w' ? '' : `aria-checked="${on}"`} data-pick="${k}:${id}"><div class="c1 row">${ic(id, color)}<div><h3>${esc(name)}</h3><p class="lab">${sub}</p></div></div><div class="desc">${desc}</div>${k === 'w' ? `<div class="wcnt"><button type="button" class="sq" data-wdel="${id}" aria-label="Снять из слота" ${on ? '' : 'disabled'}>−</button><b>${pick.w.filter(q => q === id).length}</b><button type="button" class="sq" data-wadd="${id}" aria-label="Поставить в свободный слот">+</button></div>` : ''}${on ? `<i class="ord" aria-hidden="true">${k === 'c' ? 'в команде' : k === 'w' ? 'слот ' + pick.w.map((q, j) => q === id ? j + 1 : 0).filter(Boolean).join(', ') : 'слот ' + (pick[k].indexOf(id) + 1)}</i>` : ''}</div>`; }).join('')}</div>`;
  function vWeapons() { const n = nW(), p = pick.w; return `<p class="count"><b class="fig">${p.length} из ${n}</b> слотов заряжено${p.length < n ? ` · <span class="todo">свободно ${n - p.length}</span>` : ''}</p><div class="barrels">${Array.from({ length: n }, (_, i) => { const w = p[i]; return w ? `<button type="button" class="on" style="--c:${D.WEAPONS[w].color}" data-wbar="${i}" title="Снять оружие со слота"><b>${i + 1}</b>${esc(D.WEAPONS[w].name)} ×</button>` : `<span><b>${i + 1}</b>пусто</span>`; }).join('')}</div><p class="lead">В каждый слот своё оружие: можно все разные, все одинаковые или любую смесь. Нажатие на строку или «+» ставит оружие в следующий свободный слот, «−» снимает. Каждый слот стреляет своей клавишей. Шкала под названием брони показывает, как оружие её пробивает: зелёная — сильнее обычного, красная — слабее.</p>${rows('w', 'Оружие', id => { const w = D.WEAPONS[id]; return [w.color, w.name, DT[w.type], `<p>${esc(w.note)}</p><p class="lab">Урон ${w.dmg} · перезарядка ${num(w.cd)} с · дальность ${w.range}</p><p class="lab against">Против брони</p>${dmgTable(Object.values(D.ARMOR).map(a => [a.short, a.m[w.type]]))}`]; })}`; }
  function vGear() { return `${counter('d', 'мест под спецтехнику занято')}<p class="lead">Цвет значка совпадает с цветом эффекта в бою.</p>${rows('d', 'Спецтехника', id => { const d = D.DEVICES[id]; return [d.color, d.name, `Перезарядка ${num(d.cd)} с`, esc(d.note) + net(d)]; })}`; }
  function vCrew() { return `${counter('c', 'мест в команде занято')}${rows('c', 'Команда', id => { const c = D.CREW[id]; return [undefined, c.name, c.net ? 'Нужен союзник' : 'Член команды', esc(c.note)]; })}`; }

  // ---------- способности (специальность и навыки) ----------
  function vSkills() { const x = L.skillX, X = D.SKILLS[x], st = L.stage, mine = sk2();
    const one = (s, tag = '', btn = '', cls = 'on') => `<li class="${cls}">${ic(s, api.SKILL_COL[s])}<span><b>${esc(D.SKILLS[s].name)}</b>${tag}${net(D.SKILLS[s])}<br>${esc(D.SKILLS[s].note)} Перезарядка ${num(D.SKILLS[s].cd)} с.</span>${btn}</li>`;
    const keys = n => Array.from({ length: n }, (_, i) => `<kbd>${esc(keyName(KEY['skill' + (i + 1)]))}</kbd>`).join(' ');
    // на втором этапе у каждого навыка кнопка «Взять»; с третьего в строке специальности стоит плюс дополнительного навыка
    const row = ([id, q]) => { const me = id === L.spec;
      const list = q.skills.map(s => { if (st !== 2) return one(s); const on = me && mine.includes(s); const full = me && mine.length >= 2 && !on; return one(s, on ? ' <i class="tag">выбран</i>' : '', full ? '' : `<button type="button" class="btn ghost addx" data-sk2="${id}:${s}" aria-label="${on ? 'Убрать навык' : 'Взять навык'}" title="${on ? 'Убрать навык' : 'Взять навык'}">${on ? '−' : '+'}</button>`, full ? 'off' : 'on'); }).join('');
      const pb = st >= 3 ? plusBtn('skillX', id, `data-sfor="${id}"`, me && X ? 'Выбрать другой дополнительный навык' : 'Выбрать дополнительный навык') : '';
      const extra = st < 3 ? '' : me && X ? one(x, ' <i class="tag">дополнительный</i>', pb) : `<li class="off"><span class="hic"></span><span><b>Дополнительный навык</b><br>Один из запаса: нажмите плюс справа</span>${pb}</li>`;
      const plus = st >= 3 ? inl('skillX', id) : '';
      return `<div class="pick spec" role="radio" tabindex="0" aria-checked="${me}" data-spec="${id}"><div class="c1 row">${ic(id)}<div><h3>${esc(q.name)}</h3><p class="lab">${esc(cap(q.role))}</p></div></div><div class="c3"><ul class="feats">${list}${extra}</ul></div>${plus}</div>`; };
    const head = st === 2 ? `<p class="count"><b class="fig">${mine.length}</b> из 2 навыков выбрано${mine.length < 2 ? ` · <span class="todo">${L.spec ? `выберите ещё ${2 - mine.length}` : 'сначала специальность'}</span>` : ''}</p><p class="lead">Специальность не зависит от корабля. На второй миссии из трёх её навыков открыты два: возьмите их сами плюсом справа от навыка. Они встанут на клавиши ${keys(2)}.</p>`
      : `<p class="lead">Специальность не зависит от корабля. Она даёт три навыка на клавишах ${keys(3)}. Четвёртый, дополнительный, выбирается плюсом в его строке.</p>`;
    return `${head}<div class="list" role="radiogroup" aria-label="Специальности">${Object.entries(D.SPECS).map(row).join('')}</div>
    ${st >= 3 ? '' : '<p class="lab">Третий навык специальности и четвёртый из запаса откроются с третьей миссии.</p>'}`; }

  // ---------- улов и древесина ----------
  function vCatch() { const row = (img, name, sub, desc) => `<div class="pick flat catch"><div class="c1 row"><img src="${img}" alt="" width="64" height="64"><div><h3>${esc(name)}</h3><p class="lab">${sub}</p></div></div><p class="desc">${esc(desc)}</p></div>`;
    const kind = (k, plain, how) => `${row(LOOT[k], plain, 'Каждый раз', how)}${D.CATCH[k].map(([ic, n, t]) => row(LOOT[ic], n, 'Особая добыча', t + '.')).join('')}`;
    return `<p class="lead">Рыбу ловят сетями на рыбных местах, древесину пилят у гигантских деревьев. Из каждых трёх попыток ровно одна приносит особую добычу. Она не повторяется, пока не соберёте все пять видов.</p>
    <h3 class="sec">Рыба</h3><div class="list">${kind('fish', 'Обычная рыба', 'От 8 до 15 штук за один заброс сетей.')}${row(LOOT.compass, 'Рыба-компас', 'Только во второй миссии', 'Первый улов на этапе поиска отмечает дорогу к Великому древу.')}</div>
    <h3 class="sec">Древесина</h3><div class="list">${kind('wood', 'Обычная древесина', 'От 18 до 27 брёвен за одну распилку.')}</div>`; }

  // ---------- полигон: мобы, лавка, мир, клавиши ----------
  function vMobs() { const row = (id, T, boss) => `<tr><td class="code">${id}</td><td><b>${esc(T.name)}</b><small>${esc(T.desc || '')}</small></td><td>${boss ? `Босс · миссия ${BOSS_LV[id]}` : ['Мелкий', 'Средний', 'Крупный'][T.cls]}</td><td>${esc(D.ARMOR[T.arm].name)}</td><td class="n">${T.hp}</td><td class="pm"><button type="button" class="sq" data-rm="${id}" aria-label="Убрать: ${esc(T.name)}">−</button><b>${api.countMob(id)}</b><button type="button" class="sq" data-add="${id}" aria-label="Добавить: ${esc(T.name)}">+</button></td></tr>`;
    return `<p class="lead">Враги появляются перед носом корабля. По умолчанию они не замечают корабль и служат мишенями.</p><div class="bar"><label class="chk"><input type="checkbox" id="hg-see"${api.see ? ' checked' : ''}> Враги видят корабль и отвечают на атаку</label><button type="button" class="btn ghost" data-act="clear">Убрать всех</button><button type="button" class="btn ghost" data-act="reset">Вернуть стартовый набор</button><button type="button" class="btn ghost" data-act="flood">Показать «Потоп»</button></div>
    <table><thead><tr><th>Код</th><th>Название</th><th>Класс</th><th>Броня</th><th class="n">Прочность</th><th>В мире</th></tr></thead><tbody>${Object.entries(D.MOBS).sort((a, b) => a[1].cls - b[1].cls || a[1].hp - b[1].hp).map(([id, T]) => row(id, T, false)).join('')}${Object.entries(D.BOSSES).sort((a, b) => BOSS_LV[a[0]] - BOSS_LV[b[0]]).map(([id, T]) => row(id, T, true)).join('')}</tbody></table>`; }
  // мобы по уровню: мелкие, средние, крупные, внутри по прочности; боссы — по номеру миссии
  const BOSS_LV = { 'BOSS-1': 1, 'BOSS-2': 2, 'BOSS-3': 3, 'BOSS-9': 4, 'BOSS-6': 5, 'BOSS-8': 6, 'BOSS-4': 7, 'BOSS-5': 8, 'BOSS-7': 9 };
  function vShop() { const k = L.crew.includes('CREW-07') ? 0.8 : 1;
    return `<p class="lead">В миссии лавка открывается перед боссом. С этого момента золото больше не падает, а общее золото команды делится поровну между капитанами. Награду надо забрать: пролетите над телом сбитого врага.</p>
    <div class="coins">${[['bronze', 'мелкий враг'], ['silver', 'средний враг'], ['gold', 'крупный враг; босс даёт пять']].map(([k, who, v = num(D.COIN[k])]) => `<div><img src="${COINS[k]}" alt="" width="44" height="44"><span><b>${D.COIN_NAMES[k]}</b><br>${v} золота · ${who}</span></div>`).join('')}</div>
    <div class="bar"><p class="count"><b class="fig">${fmt(res.gold)}</b> ${shop.open && api.mission.on ? 'вашего золота' : 'золота'}${shop.open && api.mission.on && res.team != null ? ` · общее золото команды ${fmt(res.team)} поделено поровну` : ''}</p>${api.mission.on ? '' : `<button type="button" class="btn ghost" data-act="shop">${shop.open ? 'Закрыть лавку и сбросить покупки' : 'Открыть лавку'}</button>`}</div>
    ${shop.open ? (() => { const mates = api.team().filter(q => !q.me); return `<div class="bar give"><label>Передать <input type="number" id="hg-give" min="0.5" step="0.5" value="1" aria-label="Сколько золота передать"${mates.length ? '' : ' disabled'}> золота</label><select id="hg-to" aria-label="Кому"${mates.length ? '' : ' disabled'}>${mates.length ? mates.map(q => `<option>${esc(q.nick)}</option>`).join('') : '<option>в команде нет других капитанов</option>'}</select><button type="button" class="btn ghost" data-act="give"${mates.length ? '' : ' disabled'}>Передать</button><p class="lab">При открытии лавки общее золото делится поровну, у каждого капитана своё. Лишнее можно отдать тому, кому не хватает на покупку${mates.length ? '' : '. В одиночном полёте передавать некому'}</p></div>`; })() : ''}
    <div class="list">${D.SHOP.map(it => { const lv = it.id === 'fix' ? 0 : shop.lv[it.id], full = it.id !== 'fix' && lv >= it.max, price = it.price[Math.min(lv, it.price.length - 1)] * k; const [nm, ds] = it.name.split(': '); const n = v => String(Math.round(v * 100) / 100).replace('.', ','), now = it.step ? it.step.slice(0, lv).reduce((a, b) => a + b, 0) : 0, nx = it.step && lv < it.max ? it.step[lv] : null; const txt = it.step ? `${cap(ds)}: ${nx != null ? `следующий уровень +${n(nx)}${it.unit}` : 'всё куплено'}${lv ? `, сейчас +${n(now)}${it.unit}` : ''}. Уровни: ${it.step.map(q => '+' + n(q) + it.unit).join(' → ')}` : cap(ds || ''); return `<div class="pick flat"><div class="c1"><h3>${esc(nm)}</h3><p class="lab">${it.id === 'fix' ? 'Сколько угодно раз' : `Куплено ${lv} из ${it.max}`}</p></div><p class="desc">${esc(txt)}</p><button type="button" class="btn" data-buy="${it.id}"${!shop.open || full ? ' disabled' : ''}>${full ? 'Максимум' : `Купить за ${fmt(price)}`}</button></div>`; }).join('')}</div>`; }
  function vWorld() { const pl = api.places();
    return `<p class="lead">«Показать» переносит корабль к острову с этой породой или постройкой, чтобы рассмотреть её в полёте.</p><h3 class="sec">Виды островов</h3><div class="list">${KINDS.map(([n, d, s]) => `<div class="pick flat"><div class="c1"><h3>${n}</h3><p class="lab">${s ? 'Можно обыскать' : 'Без обыска'}</p></div><p class="desc">${d}</p>${pl.kinds[n] ? `<button type="button" class="btn ghost" data-go="k:${n}">Показать</button>` : ''}</div>`).join('')}</div>
    <h3 class="sec">Материалы породы</h3><div class="list">${api.rocks.map((v, i) => `<div class="pick flat"><div class="c1 row"><span class="sw" style="background:linear-gradient(135deg,${css(v.b)} 0 38%,${css(v.a)} 38% 72%,${css(v.c)} 72%)"><i style="background:${css(v.gB)}"></i></span><div><h3>${cap(v.name)}</h3><p class="lab">Порода ${i}</p></div></div><p class="desc">${ROCK_NOTES[i]}</p>${pl.rocks[i] ? `<button type="button" class="btn ghost" data-go="r:${i}">Показать</button>` : ''}</div>`).join('')}</div>`; }
  function vKeys() { return `<p class="lead">Нажмите на клавишу в списке, затем на новую. Настройки хранятся в этом браузере.</p><div class="keys">${Object.keys(D.KEY_NAMES).map(a => `<div class="krow"><span>${esc(D.KEY_NAMES[a])}</span><button type="button" class="btn ghost key" data-key="${a}"${capture === a ? ' aria-pressed="true"' : ''}>${capture === a ? 'Нажмите клавишу' : esc(keyName(KEY[a]))}</button></div>`).join('')}</div><div class="bar"><button type="button" class="btn ghost" data-act="keys-reset">Сбросить по умолчанию</button></div>`; }
  const VIEW = { mission: vMission, lobby: vLobby, ship: vShip, weapons: vWeapons, skills: vSkills, gear: vGear, crew: vCrew, mobs: vMobs, shop: vShop, catch: vCatch, world: vWorld, keys: vKeys };

  function draw(keep = true) { const st = steps(), wiz = mode === 'wizard'; if (!tabList().includes(tab)) tab = tabList()[0]; const i = st.indexOf(tab);
    $('hg-kicker').textContent = picker ? NAMES[tab] : wiz ? (tab === 'keys' ? 'Подготовка к вылету' : `Подготовка к вылету · шаг ${i + 1} из ${st.length}`) : api.mission.on ? `Ангар · ${(D.MISSIONS[api.mission.id || L.mission] || D.MISSIONS['M-0']).name} · игра на паузе` : 'Ангар · игра на паузе';
    $('hg-title').textContent = picker ? PICK[picker].title : NAMES[tab];
    $('hg-stage').style.display = (L.mission === 'M-0' || !L.mission) && tab !== 'mission' && tab !== 'lobby' && !(wiz && !L.mission) ? '' : 'none';
    $('hg-stage').innerHTML = `<span class="lab" id="hg-stage-l">Этап способностей</span><div role="group" aria-labelledby="hg-stage-l">${[1, 2, 3].map(n => `<button type="button" class="seg" data-stage="${n}" aria-pressed="${L.stage === n}">${n === 3 ? '3 и дальше' : n}</button>`).join('')}</div>`;
    tabsEl.innerHTML = (wiz ? st : tabList()).map((id, j) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}">${wiz ? `<span class="fig">${j + 1}</span> ` : ''}${NAMES[id]}</button>`).join('');
    const y = body.scrollTop; body.innerHTML = picker ? vPicker() : VIEW[tab](); body.scrollTop = keep ? y : 0;
    drawFoot(); }
  function drawFoot() { const st = steps(), wiz = mode === 'wizard', i = st.indexOf(tab); const m = `<p class="msg" role="status">${esc(msg)}</p>`; let f;
    if (picker) f = `<button type="button" class="btn ghost" data-act="unpick">Назад</button>${m}`;
    else if (wiz && tab === 'keys') f = `<button type="button" class="btn ghost" data-act="keys-back">Назад к подготовке</button>${m}`;
    else if (wiz && tab === 'lobby') { const bad = st.find(t => need(t)); f = `<button type="button" class="btn ghost" data-act="prev"${count ? ' disabled' : ''}>Назад</button>${m}<button type="button" class="btn ghost" data-act="keys"${count ? ' disabled' : ''}>Управление</button>${count ? (NET.client ? '' : '<button type="button" class="btn ghost" data-act="unready">Отмена</button>') : NET.client ? `<button type="button" class="btn" data-act="gready"${bad ? ' disabled' : ''}>${bad ? `Не готово: ${NAMES[bad]}` : ready ? 'Не готов' : 'Готов'}</button>` : `<button type="button" class="btn" data-act="ready"${bad || (NET.live && !allReady()) ? ' disabled' : ''}>${bad ? `Не готово: ${NAMES[bad]}` : NET.live ? (allReady() ? 'Начать вылет' : 'Ждём готовности команды') : 'Готов'}</button>`}`; }
    else if (wiz) { const n = need(); f = `<button type="button" class="btn ghost" data-act="prev"${i <= 0 ? ' disabled' : ''}>Назад</button>${m}${tab === 'mission' ? '' : '<button type="button" class="btn ghost" data-act="wipe">Сбросить выбор</button>'}<button type="button" class="btn ghost" data-act="keys">Управление</button><button type="button" class="btn" data-act="next"${n ? ' disabled' : ''}>${n || `Далее: ${NAMES[st[i + 1]]}`}</button>`; }
    else f = `${m}${api.mission.on ? '' : '<button type="button" class="btn ghost" data-act="remission">Сменить миссию</button>'}<button type="button" class="btn" data-act="close">Вернуться в полёт (${esc(keyName(KEY.menu))})</button>`;
    foot.innerHTML = f; }
  function go(t) { tab = t; openX = null; picker = null; capture = null; syncPick(); draw(false); }
  function close() { capture = null; picker = null; syncPick(); root.style.display = 'none'; api.onClose(); }

  function act(el) { const d = el.dataset; msg = '';
    if (d.act === 'room-new') { if (!L.nick.trim()) { msg = 'Сначала введите имя капитана'; return draw(); } netBusy = true; NET.create(err => { netBusy = false; if (err) msg = err; draw(); }); return draw(); }
    if (d.act === 'room-join') { roomJoin(); return draw(); }
    if (d.act === 'room-leave') { NET.leave(); ready = false; msg = 'Вы вышли из комнаты'; return draw(); }
    if (d.act === 'room-copy') { const t = NET.link(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { copied = true; draw(); setTimeout(() => { copied = false; }, 2500); }, () => { const el = $('hg-link'); if (el) { el.select(); document.execCommand('copy'); copied = true; draw(); } }); return; }
    if (d.act === 'gready') { ready = !ready; NET.sendMe(); return draw(); }
    if (count && d.act !== 'unready') return;
    if (NET.client && d.mission) return;
    if (d.tab) return go(d.tab);
    if (d.mission) { L.mission = d.mission; const q = D.MISSIONS[d.mission]; if (q.stage) L.stage = q.stage; else if (!L.stage) L.stage = 1; api.apply(false); syncPick(); return draw(); }
    if (d.act === 'ready') { if (NET.client) return; go3(); return; }
    if (d.act === 'ready-net') { count = -1; draw(); requestAnimationFrame(() => requestAnimationFrame(() => Promise.resolve(api.launch()).catch(() => {}).then(() => { count = 3; draw(); timer = setInterval(() => { count--; if (count <= 0) { clearInterval(timer); timer = null; count = 0; close(); api.afterLaunch(); } else draw(); }, 1000); }))); return; }
    if (d.act === 'unready') { clearInterval(timer); timer = null; count = 0; return draw(); }
    if (d.stage) { L.stage = +d.stage; openX = null; picker = null; api.apply(false); syncPick(); }
    else if (d.plus) { if (d.sfor && d.sfor !== L.spec) { L.spec = d.sfor; L.skills2 = []; api.apply(false); } if (d.for && (d.for !== L.ship || !L.chosen)) { L.ship = d.for; L.chosen = true; L.feat2 = null; if (D.SHIPS[L.ship].feats.includes(L.featX)) L.featX = null; api.apply(true); syncPick(); } const f = d.sfor || d.for || ''; openX = openX && openX.k === d.plus && openX.f === f ? null : { k: d.plus, f }; return draw(); }
    else if (d.choose) { L[openX ? openX.k : picker] = d.choose; openX = null; picker = null; api.apply(false); syncPick(); return draw(); }
    else if (d.feat2 != null) { const [sh, f] = d.feat2.split(':'); if (sh !== L.ship || !L.chosen) { L.ship = sh; L.chosen = true; if (D.SHIPS[sh].feats.includes(L.featX)) L.featX = null; } L.feat2 = f || null; api.apply(true); syncPick(); }
    else if (d.ship) { if (d.ship !== L.ship || !L.chosen) { L.ship = d.ship; L.chosen = true; L.feat2 = null; if (D.SHIPS[L.ship].feats.includes(L.featX)) L.featX = null; api.apply(true); syncPick(); } }
    else if (d.sk2) { const [sp, s] = d.sk2.split(':'); if (L.spec !== sp) { L.spec = sp; L.skills2 = []; } const a = L.skills2 = sk2(), i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else if (a.length < 2) a.push(s); else msg = 'На второй миссии открыты только два навыка из трёх. Уберите один, чтобы взять другой.'; api.apply(false); }
    else if (d.spec) { if (d.spec !== L.spec) { L.spec = d.spec; L.skills2 = []; } api.apply(false); }
    else if (d.wadd) wAdd(d.wadd);
    else if (d.wdel) wDel(pick.w.lastIndexOf(d.wdel));
    else if (d.wbar != null) wDel(+d.wbar);
    else if (d.pick) { const [k, id] = d.pick.split(':'); toggle(k, id); }
    else if (d.add) api.addMob(d.add); else if (d.rm) api.removeMobOf(d.rm);
    else if (d.act === 'remission') { count = 0; show('wizard', 'mission'); return; }
    else if (d.buy) msg = api.buy(d.buy) || '';
    else if (d.act === 'give') msg = api.give($('hg-to').value, +$('hg-give').value);
    else if (d.go) { const [k, v] = d.go.split(':'), pl = api.places(); api.goTo(k === 'k' ? pl.kinds[v] : pl.rocks[+v]); return close(); }
    else if (d.key) capture = d.key;
    else if (d.act === 'clear') api.clearMobs(); else if (d.act === 'reset') api.resetMobs();
    else if (d.act === 'flood') { api.flood(2); return close(); }
    else if (d.act === 'shop') api.openShop(!shop.open);
    else if (d.act === 'keys-reset') { Object.assign(KEY, D.KEYS_DEFAULT); api.saveKeys(); }
    else if (d.act === 'keys') { keysBack = tab; return go('keys'); }
    else if (d.act === 'keys-back') return go(keysBack || 'ship');
    else if (d.act === 'unpick') { picker = null; return draw(false); }
    else if (d.act === 'dev') { devOpen = !devOpen; return draw(); }
    else if (d.act === 'wipe') { Object.assign(L, { chosen: false, weapons: [], devices: [], crew: [], spec: null, skills2: [], feat2: null, featX: null, skillX: null }); api.apply(true); msg = 'Выбор сброшен'; tab = 'ship'; syncPick(); return draw(false); }
    else if (d.act === 'prev' || d.act === 'next') { const st = steps(), i = st.indexOf(tab) + (d.act === 'next' ? 1 : -1); return go(st[Math.max(0, Math.min(st.length - 1, i))]); }
    else if (d.act === 'close') return close();
    draw(); }
  const hit = e => e.target.closest('button') || e.target.closest('[data-ship],[data-spec],[data-pick],[data-choose],[data-mission]');
  root.addEventListener('click', e => { const el = hit(e); if (el && !el.disabled && root.contains(el)) act(el); });
  root.addEventListener('change', e => { if (e.target.id === 'hg-see') api.see = e.target.checked; });
  root.addEventListener('input', e => { if (e.target.id === 'hg-nick') { L.nick = e.target.value.slice(0, 16); api.apply(false); drawFoot(); if (NET.role) NET.sendMe(); } if (e.target.id === 'hg-code') { joinCode = e.target.value.toUpperCase(); e.target.value = joinCode; } });
  root.addEventListener('keydown', e => { if (e.target.id === 'hg-code' && e.key === 'Enter') { roomJoin(); draw(); } });
  function key(e) { if (e.target && (e.target.id === 'hg-nick' || e.target.id === 'hg-code') && e.code !== 'Escape') return;
    if (capture) { e.preventDefault(); if (e.code !== 'Escape') { const other = Object.keys(KEY).find(a => KEY[a] === e.code && a !== capture); if (other) { KEY[other] = KEY[capture]; msg = `Клавиша ${keyName(e.code)} была занята действием «${D.KEY_NAMES[other]}»: действия поменялись местами.`; } KEY[capture] = e.code; api.saveKeys(); } capture = null; return draw(); }
    if (e.code === 'Escape' || e.code === KEY.menu) { e.preventDefault(); if (picker) { picker = null; draw(false); } else if (mode === 'wizard') { if (tab === 'keys') go(keysBack || 'ship'); } else close(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && e.target.matches && e.target.matches('.pick[tabindex]')) { e.preventDefault(); const id = e.target.dataset; act(e.target); const sel = Object.keys(id).map(k => `[data-${k}="${id[k]}"]`).join(''); const again = sel && body.querySelector('.pick' + sel); if (again) again.focus(); } }
  function show(m, t) { mode = m; tab = t || 'ship'; picker = null; capture = null; msg = ''; syncPick(); root.dataset.mode = m; root.style.display = 'flex'; draw(false); const f = body.querySelector('.pick[aria-checked="true"]') || foot.querySelector('button:not([disabled])'); if (f) f.focus({ preventScroll: true }); }
  // вылет: отсчёт 3-2-1 после подготовки мира. У гостя его запускает ведущий; опоздавший к началу влетает сразу
  function go3(late) { clearInterval(timer); count = -1; draw(); requestAnimationFrame(() => requestAnimationFrame(() => Promise.resolve(api.launch()).catch(e => console.error(e)).then(() => { if (late) { count = 0; ready = false; close(); api.afterLaunch(); return; } count = 3; draw(); timer = setInterval(() => { count--; if (count <= 0) { clearInterval(timer); timer = null; count = 0; ready = false; close(); api.afterLaunch(); } else draw(); }, 1000); }))); }
  return { key, open(t) { show('tabs', t); }, start() { count = 0; ready = false; show('wizard', NET.role ? 'lobby' : 'mission'); }, close, get tab() { return tab; }, get mode() { return mode; }, get ready() { return ready; }, netGo(late) { if (root.style.display === 'none') show('wizard', 'lobby'); go3(late); }, redraw() { if (root.style.display !== 'none') draw(); } };
}
