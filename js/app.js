/* King of Tokyo Lab: screens. Local games run through the shared online module's createLocal
   (same snapshot shape as online rooms), online rooms through createOnline. */
import { createLocal } from './online.js?v=1';

const { CARDS, MONSTERS, EDITIONS } = window.KotCards;
// CARDS holds the names/costs/texts of one edition at a time: the running game's, else the Settings choice
const syncEd = ed => window.KotCards.setEdition(ed || (snap && snap.pub ? snap.pub.edition : store.settings.edition));
const E = window.KotEngine, D = window.KotDice, Bots = window.KotBots, Art = window.KotArt;
const GAME = window.KotGame.game;
const STR = window.KotStrength || {};
const VERSION = '1.1';

// ------------------------------------------------------------------ storage
const KEY = 'kot-lab-v1';
const DEFAULTS = { level: 'medium', edition: '2016', bay: true, duel: false, speed: 'normal', hints: true, name: '', kinds: ['human', 'computer', 'computer', 'computer'] };
function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') o = {};
  const s = Object.assign({}, DEFAULTS, o.settings && typeof o.settings === 'object' ? o.settings : {});
  if (!['easy', 'medium', 'hard'].includes(s.level)) s.level = 'medium';
  if (!EDITIONS[s.edition]) s.edition = '2016';
  if (!['normal', 'fast'].includes(s.speed)) s.speed = 'normal';
  s.bay = s.bay !== false; s.hints = s.hints !== false; s.duel = s.duel === true;
  s.name = typeof s.name === 'string' ? s.name.slice(0, 20) : '';
  if (!Array.isArray(s.kinds) || s.kinds.length < 2 || s.kinds.length > 6 || !s.kinds.every(k => k === 'human' || k === 'computer')) s.kinds = DEFAULTS.kinds.slice();
  if (!s.kinds.includes('human')) s.kinds[0] = 'human';
  const saved = o.saved && typeof o.saved === 'object' && o.saved.state && Array.isArray(o.saved.kinds) ? o.saved : null;
  const keepSel = o.keepSel && typeof o.keepSel === 'object' && typeof o.keepSel.key === 'string' && Array.isArray(o.keepSel.keep) ? o.keepSel : null;
  return { settings: s, saved, online: !!o.online, study: Array.isArray(o.study) ? o.study.slice(-200) : [], keepSel };
}
const store = load();
// each seat's monster: distinct, one per seat
function fixMons() {
  const st = store.settings;
  let m = Array.isArray(st.mons) ? st.mons.filter((x, i, a) => Number.isInteger(x) && x >= 0 && x < 6 && a.indexOf(x) === i) : [];
  for (let k = 0; m.length < st.kinds.length && k < 6; k++) if (!m.includes(k)) m.push(k);
  st.mons = m.slice(0, st.kinds.length);
}
fixMons();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode: play on without saving */ } }

// ------------------------------------------------------------------ helpers
const $ = (sel, el) => (el || document).querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = x => (x >= 0.995 && x < 1 ? '>99' : x > 0 && x < 0.005 ? '<1' : Math.round(x * 100)) + '%';
const fmt1 = x => (Math.round(x * 10) / 10).toFixed(1);
// red → green scale for a 0..1 goodness value
function scale(g) { g = Math.max(0, Math.min(1, g)); const h = Math.round(g * 130); return `hsl(${h} 70% 62%)`; }
function toast(msg) {
  msg = String(msg);
  const old = $('.toast');
  // the same message from two places (an action's result and the room's error event) shows once
  if (old && old.textContent === msg) { clearTimeout(old._t); old._t = setTimeout(() => old.remove(), 2600); return; }
  if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  t._t = setTimeout(() => t.remove(), 2600);
}

// tap guard: a quick second tap (double tap / double-click) must not land on whatever was just drawn
// in the same spot (Roll -> Reroll, Reroll -> the next Reroll, a card -> its Buy sheet). Taps elsewhere pass.
const tapGuard = { t: -1e9, x: 0, y: 0, el: null };
document.addEventListener('click', e => {
  const tgt = e.target && e.target.closest ? e.target : null;
  if (!tgt || !tgt.closest('#v-play, #sheet')) return;
  const g = tapGuard, now = performance.now();
  const near = Math.abs(e.clientX - g.x) < 44 && Math.abs(e.clientY - g.y) < 44;
  const redrawn = g.el && tgt !== g.el && (!g.el.isConnected || (!!tgt.closest('#sheet') && !g.el.closest('#sheet')));
  if (now - g.t < 450 && near && redrawn) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
  g.t = now; g.x = e.clientX; g.y = e.clientY; g.el = tgt;
}, true);
function costTag(n) { return `<span class="cost">${Art.icon('E', 14)}${n}</span>`; }
const monName = i => MONSTERS[i] ? MONSTERS[i].name : 'Monster';

// ? popovers
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
document.addEventListener('click', e => {
  const q = e.target.closest('.q');
  if (q) {
    e.stopPropagation(); closePop();
    popEl = document.createElement('div'); popEl.className = 'pop'; popEl.innerHTML = q.dataset.tip; document.body.appendChild(popEl);
    const r = q.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left - w / 2 + 10)), y = r.bottom + 8;
    if (y + h > window.innerHeight - 10) y = r.top - h - 8;
    popEl.style.left = x + 'px'; popEl.style.top = Math.max(8, y) + 'px';
    return;
  }
  if (popEl && !e.target.closest('.pop')) closePop();
}, true);
const qTip = t => `<button class="q" data-tip="${esc(t)}" aria-label="Why?">?</button>`;

// sheets
function openSheet(html, onMount) {
  closeSheet();
  const b = document.createElement('div'); b.className = 'sheet-back'; b.id = 'sheet';
  b.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  b.addEventListener('click', e => { if (e.target === b) closeSheet(); });
  document.body.appendChild(b);
  if (onMount) onMount(b.firstElementChild);
  ui.sheetOpen = true;
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); ui.sheetOpen = false; ui.sheetKind = null; }

// ------------------------------------------------------------------ app state
const ui = { tab: 'play', mode: null, keep: new Set(), lastRoll: null, change: null, fxKey: '', marketSeen: [], sheetOpen: false, sheetKind: null, autoDone: null, lobbyN: null, connecting: false, endShown: false };
let room = null;     // local room (createLocal) or online room
let snap = null;     // latest snapshot
const net = { room: null };

// ------------------------------------------------------------------ tabs + back button
function setTab(t, push) {
  if (!['play', 'odds', 'cards', 'settings'].includes(t)) t = 'play';
  ui.tab = t;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
  if (push) history.pushState({ tab: t }, '', '#' + t);
  closeSheet(); closePop();
  render();
}
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab, true); });
// Back with a sheet open only closes the sheet: the address goes back to the tab that is still shown
window.addEventListener('popstate', () => {
  if (ui.sheetOpen) { closeSheet(); history.pushState({ tab: ui.tab }, '', '#' + ui.tab); return; }
  setTab((location.hash || '#play').slice(1), false);
});

function render() {
  if (ui.tab === 'play') renderPlay();
  else if (ui.tab === 'odds') renderOdds();
  else if (ui.tab === 'cards') renderCards();
  else renderSettings();
}

// ================================================================== PLAY
// ?botms=N in the address overrides the computers' pace (used by the automated screen tests)
const BOTMS = (() => { try { const v = +new URLSearchParams(location.search).get('botms'); return v > 0 ? v : 0; } catch (e) { return 0; } })();
function speedMs() { return BOTMS || (store.settings.speed === 'fast' ? 320 : 750); }

function startLocal(resume) {
  closeRoom();
  const st = store.settings;
  const kinds = resume ? resume.kinds : st.kinds.slice();
  let hn = 0;
  const seats = kinds.map((k, i) => ({ kind: k, name: k === 'human' ? (kinds.filter(x => x === 'human').length > 1 ? 'Player ' + (++hn) : (st.name || 'You')) : 'Computer' }));
  const g = resume ? Object.assign({}, GAME, { setup: () => resume.state }) : GAME;
  // computers get their monster's name
  ui.restoring = !!resume;
  try {
    fixMons();
    room = createLocal({ game: g, seats, options: { edition: st.edition, level: st.level, bay: st.bay, duel: st.duel, monsters: st.mons }, botDelayMs: speedMs() });
    ui.mode = 'local'; ui.endShown = false; ui.keep = new Set(); ui.lastRoll = null; ui.fxKey = ''; ui.marketSeen = [];
    if (!resume) { store.study = []; store.keepSel = null; }
    room.on('change', s => onSnap(s));
    room.on('error', e => toast(String(e && e.message || e)));
    // a resumed game is restored and drawn inside this try: a broken save fails here, not later
    room.start();
    if (resume && (!snap || !snap.pub || !document.querySelector('#v-play #game'))) throw new Error('nothing drawn');
  } catch (e) { ui.restoring = false; restoreFailed(); return; }
  ui.restoring = false;
}
function restoreFailed() {
  closeRoom(); store.saved = null; save();
  toast('Couldn’t restore the saved game.');
  if (ui.tab === 'play') renderPlay();
}
function closeRoom() {
  if (room && room.mode === 'local' && room.close) room.close();
  room = null; snap = null; ui.mode = null;
  clearTimeout(ui.autoDone);
}
function onSnap(s) {
  snap = s;
  if (ui.mode === 'local' && room && room.state) {
    if (s.status === 'finished') store.saved = null;
    else store.saved = { state: room.state, kinds: room.state.players.map(p => p.kind) };
    save();
  }
  if (ui.tab === 'play') renderPlay();
}

// act for the seat this screen plays
async function act(a) {
  if (!room || !snap) return;
  recordStudy(a);
  clearTimeout(ui.autoDone);
  if (ui.mode === 'local') {
    const r = room.act(a, snap.mySeat);
    if (!r.ok) toast(r.message);
  } else {
    // one move in flight at a time: a second tap before the room answers is dropped
    if (ui.acting) return;
    ui.acting = true;
    try { const r = await room.act(a); if (!r.ok) toast(r.message); } finally { ui.acting = false; }
  }
}

// keep a study record of the human's dice decisions (points lost vs the best keep)
function recordStudy(a) {
  try {
    const pub = snap.pub, me = snap.mySeat;
    if (!pub || !pub.ask || pub.ask.type !== 'roll' || pub.t.seat !== me) return;
    if (a.t !== 'reroll' && a.t !== 'done') return;
    if (a.t === 'reroll' && a.use && a.use !== 'normal') return;
    const adv = Bots.advise(pub, me);
    if (!adv || !adv.r) return;
    let chosen;
    if (a.t === 'done') chosen = adv.value(adv.counts);
    else { const kc = D.countsOf(a.keep.map(k => adv.faces[k])); chosen = adv.sv.keepEv(kc, adv.r); }
    store.study.push({ turn: pub.turnNo, faces: adv.faces.join(''), keep: a.t === 'done' ? 'all' : a.keep.join(','), best: adv.keep.join(','), lost: Math.max(0, adv.ev - chosen) });
    if (store.study.length > 200) store.study.splice(0, store.study.length - 200);
  } catch (e) { /* advice is optional */ }
}

// the screen's game view: public view with my seat's secret
function viewState() { return snap && snap.pub; }

function renderPlay() {
  syncEd();
  const v = $('#v-play');
  if (ui.mode === 'online' && snap && snap.status === 'lobby') return renderLobby(v);
  if (ui.mode === 'online' && (!snap || ['joining', 'none', 'closed', 'left'].includes(snap.status))) {
    if (snap && (snap.status === 'closed' || snap.status === 'left')) { ui.mode = null; store.online = false; save(); return renderSetup(v); }
    v.innerHTML = `<div class="setup"><div class="panel"><b>Connecting…</b><span class="muted small">Getting the room.</span><button class="btn" id="btn-cancel">Cancel</button></div></div>`;
    $('#btn-cancel').onclick = () => leaveOnline();
    return;
  }
  if (!room || !snap || !snap.pub) return renderSetup(v);
  renderGame(v);
}

// ------------------------------------------------------------------ setup screen
function renderSetup(v) {
  const st = store.settings;
  const kinds = st.kinds;
  fixMons();
  const seatRows = kinds.map((k, i) => `<div class="seatrow"><button class="icon-btn" style="width:38px;height:36px;border:0;background:none" data-mon-pick="${i}" aria-label="Change monster">${Art.monster(st.mons[i], 32)}</button><span class="nmx">${MONSTERS[st.mons[i]].name} <span class="muted small">· ${k === 'human' ? (i === 0 ? esc(st.name || 'You') : 'Person ' + (i + 1)) : st.level[0].toUpperCase() + st.level.slice(1)}</span></span>
      <button class="btn small kindbtn" data-seat="${i}" ${i === 0 ? 'disabled' : ''}>${k === 'human' ? 'Person' : 'Computer'}</button></div>`).join('');
  v.innerHTML = `<div class="setup">
    <div class="hero"><img src="icon.svg" alt=""><div><h1>King of Tokyo Lab</h1><p>Smash Tokyo with exact dice odds.</p></div></div>
    <div class="panel">
      <div class="row"><span class="label grow">Monsters</span>${qTip('Each extra “Person” seat is another player passing this phone. With 5 or 6 monsters, Tokyo Bay opens as a second spot in Tokyo.')}</div>
      <div class="seg" id="seg-n">${[2, 3, 4, 5, 6].map(n => `<button data-n="${n}" aria-pressed="${kinds.length === n}">${n}</button>`).join('')}</div>
      <div class="seats${kinds.length >= 5 ? ' dense' : ''}">${seatRows}</div>
      ${store.saved ? `<div class="row"><button class="btn warm grow" id="btn-resume">Resume game</button><button class="btn" id="btn-new">New game</button></div>`
        : `<button class="btn primary" id="btn-new">Start game</button>`}
    </div>
    <div class="panel">
      <div class="row"><span class="label grow">Play online</span>${qTip('Friends join with the room code on their own phones. Empty seats become computers when you start. Free, no account.')}</div>
      <div class="row"><input class="txt grow" id="in-name" maxlength="20" placeholder="Your name" value="${esc(st.name)}" autocomplete="off"><button class="btn" id="btn-create">Create room</button></div>
      <div class="row"><input class="txt code grow" id="in-code" maxlength="9" placeholder="CODE" autocomplete="off" autocapitalize="characters"><button class="btn" id="btn-join">Join</button></div>
    </div>
  </div>`;
  v.querySelectorAll('#seg-n button').forEach(b => b.onclick = () => {
    const n = +b.dataset.n;
    while (st.kinds.length < n) st.kinds.push('computer');
    st.kinds.length = n; save(); renderSetup(v);
  });
  v.querySelectorAll('[data-mon-pick]').forEach(b => b.onclick = () => {
    const i = +b.dataset.monPick;
    let m = st.mons[i];
    for (let k = 0; k < 6; k++) { m = (m + 1) % 6; if (!st.mons.includes(m)) break; }
    st.mons[i] = m; save(); renderSetup(v);
  });
  v.querySelectorAll('.kindbtn').forEach(b => b.onclick = () => {
    const i = +b.dataset.seat; st.kinds[i] = st.kinds[i] === 'human' ? 'computer' : 'human'; save(); renderSetup(v);
  });
  $('#btn-new').onclick = () => { store.saved = null; save(); startLocal(null); };
  if ($('#btn-resume')) $('#btn-resume').onclick = () => startLocal(store.saved);
  $('#in-name').oninput = e => { st.name = e.target.value.slice(0, 20); save(); };
  $('#btn-create').onclick = () => createOnlineRoom();
  $('#btn-join').onclick = () => joinOnlineRoom($('#in-code').value);
}

// ------------------------------------------------------------------ online
async function loadOnline() {
  if (net.room) return net.room;
  const mod = await import('./online.js?v=1');
  if (net.room) return net.room;
  net.room = mod.createOnline({ game: GAME, gameId: 'king-of-tokyo', botDelayMs: 900 });
  net.room.on('change', s => { if (ui.mode !== 'online') return; onSnap(s); });
  net.room.on('error', msg => { toast(String(msg)); if (ui.tab === 'play') renderPlay(); });
  return net.room;
}
function needName() {
  const n = (store.settings.name || '').trim();
  if (!n) { toast('Type your name first.'); const el = $('#in-name'); if (el) el.focus(); return null; }
  return n;
}
async function createOnlineRoom() {
  const name = needName(); if (!name) return;
  closeRoom(); ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  try {
    const r0 = await loadOnline();
    room = r0;
    const kinds = store.settings.kinds;
    const seats = kinds.map((k, i) => (i === 0 ? 'human' : k === 'computer' ? 'computer' : 'empty'));
    fixMons();
    const r = await r0.createRoom({ name, seats, options: { edition: store.settings.edition, level: store.settings.level, bay: store.settings.bay, duel: store.settings.duel, monsters: store.settings.mons } });
    if (!r.ok) { toast(r.message); ui.mode = null; room = null; snap = null; renderPlay(); return; }
    store.online = true; save();
  } catch (e) { toast('Online play couldn’t load. Check your internet.'); ui.mode = null; room = null; snap = null; renderPlay(); }
}
async function joinOnlineRoom(code) {
  const name = needName(); if (!name) return;
  code = String(code || '').replace(/\s+/g, '').toUpperCase();
  if (code.length !== 5) { toast('Room codes have 5 characters.'); return; }
  closeRoom(); ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  try {
    const r0 = await loadOnline();
    room = r0;
    const r = await r0.joinRoom(code, name);
    if (!r.ok) { toast(r.message); ui.mode = null; room = null; snap = null; renderPlay(); return; }
    store.online = true; save();
  } catch (e) { toast('Online play couldn’t load. Check your internet.'); ui.mode = null; room = null; snap = null; renderPlay(); }
}
async function leaveOnline() {
  const r = net.room;
  ui.mode = null; room = null; snap = null; store.online = false; save();
  renderPlay();
  if (r) { try { if (r.isHost && snap && snap.status === 'finished') await r.close(); else await r.leave(); } catch (e) { /* ignore */ } }
}

function renderLobby(v) {
  const s = snap;
  // each seat's picked monster, the same way the engine assigns them at the start
  const picks = (s.options && s.options.monsters) || [], used = new Set();
  const mons = s.seats.map((x, i) => (Number.isInteger(picks[i]) && picks[i] >= 0 && picks[i] < 6 ? picks[i] : i));
  for (let i = 0; i < mons.length; i++) { if (used.has(mons[i])) mons[i] = [0, 1, 2, 3, 4, 5].find(m => !used.has(m)); used.add(mons[i]); }
  const rows = s.seats.map((x, i) => {
    const label = x.kind === 'human' ? esc(x.name || 'Player') + (i === s.mySeat ? ' (you)' : '') + (x.isHost ? ' · host' : '') : x.kind === 'computer' ? 'Computer' : '<span class="muted">Open seat</span>';
    const ctrl = s.isHost && x.kind !== 'human' ? `<button class="btn small" data-seat="${i}" data-to="${x.kind === 'computer' ? 'empty' : 'computer'}">${x.kind === 'computer' ? 'Open it' : 'Computer'}</button>` : '';
    return `<div class="seatrow">${Art.monster(mons[i], 30)}<span class="nmx">${label}</span>${ctrl}</div>`;
  }).join('');
  v.innerHTML = `<div class="setup">
    <div class="panel" style="align-items:center;text-align:center">
      <span class="label">Room code</span><div class="code-big">${esc(s.code || '')}</div>
      <span class="muted small">Friends: open this site, type the code, tap Join.</span>
    </div>
    <div class="panel"><div class="seats">${rows}</div>
      ${s.isHost ? '<button class="btn primary" id="btn-start">Start game</button>' : '<span class="muted small">Waiting for the host to start…</span>'}
      <button class="btn ghost" id="btn-leave">Leave room</button></div>
  </div>`;
  v.querySelectorAll('button[data-seat]').forEach(b => b.onclick = () => room.setSeat(+b.dataset.seat, b.dataset.to));
  if ($('#btn-start')) $('#btn-start').onclick = async e => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true;
    const r = await room.start(); if (!r.ok) { toast(r.message); b.disabled = false; }
  };
  $('#btn-leave').onclick = () => leaveOnline();
}

// ------------------------------------------------------------------ the game table
function myAsk() {
  const p = snap.pub;
  if (!p || !p.ask || p.over) return null;
  return snap.toAct.includes(snap.mySeat) ? p.ask.type : null;
}
function playerFace(p, i) { return p.alive ? Art.monster(p.mon, 30) : Art.monster(p.mon, 30, 'style="filter:grayscale(1)"'); }

function renderGame(v) {
  window.__kotRenders = (window.__kotRenders || 0) + 1;
  const pub = snap.pub, me = snap.mySeat, t = pub.t;
  const ask = myAsk();
  const P = pub.players;
  // a new roll: kept dice from the engine become the starting keep selection
  const rollKey = t ? pub.turnNo + ':' + t.rollId : null;
  const newRoll = rollKey !== ui.lastRoll;
  if (newRoll) {
    // after a reload, the dice you had raised for this same roll come back
    const ks = store.keepSel;
    if (ks && ks.key === rollKey && Array.isArray(ks.keep) && t) ui.keep = new Set(ks.keep.filter(k => Number.isInteger(k) && k >= 0 && k < t.dice.length));
    else ui.keep = new Set(t ? t.dice.map((d, k) => (d.k ? k : -1)).filter(k => k >= 0) : []);
    ui.change = null;
  }
  const rolledNow = newRoll && t ? new Set(t.rolledIdx) : new Set();
  ui.lastRoll = rollKey;

  // ---- monsters strip (phone) and boards (laptop)
  const chips = P.map((p, i) => {
    const cls = ['mon'];
    if (pub.cur === i && !pub.over) cls.push('turn');
    if (pub.tokyo.city === i) cls.push('tokyo');
    if (pub.tokyo.bay === i) cls.push('tokyo', 'bay');
    if (!p.alive) cls.push('out');
    if (pub.ask && pub.ask.waiting.includes(i) && pub.cur !== i) cls.push('wait');
    const tok = (p.poison ? '☠' + p.poison : '') + (p.shrink ? ' ↓' + p.shrink : '');
    return `<div class="${cls.join(' ')}" data-mon="${i}">${tok ? `<span class="tok">${tok}</span>` : ''}<span class="av">${playerFace(p, i)}</span>
      <span class="nmx">${esc(i === me ? 'You' : p.name)}</span>
      <span class="st"><span style="color:var(--hp)">${Art.icon('H', 11)}${p.hp}</span><span style="color:var(--vp)">${Art.icon('VP', 11)}${p.vp}</span></span>
      <span class="st"><span style="color:var(--en)">${Art.icon('E', 11)}${p.en}</span>${p.cards.length ? `<span class="muted" style="font-size:10.5px">${p.cards.length}▤</span>` : ''}</span></div>`;
  }).join('');
  const boards = P.map((p, i) => {
    const cls = ['pboard'];
    if (pub.cur === i && !pub.over) cls.push('turn');
    if (!p.alive) cls.push('out');
    const where = pub.tokyo.city === i ? '<span class="where">CITY</span>' : pub.tokyo.bay === i ? '<span class="where bay">BAY</span>' : '';
    const tok = (p.poison ? ` · ☠ ${p.poison} poison` : '') + (p.shrink ? ` · ${p.shrink} shrink` : '') + (p.wings ? ' · Wings on' : '');
    return `<div class="${cls.join(' ')}" data-mon="${i}"><div class="top">${Art.monster(p.mon, 40)}<div class="grow"><b>${esc(i === me && p.name !== 'You' ? p.name + ' (you)' : p.name)}</b><span>${monName(p.mon)}${tok}</span></div>${where}</div>
      <div class="meter" style="color:var(--hp)">${Art.icon('H', 13)}<div class="bar"><i style="width:${(p.hp / p.maxHp) * 100}%;background:var(--hp)"></i></div><span>${p.hp}/${p.maxHp}</span></div>
      <div class="meter" style="color:var(--vp)">${Art.icon('VP', 13)}<div class="bar"><i style="width:${Math.min(100, p.vp / 20 * 100)}%;background:var(--vp)"></i></div><span>${p.vp}/20</span></div>
      <div class="meter" style="color:var(--en)">${Art.icon('E', 13)}<span>${p.en} energy</span></div>
      ${p.cards.length ? `<div class="cards">${p.cards.map(c => `<span class="chipcard" data-card="${c.id}" data-k="${c.k}">${esc(CARDS[c.id].name)}${c.c != null ? ' ·' + c.c : ''}${c.as ? ' → ' + esc(CARDS[c.as].name) : ''}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');

  // ---- Tokyo board
  const spot = (which) => {
    const i = pub.tokyo[which];
    const occ = i >= 0 ? `<div class="occ" data-mon="${i}">${Art.monster(P[i].mon, 58)}<div style="min-width:0"><b>${esc(i === me ? 'You' : P[i].name)}</b><span>${Art.icon('H', 12)} ${P[i].hp} · ${Art.icon('VP', 12)} ${P[i].vp}</span></div></div>` : `<div class="empty">Empty</div>`;
    return `<div class="spot ${which}"><span class="tag">TOKYO ${which === 'city' ? 'CITY' : 'BAY'}</span>${occ}</div>`;
  };
  const board = `<div class="board">${Art.skyline(400, 80)}${spot('city')}${pub.bayRule && (pub.bayOpen || pub.tokyo.bay >= 0) ? spot('bay') : ''}</div>`;

  // ---- status line
  let who = '', sub = '';
  const curP = pub.cur >= 0 ? P[pub.cur] : null;
  const nm = i => (i === me ? 'You' : esc(P[i].name));
  if (pub.over) {
    who = pub.winners.length ? pub.winners.map(nm).join(' & ') + (pub.winners.includes(me) ? ' win!' : ' wins!') : 'Nobody wins';
    sub = pub.why === 'points' ? 'reached 20 points' : pub.why === 'last' ? 'last monster standing' : '';
  } else if (ask) {
    const tt = { start: 'Your turn', roll: 'Keep dice, then reroll', probe: 'Psychic Probe', ray: 'Healing Ray', wings: 'Wings?', yield: 'Stay in Tokyo?', mimic: 'Mimic', opp: 'Opportunist', buy: 'Buy cards' };
    who = tt[ask] || 'Your move';
    if (ask === 'roll') sub = t.rerolls > 0 ? t.rerolls + ' reroll' + (t.rerolls > 1 ? 's' : '') + ' left' : 'no rerolls left';
    else if (ask === 'buy') sub = 'You have ' + P[me].en + ' energy';
    else if (ask === 'probe') sub = 'tap one of ' + nm(pub.cur) + '’s dice, or skip';
    else if (ask === 'yield') sub = 'you took a hit';
    else if (ask === 'wings') sub = pub.ask.dmg + ' damage coming';
  } else if (curP) {
    const w = pub.ask ? pub.ask.waiting : [];
    const waitOn = w.length && w[0] !== pub.cur ? w[0] : pub.cur;
    const doing = { start: 'is about to roll', roll: 'is rolling', probe: 'is using Psychic Probe', ray: 'is healing', wings: 'is deciding on Wings', yield: 'is deciding to stay or leave', mimic: 'is choosing a card to copy', opp: 'is thinking (Opportunist)', buy: 'is shopping' };
    who = nm(waitOn); sub = doing[pub.ask ? pub.ask.type : 'roll'] || '';
    if (snap.seats && snap.seats[waitOn] && snap.seats[waitOn].kind === 'human' && snap.mode === 'online' && !snap.seats[waitOn].online) sub += ' (offline)';
  }
  if (snap.hostAway) sub = 'Host lost connection; waiting…';

  // ---- dice
  let dice = '';
  if (t && t.dice.length && pub.cur >= 0) {
    const adv = ask === 'roll' && store.settings.hints ? safeAdvise(pub, me) : null;
    const hint = adv ? new Set(adv.keep) : new Set();
    dice = t.dice.map((d, k) => {
      const cls = ['die'];
      const mine = ask === 'roll';
      if (mine ? ui.keep.has(k) : d.k) cls.push('kept');
      if (hint.has(k)) cls.push('hint');
      if (rolledNow.has(k)) cls.push('roll');
      if (ask === 'probe' || ui.change) cls.push('pick');
      return `<button class="${cls.join(' ')}" data-die="${k}" style="animation-delay:${rolledNow.has(k) ? (k * 40) : 0}ms" aria-label="${d.f}">${Art.face(d.f)}</button>`;
    }).join('');
  } else if (curP) {
    const n = 6;
    dice = Array.from({ length: n }, () => `<span class="die ghost">${Art.face('1')}</span>`).join('');
  }

  // ---- odds bar
  const odds = oddsBar(pub, me, ask);

  // ---- my cards row
  const myP = P[me];
  const abil = abilities(pub, me, ask);
  const mine = (myP ? myP.cards.map(c => `<span class="chipcard${abil.ids.has(c.id) ? ' ab' : ''}" data-card="${c.id}" data-k="${c.k}">${esc(CARDS[c.id].name)}${c.c != null ? ' ·' + c.c : ''}${c.as ? ' → ' + esc(CARDS[c.as].name) : ''}</span>`).join('') : '')
    + abil.html + (snap.mine && snap.mine.top && ask === 'buy' ? `<span class="chipcard ab" data-top="1">Top: ${esc(CARDS[snap.mine.top].name)}</span>` : '');

  // ---- market
  const canBuy = ask === 'buy' || ask === 'opp';
  const market = pub.market.map((id, k) => {
    if (!id) return '<div></div>';
    const cost = myP ? E.costFor(pub, me, id) : CARDS[id].cost;
    const fresh = ui.marketSeen[k] !== id;
    const cls = ['pc', CARDS[id].keep ? 'K' : 'D'];
    if (fresh) cls.push('deal');
    if (canBuy && myP && myP.en >= cost && (ask === 'buy' || pub.ask.i === k)) cls.push('can');
    return cardFace(id, cls.join(' '), cost, `data-slot="${k}"`);
  }).join('') + `<button class="sweep" id="btn-sweep" ${ask === 'buy' && myP.en >= 2 ? '' : 'disabled'}>${Art.icon('E', 14)}<span>2 · Sweep</span></button>`;
  ui.marketSeen = pub.market.slice();

  // ---- actions
  const acts = actionButtons(pub, me, ask);

  // ---- log
  const logHtml = logList(pub, me, 40);

  v.innerHTML = `<div id="game">
    <div class="mons">${chips}</div>
    <div class="plist">${boards}</div>
    ${board}
    <div class="status"><div class="grow" style="min-width:0"><div class="who">${who}</div></div><span class="sub">${sub}</span>
      <button class="icon-btn" id="btn-log" aria-label="Game log"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg></button>
      <button class="icon-btn" id="btn-menu" aria-label="Game menu"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>
    <div class="dice">${dice}</div>
    ${odds}
    <div class="mine">${mine || '<span class="muted small">No cards yet</span>'}</div>
    <div class="market" id="market">${market}</div>
    <div class="acts">${acts}</div>
    <div id="g-side"><div class="panel logbox"><span class="label">Log</span><div class="scroll" style="flex:1"><ul class="log">${logHtml}</ul></div></div></div>
  </div>`;
  // laptop: market goes into the side column above the log
  if (window.matchMedia('(min-width: 900px)').matches) {
    const side = $('#g-side'), mk = $('#market');
    const wrap = document.createElement('div'); wrap.className = 'panel'; wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    wrap.innerHTML = `<div class="row"><span class="label grow">Cards for sale</span><span class="muted small">${pub.deckSize} in deck</span></div>`;
    wrap.appendChild(mk); side.insertBefore(wrap, side.firstChild);
    const sc = side.querySelector('.logbox .scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }
  wireGame(v, pub, me, ask);
  floats(pub);
  if (pub.over && !ui.endShown) { ui.endShown = true; setTimeout(() => showEnd(), 700); }
  // nothing left to do with the dice: resolve on its own
  if (ask === 'roll' && !t.opts.length && !abil.change) ui.autoDone = setTimeout(() => act({ t: 'done' }), 650);
  // decisions that need a sheet
  if (ask === 'ray' && ui.sheetKind !== 'ray') raySheet(pub, me);
  if (ask === 'mimic' && ui.sheetKind !== 'mimic') mimicSheet(pub, me, true);
}

function safeAdvise(pub, me) { try { return Bots.advise(pub, me); } catch (e) { return null; } }

function cardFace(id, cls, cost, attrs) {
  const c = CARDS[id];
  const kind = Art.cardKind(id);
  return `<button class="${cls}" ${attrs || ''}><span class="band" style="background:${kind === 'D' ? '#39405a' : '#2a2f3f'}"><span class="ic">${Art.cardIcon(id, 16)}</span>${costTag(cost == null ? c.cost : cost)}</span>
    <span class="nm">${esc(c.name)}</span><span class="tx">${esc(c.text)}</span><span class="ty">${c.keep ? 'KEEP' : 'DISCARD'}</span></button>`;
}

function abilities(pub, me, ask) {
  const ids = new Set();
  let html = '';
  let change = false;
  const p = pub.players[me];
  if (!p || !p.alive) return { ids, html, change };
  const t = pub.t;
  if (ask === 'roll') {
    if (E.has(pub, me, 'herd-culler') && !t.herd) { ids.add('herd-culler'); change = true; html += `<button class="btn small" data-chg="herd">Make a 1</button>`; }
    if (E.has(pub, me, 'stretchy') && p.en >= 2) { ids.add('stretchy'); change = true; html += `<button class="btn small" data-chg="stretchy">Stretchy 2⚡</button>`; }
    if (E.insts(pub, me, 'plot-twist').length) { ids.add('plot-twist'); change = true; html += `<button class="btn small" data-chg="plot">Plot Twist</button>`; }
    if (t.rerolls === 0) for (const u of t.opts) {
      const lbl = { smoke: 'Smoke reroll', telepath: CARDS.telepath.name + ' 1⚡', dweller: 'Reroll 3s' }[u];
      if (lbl) { html += `<button class="btn small" data-use="${u}">${lbl}</button>`; }
    }
  }
  if ((ask === 'start' || ask === 'roll' || ask === 'buy') && E.has(pub, me, 'rapid-healing') && p.en >= 2 && p.hp < p.maxHp) { ids.add('rapid-healing'); html += `<button class="btn small" data-rapid="1">Heal 2⚡</button>`; }
  if (ask === 'start' && p.cards.some(c => c.id === 'mimic') && p.en >= 1 && E.mimicTargets(pub, me).length) { ids.add('mimic'); html += `<button class="btn small" data-mimic="1">Switch Mimic 1⚡</button>`; }
  return { ids, html, change };
}

function actionButtons(pub, me, ask) {
  const t = pub.t, p = pub.players[me];
  if (pub.over) return `<button class="btn primary" id="btn-again">New game</button><button class="btn" id="btn-results">Results</button>`;
  switch (ask) {
    case 'start': return `<button class="btn primary" id="btn-roll">Roll ${t && t.less ? (6 - t.less) : ''} dice</button>`;
    case 'roll': {
      const re = t.dice.length - ui.keep.size;
      const lbl = t.rerolls > 0 ? `Reroll ${re || ''} <span class="muted" style="font-weight:500">· ${t.rerolls} left</span>` : 'Reroll';
      const can = re > 0 && t.rerolls > 0;
      return `<button class="btn primary" id="btn-reroll" ${can ? '' : 'disabled'}>${lbl}</button><button class="btn" id="btn-done">Done</button>`;
    }
    case 'probe': return `<button class="btn" id="btn-pass">Skip</button>`;
    case 'wings': return `<button class="btn warm" id="btn-wings">Use Wings · 2⚡</button><button class="btn" id="btn-nowings">Take it</button>`;
    case 'yield': {
      const ko = safeKo(pub, me, p.hp);
      return `<button class="btn primary" id="btn-stay">Stay${ko != null ? ` <span style="font-weight:500">· ${pct(ko)} risk</span>` : ''}</button><button class="btn" id="btn-leave">Leave</button>`;
    }
    case 'opp': { const id = pub.market[pub.ask.i]; return `<button class="btn primary" id="btn-opp">Buy ${esc(CARDS[id].name)}</button><button class="btn" id="btn-pass">Pass</button>`; }
    case 'buy': return `<button class="btn primary" id="btn-end">End turn</button>`;
    case 'ray': return `<button class="btn primary" id="btn-ray">Healing Ray…</button>`;
    case 'mimic': return `<button class="btn primary" id="btn-mimicpick">Pick a card to copy…</button>`;
  }
  return `<button class="btn" disabled>${pub.cur === me ? 'Working…' : 'Waiting…'}</button>`;
}
function safeKo(pub, me, hp) { try { return Bots.koChance(pub, me, hp); } catch (e) { return null; } }

function oddsBar(pub, me, ask) {
  const p = pub.players[me];
  if (!p) return '<div class="odds"></div>';
  if (ask === 'roll') {
    const adv = safeAdvise(pub, me);
    if (!adv) return '<div class="odds"></div>';
    const keepC = D.countsOf([...ui.keep].map(k => adv.faces[k]));
    const yours = adv.r ? adv.sv.keepEv(keepC, adv.r) : adv.value(adv.counts);
    const lost = Math.max(0, adv.ev - yours);
    return `<div class="odds" id="odds"><div class="cells"><span>Best <b>${fmt1(adv.ev)}</b> pts</span><span>Yours <b style="color:${scale(1 - lost / 2)}">${lost < 0.05 ? 'best' : '−' + fmt1(lost)}</b></span>${store.settings.hints ? '<span class="muted">● = best keep</span>' : ''}</div>${qTip('Points = expected stars from the dice, plus energy, hearts and claws counted by how much they help you right now. “Yours” is what your current keep gives up versus the best keep. Tap the bar for set and claw chances.')}</div>`;
  }
  if (ask === 'yield' || (E.inTokyo(pub, me) && p.alive)) {
    const ko = safeKo(pub, me, p.hp);
    if (ko == null) return '<div class="odds"></div>';
    // what staying is worth: the start-of-turn Tokyo points, if you live to collect them
    const gain = pub.duel ? 0 : 2 + E.has(pub, me, 'urbavore');
    const ev = ask === 'yield' && gain ? `<span>Stay ≈ <b>+${fmt1((1 - ko) * gain)}</b> ★</span>` : '';
    return `<div class="odds" id="odds"><div class="cells"><span>Knock-out risk before your turn <b style="color:${scale(1 - ko / 0.5)}">${pct(ko)}</b></span>${ev}</div>${qTip('If you stay in Tokyo, every monster outside rolls at you once before your next turn. Assumes each of their dice ends as a claw ' + Math.round(Bots.CFG.claw * 100) + '% of the time (measured from computer games). Stay ≈ the ' + gain + ' points for starting your turn in Tokyo times your chance to survive until then. The Hard computer leaves above ' + Math.round(Bots.CFG.stayKo * 100) + '% risk.')}</div>`;
  }
  const lead = Math.max(...pub.players.map(x => x.vp));
  return `<div class="odds" id="odds"><div class="cells"><span>Deck <b>${pub.deckSize}</b></span><span>Leader <b>${lead}</b>/20</span><span>Turn <b>${pub.turnNo}</b></span></div></div>`;
}

function logList(pub, me, n) {
  return pub.log.slice(-n).map(l => `<li class="${l.s === me ? 'me' : ''}">${l.s >= 0 ? '<b>' + esc(l.s === me ? 'You' : pub.players[l.s].name) + '</b> ' : ''}${esc(l.m)}</li>`).join('');
}

function floats(pub) {
  const key = pub.turnNo + '|' + pub.log.length + '|' + JSON.stringify(pub.fx);
  if (key === ui.fxKey || !pub.fx.length) { ui.fxKey = key; return; }
  ui.fxKey = key;
  const sum = {};
  for (const f of pub.fx) {
    if (!['hp', 'vp', 'en'].includes(f.k)) continue;
    const k = f.s + f.k; sum[k] = sum[k] || { s: f.s, k: f.k, n: 0 }; sum[k].n += f.n;
  }
  const col = { hp: 'var(--hp)', vp: 'var(--vp)', en: 'var(--en)' };
  const sym = { hp: '♥', vp: '★', en: '⚡' };
  let off = 0;
  for (const x of Object.values(sum)) {
    if (!x.n) continue;
    document.querySelectorAll(`[data-mon="${x.s}"].mon, [data-mon="${x.s}"].pboard`).forEach(el => {
      const f = document.createElement('span'); f.className = 'float';
      f.style.color = col[x.k]; f.style.animationDelay = (off * 120) + 'ms'; f.style.marginTop = (off * 2) + 'px';
      f.textContent = (x.n > 0 ? '+' : '') + x.n + sym[x.k];
      el.appendChild(f); setTimeout(() => f.remove(), 1500);
      if (x.k === 'hp' && x.n < 0) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
    });
    off++;
  }
}

function wireGame(v, pub, me, ask) {
  const on = (sel, fn) => { const el = $(sel, v); if (el) el.onclick = fn; };
  on('#btn-roll', () => act({ t: 'roll' }));
  on('#btn-reroll', () => act({ t: 'reroll', keep: [...ui.keep].sort((a, b) => a - b), use: 'normal' }));
  on('#btn-done', () => act({ t: 'done' }));
  on('#btn-pass', () => act({ t: 'pass' }));
  on('#btn-wings', () => act({ t: 'wings', use: true }));
  on('#btn-nowings', () => act({ t: 'wings', use: false }));
  on('#btn-stay', () => act({ t: 'yield', leave: false }));
  on('#btn-leave', () => act({ t: 'yield', leave: true }));
  on('#btn-opp', () => act({ t: 'buy' }));
  on('#btn-end', () => endTurn(pub, me));
  on('#btn-ray', () => raySheet(pub, me));
  on('#btn-mimicpick', () => mimicSheet(pub, me, true));
  on('#btn-sweep', () => act({ t: 'sweep' }));
  on('#btn-log', () => openSheet(`<h3>Game log</h3><div class="scroll" id="logscroll"><ul class="log">${logList(pub, me, 80)}</ul></div><button class="btn" onclick="document.getElementById('sheet').remove()">Close</button>`, el => { const s = $('#logscroll', el); s.scrollTop = s.scrollHeight; }));
  on('#btn-menu', () => gameMenu());
  on('#btn-again', () => newGameFromEnd());
  on('#btn-results', () => showEnd());
  on('#odds', e => { if (!e.target.closest('.q')) oddsSheet(pub, me, ask); });
  v.querySelectorAll('[data-die]').forEach(b => b.onclick = () => {
    const k = +b.dataset.die;
    if (ask === 'probe') { act({ t: 'probe', i: k }); return; }
    if (ask !== 'roll') return;
    if (ui.change) { facePicker(k, ui.change); return; }
    if (ui.keep.has(k)) ui.keep.delete(k); else ui.keep.add(k);
    store.keepSel = { key: ui.lastRoll, keep: [...ui.keep] }; save();
    renderPlay();
  });
  v.querySelectorAll('[data-chg]').forEach(b => b.onclick = () => { ui.change = b.dataset.chg; toast('Tap the die to change'); renderPlay(); });
  v.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    const keep = [...ui.keep].sort((a, c) => a - c);
    if (b.dataset.use === 'dweller') { const k3 = pub.t.dice.map((d, k) => (d.f === '3' && !ui.keep.has(k) ? -1 : k)).filter(k => k >= 0); act({ t: 'reroll', keep: k3, use: 'dweller' }); return; }
    act({ t: 'reroll', keep, use: b.dataset.use });
  });
  v.querySelectorAll('[data-rapid]').forEach(b => b.onclick = () => act({ t: 'rapid' }));
  v.querySelectorAll('[data-mimic]').forEach(b => b.onclick = () => mimicSheet(pub, me, false));
  v.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => cardSheet(pub.market[+b.dataset.slot], { slot: +b.dataset.slot }));
  v.querySelectorAll('[data-top]').forEach(b => b.onclick = () => cardSheet(snap.mine.top, { top: true }));
  v.querySelectorAll('[data-card]').forEach(b => b.onclick = e => { e.stopPropagation(); cardSheet(b.dataset.card, { k: +b.dataset.k }); });
  v.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => monsterSheet(+b.dataset.mon));
}

function facePicker(k, via) {
  const faces = via === 'herd' ? ['1'] : D.FACES;
  openSheet(`<h3>Change this die to…</h3><div class="facepick">${faces.map(f => `<button class="die" data-f="${f}">${Art.face(f)}</button>`).join('')}</div>
    <button class="btn" id="btn-x">Cancel</button>`, el => {
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { closeSheet(); ui.change = null; act({ t: 'change', i: k, f: b.dataset.f, via }); });
    $('#btn-x', el).onclick = () => { closeSheet(); ui.change = null; renderPlay(); };
  });
}

function endTurn(pub, me) {
  const p = pub.players[me];
  if (E.has(pub, me, 'metamorph') && p.cards.some(c => CARDS[c.id].keep)) {
    const sel = new Set();
    openSheet(`<h3>Metamorph</h3><span class="muted small">Discard keep cards to get back what they cost.</span>
      <div class="seats">${p.cards.map(c => `<label class="seatrow"><input type="checkbox" data-k="${c.k}"><span class="nmx">${esc(CARDS[c.id].name)}</span>${costTag(CARDS[c.id].cost)}</label>`).join('')}</div>
      <button class="btn primary" id="btn-endm">End turn</button>`, el => {
      el.querySelectorAll('input[data-k]').forEach(i => i.onchange = () => { const k = +i.dataset.k; if (i.checked) sel.add(k); else sel.delete(k); });
      $('#btn-endm', el).onclick = () => { closeSheet(); act({ t: 'end', sell: [...sel] }); };
    });
    return;
  }
  act({ t: 'end' });
}

function cardSheet(id, where) {
  if (!id || !CARDS[id]) return;
  const c = CARDS[id];
  const pub = snap && snap.pub, me = snap ? snap.mySeat : -1;
  const ask = snap && snap.pub ? myAsk() : null;
  const myP = pub && pub.players[me];
  const cost = myP ? E.costFor(pub, me, id) : c.cost;
  let btn = '';
  if (myP && ask === 'buy' && (where.slot != null || where.top)) btn = `<button class="btn primary" id="btn-buy" ${myP.en >= cost ? '' : 'disabled'}>Buy · ${cost}⚡</button>`;
  if (myP && ask === 'opp' && where.slot === pub.ask.i) btn = `<button class="btn primary" id="btn-buy">Buy · ${cost}⚡</button>`;
  if (myP && ask === 'buy' && where.k != null && E.has(pub, me, 'parasitic-tentacles')) {
    const f = E.findInst(pub, where.k);
    if (f && f.seat !== me) btn = `<button class="btn warm" id="btn-steal" ${myP.en >= cost ? '' : 'disabled'}>Take it · ${cost}⚡ to ${esc(pub.players[f.seat].name)}</button>`;
  }
  const m = STR.cards && STR.cards[id];
  const stat = m ? `<div class="row small"><span class="muted grow">Hard computers who bought it won</span><b class="pct" style="color:${scale((m.win - 0.15) / 0.25)}">${pct(m.win)}</b>${qTip('Measured over ' + (STR.measured ? STR.measured.games : 'many') + ' four-player games between Hard computers; an average monster wins 25%. Cards bought by players already ahead score higher, so read it as a hint, not a law.')}</div>` : '';
  let amount = 0;
  const batt = id === 'monster-batteries' && pub && pub.edition === '2011' && btn.includes('btn-buy');
  openSheet(`${cardFace(id, 'pc big ' + (c.keep ? 'K' : 'D'), cost)}${stat}
    ${batt ? `<div class="row"><span class="grow">Energy to put on it <span class="muted small">(bank doubles it)</span></span><span class="stepper"><button data-d="-1">−</button><b id="amt">0</b><button data-d="1">+</button></span></div>` : ''}
    ${btn}<button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { amount = Math.max(0, Math.min(myP.en - cost, amount + +b.dataset.d)); $('#amt', el).textContent = amount; });
    const bb = $('#btn-buy', el);
    if (bb) bb.onclick = () => {
      closeSheet();
      if (ask === 'opp') act({ t: 'buy' });
      else if (where.top) act(Object.assign({ t: 'top' }, batt ? { amount } : {}));
      else act(Object.assign({ t: 'buy', i: where.slot }, batt ? { amount } : {}));
    };
    const bs = $('#btn-steal', el);
    if (bs) bs.onclick = () => { closeSheet(); act({ t: 'steal', k: where.k }); };
  });
}

function monsterSheet(i) {
  const pub = snap.pub, p = pub.players[i];
  const where = pub.tokyo.city === i ? 'in Tokyo City' : pub.tokyo.bay === i ? 'in Tokyo Bay' : p.alive ? 'outside Tokyo' : 'knocked out';
  openSheet(`<h3>${Art.monster(p.mon, 34)} ${esc(p.name)}</h3><span class="muted small">${monName(p.mon)} · ${where}${p.poison ? ` · ${p.poison} poison` : ''}${p.shrink ? ` · ${p.shrink} shrink` : ''}</span>
    <div class="row" style="gap:16px;font-size:15px"><span style="color:var(--hp)">${Art.icon('H', 16)} ${p.hp}/${p.maxHp}</span><span style="color:var(--vp)">${Art.icon('VP', 16)} ${p.vp}/20</span><span style="color:var(--en)">${Art.icon('E', 16)} ${p.en}</span></div>
    <div class="scroll" style="display:flex;flex-direction:column;gap:6px">${p.cards.length ? p.cards.map(c => `<div class="crow" data-card="${c.id}" data-k="${c.k}"><span>${Art.cardIcon(c.id, 18)}</span><div class="ct"><div class="cn">${esc(CARDS[c.id].name)}${c.c != null ? ' · ' + c.c + ' left' : ''}${c.as ? ' → ' + esc(CARDS[c.as].name) : ''}</div><div class="cx">${esc(CARDS[c.id].text)}</div></div></div>`).join('') : '<span class="muted small">No cards.</span>'}</div>
    <button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => cardSheet(b.dataset.card, { k: +b.dataset.k }));
  });
}

function raySheet(pub, me) {
  ui.sheetKind = 'ray';
  const hearts = pub.t.dice.filter(d => d.f === 'H').length;
  const plan = {};
  const others = pub.players.map((p, i) => i).filter(i => i !== me && pub.players[i].alive && pub.players[i].hp < pub.players[i].maxHp);
  openSheet(`<h3>Healing Ray</h3><span class="muted small">Give some of your ${hearts} hearts to other monsters. They pay you 2⚡ per health (or all they have).</span>
    <div class="seats">${others.map(i => `<div class="seatrow">${Art.monster(pub.players[i].mon, 28)}<span class="nmx">${esc(pub.players[i].name)} <span class="muted small">♥${pub.players[i].hp} ⚡${pub.players[i].en}</span></span><span class="stepper"><button data-s="${i}" data-d="-1">−</button><b id="r${i}">0</b><button data-s="${i}" data-d="1">+</button></span></div>`).join('')}</div>
    <button class="btn primary" id="btn-rayok">Done</button>`, el => {
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const i = +b.dataset.s, used = Object.values(plan).reduce((a, x) => a + x, 0);
      const next = Math.max(0, (plan[i] || 0) + +b.dataset.d);
      if (next > (plan[i] || 0) && used >= hearts) return;
      plan[i] = Math.min(next, pub.players[i].maxHp - pub.players[i].hp); $('#r' + i, el).textContent = plan[i];
    });
    $('#btn-rayok', el).onclick = () => { closeSheet(); act({ t: 'ray', heal: plan }); };
  });
  ui.sheetKind = 'ray';
}

function mimicSheet(pub, me, required) {
  ui.sheetKind = 'mimic';
  const opts = E.mimicTargets(pub, me);
  openSheet(`<h3>Mimic: copy a card</h3><span class="muted small">${required ? 'Pick a keep card in play to copy.' : 'Switching costs 1 energy.'}</span>
    <div class="scroll" style="display:flex;flex-direction:column;gap:6px">${opts.map(o => `<div class="crow" data-k="${o.k}"><span>${Art.cardIcon(o.id, 18)}</span><div class="ct"><div class="cn">${esc(CARDS[o.id].name)} <span class="muted small">· ${esc(pub.players[o.seat].name)}</span></div><div class="cx">${esc(CARDS[o.id].text)}</div></div></div>`).join('')}</div>
    ${required ? '' : '<button class="btn ghost" id="btn-x">Cancel</button>'}`, el => {
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { closeSheet(); act({ t: 'mimic', k: +b.dataset.k }); });
    if ($('#btn-x', el)) $('#btn-x', el).onclick = closeSheet;
  });
  ui.sheetKind = 'mimic';
}

function oddsSheet(pub, me, ask) {
  if (ask !== 'roll') {
    const p = pub.players[me];
    if (!p) return;
    const dist = safeDist(pub, me);
    openSheet(`<h3>Damage before your next turn</h3><span class="muted small">If you stay in Tokyo with ${p.hp} health.</span>${dist}<button class="btn ghost" id="btn-x">Close</button>`, el => { $('#btn-x', el).onclick = closeSheet; });
    return;
  }
  const adv = safeAdvise(pub, me);
  if (!adv) return;
  const n = adv.faces.length, r = adv.r;
  const keepC = D.countsOf([...ui.keep].map(k => adv.faces[k]));
  const rows = [
    ['1-1-1 or better', c => c[0] >= 3], ['2-2-2 or better', c => c[1] >= 3], ['3-3-3 or better', c => c[2] >= 3],
    ['Any set of three', c => c[0] >= 3 || c[1] >= 3 || c[2] >= 3], ['2+ claws', c => c[5] >= 2], ['3+ claws', c => c[5] >= 3],
    ['2+ hearts', c => c[4] >= 2], ['3+ energy', c => c[3] >= 3],
  ].map(([lbl, pred]) => { const pr = r ? D.chance(n, keepC, r, pred) : (pred(adv.counts) ? 1 : 0); return `<div><span>${lbl}</span><b class="pct" style="color:${scale(pr)}">${pct(pr)}</b></div>`; }).join('');
  openSheet(`<h3>Chances with your keep</h3><span class="muted small">If you keep the raised dice and chase each goal with your ${r} reroll${r === 1 ? '' : 's'} left.</span>
    <div class="ogrid">${rows}</div><button class="btn ghost" id="btn-x">Close</button>`, el => { $('#btn-x', el).onclick = closeSheet; });
}
function safeDist(pub, me) {
  try {
    const d = Bots.damageDist(pub, me);
    const hp = pub.players[me].hp;
    const max = Math.max(...d);
    return `<div style="display:flex;align-items:flex-end;gap:3px;height:110px;padding-top:8px">${d.slice(0, 16).map((x, k) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px"><div style="width:100%;height:${Math.max(2, x / max * 84)}px;background:${k >= hp ? 'var(--bad)' : 'var(--accent)'};border-radius:3px 3px 0 0"></div><span class="muted" style="font-size:10px">${k}</span></div>`).join('')}</div>
      <span class="small muted">Bars: chance of each total damage. Red = knocks you out (${pct(Bots.koChance(pub, me, hp))}).</span>`;
  } catch (e) { return ''; }
}

function gameMenu() {
  const online = ui.mode === 'online';
  openSheet(`<h3>Game</h3>
    ${online ? `<span class="muted small">Room ${esc(snap.code || '')}</span><button class="btn danger" id="btn-quit">Leave room</button>` : '<button class="btn danger" id="btn-quit">Quit this game</button>'}
    <button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    $('#btn-quit', el).onclick = () => { closeSheet(); if (online) leaveOnline(); else { closeRoom(); store.saved = null; save(); renderPlay(); } };
  });
}

function newGameFromEnd() {
  closeSheet();
  if (ui.mode === 'online') { leaveOnline(); return; }
  closeRoom(); store.saved = null; save(); renderPlay();
}

function showEnd() {
  if (!snap || !snap.pub) return;
  const pub = snap.pub, me = snap.mySeat;
  const order = pub.players.map((p, i) => i).sort((a, b) => (pub.winners.includes(b) - pub.winners.includes(a)) || (pub.players[b].alive - pub.players[a].alive) || pub.players[b].vp - pub.players[a].vp);
  const w = pub.winners.includes(me) ? me : pub.winners[0];
  const shared = pub.winners.length > 1;
  const title = w == null ? 'Nobody wins' : shared ? (pub.winners.includes(me) ? 'You share the win!' : pub.winners.map(i => pub.players[i].name).join(' & ') + ' share the win') : w === me ? 'You win!' : pub.players[w].name + ' wins!';
  const st = store.study || [];
  const lost = st.reduce((a, x) => a + x.lost, 0);
  const worst = st.slice().sort((a, b) => b.lost - a.lost).filter(x => x.lost >= 0.1).slice(0, 3);
  const study = st.length ? `<div class="panel" style="padding:10px"><div class="row"><span class="label grow">Your dice choices</span>${qTip('Each reroll you chose is compared with the best keep for your situation at that moment (exact odds, two rerolls ahead). Points lost add up what your keeps gave away on average.')}</div>
      <div class="row small"><span class="grow">${st.length} choices · ${st.filter(x => x.lost < 0.05).length} were the best keep</span><b class="lost" style="color:${scale(1 - lost / 8)}">−${fmt1(lost)} pts</b></div>
      ${worst.map(x => `<div class="row small muted"><span class="grow">Turn ${x.turn}: ${[...x.faces].map(f => Art.face(f, 15)).join('')}</span><span>−${fmt1(x.lost)}</span></div>`).join('')}</div>` : '';
  openSheet(`<div class="endcard"><div class="win">${w != null ? Art.monster(pub.players[w].mon, 64) : ''}<div><b>${esc(title)}</b><span class="muted">${pub.why === 'points' ? '20 points reached' : pub.why === 'last' ? 'Last monster standing' : 'Everyone fell at once'} · turn ${pub.turnNo}</span></div></div>
    <table class="res"><tr><th>Monster</th><th>★</th><th>♥</th><th>Cards</th></tr>${order.map(i => { const p = pub.players[i]; return `<tr><td>${esc(i === me ? 'You' : p.name)}</td><td>${p.vp}</td><td>${p.alive ? p.hp : 'out'}</td><td>${p.cards.length}</td></tr>`; }).join('')}</table>
    ${study}
    <div class="row"><button class="btn primary grow" id="btn-again2">New game</button><button class="btn" id="btn-x">Close</button></div></div>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    $('#btn-again2', el).onclick = () => newGameFromEnd();
  });
}

// ================================================================== ODDS tab (also a table companion)
const oz = { faces: ['1', '1', 'C', 'H', 'E', '2'], r: 2, hp: 10, tokyo: false, outside: 3, ohp: 10 };
function renderOdds() {
  const v = $('#v-odds');
  // a fake public state so the same advice code runs
  const n = oz.faces.length;
  const players = [{ hp: oz.tokyo ? 10 : oz.hp, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0, mon: 0 }];
  for (let i = 0; i < Math.max(1, oz.outside); i++) players.push({ hp: 10, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0, mon: i + 1 });
  players[0].hp = oz.hp;
  const fake = { players, tokyo: { city: oz.tokyo ? 0 : 1, bay: -1 }, bayRule: false, t: { seat: 0, dice: oz.faces.map(f => ({ f, k: false })), rerolls: oz.r, less: 6 - n } };
  let adv = null;
  try { adv = Bots.advise(fake, 0); } catch (e) { adv = null; }
  const best = adv ? new Set(adv.keep) : new Set();
  const counts = D.countsOf(oz.faces);
  const rows = [['1-1-1 or better', c => c[0] >= 3], ['2-2-2 or better', c => c[1] >= 3], ['3-3-3 or better', c => c[2] >= 3], ['Any set of three', c => c[0] >= 3 || c[1] >= 3 || c[2] >= 3], ['2+ claws', c => c[5] >= 2], ['3+ claws', c => c[5] >= 3], ['2+ hearts', c => c[4] >= 2], ['3+ energy', c => c[3] >= 3]]
    .map(([l, pred]) => { const pr = oz.r ? D.solver(n, c => (pred(c) ? 1 : 0)).ev(counts, oz.r) : (pred(counts) ? 1 : 0); return `<div><span>${l}</span><b class="pct" style="color:${scale(pr)}">${pct(pr)}</b></div>`; }).join('');
  // Tokyo calculator: fake board with `outside` monsters attacking me in Tokyo
  const tp = [{ hp: oz.ohp, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0 }];
  for (let i = 0; i < oz.outside; i++) tp.push({ hp: 10, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0 });
  const tState = { players: tp, tokyo: { city: 0, bay: -1 }, bayRule: false, t: null };
  let ko = 0, dist = [];
  try { ko = Bots.koChance(tState, 0, oz.ohp); dist = Bots.damageDist(tState, 0); } catch (e) { /* */ }
  const mx = Math.max(...dist, 0.0001);
  const step = (id, val) => `<span class="stepper"><button data-st="${id}" data-d="-1">−</button><b>${val}</b><button data-st="${id}" data-d="1">+</button></span>`;
  v.innerHTML = `<div class="oddsv">
    <div class="panel">
      <div class="row"><span class="label grow">Your dice</span>${qTip('Tap a die to change its face (works with your real dice at the table). The green dots show the keep with the most expected points: stars from sets, plus energy, hearts and claws valued for your situation.')}</div>
      <div class="dice" id="oz-dice">${oz.faces.map((f, k) => `<button class="die${best.has(k) ? ' kept hint' : ''}" data-oz="${k}">${Art.face(f)}</button>`).join('')}</div>
      <div class="row"><span class="grow small">Rerolls left</span><div class="seg" style="width:150px">${[0, 1, 2].map(r => `<button data-r="${r}" aria-pressed="${oz.r === r}">${r}</button>`).join('')}</div></div>
      <div class="row"><span class="grow small">Dice</span>${step('n', n)}<span class="grow small" style="text-align:right">Health</span>${step('hp', oz.hp)}</div>
      <div class="row"><span class="grow small">I'm in Tokyo</span><label class="switch"><input type="checkbox" id="oz-tokyo" ${oz.tokyo ? 'checked' : ''}><span></span></label></div>
      <div class="row small"><span class="grow">${oz.r ? 'Best keep is worth' : 'These dice are worth'}</span><b>${adv ? fmt1(Math.max(0, adv.ev)) : '–'} pts</b></div>
    </div>
    <div class="panel scroll">
      <span class="label">Chances if you chase it</span>
      <div class="ogrid">${rows}</div>
      <div class="row" style="margin-top:6px"><span class="label grow">Stay in Tokyo?</span>${qTip('Each monster outside Tokyo rolls once before your next turn. Each of their dice is assumed to end as a claw ' + Math.round(Bots.CFG.claw * 100) + '% of the time, measured from computer games. Red bars knock you out.')}</div>
      <div class="row"><span class="grow small">Your health</span>${step('ohp', oz.ohp)}<span class="grow small" style="text-align:right">Outside</span>${step('out', oz.outside)}</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:76px">${dist.slice(0, 16).map((x, k) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px"><div style="width:100%;height:${Math.max(2, x / mx * 58)}px;background:${k >= oz.ohp ? 'var(--bad)' : 'var(--accent)'};border-radius:3px 3px 0 0"></div><span class="muted" style="font-size:9.5px">${k}</span></div>`).join('')}</div>
      <div class="row"><span class="grow">Knock-out risk</span><b class="pct" style="color:${scale(1 - ko / 0.5)}">${pct(ko)}</b><span class="muted small">${ko > 0.22 ? 'Hard leaves' : 'Hard stays'}</span></div>
    </div>
  </div>`;
  v.querySelectorAll('[data-oz]').forEach(b => b.onclick = () => { const k = +b.dataset.oz; oz.faces[k] = D.FACES[(D.FACES.indexOf(oz.faces[k]) + 1) % 6]; renderOdds(); });
  v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { oz.r = +b.dataset.r; renderOdds(); });
  $('#oz-tokyo', v).onchange = e => { oz.tokyo = e.target.checked; renderOdds(); };
  v.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
    const d = +b.dataset.d, id = b.dataset.st;
    if (id === 'n') { const n2 = Math.max(4, Math.min(8, oz.faces.length + d)); while (oz.faces.length < n2) oz.faces.push('1'); oz.faces.length = n2; }
    if (id === 'hp') oz.hp = Math.max(1, Math.min(12, oz.hp + d));
    if (id === 'ohp') oz.ohp = Math.max(1, Math.min(12, oz.ohp + d));
    if (id === 'out') oz.outside = Math.max(1, Math.min(5, oz.outside + d));
    renderOdds();
  });
}

// ================================================================== CARDS tab
const cz = { filter: 'all', sort: 'cost' };
function renderCards() {
  const v = $('#v-cards');
  const ed = store.settings.edition;
  syncEd(ed);
  let list = Object.values(CARDS);
  if (cz.filter !== 'all') list = list.filter(c => (cz.filter === 'keep') === c.keep);
  const val = id => (STR.cards && STR.cards[id] ? STR.cards[id].win : -1);
  list.sort((a, b) => (cz.sort === 'cost' ? a.cost - b.cost || a.name.localeCompare(b.name) : val(b.id) - val(a.id)));
  const total = Object.values(CARDS).reduce((a, c) => a + c.copies, 0);
  v.innerHTML = `<div class="cardsv">
    <div class="row"><span class="label grow">${EDITIONS[ed]} · ${total} cards</span>${qTip('Win % = how often Hard computers who bought the card went on to win, in measured four-player games (25% is average). Change the edition in Settings.')}</div>
    <div class="row"><div class="seg grow">${[['all', 'All'], ['keep', 'Keep'], ['discard', 'Discard']].map(([k, l]) => `<button data-f="${k}" aria-pressed="${cz.filter === k}">${l}</button>`).join('')}</div>
      <div class="seg" style="width:150px">${[['cost', 'Cost'], ['value', 'Win %']].map(([k, l]) => `<button data-s="${k}" aria-pressed="${cz.sort === k}">${l}</button>`).join('')}</div></div>
    <div class="scroll" style="flex:1"><div class="clist">${list.map(c => { const m = STR.cards && STR.cards[c.id]; return `<div class="crow" data-card="${c.id}"><span>${Art.cardIcon(c.id, 20)}</span>
      <div class="ct"><div class="cn">${esc(c.name)}${c.copies > 1 ? ' <span class="muted small">×' + c.copies + '</span>' : ''} <span class="tagk ${c.keep ? 'K' : 'D'}">${c.keep ? 'KEEP' : 'DISCARD'}</span></div><div class="cx">${esc(c.text)}</div></div>
      ${costTag(c.cost)}<div class="cv">${m ? `<span class="pct" style="color:${scale((m.win - 0.15) / 0.25)}">${pct(m.win)}</span>win` : ''}</div></div>`; }).join('')}</div></div>
  </div>`;
  v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { cz.filter = b.dataset.f; renderCards(); });
  v.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cz.sort = b.dataset.s; renderCards(); });
  v.querySelectorAll('[data-card]').forEach(b => b.onclick = () => cardSheet(b.dataset.card, {}));
}

// ================================================================== SETTINGS
function renderSettings() {
  const v = $('#v-settings'), st = store.settings;
  const L = STR.levels || {};
  const strengthTip = STR.measured
    ? `Measured over ${STR.measured.games} games each: ${Object.keys(L).map(k => L[k]).join(' ')}`
    : 'Strength numbers appear after the measurement run.';
  const seg = (key, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-k="${key}" data-v="${k}" aria-pressed="${String(st[key]) === String(k)}">${l}</button>`).join('')}</div>`;
  v.innerHTML = `<div class="set scroll">
    <div class="panel"><div class="row"><span class="label grow">Computer level</span>${qTip(esc(strengthTip))}</div>${seg('level', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']])}</div>
    <div class="panel"><div class="row"><span class="label grow">Card deck</span>${qTip('Both decks have the same 66 cards. 2016 renamed 8 of them, made Battery Monster cost 3, lets cards add claws, and always sends the first monster into an empty Tokyo. Takes effect in your next game.')}</div>${seg('edition', [['2016', '2016 edition'], ['2011', '2011 edition']])}</div>
    <div class="panel">
      <div class="setrow"><div class="grow"><b>Tokyo Bay</b><span>Second Tokyo spot with 5–6 monsters</span></div><label class="switch"><input type="checkbox" data-sw="bay" ${st.bay ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Two-player variant</b><span>With 2 monsters, Tokyo pays energy instead of points${st.edition === '2011' ? ' · 2016 deck only' : ''}</span></div><label class="switch"><input type="checkbox" data-sw="duel" ${st.duel && st.edition !== '2011' ? 'checked' : ''} ${st.edition === '2011' ? 'disabled' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Best-keep dots</b><span>Green dot under the best dice to keep</span></div><label class="switch"><input type="checkbox" data-sw="hints" ${st.hints ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Computer speed</b></div><div style="width:170px">${seg('speed', [['normal', 'Normal'], ['fast', 'Fast']])}</div></div>
    </div>
    <div class="ver">King of Tokyo Lab ${VERSION} · fan-made study tool, not affiliated with the publisher · <a href="../">All games</a></div>
  </div>`;
  v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { st[b.dataset.k] = b.dataset.v; save(); renderSettings(); });
  v.querySelectorAll('[data-sw]').forEach(i => i.onchange = () => { st[i.dataset.sw] = i.checked; save(); });
}

// ================================================================== boot
setTab((location.hash || '#play').slice(1), false);
if (store.online) {
  ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  loadOnline().then(r => { room = r; return r.resume(); }).then(ok => {
    if (!ok) { store.online = false; save(); ui.mode = null; room = null; snap = null; }
    renderPlay();
  }).catch(() => { store.online = false; save(); ui.mode = null; room = null; snap = null; renderPlay(); });
}
window.__kot = { get snap() { return snap; }, get room() { return room; }, act };
