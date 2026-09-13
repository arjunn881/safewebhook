/* ═════════════════════════════════════════════════════════════════════════
   actions.js — everything that talks to the edge or mutates state: the live
   feed, endpoint switching, exports/imports, response & workflow config,
   composer, mock library, replay, monitor, analytics, palette.
   ═════════════════════════════════════════════════════════════════════════ */
import {
  S, el, $, $$, esc, read, write, K, CAP, EP_RE, copy, dl, ok, oops, note, heads,
  open, close, closeMenus, confirmBox, newId, hookUrl, mailAddr, epList, touchEp,
  forgetEp, saveLog, setPref, targets, rememberTarget, bytes, sizeOf, clock, stamp,
  ago, pretty, dur, saveSecrets, storeBytes, savePins,
} from './core.js';
import { ic } from './icons.js';
import * as V from './view.js';
import { verify, signHeaders, detect, SCHEMES } from './sign.js';

/* ── Normalising incoming events ────────────────────────────────────────── */
function obj(v) {
  if (typeof v === 'string') { try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
  return v && typeof v === 'object' ? v : {};
}
export function normalise(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ev = Object.assign({}, raw);
  ev.id = String(ev.id || 'ev_' + Math.random().toString(36).slice(2, 12));
  ev.endpoint_id = ev.endpoint_id || S.ep;
  ev.timestamp = ev.timestamp || new Date().toISOString();
  ev.method = String(ev.method || 'POST').toUpperCase();
  ev.headers = obj(ev.headers);
  ev.query_params = obj(ev.query_params);
  ev.body = ev.body == null ? '' : String(ev.body);
  if (!ev.size_bytes) ev.size_bytes = sizeOf(ev.body);
  if (ev.email && typeof ev.email === 'string') ev.email = obj(ev.email);
  return ev;
}

let titleTimer = 0;
function flashTitle(n) {
  if (document.visibilityState === 'visible') return;
  document.title = `(${n}) SafeWebhook Workspace`;
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => { document.title = 'SafeWebhook Workspace'; }, 20000);
}

function ping(ev) {
  if (!S.prefs.notify || document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`${ev.method} · ${V.nameOf(ev)}`, {
      body: `${bytes(ev.size_bytes)} · ${S.ep}`,
      tag: 'swh-' + ev.id,
      icon: '/favicon.svg',
    });
  } catch { /* notification API can throw on some platforms */ }
}

function bumpJump() {
  const b = el('swh-jump');
  if (!b) return;
  const n = S.paused ? S.held.length : S.unseen;
  if (!n) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  const label = el('swh-jump-n');
  if (label) label.textContent = S.paused ? `${n} held` : `${n} new`;
}

/* ── Ingest ─────────────────────────────────────────────────────────────── */
export function addEvents(list, opts) {
  const o = opts || {};
  const fresh = [];
  (Array.isArray(list) ? list : [list]).forEach((raw) => {
    const ev = normalise(raw);
    if (!ev || S.seenIds.has(ev.id)) return;
    S.seenIds.add(ev.id);
    fresh.push(ev);
  });
  if (!fresh.length) return 0;
  if (S.paused && !o.force) {
    S.held = fresh.concat(S.held).slice(0, CAP);
    bumpJump();
    V.updateStatus();
    return 0;
  }
  return commit(fresh, o);
}

function commit(fresh, o) {
  if (o.live) {
    fresh.forEach((e) => {
      try {
        Object.defineProperty(e, '__fresh', { value: 1, configurable: true, writable: true });
        setTimeout(() => { try { delete e.__fresh; } catch { /* ignore */ } }, 2600);
      } catch { /* ignore */ }
    });
  }
  S.events = fresh.concat(S.events).slice(0, CAP);
  if (S.seenIds.size > 900) S.seenIds = new Set(S.events.map((e) => e.id));
  saveLog();
  V.renderRows();
  if (!S.sel) V.select(fresh[0].id, true);
  else if (o.live) { S.unseen += fresh.length; bumpJump(); }
  if (o.live) {
    flashTitle(S.unseen || fresh.length);
    ping(fresh[0]);
    if (S.prefs.autoVerify && S.sel === fresh[0].id) setTimeout(() => runVerify(true), 80);
  }
  return fresh.length;
}

export function releaseHeld() {
  if (!S.held.length) { bumpJump(); return; }
  const list = S.held.slice();
  S.held = [];
  commit(list, { live: false });
  bumpJump();
  ok('Feed flushed', `${list.length} held ${list.length === 1 ? 'request' : 'requests'} added.`);
}

export function markSeen() {
  S.unseen = 0;
  bumpJump();
}

/* ── Live feed: SSE first, polling only while SSE is unhealthy ──────────── */
const POLL_MS = 5000;
let reT = 0;

function stopPoll() {
  if (S.pollT) { clearInterval(S.pollT); S.pollT = 0; }
}
function startPoll() {
  if (S.pollT || !S.ep) return;
  S.pollT = setInterval(poll, POLL_MS);
  poll();
}
async function poll() {
  if (!S.ep) return;
  try {
    const r = await fetch(`/api/poll/${encodeURIComponent(S.ep)}`, { headers: { accept: 'application/json' } });
    if (!r.ok) return;
    const d = await r.json();
    const list = Array.isArray(d && d.events) ? d.events : [];
    if (list.length) addEvents(list, { live: true });
    if (S.conn === 'offline') V.setConn('polling');
  } catch { /* offline; the interval keeps trying */ }
}

export function stopFeed() {
  clearTimeout(reT);
  if (S.es) { try { S.es.close(); } catch { /* ignore */ } S.es = null; }
  stopPoll();
}

export function connect() {
  stopFeed();
  if (!S.ep) return;
  if (typeof EventSource === 'undefined') { V.setConn('polling'); startPoll(); return; }
  V.setConn('connecting');
  let es;
  try { es = new EventSource(`/api/stream/${encodeURIComponent(S.ep)}`); }
  catch { V.setConn('polling'); startPoll(); return; }
  S.es = es;

  const healthy = () => { S.tries = 0; stopPoll(); V.setConn(S.paused ? 'paused' : 'live'); };
  es.onopen = healthy;
  es.onmessage = (m) => {
    let d = null;
    try { d = JSON.parse(m.data); } catch { return; }
    if (!d || typeof d !== 'object') return;
    if (d.type === 'connected') { healthy(); return; }
    if (d.type === 'error') { heads('Stream refused', String(d.message || 'The edge closed this stream.')); return; }
    if (d.id || d.method || d.body !== undefined) addEvents([d], { live: true });
  };
  es.onerror = () => {
    if (S.es !== es) return;
    try { es.close(); } catch { /* ignore */ }
    S.es = null;
    S.tries += 1;
    V.setConn('offline');
    startPoll();                                   // keep delivering while we back off
    const wait = Math.min(30000, 800 * Math.pow(2, Math.min(5, S.tries)));
    clearTimeout(reT);
    reT = setTimeout(connect, wait);
  };
}

export function togglePause(force) {
  S.paused = typeof force === 'boolean' ? force : !S.paused;
  const b = el('swh-pause');
  if (b) {
    b.setAttribute('aria-pressed', String(S.paused));
    const t = el('swh-pause-text');
    if (t) t.textContent = S.paused ? 'Resume' : 'Pause';
    const i = $('svg', b);
    if (i) i.outerHTML = ic(S.paused ? 'play' : 'pause', 15);
  }
  V.setConn(S.paused ? 'paused' : (S.es ? 'live' : (S.pollT ? 'polling' : 'offline')));
  if (!S.paused) releaseHeld();
  else note('Feed paused', 'Incoming requests are held until you resume.');
  bumpJump();
}

/* ── Edge history (survives a cleared cache / another device) ───────────── */
export async function syncHistory(loud) {
  if (!S.ep) return 0;
  try {
    const r = await fetch(`/api/history/${encodeURIComponent(S.ep)}?limit=100`, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const list = Array.isArray(d && d.webhooks) ? d.webhooks : [];
    const n = addEvents(list, { live: false, force: true });
    if (loud) {
      if (n) ok('History restored', `${n} request${n === 1 ? '' : 's'} pulled from the edge.`);
      else note('Nothing new', 'The edge has no requests this browser is missing.');
    }
    return n;
  } catch (e) {
    if (loud) oops('Could not reach the edge', e && e.message ? e.message : 'Network error');
    return 0;
  }
}

/* ── Endpoints ──────────────────────────────────────────────────────────── */
function hydrate(list) {
  return (Array.isArray(list) ? list : []).map(normalise).filter(Boolean);
}

export function renderEpList() {
  const host = el('swh-ep-list');
  if (!host) return;
  const list = epList();
  if (!list.length) { host.innerHTML = '<p class="swh-none">No other endpoints in this browser yet.</p>'; return; }
  host.innerHTML = list.map((e) => {
    const on = e.id === S.ep;
    const n = (read(K.log(e.id), []) || []).length;
    return `<div class="swh-row2"><button class="swh-b swh-b--line swh-grow" data-use="${esc(e.id)}"${on ? ' aria-current="true"' : ''}>` +
      `<span class="mono trunc">${esc(e.id)}</span>` +
      `<span class="swh-pill swh-mla">${n} held</span></button>` +
      `<button class="swh-b swh-b--ico swh-b--line" data-forget="${esc(e.id)}" title="Forget this endpoint"${on ? ' disabled' : ''}>${ic('trash', 13)}</button></div>`;
  }).join('');
}

export function useEndpoint(id, opts) {
  const clean = String(id || '').trim();
  if (!EP_RE.test(clean)) {
    oops('That id will not work', 'Use 1–64 letters, numbers, dashes or underscores.');
    return false;
  }
  const first = !S.ep;
  if (clean === S.ep && !(opts && opts.force)) return true;
  stopFeed();
  S.ep = clean;
  write(K.ep, clean);
  touchEp(clean);
  S.events = hydrate(read(K.log(clean), []));
  S.seenIds = new Set(S.events.map((e) => e.id));
  S.sel = null; S.held = []; S.unseen = 0;
  S.baseline = null; S.diffOn = false;
  S.checked.clear(); S.selMode = false;
  S.cfg = null; S.wf = null;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('ep', clean);
    window.history.replaceState({}, '', u.pathname + u.search);
  } catch { /* ignore */ }
  V.renderEndpoint();
  V.clearSelection();
  V.renderRows();
  renderEpList();
  bumpJump();
  connect();
  syncHistory(false);
  if (!first) ok('Endpoint switched', clean);
  return true;
}

export function spawnEndpoint() {
  const id = newId();
  if (useEndpoint(id)) {
    close('endpoints');
    ok('Fresh endpoint ready', id);
  }
}

export function openEndpointFromField() {
  const f = el('swh-ep-name');
  const raw = f ? String(f.value || '').trim() : '';
  if (!raw) { spawnEndpoint(); if (f) f.value = ''; return; }
  const v = raw.replace(/^.*\/api\/r\//, '').replace(/[?#].*$/, '').replace(/@safewebhook\.com$/i, '');
  if (useEndpoint(v)) { if (f) f.value = ''; close('endpoints'); }
}

export async function dropEndpoint(id) {
  if (id === S.ep) { heads('Still in use', 'Switch to another endpoint before forgetting this one.'); return; }
  if (!await confirmBox(`Forget "${id}" and its locally stored requests? The edge copy is untouched.`, 'Forget')) return;
  forgetEp(id);
  renderEpList();
  ok('Endpoint forgotten', id);
}

/* ── Deleting ───────────────────────────────────────────────────────────── */
export async function clearAll() {
  if (!S.events.length && !S.held.length) { note('Nothing to clear', 'This endpoint has no captured requests.'); return; }
  const yes = await confirmBox(`Delete all ${S.events.length} captured requests for "${S.ep}" — here and on the edge? This cannot be undone.`, 'Delete everything');
  if (!yes) return;
  let edge = true;
  try {
    const r = await fetch(`/api/history/${encodeURIComponent(S.ep)}`, { method: 'DELETE' });
    edge = r.ok;
  } catch { edge = false; }
  S.events = []; S.held = []; S.unseen = 0; S.seenIds.clear();
  S.sel = null; S.baseline = null; S.diffOn = false; S.checked.clear();
  saveLog();
  V.clearSelection();
  V.renderRows();
  bumpJump();
  if (edge) ok('History cleared', 'Local log and edge storage are both empty.');
  else heads('Cleared locally', 'The edge delete failed — old requests may reappear on refresh.');
}

export function forgetEvent(id) {
  const i = S.events.findIndex((e) => e.id === id);
  if (i < 0) return;
  S.events.splice(i, 1);
  S.seenIds.delete(id);
  S.checked.delete(id);
  if (S.baseline === id) { S.baseline = null; S.diffOn = false; }
  saveLog();
  if (S.sel === id) {
    const next = S.events[Math.min(i, S.events.length - 1)];
    if (next) V.select(next.id, true); else V.clearSelection();
  }
  V.renderRows();
  note('Removed', 'That request is gone from this browser.');
}

export async function deleteChecked() {
  const ids = Array.from(S.checked);
  if (!ids.length) { note('Nothing selected', 'Tick a few requests first.'); return; }
  if (!await confirmBox(`Remove ${ids.length} selected request${ids.length === 1 ? '' : 's'} from this browser?`, 'Remove')) return;
  const gone = new Set(ids);
  S.events = S.events.filter((e) => !gone.has(e.id));
  ids.forEach((id) => { S.seenIds.delete(id); if (S.pins[id]) delete S.pins[id]; });
  savePins();
  S.checked.clear();
  if (S.sel && gone.has(S.sel)) V.clearSelection();
  saveLog();
  V.renderRows();
  syncBulk();
  ok('Removed', `${ids.length} request${ids.length === 1 ? '' : 's'} dropped locally.`);
}

/* ── Multi-select ───────────────────────────────────────────────────────── */
export function syncBulk() {
  const bar = el('swh-bulk');
  if (bar) bar.classList.toggle('hidden', !S.selMode);
  const n = el('swh-bulk-n');
  if (n) n.textContent = `${S.checked.size} selected`;
  const btn = el('swh-select-mode');
  if (btn) btn.setAttribute('aria-pressed', String(S.selMode));
}

export function toggleSelectMode(force) {
  S.selMode = typeof force === 'boolean' ? force : !S.selMode;
  if (!S.selMode) S.checked.clear();
  syncBulk();
  V.renderRows();
}

export function check(id, on) {
  if (on) S.checked.add(id); else S.checked.delete(id);
  syncBulk();
}

export function checkAll() {
  const list = V.filtered();
  const all = list.every((e) => S.checked.has(e.id));
  if (all) S.checked.clear();
  else list.forEach((e) => S.checked.add(e.id));
  syncBulk();
  V.renderRows();
}

export function pinChecked() {
  const ids = Array.from(S.checked);
  if (!ids.length) { note('Nothing selected', 'Tick a few requests first.'); return; }
  const allPinned = ids.every((id) => S.pins[id]);
  ids.forEach((id) => { if (allPinned) delete S.pins[id]; else S.pins[id] = 1; });
  savePins();
  V.renderRows();
  if (S.sel) V.renderInspector();
  ok(allPinned ? 'Unpinned' : 'Pinned', `${ids.length} request${ids.length === 1 ? '' : 's'}.`);
}

function chosen() {
  const ids = Array.from(S.checked);
  if (ids.length) {
    const set = new Set(ids);
    return S.events.filter((e) => set.has(e.id));
  }
  return V.filtered();
}

/* ── Copy helpers ───────────────────────────────────────────────────────── */
function shq(s) { return "'" + String(s == null ? '' : s).replace(/'/g, "'\\''") + "'"; }

const HOP = new Set([
  'host', 'content-length', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'accept-encoding', 'cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'cf-visitor',
  'cf-worker', 'cf-ew-via', 'cdn-loop', 'x-forwarded-for', 'x-forwarded-proto',
  'x-forwarded-host', 'x-real-ip', 'x-request-id',
]);

export function replayHeaders(ev, mode) {
  const hs = V.headersOf(ev);
  const out = {};
  if (mode === 'none') return out;
  Object.keys(hs).forEach((k) => {
    const low = k.toLowerCase();
    if (HOP.has(low)) return;
    if (mode === 'min' && low !== 'content-type' && low !== 'user-agent' && !low.startsWith('x-') && !low.includes('signature')) return;
    out[k] = String(hs[k]);
  });
  return out;
}

export function toCurl(ev, url) {
  const hs = replayHeaders(ev, 'all');
  const lines = [`curl -X ${String(ev.method || 'POST').toUpperCase()} ${shq(url || hookUrl())}`];
  Object.keys(hs).forEach((k) => lines.push(`  -H ${shq(k + ': ' + hs[k])}`));
  if (ev.body) lines.push(`  --data-raw ${shq(ev.body)}`);
  return lines.join(' \\\n');
}

export function toFetch(ev, url) {
  const hs = replayHeaders(ev, 'all');
  return [
    `await fetch(${JSON.stringify(url || hookUrl())}, {`,
    `  method: ${JSON.stringify(String(ev.method || 'POST').toUpperCase())},`,
    `  headers: ${JSON.stringify(hs, null, 2).replace(/\n/g, '\n  ')},`,
    ev.body ? `  body: ${JSON.stringify(ev.body)},` : null,
    '});',
  ].filter(Boolean).join('\n');
}

export function copyKind(kind) {
  if (kind === 'url' || kind === 'email') setPref('copied', 1);
  if (kind === 'url') { copy(hookUrl(), hookUrl()); V.renderRows(); return; }
  if (kind === 'email') { copy(mailAddr(), mailAddr()); V.renderRows(); return; }
  if (kind === 'curl') { copy(V.sampleCurl(), 'Sample cURL request'); return; }
  if (kind === 'fetch') {
    copy([
      `await fetch(${JSON.stringify(hookUrl())}, {`,
      "  method: 'POST',",
      "  headers: { 'content-type': 'application/json' },",
      "  body: JSON.stringify({ hello: 'world', at: new Date().toISOString() }),",
      '});',
    ].join('\n'), 'fetch() snippet');
    return;
  }
  if (kind === 'id') { copy(S.ep, 'Endpoint id'); return; }
  closeMenus();
}

export function icopy(kind) {
  const ev = V.current();
  if (!ev) { note('Nothing selected', 'Pick a request from the list first.'); return; }
  closeMenus();
  if (kind === 'body') { copy(pretty(ev.body) || ev.body || '', 'Request body'); return; }
  if (kind === 'headers') { copy(JSON.stringify(V.headersOf(ev), null, 2), 'Headers as JSON'); return; }
  if (kind === 'curl') { copy(toCurl(ev), 'cURL that reproduces this request'); return; }
  if (kind === 'fetch') { copy(toFetch(ev), 'fetch() that reproduces this request'); return; }
  if (kind === 'raw') { copy(V.rawText(ev), 'Raw HTTP request'); return; }
  if (kind === 'event') { copy(JSON.stringify(ev, null, 2), 'Whole event as JSON'); return; }
  if (kind === 'link') {
    const u = `${S.origin}/app?ep=${encodeURIComponent(S.ep)}#${encodeURIComponent(ev.id)}`;
    copy(u, 'Deep link to this request');
    return;
  }
  if (kind === 'download') {
    dl(`${S.ep}-${ev.id}.json`, JSON.stringify(ev, null, 2));
    return;
  }
}

/* ── Export ─────────────────────────────────────────────────────────────── */
function harEntry(ev) {
  const hs = V.headersOf(ev);
  const qs = V.queryOf(ev);
  const ct = hs['content-type'] || hs['Content-Type'] || 'application/json';
  const url = hookUrl() + (Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : '');
  return {
    startedDateTime: new Date(ev.timestamp).toISOString(),
    time: 0,
    request: {
      method: String(ev.method || 'POST').toUpperCase(),
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: Object.keys(hs).map((k) => ({ name: k, value: String(hs[k]) })),
      queryString: Object.keys(qs).map((k) => ({ name: k, value: String(qs[k]) })),
      headersSize: -1,
      bodySize: Number(ev.size_bytes) || sizeOf(ev.body),
      postData: ev.body ? { mimeType: String(ct), text: String(ev.body), params: [] } : undefined,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: { size: 0, mimeType: 'application/json', text: '' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 0,
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    comment: `SafeWebhook capture ${ev.id}`,
  };
}

export async function exportAs(kind) {
  closeMenus();
  const list = chosen();
  const scope = S.checked.size ? 'selected' : 'filtered';
  const day = new Date().toISOString().slice(0, 10);
  const base = `safewebhook-${S.ep}-${day}`;

  if (kind === 'edge-json') {
    try {
      const r = await fetch(`/api/export/${encodeURIComponent(S.ep)}?format=json&limit=500`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      dl(`${base}-edge.json`, await r.text());
    } catch (e) {
      oops('Edge export failed', e && e.message ? e.message : 'Network error');
    }
    return;
  }

  if (!list.length) { note('Nothing to export', 'No requests match the current view.'); return; }

  if (kind === 'json' || kind === 'clipboard') {
    const doc = {
      tool: 'SafeWebhook',
      format: 'safewebhook.capture.v1',
      endpoint_id: S.ep,
      capture_url: hookUrl(),
      exported_at: new Date().toISOString(),
      scope,
      count: list.length,
      records: list,
    };
    const text = JSON.stringify(doc, null, 2);
    if (kind === 'clipboard') copy(text, `${list.length} request${list.length === 1 ? '' : 's'} as JSON`);
    else dl(`${base}.json`, text);
    return;
  }
  if (kind === 'ndjson') {
    dl(`${base}.ndjson`, list.map((e) => JSON.stringify(e)).join('\n') + '\n', 'application/x-ndjson');
    return;
  }
  if (kind === 'har') {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'SafeWebhook', version: '1.0' },
        browser: { name: 'SafeWebhook edge', version: '1.0' },
        pages: [],
        entries: list.slice().reverse().map(harEntry),
      },
    };
    dl(`${base}.har`, JSON.stringify(har, null, 2), 'application/json');
    return;
  }
  if (kind === 'curl') {
    const head = [
      '#!/usr/bin/env bash',
      '# Replay a SafeWebhook capture set against any target.',
      `#   TARGET=http://localhost:3000/api/webhooks bash ${base}.sh`,
      'set -euo pipefail',
      `TARGET="\${TARGET:-${hookUrl()}}"`,
      '',
    ].join('\n');
    const body = list.slice().reverse().map((ev, i) => {
      const c = toCurl(ev, '$TARGET').replace(shq('$TARGET'), '"$TARGET"');
      return `# ${i + 1}/${list.length} · ${stamp(ev.timestamp)} · ${V.nameOf(ev)}\n${c}\necho`;
    }).join('\n\n');
    dl(`${base}.sh`, head + body + '\n', 'text/x-shellscript');
    return;
  }
  if (kind === 'csv') {
    const rows = [['id', 'timestamp', 'method', 'path', 'event', 'format', 'bytes', 'signature', 'client_ip']];
    list.forEach((e) => rows.push([
      e.id, e.timestamp, String(e.method || '').toUpperCase(), V.pathOf(e), V.nameOf(e),
      V.fmtOf(e), String(Number(e.size_bytes) || sizeOf(e.body)), V.sigOf(e) || '', e.client_ip || '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    dl(`${base}.csv`, csv + '\r\n', 'text/csv');
    return;
  }
  if (kind === 'md') {
    const lines = [`# SafeWebhook — ${S.ep}`, '', `Exported ${stamp(Date.now())} · ${list.length} request${list.length === 1 ? '' : 's'}`, ''];
    list.slice().reverse().forEach((e, i) => {
      lines.push(`## ${i + 1}. ${String(e.method || '').toUpperCase()} ${V.nameOf(e)}`, '',
        `- **When:** ${stamp(e.timestamp)}`, `- **Size:** ${bytes(Number(e.size_bytes) || sizeOf(e.body))}`,
        `- **Signature:** ${V.sigOf(e) || 'none detected'}`, '', '```json',
        (pretty(e.body) || e.body || '(empty body)'), '```', '');
    });
    dl(`${base}.md`, lines.join('\n'), 'text/markdown');
  }
}

/* ── Import ─────────────────────────────────────────────────────────────── */
function pluck(doc) {
  if (Array.isArray(doc)) return doc;
  if (!doc || typeof doc !== 'object') return [];
  if (Array.isArray(doc.records)) return doc.records;
  if (Array.isArray(doc.webhooks)) return doc.webhooks;
  if (Array.isArray(doc.events)) return doc.events;
  if (doc.log && Array.isArray(doc.log.entries)) {
    return doc.log.entries.map((en) => {
      const rq = en.request || {};
      const hs = {};
      (rq.headers || []).forEach((h) => { if (h && h.name) hs[h.name] = h.value; });
      let query = {};
      try { query = Object.fromEntries((rq.queryString || []).map((q) => [q.name, q.value])); } catch { query = {}; }
      return {
        id: 'har_' + Math.random().toString(36).slice(2, 12),
        timestamp: en.startedDateTime || new Date().toISOString(),
        method: rq.method || 'POST',
        headers: hs,
        query_params: query,
        body: (rq.postData && rq.postData.text) || '',
        url: rq.url || '',
      };
    });
  }
  if (doc.id || doc.body !== undefined) return [doc];
  return [];
}

export function importText(text, mode) {
  const raw = String(text || '').trim();
  if (!raw) { oops('Nothing to import', 'Paste a JSON or NDJSON export first.'); return 0; }
  let list = [];
  try {
    list = pluck(JSON.parse(raw));
  } catch {
    list = raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }
  if (!list.length) { oops('Unrecognised file', 'Expected a SafeWebhook export, an events array, NDJSON or a HAR file.'); return 0; }
  if (mode === 'replace') {
    S.events = []; S.seenIds.clear(); S.sel = null;
    S.baseline = null; S.diffOn = false; S.checked.clear();
    V.clearSelection();
  }
  const n = addEvents(list, { live: false, force: true });
  V.renderRows();
  close('import');
  if (n) ok('Import complete', `${n} request${n === 1 ? '' : 's'} added to this endpoint.`);
  else heads('Nothing new', 'Every request in that file was already here.');
  return n;
}

function importMode() {
  return (el('swh-import-replace') || {}).checked ? 'replace' : 'merge';
}

export function wireDrop() {
  const zone = el('swh-drop');
  const picker = el('swh-drop-input');
  const ta = el('swh-import-ta');
  if (zone) {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { stop(e); zone.dataset.hot = '1'; }));
    ['dragleave', 'dragend'].forEach((t) => zone.addEventListener(t, (e) => { stop(e); delete zone.dataset.hot; }));
    zone.addEventListener('drop', (e) => {
      stop(e);
      delete zone.dataset.hot;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      readFile(f);
    });
    zone.addEventListener('click', () => { if (picker) picker.click(); });
    zone.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (picker) picker.click();
    });
  }
  if (picker) {
    picker.addEventListener('change', () => {
      const f = picker.files && picker.files[0];
      if (f) readFile(f);
      picker.value = '';
    });
  }

  function readFile(f) {
    if (f.size > 8 * 1024 * 1024) { oops('That file is too big', 'Imports are capped at 8 MB.'); return; }
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || '');
      if (ta) ta.value = text.slice(0, 400000);
      importText(text, importMode());
    };
    r.onerror = () => oops('Could not read that file', f.name);
    r.readAsText(f);
  }
}

export function importFromTextarea() {
  importText((el('swh-import-ta') || {}).value || '', importMode());
}

/* ── Editable header rows (response builder + composer + replay) ────────── */
export function addRow(hostId, k, v) {
  const host = el(hostId);
  if (!host) return;
  const row = document.createElement('div');
  row.className = 'swh-row2';
  row.innerHTML = `<input class="swh-in mono swh-grow" data-hk placeholder="header-name" value="${esc(k || '')}" spellcheck="false" aria-label="Header name" />` +
    `<input class="swh-in mono swh-grow" data-hv placeholder="value" value="${esc(v || '')}" spellcheck="false" aria-label="Header value" />` +
    `<button type="button" class="swh-b swh-b--ico swh-b--line" data-hdel aria-label="Remove this header">${ic('x', 13)}</button>`;
  host.appendChild(row);
}
export function readRows(hostId) {
  const out = {};
  $$(`#${hostId} .swh-row2`).forEach((r) => {
    const k = (r.querySelector('[data-hk]') || {}).value || '';
    const v = (r.querySelector('[data-hv]') || {}).value || '';
    if (String(k).trim()) out[String(k).trim()] = String(v);
  });
  return out;
}
function fillRows(hostId, map) {
  const host = el(hostId);
  if (!host) return;
  host.innerHTML = '';
  const keys = Object.keys(map || {});
  keys.forEach((k) => addRow(hostId, k, map[k]));
  if (!keys.length) addRow(hostId, '', '');
}

/* ── Response builder ───────────────────────────────────────────────────── */
const PRESETS = {
  ok: { statusCode: 200, contentType: 'application/json', responseBody: '{\n  "received": true\n}', delayMs: 0, responseHeaders: {} },
  created: { statusCode: 201, contentType: 'application/json', responseBody: '{\n  "id": "obj_123",\n  "created": true\n}', delayMs: 0, responseHeaders: {} },
  accepted: { statusCode: 202, contentType: 'application/json', responseBody: '{\n  "queued": true\n}', delayMs: 0, responseHeaders: {} },
  bad: { statusCode: 400, contentType: 'application/json', responseBody: '{\n  "error": "invalid_payload"\n}', delayMs: 0, responseHeaders: {} },
  unauth: { statusCode: 401, contentType: 'application/json', responseBody: '{\n  "error": "signature_mismatch"\n}', delayMs: 0, responseHeaders: { 'www-authenticate': 'Signature' } },
  server: { statusCode: 500, contentType: 'application/json', responseBody: '{\n  "error": "internal"\n}', delayMs: 0, responseHeaders: {} },
  slow: { statusCode: 200, contentType: 'application/json', responseBody: '{\n  "received": true\n}', delayMs: 3000, responseHeaders: {} },
};

function paintConfig(c) {
  S.cfg = c || {};
  const set = (id, v) => { const n = el(id); if (n) n.value = v; };
  set('swh-resp-status', String(c && c.statusCode != null ? c.statusCode : 200));
  set('swh-resp-ct', String((c && c.contentType) || 'application/json'));
  set('swh-resp-body', String((c && c.responseBody) != null ? c.responseBody : ''));
  const d = Math.min(10000, Math.max(0, Number(c && c.delayMs) || 0));
  set('swh-resp-delay', String(d));
  const out = el('swh-resp-delay-v');
  if (out) out.textContent = d ? dur(d) : '0 ms';
  fillRows('swh-resp-headers', (c && c.responseHeaders) || {});
  checkResponseBody();
}

export function checkResponseBody() {
  const ta = el('swh-resp-body');
  const hint = el('swh-resp-valid');
  if (!ta || !hint) return true;
  const ct = String((el('swh-resp-ct') || {}).value || '');
  const body = String(ta.value || '');
  if (!/json/i.test(ct) || !body.trim()) { hint.textContent = ''; return true; }
  const good = !!pretty(body);
  hint.textContent = good ? 'Valid JSON' : 'Not valid JSON yet';
  hint.style.color = good ? 'var(--accent-secondary)' : '#f59e0b';
  return good;
}

export async function loadConfig(loud) {
  if (!S.ep) return;
  try {
    const r = await fetch(`/api/config/${encodeURIComponent(S.ep)}`, { headers: { accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok) throw new Error((d && d.error) || 'HTTP ' + r.status);
    paintConfig(d.config || {});
    if (loud) note('Loaded', 'Current edge response for this endpoint.');
  } catch (e) {
    if (loud) oops('Could not load the response config', e && e.message ? e.message : 'Network error');
  }
}

export function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  paintConfig(Object.assign({}, S.cfg || {}, p));
  $$('#swh-resp-presets .swh-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.preset === name)));
  note('Preset loaded', 'Press Save response to make it live.');
}

export function formatResponseBody() {
  const ta = el('swh-resp-body');
  if (!ta) return;
  const p = pretty(ta.value);
  if (!p) { oops('Not JSON', 'Only valid JSON can be reformatted.'); return; }
  ta.value = p;
  checkResponseBody();
}

export async function saveConfig() {
  const status = Number((el('swh-resp-status') || {}).value || 200);
  const ct = String((el('swh-resp-ct') || {}).value || 'application/json').trim();
  const body = String((el('swh-resp-body') || {}).value || '');
  const delay = Number((el('swh-resp-delay') || {}).value || 0);
  if (!(status >= 100 && status <= 599)) { oops('Bad status code', 'Use a number between 100 and 599.'); return; }
  if (!checkResponseBody()) {
    const go = await confirmBox('That body is not valid JSON but the content type says JSON. Save it anyway?', 'Save anyway');
    if (!go) return;
  }
  const payload = {
    statusCode: status,
    contentType: ct,
    responseBody: body,
    delayMs: Math.min(10000, Math.max(0, delay)),
    responseHeaders: readRows('swh-resp-headers'),
  };
  try {
    const r = await fetch(`/api/config/${encodeURIComponent(S.ep)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok || d.success === false) throw new Error((d && d.error) || 'HTTP ' + r.status);
    paintConfig(d.config || payload);
    close('respond');
    ok('Response is live', `Senders now get HTTP ${payload.statusCode}${payload.delayMs ? ' after ' + dur(payload.delayMs) : ''}.`);
  } catch (e) {
    oops('Save failed', e && e.message ? e.message : 'Network error');
  }
}

/* ── Workflow rules ─────────────────────────────────────────────────────── */
function paintWorkflow(w) {
  S.wf = w || {};
  const on = el('swh-wf-on');
  if (on) on.checked = !!(w && w.enabled);
  const set = (id, v) => { const n = el(id); if (n) n.value = v == null ? '' : String(v); };
  set('swh-wf-fwd', w && w.autoForwardUrl);
  set('swh-wf-notify', w && w.notifyWebhookUrl);
}

export async function loadWorkflow(loud) {
  if (!S.ep) return;
  try {
    const r = await fetch(`/api/workflow/${encodeURIComponent(S.ep)}`, { headers: { accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok) throw new Error((d && d.error) || 'HTTP ' + r.status);
    paintWorkflow(d.workflow || {});
    if (loud) note('Loaded', 'Current automation for this endpoint.');
  } catch (e) {
    if (loud) oops('Could not load automation', e && e.message ? e.message : 'Network error');
  }
}

function urlish(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

export async function saveWorkflow() {
  const fwd = urlish((el('swh-wf-fwd') || {}).value);
  const nfy = urlish((el('swh-wf-notify') || {}).value);
  if (fwd === null || nfy === null) { oops('Bad URL', 'Forward and notify targets must start with http:// or https://.'); return; }
  const payload = {
    enabled: !!(el('swh-wf-on') || {}).checked,
    autoForwardUrl: fwd,
    notifyWebhookUrl: nfy,
    jsTransformCode: String((S.wf && S.wf.jsTransformCode) || ''),
  };
  if (payload.enabled && !fwd && !nfy) {
    heads('Nothing to do', 'Add a forward or notify URL before enabling automation.');
    return;
  }
  try {
    const r = await fetch(`/api/workflow/${encodeURIComponent(S.ep)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok || d.success === false) throw new Error((d && d.error) || 'HTTP ' + r.status);
    paintWorkflow(d.workflow || payload);
    close('workflow');
    ok(payload.enabled ? 'Automation armed' : 'Automation saved',
      payload.enabled && fwd ? 'Every capture is forwarded to ' + fwd : 'Rules stored for this endpoint.');
  } catch (e) {
    oops('Save failed', e && e.message ? e.message : 'Network error');
  }
}

export async function testForward() {
  const btn = el('swh-wf-test');
  const fwd = urlish((el('swh-wf-fwd') || {}).value);
  if (!fwd) { oops('No target', 'Enter the forward URL you want to test.'); return; }
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  note('Testing…', 'Delivering a probe through the edge.');
  const ev = V.current();
  const body = ev && ev.body
    ? ev.body
    : JSON.stringify({ safewebhook: 'forward-test', endpoint_id: S.ep, at: new Date().toISOString() }, null, 2);
  const res = await sendReplay({
    target_url: fwd,
    method: 'POST',
    headers: Object.assign(
      { 'content-type': 'application/json', 'x-safewebhook-test': 'forward' },
      ev ? replayHeaders(ev, 'min') : {},
    ),
    body,
    retry_count: 0,
  });
  if (btn) { btn.disabled = false; delete btn.dataset.busy; }
  const first = String(res.text || '').split('\n')[0];
  if (res.good) ok('Target reachable', first);
  else oops('Target did not accept it', first);
}

/* ── Replay through the edge (shared by workflow test + replay modal) ───── */
export async function sendReplay(payload) {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/replay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    const ms = d && d.duration_ms != null ? d.duration_ms : Math.round(performance.now() - t0);
    if (r.status === 429) {
      return { good: false, text: 'Rate limited — 20 replays per minute per IP. Try again shortly.' };
    }
    if (!r.ok || d.success === false) {
      return { good: false, text: `Failed after ${d && d.attempts ? d.attempts : 1} attempt(s) in ${dur(ms)}\n${(d && d.error) || 'HTTP ' + r.status}` };
    }
    const hs = d.headers || {};
    const head = Object.keys(hs).slice(0, 12).map((k) => `${k}: ${hs[k]}`).join('\n');
    return {
      good: d.status < 400,
      status: d.status,
      text: `HTTP ${d.status} ${d.status_text || ''} · ${dur(ms)} · ${d.attempts || 1} attempt(s)\n\n${head}\n\n${String(d.body || '(empty body)').slice(0, 1200)}`,
    };
  } catch (e) {
    return { good: false, text: 'Network error: ' + (e && e.message ? e.message : 'unknown') };
  }
}

/* ── Shared result pane ─────────────────────────────────────────────────── */
function out(id, text, state) {
  const n = el(id);
  if (!n) return;
  n.className = 'swh-out';
  n.dataset.s = state || 'idle';
  n.textContent = String(text == null ? '' : text);
}

/* ── Replay modal ───────────────────────────────────────────────────────── */
export function openReplay() {
  const ev = V.current();
  if (!ev) { heads('Pick a request first', 'Select a capture in the list, then replay it.'); return; }
  const list = el('swh-rp-recent');
  if (list) {
    list.innerHTML = targets().map((t) => `<option value="${esc(t)}"></option>`).join('');
  }
  const url = el('swh-rp-url');
  if (url && !url.value) url.value = S.prefs.fwdTarget || '';
  out('swh-rp-out', `Ready to send ${String(ev.method || 'POST').toUpperCase()} ${V.nameOf(ev)} · ${bytes(Number(ev.size_bytes) || sizeOf(ev.body))}`, 'idle');
  open('replay');
}

export async function runReplay() {
  const ev = V.current();
  if (!ev) { heads('Nothing selected', 'Choose a capture to replay.'); return; }
  const field = el('swh-rp-url');
  const target = urlish(field ? field.value : '');
  if (!target) { oops('Bad target', 'Enter an http:// or https:// URL to replay into.'); return; }
  const mode = String((el('swh-rp-headers') || {}).value || 'all');
  const retry = Math.min(3, Math.max(0, Number((el('swh-rp-retry') || {}).value || 1)));
  const btn = el('swh-rp-send');
  out('swh-rp-out', 'Sending through the edge…', 'wait');
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  setPref('fwdTarget', target);
  const res = await sendReplay({
    target_url: target,
    method: String(ev.method || 'POST').toUpperCase(),
    headers: replayHeaders(ev, mode),
    body: ev.body == null ? '' : String(ev.body),
    retry_count: retry,
  });
  if (btn) { btn.disabled = false; delete btn.dataset.busy; }
  out('swh-rp-out', res.text, res.good ? 'ok' : 'bad');
  if (res.good) { rememberTarget(target); ok('Replay delivered', `HTTP ${res.status} from ${target}`); }
  else oops('Replay failed', String(res.text || '').split('\n')[0]);
}

/* ── Uptime / reachability monitor ──────────────────────────────────────── */
export async function runMonitor() {
  const target = urlish((el('swh-mon-url') || {}).value);
  const btn = el('swh-mon-run');
  if (!target) { oops('Bad URL', 'Enter an http:// or https:// endpoint to probe.'); return; }
  out('swh-mon-out', 'Probing from the edge…', 'wait');
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  try {
    const r = await fetch('/api/monitor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: target, method: String((el('swh-mon-method') || {}).value || 'GET').toUpperCase() }),
    });
    const d = await r.json().catch(() => ({}));
    const lines = [];
    const up = !!d.status && d.status < 400;
    if (!d.status) {
      lines.push('Unreachable — ' + (d.error || 'no response from the edge'));
    } else {
      lines.push(`HTTP ${d.status} ${d.status_text || ''} · ${dur(d.response_time_ms)}`);
      const ssl = d.ssl || {};
      if (ssl.enabled) lines.push(`TLS: ${ssl.protocol || 'negotiated'}${ssl.valid ? ' · certificate valid' : ' · certificate unverified'}`);
      else lines.push('TLS: not used (plain HTTP)');
      if (d.redirected) lines.push('Redirected to ' + (d.final_url || 'another host'));
      const hs = d.headers || {};
      const keys = Object.keys(hs).slice(0, 14);
      if (keys.length) lines.push('', ...keys.map((k) => `${k}: ${hs[k]}`));
      if (d.body_preview) lines.push('', String(d.body_preview).slice(0, 800));
    }
    out('swh-mon-out', lines.join('\n'), up ? 'ok' : 'bad');
    if (up) ok('Target is up', `HTTP ${d.status} in ${dur(d.response_time_ms)}`);
    else heads('Target looks unhealthy', d.error || `HTTP ${d.status || '—'}`);
  } catch (e) {
    out('swh-mon-out', 'Probe failed: ' + (e && e.message ? e.message : 'network error'), 'bad');
    oops('Probe failed', e && e.message ? e.message : 'Network error');
  } finally {
    if (btn) { btn.disabled = false; delete btn.dataset.busy; }
  }
}

/* ── Endpoint analytics (edge-side, not this browser's log) ─────────────── */
function statTile(label, value, sub) {
  return `<div class="swh-stat"><dt>${esc(label)}</dt><dd>${esc(value)}` +
    (sub ? `<small> ${esc(sub)}</small>` : '') + '</dd></div>';
}

function breakdown(title, map) {
  const keys = Object.keys(map || {});
  if (!keys.length) return '';
  const total = keys.reduce((n, k) => n + (Number(map[k]) || 0), 0) || 1;
  const rows = keys.sort((a, b) => map[b] - map[a]).map((k) => {
    const n = Number(map[k]) || 0;
    const pct = Math.round((n / total) * 100);
    return '<div class="swh-meter">' +
      `<span class="swh-meter-k mono">${esc(k)}</span>` +
      `<span class="swh-meter-t"><i style="width:${Math.max(2, pct)}%"></i></span>` +
      `<span class="swh-meter-n mono">${n} · ${pct}%</span></div>`;
  }).join('');
  return `<div class="swh-card"><div class="swh-card-h">${esc(title)}</div><div class="swh-card-b swh-fc">${rows}</div></div>`;
}

export async function loadStats() {
  const host = el('swh-stats-out');
  if (!host) return;
  host.innerHTML = '<p class="swh-none">Reading the edge store…</p>';
  try {
    const r = await fetch(`/api/stats/${encodeURIComponent(S.ep)}`, { headers: { accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok) throw new Error((d && d.error) || 'HTTP ' + r.status);
    const total = Number(d.total_requests) || 0;
    const local = S.events.length;
    const grid = [
      statTile('Total stored', String(total)),
      statTile('Last hour', String(Number(d.requests_last_hour) || 0)),
      statTile('Last 24 hours', String(Number(d.requests_last_24h) || 0)),
      statTile('Average payload', bytes(d.avg_payload_size_bytes)),
      statTile('In this browser', String(local), local === total ? 'in sync' : ''),
      statTile('Local storage used', bytes(storeBytes())),
    ].join('');
    const when = [
      d.first_seen ? `<div class="swh-stat"><dt>First seen</dt><dd>${esc(stamp(d.first_seen))}<small> ${esc(ago(d.first_seen))} ago</small></dd></div>` : '',
      d.last_seen ? `<div class="swh-stat"><dt>Last seen</dt><dd>${esc(stamp(d.last_seen))}<small> ${esc(ago(d.last_seen))} ago</small></dd></div>` : '',
    ].join('');
    host.innerHTML = `<div class="swh-grid">${grid}${when}</div>` +
      breakdown('Method breakdown', d.method_breakdown) +
      breakdown('Signature providers seen', d.signature_providers) +
      (total ? '' : '<p class="swh-none">Nothing has reached this endpoint yet. Send a test event and refresh.</p>') +
      `<p class="swh-hint">Computed ${esc(stamp(d.computed_at || Date.now()))} · the edge keeps the most recent 100 requests per endpoint.</p>`;
  } catch (e) {
    host.innerHTML = `<p class="swh-none">Could not load analytics — ${esc(e && e.message ? e.message : 'network error')}</p>`;
  }
}

/* ── Integration snippets ───────────────────────────────────────────────── */
const SNIP_BODY = '{"event":"order.created","id":"evt_123","amount":4200}';

function snippet(lang, url) {
  const b = SNIP_BODY;
  if (lang === 'curl') {
    return `curl -i -X POST '${url}' \\\n  -H 'content-type: application/json' \\\n  -d '${b}'`;
  }
  if (lang === 'js') {
    return [
      `const res = await fetch('${url}', {`,
      "  method: 'POST',",
      "  headers: { 'content-type': 'application/json' },",
      `  body: JSON.stringify(${b}),`,
      '});',
      'console.log(res.status, await res.text());',
    ].join('\n');
  }
  if (lang === 'node') {
    return [
      "// Node 18+ has fetch built in — no dependencies needed.",
      `const res = await fetch('${url}', {`,
      "  method: 'POST',",
      "  headers: { 'content-type': 'application/json' },",
      `  body: JSON.stringify(${b}),`,
      '});',
      'console.log(res.status, await res.text());',
    ].join('\n');
  }
  if (lang === 'python') {
    return [
      'import requests',
      '',
      `r = requests.post("${url}", json=${b.replace(/true/g, 'True').replace(/false/g, 'False')}, timeout=10)`,
      'print(r.status_code, r.text)',
    ].join('\n');
  }
  if (lang === 'go') {
    return [
      'package main',
      '',
      'import (',
      '\t"bytes"',
      '\t"fmt"',
      '\t"io"',
      '\t"net/http"',
      ')',
      '',
      'func main() {',
      `\tbody := []byte(\`${b}\`)`,
      `\tres, err := http.Post("${url}", "application/json", bytes.NewReader(body))`,
      '\tif err != nil { panic(err) }',
      '\tdefer res.Body.Close()',
      '\tout, _ := io.ReadAll(res.Body)',
      '\tfmt.Println(res.StatusCode, string(out))',
      '}',
    ].join('\n');
  }
  if (lang === 'php') {
    return [
      '<?php',
      `$ch = curl_init('${url}');`,
      'curl_setopt_array($ch, [',
      '    CURLOPT_POST => true,',
      `    CURLOPT_POSTFIELDS => '${b}',`,
      "    CURLOPT_HTTPHEADER => ['content-type: application/json'],",
      '    CURLOPT_RETURNTRANSFER => true,',
      ']);',
      '$out = curl_exec($ch);',
      'echo curl_getinfo($ch, CURLINFO_HTTP_CODE), PHP_EOL, $out, PHP_EOL;',
      'curl_close($ch);',
    ].join('\n');
  }
  if (lang === 'ruby') {
    return [
      "require 'net/http'",
      "require 'json'",
      '',
      `uri = URI('${url}')`,
      "res = Net::HTTP.post(uri, '" + b + "', 'content-type' => 'application/json')",
      'puts res.code, res.body',
    ].join('\n');
  }
  if (lang === 'rust') {
    return [
      '// Cargo.toml: reqwest = { version = "0.12", features = ["json", "blocking"] }',
      'fn main() -> Result<(), Box<dyn std::error::Error>> {',
      '    let client = reqwest::blocking::Client::new();',
      `    let res = client.post("${url}")`,
      '        .header("content-type", "application/json")',
      `        .body(r#"${b}"#)`,
      '        .send()?;',
      '    println!("{} {}", res.status(), res.text()?);',
      '    Ok(())',
      '}',
    ].join('\n');
  }
  if (lang === 'java') {
    return [
      'import java.net.URI;',
      'import java.net.http.*;',
      '',
      'var client = HttpClient.newHttpClient();',
      'var req = HttpRequest.newBuilder()',
      `    .uri(URI.create("${url}"))`,
      '    .header("content-type", "application/json")',
      `    .POST(HttpRequest.BodyPublishers.ofString("${b.replace(/"/g, '\\"')}"))`,
      '    .build();',
      'var res = client.send(req, HttpResponse.BodyHandlers.ofString());',
      'System.out.println(res.statusCode() + " " + res.body());',
    ].join('\n');
  }
  return [
    'using var client = new HttpClient();',
    `var body = new StringContent(@"${b.replace(/"/g, '""')}", System.Text.Encoding.UTF8, "application/json");`,
    `var res = await client.PostAsync("${url}", body);`,
    'Console.WriteLine((int)res.StatusCode + " " + await res.Content.ReadAsStringAsync());',
  ].join('\n');
}

export function renderSnippet(lang) {
  const which = lang || S.prefs.codeLang || 'curl';
  setPref('codeLang', which);
  const node = el('swh-code-out');
  if (node) node.textContent = snippet(which, hookUrl());
  $$('#swh-code-langs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.lang === which ? 'true' : 'false'));
}

/* ── Forward captures to localhost (no tunnel) ──────────────────────────── */
function fwdScript(lang, target) {
  const stream = `${S.origin}/api/stream/${S.ep}`;
  if (lang === 'bash') {
    return [
      '#!/usr/bin/env bash',
      '# Streams SafeWebhook captures into your local server. Needs curl + jq.',
      'set -euo pipefail',
      `TARGET="\${TARGET:-${target}}"`,
      `curl -sN "${stream}" | while read -r line; do`,
      '  case "$line" in',
      '    data:*)',
      '      payload="${line#data: }"',
      '      [ -z "$payload" ] && continue',
      '      echo "$payload" | jq -e .body >/dev/null 2>&1 || continue',
      '      body=$(echo "$payload" | jq -r ".body // \\"\\"")',
      '      method=$(echo "$payload" | jq -r ".method // \\"POST\\"")',
      '      echo "→ $method $TARGET"',
      '      curl -s -o /dev/null -w "  ← HTTP %{http_code} in %{time_total}s\\n" \\',
      '        -X "$method" -H "content-type: application/json" -d "$body" "$TARGET"',
      '      ;;',
      '  esac',
      'done',
    ].join('\n');
  }
  if (lang === 'python') {
    return [
      '#!/usr/bin/env python3',
      '"""Streams SafeWebhook captures into your local server.  pip install httpx"""',
      'import json',
      'import httpx',
      '',
      `STREAM = "${stream}"`,
      `TARGET = "${target}"`,
      '',
      'with httpx.Client(timeout=None) as client:',
      '    with client.stream("GET", STREAM) as res:',
      '        print(f"listening — forwarding to {TARGET}")',
      '        for line in res.iter_lines():',
      '            if not line.startswith("data:"):',
      '                continue',
      '            try:',
      '                ev = json.loads(line[5:].strip())',
      '            except json.JSONDecodeError:',
      '                continue',
      '            if ev.get("type") == "connected":',
      '                continue',
      '            method = (ev.get("method") or "POST").upper()',
      '            headers = {k: v for k, v in (ev.get("headers") or {}).items()',
      '                       if k.lower() not in ("host", "content-length", "connection")}',
      '            out = httpx.request(method, TARGET, content=ev.get("body") or "",',
      '                                headers=headers or {"content-type": "application/json"},',
      '                                timeout=15)',
      '            print(f"{method} -> {out.status_code}")',
    ].join('\n');
  }
  return [
    '#!/usr/bin/env node',
    '// Streams SafeWebhook captures into your local server. Node 18+, zero dependencies.',
    `const STREAM = '${stream}';`,
    `const TARGET = process.env.TARGET || '${target}';`,
    'const SKIP = new Set([\'host\', \'content-length\', \'connection\', \'transfer-encoding\']);',
    '',
    'async function listen() {',
    '  const res = await fetch(STREAM, { headers: { accept: \'text/event-stream\' } });',
    '  if (!res.ok || !res.body) throw new Error(`stream failed: HTTP ${res.status}`);',
    '  console.log(`listening — forwarding to ${TARGET}`);',
    '  const reader = res.body.getReader();',
    '  const dec = new TextDecoder();',
    '  let buf = \'\';',
    '  for (;;) {',
    '    const { value, done } = await reader.read();',
    '    if (done) break;',
    '    buf += dec.decode(value, { stream: true });',
    '    const chunks = buf.split(\'\\n\\n\');',
    '    buf = chunks.pop() || \'\';',
    '    for (const chunk of chunks) {',
    '      const line = chunk.split(\'\\n\').find((l) => l.startsWith(\'data:\'));',
    '      if (!line) continue;',
    '      let ev;',
    '      try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }',
    '      if (!ev || ev.type === \'connected\') continue;',
    '      const headers = {};',
    '      for (const [k, v] of Object.entries(ev.headers || {})) {',
    '        if (!SKIP.has(k.toLowerCase())) headers[k] = String(v);',
    '      }',
    '      if (!headers[\'content-type\']) headers[\'content-type\'] = \'application/json\';',
    '      const t0 = Date.now();',
    '      try {',
    '        const hit = await fetch(TARGET, {',
    '          method: (ev.method || \'POST\').toUpperCase(),',
    '          headers,',
    '          body: ev.body ?? undefined,',
    '        });',
    '        console.log(`${ev.method || \'POST\'} -> ${hit.status} in ${Date.now() - t0}ms`);',
    '      } catch (err) {',
    '        console.error(`forward failed: ${err.message}`);',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    'listen().catch((err) => {',
    '  console.error(err.message);',
    '  process.exit(1);',
    '});',
  ].join('\n');
}

export function renderForwarder(lang) {
  const which = lang || S.prefs.fwdLang || 'node';
  setPref('fwdLang', which);
  const field = el('swh-fwd-target');
  const target = String((field && field.value) || S.prefs.fwdTarget || 'http://localhost:3000/api/webhooks').trim();
  if (field && field.value) setPref('fwdTarget', target);
  const node = el('swh-fwd-code');
  if (node) node.textContent = fwdScript(which, target);
  $$('#swh-fwd-langs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.lang === which ? 'true' : 'false'));
}

/* ── Mock event library (shared with the composer templates) ─────────────── */
function uuid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
const rid = (n) => Math.random().toString(36).slice(2, 2 + (n || 10));
const nowSec = () => Math.floor(Date.now() / 1000);

export function expand(text) {
  return String(text == null ? '' : text).replace(/\{\{(uuid|now|iso|rand)\}\}/g, (m, k) => {
    if (k === 'uuid') return uuid();
    if (k === 'now') return String(nowSec());
    if (k === 'iso') return new Date().toISOString();
    return rid(8);
  });
}

export const LIB = [
  {
    id: 'stripe-pay', group: 'Stripe', label: 'payment_intent.succeeded', provider: 'stripe',
    note: 'A completed card charge, the payload most integrations start with.',
    body: {
      id: 'evt_{{rand}}', object: 'event', api_version: '2024-06-20', created: '{{now}}',
      type: 'payment_intent.succeeded', livemode: false,
      data: { object: { id: 'pi_{{rand}}', object: 'payment_intent', amount: 4200, amount_received: 4200, currency: 'usd', status: 'succeeded', customer: 'cus_{{rand}}', description: 'Pro plan — monthly', receipt_email: 'buyer@example.com' } },
    },
  },
  {
    id: 'stripe-fail', group: 'Stripe', label: 'payment_intent.payment_failed', provider: 'stripe',
    note: 'Declined card — exercises your failure branch and alerting.',
    body: {
      id: 'evt_{{rand}}', object: 'event', created: '{{now}}', type: 'payment_intent.payment_failed', livemode: false,
      data: { object: { id: 'pi_{{rand}}', object: 'payment_intent', amount: 9900, currency: 'usd', status: 'requires_payment_method', last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' } } },
    },
  },
  {
    id: 'stripe-sub', group: 'Stripe', label: 'customer.subscription.deleted', provider: 'stripe',
    note: 'Cancellation event for churn and downgrade handling.',
    body: {
      id: 'evt_{{rand}}', object: 'event', created: '{{now}}', type: 'customer.subscription.deleted', livemode: false,
      data: { object: { id: 'sub_{{rand}}', object: 'subscription', customer: 'cus_{{rand}}', status: 'canceled', cancel_at_period_end: false, canceled_at: '{{now}}', items: { data: [{ price: { id: 'price_{{rand}}', unit_amount: 2900, currency: 'usd', recurring: { interval: 'month' } } } ] } } },
    },
  },
  {
    id: 'github-push', group: 'GitHub', label: 'push', provider: 'github',
    note: 'Two commits pushed to main, with the sender block CI usually reads.',
    headers: { 'x-github-event': 'push', 'x-github-delivery': '{{uuid}}', 'user-agent': 'GitHub-Hookshot/a1b2c3d' },
    body: {
      ref: 'refs/heads/main', before: '{{rand}}', after: '{{rand}}', created: false, deleted: false, forced: false,
      repository: { id: 812345, name: 'checkout-service', full_name: 'acme/checkout-service', private: true, default_branch: 'main' },
      pusher: { name: 'dana-dev', email: 'dana@example.com' },
      sender: { login: 'dana-dev', id: 4471, type: 'User' },
      commits: [
        { id: '{{rand}}', message: 'fix: verify raw body before JSON.parse', author: { name: 'Dana', email: 'dana@example.com' }, added: [], removed: [], modified: ['src/webhooks.ts'] },
        { id: '{{rand}}', message: 'test: cover replay attack window', author: { name: 'Dana', email: 'dana@example.com' }, added: ['test/replay.test.ts'], removed: [], modified: [] },
      ],
    },
  },
  {
    id: 'github-pr', group: 'GitHub', label: 'pull_request.opened', provider: 'github',
    note: 'PR opened — the classic trigger for review bots.',
    headers: { 'x-github-event': 'pull_request', 'x-github-delivery': '{{uuid}}', 'user-agent': 'GitHub-Hookshot/a1b2c3d' },
    body: {
      action: 'opened', number: 214,
      pull_request: { id: 99123, number: 214, state: 'open', title: 'Harden webhook signature checks', user: { login: 'dana-dev' }, head: { ref: 'harden-hmac', sha: '{{rand}}' }, base: { ref: 'main' }, additions: 148, deletions: 22, changed_files: 6, draft: false },
      repository: { full_name: 'acme/checkout-service', private: true },
      sender: { login: 'dana-dev', id: 4471 },
    },
  },
  {
    id: 'shopify-order', group: 'Shopify', label: 'orders/paid', provider: 'shopify',
    note: 'Paid order with line items and customer block.',
    headers: { 'x-shopify-topic': 'orders/paid', 'x-shopify-shop-domain': 'demo-store.myshopify.com', 'x-shopify-api-version': '2024-07', 'x-shopify-webhook-id': '{{uuid}}' },
    body: {
      id: 5123456789, admin_graphql_api_id: 'gid://shopify/Order/5123456789', name: '#1042',
      email: 'buyer@example.com', currency: 'USD', total_price: '129.90', financial_status: 'paid',
      created_at: '{{iso}}', test: true,
      customer: { id: 7712345, email: 'buyer@example.com', first_name: 'Ari', last_name: 'Rivera' },
      line_items: [
        { id: 1, title: 'Mechanical keyboard', quantity: 1, price: '99.00', sku: 'KB-87' },
        { id: 2, title: 'Keycap set', quantity: 1, price: '30.90', sku: 'KC-01' },
      ],
    },
  },
  {
    id: 'slack-cmd', group: 'Slack', label: 'Slash command', provider: 'slack',
    note: 'Form-encoded slash command — not JSON, which trips a lot of parsers.',
    ct: 'application/x-www-form-urlencoded',
    raw: 'token=gIkuvaNzQIHg97ATvDxqgjtO&team_id=T0001&team_domain=acme&channel_id=C2147483705&channel_name=deploys&user_id=U2147483697&user_name=dana&command=%2Fdeploy&text=staging+checkout-service&api_app_id=A123&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2F1234%2F5678&trigger_id=13345224609.738474920.8088930838d88f008e0',
  },
  {
    id: 'svix-user', group: 'Clerk / Svix', label: 'user.created', provider: 'svix',
    note: 'Svix-shaped delivery, base64 signature over id.timestamp.body.',
    body: {
      type: 'user.created', object: 'event', timestamp: '{{now}}',
      data: { id: 'user_{{rand}}', object: 'user', first_name: 'Ari', last_name: 'Rivera', email_addresses: [{ id: 'idn_{{rand}}', email_address: 'ari@example.com', verification: { status: 'verified', strategy: 'email_code' } }], created_at: '{{now}}', last_sign_in_at: null },
    },
  },
  {
    id: 'razorpay-paid', group: 'Razorpay', label: 'payment.captured', provider: 'razorpay',
    note: 'Hex HMAC over the raw body, no timestamp component.',
    headers: { 'x-razorpay-event-id': '{{rand}}' },
    body: {
      entity: 'event', account_id: 'acc_{{rand}}', event: 'payment.captured', created_at: '{{now}}',
      contains: ['payment'],
      payload: { payment: { entity: { id: 'pay_{{rand}}', entity: 'payment', amount: 250000, currency: 'INR', status: 'captured', method: 'upi', email: 'buyer@example.com', contact: '+919900000000', captured: true } } },
    },
  },
  {
    id: 'twilio-sms', group: 'Twilio', label: 'Inbound SMS', provider: '',
    note: 'Form-encoded inbound message with the usual Twilio field names.',
    ct: 'application/x-www-form-urlencoded',
    headers: { 'x-twilio-signature': 'p8xL0oR0dEmO0nLyNoTvAlId=' },
    raw: 'MessageSid=SM{{rand}}&AccountSid=AC{{rand}}&From=%2B14155550100&To=%2B14155550199&Body=Ship+it+%F0%9F%9A%80&NumMedia=0&SmsStatus=received&FromCity=SAN+FRANCISCO&FromCountry=US',
  },
  {
    id: 'sendgrid-open', group: 'SendGrid', label: 'Event batch (array)', provider: '',
    note: 'A JSON array at the top level — good for testing non-object payloads.',
    body: [
      { email: 'buyer@example.com', event: 'delivered', timestamp: '{{now}}', 'smtp-id': '<{{rand}}@sendgrid.net>', sg_event_id: '{{rand}}', sg_message_id: '{{rand}}' },
      { email: 'buyer@example.com', event: 'open', timestamp: '{{now}}', useragent: 'Mozilla/5.0', ip: '203.0.113.7', sg_event_id: '{{rand}}' },
    ],
  },
  {
    id: 'plain-json', group: 'Generic', label: 'Minimal JSON event', provider: 'hex',
    note: 'Small, signed with a generic x-signature header.',
    body: { event: 'order.created', id: 'ord_{{rand}}', amount: 4200, currency: 'usd', at: '{{iso}}' },
  },
];

export function mockBody(entry) {
  if (!entry) return '';
  if (entry.raw) return expand(entry.raw);
  return expand(JSON.stringify(entry.body, null, 2));
}

export function renderMockGrid() {
  const host = el('swh-mock-grid');
  if (!host) return;
  const secret = el('swh-mock-secret');
  if (secret && !secret.value && S.prefs.mockSecret) secret.value = S.prefs.mockSecret;
  host.innerHTML = LIB.map((m) => {
    const sc = m.provider && SCHEMES[m.provider];
    return `<button type="button" class="swh-tile" data-mock="${esc(m.id)}">` +
      `<span class="swh-tile-g">${esc(m.group)}</span>` +
      `<span class="swh-tile-t mono">${esc(m.label)}</span>` +
      `<span class="swh-tile-n">${esc(m.note || '')}</span>` +
      `<span class="swh-tile-f">${sc ? esc('signs ' + sc.hdr) : 'no signature'}</span></button>`;
  }).join('');
}

export async function sendMock(id) {
  const m = LIB.find((x) => x.id === id) || LIB[0];
  const body = mockBody(m);
  const secretField = el('swh-mock-secret');
  const secret = String((secretField && secretField.value) || S.prefs.mockSecret || '').trim();
  if (secretField) setPref('mockSecret', secret);
  const headers = Object.assign(
    { 'content-type': m.ct || 'application/json' },
    Object.fromEntries(Object.entries(m.headers || {}).map(([k, v]) => [k, expand(v)])),
  );
  if (m.provider && secret) {
    try { Object.assign(headers, await signHeaders(m.provider, secret, body)); }
    catch { heads('Could not sign', 'The mock was sent unsigned — check the secret format.'); }
  }
  try {
    const r = await fetch(hookUrl(), { method: 'POST', headers, body });
    if (r.status === 429) { heads('Rate limited', 'The edge caps inbound requests per minute. Wait a moment.'); return; }
    if (!r.ok && r.status >= 500) heads(`Endpoint answered ${r.status}`, 'The capture still landed — check the response builder.');
    else ok('Mock delivered', `${m.group} · ${m.label}${m.provider && secret ? ' (signed)' : ''}`);
    setPref('copied', true);
    setTimeout(() => { if (!S.events.length) syncHistory(false); }, 900);
  } catch (e) {
    oops('Could not send the mock', e && e.message ? e.message : 'Network error');
  }
}

/* ── Request composer ───────────────────────────────────────────────────── */
export function openCompose() {
  const sel = el('swh-c-preset');
  if (sel && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">Load a template…</option>' +
      LIB.map((m) => `<option value="${esc(m.id)}">${esc(m.group)} · ${esc(m.label)}</option>`).join('');
  }
  const host = el('swh-c-headers');
  if (host && !host.children.length) addRow('swh-c-headers', 'content-type', 'application/json');
  const body = el('swh-c-body');
  if (body && !body.value.trim()) {
    body.value = JSON.stringify({ event: 'order.created', id: 'ord_{{rand}}', amount: 4200, at: '{{iso}}' }, null, 2);
  }
  syncComposeTarget();
  out('swh-c-out', 'Nothing sent yet.', 'idle');
  const status = el('swh-c-status');
  if (status) status.textContent = '';
  open('compose');
}

export function syncComposeTarget() {
  const custom = String((el('swh-c-target') || {}).value || 'self') === 'custom';
  const wrap = el('swh-c-url-wrap');
  if (wrap) wrap.classList.toggle('hidden', !custom);
}

export function loadComposeTemplate(id) {
  const m = LIB.find((x) => x.id === id);
  if (!m) return;
  const body = el('swh-c-body');
  if (body) body.value = m.raw ? m.raw : JSON.stringify(m.body, null, 2);
  fillRows('swh-c-headers', Object.assign({ 'content-type': m.ct || 'application/json' }, m.headers || {}));
  const sign = el('swh-c-sign');
  if (sign) {
    const supported = Array.from(sign.options).some((o) => o.value === m.provider);
    sign.value = supported ? m.provider : '';
  }
  const fmt = el('swh-c-fmt');
  if (fmt) fmt.disabled = !!m.raw;
  note('Template loaded', `${m.group} · ${m.label}`);
}

export function formatComposeBody() {
  const ta = el('swh-c-body');
  if (!ta) return;
  const p = pretty(ta.value);
  if (!p) { oops('Not JSON', 'Only a valid JSON body can be reformatted.'); return; }
  ta.value = p;
}

export async function sendComposed() {
  const btn = el('swh-c-send');
  const status = el('swh-c-status');
  const method = String((el('swh-c-method') || {}).value || 'POST').toUpperCase();
  const custom = String((el('swh-c-target') || {}).value || 'self') === 'custom';
  const qs = String((el('swh-c-qs') || {}).value || '').trim().replace(/^[?&]+/, '');
  const rawBody = String((el('swh-c-body') || {}).value || '');
  const provider = String((el('swh-c-sign') || {}).value || '');
  const secret = String((el('swh-c-secret') || {}).value || '').trim();
  const count = Math.min(20, Math.max(1, Number((el('swh-c-count') || {}).value || 1)));
  const gap = Math.min(5000, Math.max(0, Number((el('swh-c-gap') || {}).value || 0)));
  const baseHeaders = readRows('swh-c-headers');

  let base = hookUrl();
  if (custom) {
    const u = urlish((el('swh-c-url') || {}).value);
    if (!u) { oops('Bad destination', 'Enter an http:// or https:// URL, or switch the target back to your endpoint.'); return; }
    base = u;
  }
  const url = qs ? base + (base.indexOf('?') > -1 ? '&' : '?') + qs : base;
  if (provider && !secret) { heads('No secret', 'Signing is selected but the secret is empty — sending unsigned.'); }

  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  const lines = [];
  let good = 0;
  for (let i = 0; i < count; i++) {
    const body = expand(rawBody);
    const headers = Object.assign({}, baseHeaders);
    if (provider && secret) {
      try { Object.assign(headers, await signHeaders(provider, secret, body)); }
      catch (e) { lines.push(`#${i + 1} signing failed: ${e && e.message ? e.message : 'unknown'}`); }
    }
    const label = `#${i + 1}/${count}`;
    if (status) status.textContent = `Sending ${label}…`;
    if (custom) {
      const res = await sendReplay({ target_url: url, method, headers, body: method === 'GET' ? '' : body, retry_count: 0 });
      if (res.good) good += 1;
      lines.push(`${label} ${String(res.text || '').split('\n')[0]}`);
    } else {
      const t0 = performance.now();
      try {
        const r = await fetch(url, { method, headers, body: method === 'GET' ? undefined : body });
        const text = await r.text();
        const ms = Math.round(performance.now() - t0);
        if (r.ok) good += 1;
        lines.push(`${label} HTTP ${r.status} ${r.statusText || ''} · ${ms} ms · ${bytes(sizeOf(text))}` +
          (i === count - 1 && text ? '\n' + text.slice(0, 400) : ''));
      } catch (e) {
        lines.push(`${label} failed: ${e && e.message ? e.message : 'network error'}`);
      }
    }
    out('swh-c-out', lines.join('\n'), 'wait');
    if (i < count - 1 && gap) await new Promise((r) => setTimeout(r, gap));
  }
  if (btn) { btn.disabled = false; delete btn.dataset.busy; }
  const allGood = good === count;
  out('swh-c-out', lines.join('\n'), allGood ? 'ok' : 'bad');
  if (status) status.textContent = `${good}/${count} accepted`;
  if (allGood) {
    setPref('copied', true);
    ok(count === 1 ? 'Request sent' : `${count} requests sent`, custom ? url : 'Watch the list on the left.');
  } else oops('Some requests failed', `${count - good} of ${count} did not succeed.`);
}

/* ── Signature verification (all in-browser) ────────────────────────────── */
const secretKey = (p) => `${S.ep}|${p || 'auto'}`;

export function resetVerify() {
  const tag = el('swh-sig-result');
  if (tag) { tag.textContent = 'Not checked yet'; tag.className = 'swh-tag swh-tag--mute'; }
  const detail = el('swh-sig-detail');
  if (detail) detail.classList.add('hidden');
}

export function loadSecret() {
  const field = el('swh-sig-secret');
  if (!field) return;
  const p = String((el('swh-sig-provider') || {}).value || 'auto');
  const stored = S.secrets[secretKey(p)] || S.secrets[secretKey('auto')] || '';
  if (stored && !field.value) {
    field.value = stored;
    const r = el('swh-sig-remember');
    if (r) r.checked = true;
  }
}

export function toggleSecretEye() {
  const field = el('swh-sig-secret');
  const btn = el('swh-sig-eye');
  if (!field || !btn) return;
  const show = field.type === 'password';
  field.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  btn.setAttribute('aria-label', show ? 'Hide secret' : 'Reveal secret');
}

export async function runVerify(auto) {
  const ev = V.current();
  const tag = el('swh-sig-result');
  const detail = el('swh-sig-detail');
  if (!ev) { if (!auto) heads('Nothing selected', 'Choose a captured request first.'); return; }
  const provider = String((el('swh-sig-provider') || {}).value || 'auto');
  const field = el('swh-sig-secret');
  const secret = String((field && field.value) || '').trim();
  const remember = !!(el('swh-sig-remember') || {}).checked;
  if (remember && secret) { S.secrets[secretKey(provider)] = secret; saveSecrets(); }
  else if (!remember && S.secrets[secretKey(provider)]) { delete S.secrets[secretKey(provider)]; saveSecrets(); }

  const res = await verify(provider, V.headersOf(ev), ev.body, secret);
  if (tag) {
    tag.textContent = res.state === 'ok' ? 'Signature valid' : res.state === 'bad' ? 'Signature mismatch' : (res.msg || 'Cannot verify');
    tag.className = 'swh-tag ' + (res.state === 'ok' ? 'swh-tag--ok' : res.state === 'bad' ? 'swh-tag--err' : 'swh-tag--mute');
  }
  if (detail) detail.classList.toggle('hidden', res.state === 'na');
  if (res.state !== 'na') {
    const put = (id, v) => { const n = el(id); if (n) n.textContent = String(v == null ? '' : v); };
    const base = String(res.base || '');
    put('swh-sig-base', base.length > 2000 ? base.slice(0, 2000) + `\n… ${bytes(sizeOf(base))} total` : base);
    put('swh-sig-got', res.got);
    put('swh-sig-exp', res.exp);
    const age = Number(res.ageMs) || 0;
    put('swh-sig-age', age
      ? `Timestamp is ${dur(Math.abs(age))} ${age > 0 ? 'old' : 'in the future'} — most providers reject anything beyond 5 minutes to stop replay attacks.`
      : 'This scheme signs the body only, so there is no timestamp window to check.');
  }
  if (!auto) {
    if (res.state === 'ok') ok('Signature valid', res.msg);
    else if (res.state === 'bad') oops('Signature mismatch', 'The body may have been altered, or the secret is wrong.');
    else note('Cannot verify yet', res.msg);
  }
  return res;
}

export function setAutoVerify(on) {
  setPref('autoVerify', !!on);
  if (on) runVerify(true);
}

/* ── Selection helper used everywhere (keeps the security pane honest) ───── */
export function pick(id, keepPane) {
  V.select(id, keepPane);
  resetVerify();
  loadSecret();
  markSeen();
  if (S.prefs.autoVerify) runVerify(true);
}

/* ── Keyboard shortcut reference ────────────────────────────────────────── */
const KEYS = [
  ['Navigate & find', [
    ['/', 'Focus the search box'],
    ['⌘K / Ctrl K', 'Open the command palette'],
    ['j / k', 'Next / previous request'],
    ['↑ / ↓', 'Move through the list when it has focus'],
    ['g', 'Jump to the newest request'],
    ['?', 'Show this list'],
    ['Esc', 'Close the top layer, or clear the search'],
  ]],
  ['Work with the selected request', [
    ['1 – 7', 'Switch inspector tabs'],
    ['y', 'Copy the body'],
    ['c', 'Copy as cURL'],
    ['l', 'Copy a deep link to this request'],
    ['r', 'Replay it'],
    ['v', 'Verify the signature'],
    ['p', 'Pin or unpin'],
    ['d', 'Set the diff baseline, then compare against it'],
    ['Backspace', 'Delete it from this browser'],
  ]],
  ['Endpoint & stream', [
    ['Space', 'Pause or resume the live stream'],
    ['u', 'Copy the capture URL'],
    ['m', 'Open the mock event library'],
    ['e', 'Export what is on screen'],
    ['n', 'New endpoint'],
    ['x', 'Toggle multi-select mode'],
    ['t', 'Cycle the colour theme'],
  ]],
];

export function renderKeys() {
  const host = el('swh-keys-out');
  if (!host) return;
  host.innerHTML = KEYS.map(([title, rows]) =>
    `<div class="swh-card"><div class="swh-card-h">${esc(title)}</div><div class="swh-card-b swh-fc">` +
    rows.map(([k, v]) => `<div class="swh-keyrow"><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('') +
    '</div></div>').join('');
}

/* ── Tool dispatch (menu items, palette and shortcuts share this) ───────── */
export function openTool(name) {
  closeMenus();
  if (name === 'respond') { open('respond'); loadConfig(false); return; }
  if (name === 'workflow') { open('workflow'); loadWorkflow(false); return; }
  if (name === 'compose') { openCompose(); return; }
  if (name === 'mock') { renderMockGrid(); open('mock'); return; }
  if (name === 'stats') { open('stats'); loadStats(); return; }
  if (name === 'monitor') {
    const f = el('swh-mon-url');
    if (f && !f.value) f.value = S.prefs.fwdTarget && /^https:/.test(S.prefs.fwdTarget) ? S.prefs.fwdTarget : '';
    open('monitor');
    return;
  }
  if (name === 'forward') { renderForwarder(); open('forward'); return; }
  if (name === 'code') { renderSnippet(); open('code'); return; }
  if (name === 'endpoints') { renderEpList(); open('endpoints'); return; }
  if (name === 'import') { open('import'); return; }
  if (name === 'keys') { renderKeys(); open('keys'); return; }
  if (name === 'replay') { openReplay(); return; }
  open(name);
}

/* ── Command palette ────────────────────────────────────────────────────── */
let palRows = [];
let palIdx = 0;

function commands() {
  const ev = V.current();
  const fire = (name) => document.dispatchEvent(new CustomEvent(name));
  const list = [
    { k: 'Copy capture URL', s: 'url clipboard endpoint', i: 'link', run: () => copyKind('url') },
    { k: 'Copy the endpoint ID', s: 'id name slug', i: 'hash', run: () => copyKind('id') },
    { k: 'Copy inbound email address', s: 'mail smtp', i: 'mail', run: () => copyKind('email') },
    { k: 'Copy a ready-to-run cURL', s: 'curl terminal', i: 'terminal', run: () => copyKind('curl') },
    { k: 'Send a test event', s: 'mock sample stripe payload', i: 'sparkle', run: () => sendMock('stripe-pay') },
    { k: 'Mock event library', s: 'stripe github shopify slack svix', i: 'sparkle', run: () => openTool('mock') },
    { k: 'Request composer', s: 'build send sign hmac burst', i: 'beaker', run: () => openTool('compose') },
    { k: 'Response builder', s: 'status code latency delay body', i: 'zap', run: () => openTool('respond') },
    { k: 'Forwarding & alerts', s: 'workflow automation slack discord', i: 'workflow', run: () => openTool('workflow') },
    { k: 'Forward to localhost', s: 'tunnel ngrok script node bash python', i: 'terminal', run: () => openTool('forward') },
    { k: 'Endpoint analytics', s: 'stats counts providers', i: 'activity', run: () => openTool('stats') },
    { k: 'Uptime & TLS check', s: 'monitor ping ssl certificate', i: 'globe', run: () => openTool('monitor') },
    { k: 'Integration snippets', s: 'code language curl node python go php', i: 'code', run: () => openTool('code') },
    { k: 'Switch or create an endpoint', s: 'endpoints new id', i: 'server', run: () => openTool('endpoints') },
    { k: 'Import a session', s: 'file json ndjson har upload', i: 'upload', run: () => openTool('import') },
    { k: 'Keyboard shortcuts', s: 'keys help', i: 'keyboard', run: () => openTool('keys') },
    { k: S.paused ? 'Resume the live stream' : 'Pause the live stream', s: 'hold buffer sse', i: S.paused ? 'play' : 'pause', run: () => togglePause() },
    { k: 'Export what is on screen (JSON)', s: 'download save', i: 'download', run: () => exportAs('json') },
    { k: 'Export as NDJSON', s: 'download stream lines jsonl', i: 'download', run: () => exportAs('ndjson') },
    { k: 'Export as CSV', s: 'download spreadsheet excel sheets', i: 'download', run: () => exportAs('csv') },
    { k: 'Export as Markdown', s: 'download report notes docs', i: 'file', run: () => exportAs('md') },
    { k: 'Export as HAR', s: 'download charles devtools', i: 'download', run: () => exportAs('har') },
    { k: 'Export as a replay script', s: 'curl bash download', i: 'download', run: () => exportAs('curl') },
    { k: 'Export the edge copy of this endpoint', s: 'server download all', i: 'download', run: () => exportAs('edge-json') },
    { k: S.selMode ? 'Leave multi-select mode' : 'Enter multi-select mode', s: 'bulk check', i: 'check', run: () => toggleSelectMode() },
    { k: 'Cycle the colour theme', s: 'dark light obsidian midnight bright appearance', i: 'moon', run: () => fire('swh:theme') },
    { k: S.prefs.density === 'compact' ? 'Use roomier rows' : 'Use compact rows', s: 'density spacing rows comfortable', i: 'rows', run: () => fire('swh:density') },
    { k: 'Refresh from the edge', s: 'sync history reload', i: 'refresh', run: () => syncHistory(true) },
    { k: 'Clear every request on this endpoint', s: 'delete wipe reset', i: 'trash', run: () => clearAll() },
    { k: 'New random endpoint', s: 'create fresh', i: 'plus', run: () => spawnEndpoint() },
  ];
  if (ev) {
    list.unshift(
      { k: 'Replay the selected request', s: 'send target retry', i: 'replay', run: () => openReplay() },
      { k: 'Verify the selected signature', s: 'hmac security secret', i: 'shield', run: () => { V.setTab('security'); runVerify(false); } },
      { k: 'Copy the selected body', s: 'json clipboard', i: 'copy', run: () => icopy('body') },
      { k: 'Copy a deep link to the selected request', s: 'share url permalink anchor', i: 'link', run: () => icopy('link') },
      { k: S.pins[ev.id] ? 'Unpin the selected request' : 'Pin the selected request', s: 'flag keep', i: 'pin', run: () => V.togglePin(ev.id) },
    );
  }
  return list;
}

function palRow(r, i) {
  const on = i === palIdx;
  return `<button type="button" class="swh-pal-row" role="option" data-pi="${i}" aria-selected="${on}"${on ? ' data-on="1"' : ''}>` +
    ic(r.i || 'zap', 14) +
    `<span class="swh-grow trunc">${esc(r.k)}</span>` +
    (r.tag ? `<span class="swh-tag swh-tag--mute">${esc(r.tag)}</span>` : '') +
    '</button>';
}

export function palPaint(q) {
  const host = el('swh-pal-list');
  if (!host) return;
  const term = String(q || '').trim().toLowerCase();
  const cmds = commands().filter((c) => !term || (c.k + ' ' + (c.s || '')).toLowerCase().indexOf(term) > -1)
    .map((c) => ({ k: c.k, s: c.s, i: c.i, run: c.run }));
  let rows = cmds.slice(0, 12);
  if (term) {
    const hits = S.events.filter((e) => {
      const hay = `${e.method} ${V.nameOf(e)} ${V.pathOf(e)} ${e.id} ${e.body || ''}`.toLowerCase();
      return hay.indexOf(term) > -1;
    }).slice(0, 8).map((e) => ({
      k: `${String(e.method || '').toUpperCase()} ${V.nameOf(e)}`,
      tag: ago(e.timestamp),
      i: 'inbox',
      run: () => { pick(e.id); V.setTab('body'); },
    }));
    rows = rows.slice(0, 8).concat(hits);
  }
  palRows = rows;
  if (palIdx >= rows.length) palIdx = 0;
  host.innerHTML = rows.length
    ? rows.map(palRow).join('')
    : '<p class="swh-none">Nothing matches that.</p>';
  const on = host.querySelector('[data-on="1"]');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}

export function openPal() {
  const pal = el('swh-pal');
  if (!pal) return;
  closeMenus();
  palIdx = 0;
  const q = el('swh-pal-q');
  if (q) q.value = '';
  palPaint('');
  pal.classList.remove('hidden');
  if (q) setTimeout(() => { try { q.focus(); } catch { /* ignore */ } }, 30);
}

export function closePal() {
  const pal = el('swh-pal');
  if (pal) pal.classList.add('hidden');
}

export function palMove(step) {
  if (!palRows.length) return;
  palIdx = (palIdx + step + palRows.length) % palRows.length;
  palPaint((el('swh-pal-q') || {}).value || '');
}

export function palRun(i) {
  const row = palRows[i == null ? palIdx : i];
  if (!row) return;
  closePal();
  try { row.run(); } catch (e) { oops('That command failed', e && e.message ? e.message : 'Unknown error'); }
}

