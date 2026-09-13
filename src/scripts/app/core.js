/* ═════════════════════════════════════════════════════════════════════════
   core.js — state, persistence, formatting and app chrome (toasts, modals).
   ═════════════════════════════════════════════════════════════════════════ */
import { ic } from './icons.js';

export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export const el = (id) => document.getElementById(id);

export const K = {
  ep: 'wh_active_endpoint_id',
  list: 'wh_saved_endpoints_list',
  pins: 'swh_pinned',
  prefs: 'swh_prefs',
  secrets: 'swh_secrets',
  targets: 'swh_replay_targets',
  log: (id) => `wh_captured_payloads_${id}`,
};

export const CAP = 100;                       // events kept per endpoint locally
export const EP_RE = /^[a-zA-Z0-9_-]{1,64}$/; // mirrors isValidEndpointId server-side

export function read(key, fb) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; } catch { return fb; }
}
export function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

const DEFAULTS = {
  sort: 'new', bview: 'tree', wrap: true, notify: false, autoVerify: false,
  listW: 356, recipe: 'node', codeLang: 'curl', fwdLang: 'node', mockSecret: '',
  fwdTarget: 'http://localhost:3000/api/webhooks',
  density: 'cosy', copied: false,
};

export const S = {
  ep: '', origin: '', events: [], sel: null,
  pins: read(K.pins, {}) || {},
  prefs: Object.assign({}, DEFAULTS, read(K.prefs, {}) || {}),
  secrets: read(K.secrets, {}) || {},
  q: '', method: 'ALL', pinOnly: false, sigOnly: false,
  paused: false, held: [], unseen: 0,
  selMode: false, checked: new Set(),
  baseline: null, diffOn: false,
  conn: 'boot', es: null, tries: 0, pollT: 0, seenIds: new Set(),
  hits: [], cfg: null, wf: null, boot: Date.now(),
};

export function savePrefs() { write(K.prefs, S.prefs); }
export function setPref(k, v) { S.prefs[k] = v; savePrefs(); }
export function saveLog() { write(K.log(S.ep), S.events.slice(0, CAP)); }
export function savePins() { write(K.pins, S.pins); }
export function saveSecrets() { write(K.secrets, S.secrets); }

/* ── Formatting ─────────────────────────────────────────────────────────── */
const ESC_RE = /[&<>"']/g;
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) { return String(v == null ? '' : v).replace(ESC_RE, (c) => ESC_MAP[c]); }

export function bytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1048576) return (v / 1024).toFixed(v < 10240 ? 1 : 0) + ' KB';
  return (v / 1048576).toFixed(2) + ' MB';
}
export function sizeOf(s) {
  try { return new TextEncoder().encode(String(s == null ? '' : s)).length; }
  catch { return String(s == null ? '' : s).length; }
}
export function ago(ts) {
  const ms = Math.max(0, Date.now() - new Date(ts).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'now';
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
export function clock(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}
export function stamp(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' });
}
export function dayKey(ts) {
  const d = new Date(ts); if (isNaN(d.getTime())) return 'Unknown';
  const now = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  if (same(d, new Date(now.getTime() - 86400000))) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function dur(n) { const v = Number(n) || 0; return v < 1000 ? Math.round(v) + ' ms' : (v / 1000).toFixed(2) + ' s'; }
export function pretty(txt) { try { return JSON.stringify(JSON.parse(txt), null, 2); } catch { return null; } }

/* ── Toasts ─────────────────────────────────────────────────────────────── */
const T_ICON = { ok: 'checkCircle', err: 'xCircle', warn: 'alert', info: 'info' };

export function toast(kind, title, msg) {
  const host = el('swh-toasts');
  if (!host) return;
  const n = document.createElement('div');
  n.className = 'swh-toast';
  n.dataset.k = kind || 'info';
  n.innerHTML = ic(T_ICON[kind] || 'info', 15) +
    `<div class="swh-grow"><p class="swh-toast-t">${esc(title)}</p>` +
    (msg ? `<p class="swh-toast-m">${esc(msg)}</p>` : '') + '</div>';
  host.appendChild(n);
  while (host.children.length > 4) host.firstElementChild.remove();
  setTimeout(() => {
    n.style.opacity = '0';
    n.style.transform = 'translateX(14px)';
    setTimeout(() => n.remove(), 240);
  }, kind === 'err' ? 6200 : 3600);
}
export const ok = (t, m) => toast('ok', t, m);
export const oops = (t, m) => toast('err', t, m);
export const note = (t, m) => toast('info', t, m);
export const heads = (t, m) => toast('warn', t, m);

/* ── Menus & modals ─────────────────────────────────────────────────────── */
export const stack = [];
let lastFocus = null;

export function closeMenus() {
  $$('#swh .swh-menu').forEach((m) => m.classList.add('hidden'));
  $$('#swh [aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

export function open(name) {
  const m = el('swh-m-' + name);
  if (!m) return null;
  closeMenus();
  if (!stack.length) lastFocus = document.activeElement;
  m.classList.remove('hidden');
  if (stack.indexOf(m) < 0) stack.push(m);
  document.dispatchEvent(new CustomEvent('swh:open', { detail: name }));
  const f = m.querySelector('input:not([type=hidden]):not([readonly]),textarea,select,.swh-b--pri');
  if (f) setTimeout(() => { try { f.focus(); } catch { /* ignore */ } }, 40);
  return m;
}

export function close(node) {
  const m = typeof node === 'string' ? el('swh-m-' + node) : node;
  if (!m || m.classList.contains('hidden')) return;
  m.classList.add('hidden');
  const i = stack.indexOf(m);
  if (i > -1) stack.splice(i, 1);
  m.dispatchEvent(new CustomEvent('swh:closed'));
  if (!stack.length && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch { /* ignore */ } }
}

export function closeTop() {
  const pal = el('swh-pal');
  if (pal && !pal.classList.contains('hidden')) { pal.classList.add('hidden'); return true; }
  if ($('#swh .swh-menu:not(.hidden)')) { closeMenus(); return true; }
  if (stack.length) { close(stack[stack.length - 1]); return true; }
  return false;
}

export function confirmBox(msg, label) {
  return new Promise((resolve) => {
    const m = el('swh-m-confirm');
    if (!m) { resolve(window.confirm(msg)); return; }
    el('swh-confirm-msg').textContent = msg;
    const prev = el('swh-confirm-ok');
    const btn = prev.cloneNode(false);
    btn.id = 'swh-confirm-ok';
    btn.textContent = label || 'Confirm';
    prev.replaceWith(btn);
    let done = false;
    const settle = (v) => { if (done) return; done = true; resolve(v); if (v) close(m); };
    btn.addEventListener('click', () => settle(true));
    m.addEventListener('swh:closed', () => settle(false), { once: true });
    open('confirm');
    setTimeout(() => btn.focus(), 50);
  });
}

/* ── Clipboard & files ──────────────────────────────────────────────────── */
export async function copy(text, label) {
  const s = String(text == null ? '' : text);
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    ta.remove();
    if (!done) { oops('Copy failed', 'The browser blocked clipboard access.'); return false; }
  }
  ok('Copied', label || undefined);
  return true;
}

export function dl(name, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  ok('Download started', name);
}

/* ── Endpoints ──────────────────────────────────────────────────────────── */
export function newId() {
  let seed = '';
  try {
    seed = Array.from(crypto.getRandomValues(new Uint32Array(4)))
      .map((n) => n.toString(36)).join('');
  } catch {
    seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return 'ep_' + seed.replace(/[^a-z0-9]/g, '').slice(0, 14);
}
export const hookUrl = (id) => `${S.origin}/api/r/${id || S.ep}`;
export const mailAddr = (id) => `${id || S.ep}@safewebhook.com`;

export function epList() {
  const raw = read(K.list, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (typeof e === 'string' ? { id: e, seen: 0 } : e))
    .filter((e) => e && typeof e.id === 'string' && EP_RE.test(e.id));
}
export function touchEp(id) {
  const list = epList().filter((e) => e.id !== id);
  list.unshift({ id, seen: Date.now() });
  write(K.list, list.slice(0, 15));
}
export function forgetEp(id) {
  write(K.list, epList().filter((e) => e.id !== id));
  try { localStorage.removeItem(K.log(id)); } catch { /* ignore */ }
}
export function storeBytes(id) {
  try { return (localStorage.getItem(K.log(id || S.ep)) || '').length; } catch { return 0; }
}

/* ── Replay target history ──────────────────────────────────────────────── */
export function targets() {
  const v = read(K.targets, []);
  return Array.isArray(v) ? v.filter((t) => typeof t === 'string') : [];
}
export function rememberTarget(url) {
  const list = targets().filter((t) => t !== url);
  list.unshift(url);
  write(K.targets, list.slice(0, 8));
}

