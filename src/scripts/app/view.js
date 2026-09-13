/* ═════════════════════════════════════════════════════════════════════════
   view.js — every render path: request rows, inspector panes, JSON tree,
   headers/query tables, telemetry, raw view and the baseline diff.
   ═════════════════════════════════════════════════════════════════════════ */
import {
  S, el, $, $$, esc, ago, clock, stamp, dayKey, bytes, sizeOf, pretty,
  savePins, savePrefs, storeBytes, hookUrl,
} from './core.js';
import { ic } from './icons.js';
import { detect, SCHEMES, recipe } from './sign.js';

/* ── Event accessors (memoised on non-enumerable fields) ────────────────── */
function memo(ev, key, make) {
  if (Object.prototype.hasOwnProperty.call(ev, key)) return ev[key];
  const v = make();
  try { Object.defineProperty(ev, key, { value: v, enumerable: false, configurable: true, writable: true }); }
  catch { ev[key] = v; }
  return v;
}

export function parsed(ev) {
  return memo(ev, '__p', () => { try { return JSON.parse(ev.body); } catch { return null; } });
}
export function headersOf(ev) {
  const h = ev && ev.headers;
  if (!h) return {};
  if (typeof h === 'string') { try { return JSON.parse(h) || {}; } catch { return {}; } }
  return h;
}
export function queryOf(ev) {
  const q = ev && ev.query_params;
  if (!q) return {};
  if (typeof q === 'string') { try { return JSON.parse(q) || {}; } catch { return {}; } }
  return q;
}
export function sigOf(ev) {
  if (ev.signature_provider) return String(ev.signature_provider);
  const d = detect(headersOf(ev));
  return d ? (SCHEMES[d.provider] ? SCHEMES[d.provider].label : d.provider) : '';
}
export function fmtOf(ev) {
  if (ev.format) return String(ev.format);
  const b = String(ev.body || '').trim();
  if (!b) return 'empty';
  if (parsed(ev) !== null) return 'json';
  if (b.startsWith('<')) return 'xml';
  if (/^[\w.[\]%+-]+=[^&]*(&|$)/.test(b)) return 'form';
  return 'text';
}

export function pathOf(ev) {
  if (ev.path) return String(ev.path);
  if (ev.url) { try { return new URL(ev.url).pathname; } catch { /* ignore */ } }
  return '/api/r/' + (ev.endpoint_id || S.ep);
}
export function nameOf(ev) {
  if (ev.is_email && ev.email) return ev.email.subject || 'Inbound email';
  const p = parsed(ev);
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const hit = p.type || p.event || p.event_type || p.eventType || p.action || p.topic || p.name || p.trigger;
    if (typeof hit === 'string' && hit.length < 72) return hit;
  }
  const h = headersOf(ev);
  const ghost = h['x-github-event'] || h['X-GitHub-Event'] || h['x-shopify-topic'] || h['x-event-name'];
  if (ghost) return String(ghost);
  const qs = queryOf(ev);
  const keys = Object.keys(qs);
  return pathOf(ev) + (keys.length ? '?' + keys.slice(0, 2).map((k) => `${k}=${qs[k]}`).join('&') : '');
}
export function preview(ev) {
  if (ev.is_email && ev.email) return `${ev.email.from || '—'} → ${ev.email.subject || '(no subject)'}`;
  const b = String(ev.body || '');
  if (!b) return '(no body)';
  return b.replace(/\s+/g, ' ').trim().slice(0, 120);
}
function hay(ev) {
  return memo(ev, '__h', () => [
    ev.method, pathOf(ev), ev.client_ip || '', ev.body || '',
    JSON.stringify(headersOf(ev)), JSON.stringify(queryOf(ev)), sigOf(ev),
  ].join('  ').toLowerCase());
}

/* ── Filtering & ordering ───────────────────────────────────────────────── */
export function filtered() {
  const q = S.q.trim().toLowerCase();
  const out = S.events.filter((e) => {
    if (S.method !== 'ALL' && String(e.method || '').toUpperCase() !== S.method) return false;
    if (S.pinOnly && !S.pins[e.id]) return false;
    if (S.sigOnly && !sigOf(e)) return false;
    return !q || hay(e).indexOf(q) > -1;
  });
  const t = (e) => new Date(e.timestamp).getTime() || 0;
  const cmp = S.prefs.sort === 'old'
    ? (a, b) => t(a) - t(b)
    : S.prefs.sort === 'big'
      ? (a, b) => (Number(b.size_bytes) || sizeOf(b.body)) - (Number(a.size_bytes) || sizeOf(a.body))
      : (a, b) => t(b) - t(a);
  return out.sort((a, b) => {
    const pa = S.pins[a.id] ? 1 : 0, pb = S.pins[b.id] ? 1 : 0;
    return pa !== pb ? pb - pa : cmp(a, b);
  });
}

/* ── Request list ───────────────────────────────────────────────────────── */
function rowHtml(ev) {
  const m = String(ev.method || 'POST').toUpperCase();
  const ts = ev.timestamp;
  const size = Number(ev.size_bytes) || sizeOf(ev.body);
  const sig = sigOf(ev);
  const pinned = !!S.pins[ev.id];
  return `<div class="swh-row" data-id="${esc(ev.id)}" role="option" tabindex="-1"` +
    ` aria-selected="${S.sel === ev.id ? 'true' : 'false'}"${ev.__fresh ? ' data-new="1"' : ''}>` +
    (S.selMode
      ? `<input class="swh-chk" type="checkbox" data-check="${esc(ev.id)}"${S.checked.has(ev.id) ? ' checked' : ''} aria-label="Select this request" />`
      : '') +
    '<div class="swh-row-body">' +
      `<div class="swh-row-top"><span class="swh-m swh-m--${esc(m)}">${esc(m)}</span>` +
      `<span class="swh-row-title">${esc(nameOf(ev))}</span></div>` +
      `<div class="swh-row-sub"><span>${esc(clock(ts))}</span><span>·</span><span>${esc(bytes(size))}</span>` +
      `<span>·</span><span>${esc(fmtOf(ev))}</span>` +
      (sig ? `<span>·</span><span title="Signature header present">${ic('shield', 10)}${esc(sig)}</span>` : '') +
    '</div></div>' +
    '<div class="swh-row-side">' +
      `<span class="swh-ago" data-ago="${esc(ts)}">${esc(ago(ts))}</span>` +
      `<button class="swh-pin" data-pin="${esc(ev.id)}" aria-pressed="${pinned}" title="${pinned ? 'Unpin' : 'Pin'} this request">${ic('star', 13)}</button>` +
    '</div></div>';
}

export function renderRows() {
  const host = el('swh-rows');
  const empty = el('swh-empty');
  if (!host) return;
  const list = filtered();
  const total = S.events.length;

  if (empty) empty.classList.toggle('hidden', total > 0);
  host.classList.toggle('hidden', total === 0);

  if (total && !list.length) {
    host.innerHTML = `<p class="swh-none">Nothing matches those filters.<br /><small>${total} request${total === 1 ? '' : 's'} captured in total.</small></p>`;
  } else {
    let out = '';
    let group = '';
    const grouped = S.prefs.sort !== 'big';
    list.forEach((ev) => {
      if (grouped) {
        const g = dayKey(ev.timestamp) + (S.pins[ev.id] ? ' · pinned' : '');
        if (g !== group) { group = g; out += `<p class="swh-group">${esc(group)}</p>`; }
      }
      out += rowHtml(ev);
    });
    host.innerHTML = out;
  }

  const count = el('swh-count');
  if (count) {
    count.textContent = !total ? 'No requests yet'
      : list.length === total ? `${total} request${total === 1 ? '' : 's'}`
        : `${list.length} of ${total}`;
  }
  renderSpark();
  updateStatus();
  paintSteps();
}

export function renderSpark() {
  const host = el('swh-spark');
  if (!host) return;
  const now = Date.now();
  const buckets = new Array(12).fill(0);
  S.events.forEach((e) => {
    const d = now - (new Date(e.timestamp).getTime() || 0);
    if (d < 0 || d > 120000) return;
    const i = 11 - Math.floor(d / 10000);
    if (i >= 0 && i < 12) buckets[i]++;
  });
  const max = Math.max(1, ...buckets);
  host.innerHTML = buckets.map((v) => {
    const h = v ? Math.max(3, Math.round((v / max) * 16)) : 2;
    return `<i style="height:${h}px"${v && v === max ? ' data-hot="1"' : ''}></i>`;
  }).join('');
}

export function ticks() {
  $$('#swh-rows [data-ago]').forEach((n) => { n.textContent = ago(n.dataset.ago); });
}

function paintSteps() {
  const s2 = el('swh-step-2');
  const s3 = el('swh-step-3');
  const s1 = el('swh-step-1');
  if (s1) s1.dataset.done = S.prefs.copied ? '1' : '0';
  if (s2) s2.dataset.done = S.events.length ? '1' : '0';
  if (s3) s3.dataset.done = S.sel ? '1' : '0';
}

export function updateStatus() {
  const set = (id, v) => { const n = el(id); if (n) n.textContent = v; };
  set('swh-st-ep', S.ep || '…');
  set('swh-st-total', String(S.events.length));
  set('swh-st-sse', S.conn);
  set('swh-st-store', bytes(storeBytes()));
  const last = S.events.length
    ? S.events.reduce((a, b) => ((new Date(a.timestamp) > new Date(b.timestamp)) ? a : b))
    : null;
  set('swh-st-last', last ? `${String(last.method || '').toUpperCase()} ${ago(last.timestamp)} ago` : 'no traffic yet');
  const rate = el('swh-rate');
  if (rate) {
    const cut = Date.now() - 60000;
    rate.textContent = S.events.filter((e) => (new Date(e.timestamp).getTime() || 0) > cut).length + '/min';
  }
}

/* ── Syntax highlighting ────────────────────────────────────────────────── */
/* Tokenise the raw source and escape each piece as it is emitted. Escaping
   first — as this used to — let the number rule match the `39` inside the
   `&#39;` that `esc` writes for an apostrophe and wrap it in a `<span>`, which
   breaks the character reference: every single-quoted snippet (the sample cURL
   on the zero state, any body holding an apostrophe) rendered a literal
   `&#39;` where the quote belonged. */
const TOK = /("(?:\\.|[^"\\\n])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
export function hl(src) {
  const s = String(src == null ? '' : src);
  let out = '';
  let at = 0;
  s.replace(TOK, (m, str, colon, bool, num, i) => {
    out += esc(s.slice(at, i));
    at = i + m.length;
    if (str) out += `<span class="${colon ? 'k' : 's'}">${esc(str)}</span>${colon || ''}`;
    else out += `<span class="${bool ? 'b' : 'n'}">${bool || num}</span>`;
    return m;
  });
  return out + esc(s.slice(at));
}
function numbered(src, colour) {
  const rows = String(src == null ? '' : src).split('\n');
  return rows.map((l) => `<span>${colour ? hl(l) : esc(l)}</span>`).join('');
}

/* ── Inspector shell ────────────────────────────────────────────────────── */
export const current = () => S.events.find((e) => e.id === S.sel) || null;

export function select(id, keepPane) {
  const ev = S.events.find((e) => e.id === id);
  if (!ev) return;
  S.sel = id;
  const zero = el('swh-zero');
  const detail = el('swh-detail');
  if (zero) zero.classList.add('hidden');
  if (detail) detail.classList.remove('hidden');
  const main = el('swh-main');
  if (main && !keepPane && window.innerWidth <= 780) main.dataset.view = 'insp';
  $$('#swh-rows .swh-row').forEach((r) => r.setAttribute('aria-selected', r.dataset.id === id ? 'true' : 'false'));
  const row = $(`#swh-rows .swh-row[data-id="${window.CSS && CSS.escape ? CSS.escape(id) : id}"]`);
  if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  renderInspector();
  paintSteps();
}

export function clearSelection() {
  S.sel = null;
  S.diffOn = false;
  const zero = el('swh-zero');
  const detail = el('swh-detail');
  if (zero) zero.classList.remove('hidden');
  if (detail) detail.classList.add('hidden');
  const main = el('swh-main');
  if (main) main.dataset.view = 'list';
  $$('#swh-rows .swh-row').forEach((r) => r.setAttribute('aria-selected', 'false'));
}

export function renderInspector() {
  const ev = current();
  if (!ev) return;
  const m = String(ev.method || 'POST').toUpperCase();
  const mn = el('swh-i-method');
  if (mn) { mn.textContent = m; mn.className = 'swh-m swh-m--' + m; }
  const tn = el('swh-i-title');
  if (tn) tn.textContent = nameOf(ev);
  const hs = headersOf(ev);
  const qs = queryOf(ev);
  const size = Number(ev.size_bytes) || sizeOf(ev.body);
  const meta = el('swh-i-meta');
  if (meta) {
    meta.innerHTML = [
      esc(clock(ev.timestamp)), esc(bytes(size)), esc(fmtOf(ev)),
      ev.client_ip ? esc(ev.client_ip) : '', esc(ev.id),
    ].filter(Boolean).map((s) => `<span>${s}</span>`).join('<span>·</span>');
  }
  const pin = el('swh-i-pin');
  if (pin) pin.setAttribute('aria-pressed', S.pins[ev.id] ? 'true' : 'false');
  const cmp = el('swh-compare');
  if (cmp) cmp.setAttribute('aria-pressed', S.baseline === ev.id ? 'true' : 'false');
  const dtab = el('swh-tab-diff');
  if (dtab) dtab.classList.toggle('hidden', !S.baseline);
  const hc = el('swh-h-count');
  if (hc) hc.textContent = String(Object.keys(hs).length);
  const qc = el('swh-q-count');
  if (qc) qc.textContent = String(Object.keys(qs).length);

  const sig = sigOf(ev);
  const dot = el('swh-sig-dot');
  if (dot) dot.className = 'swh-dot' + (sig ? ' swh-dot--live' : '');
  const det = el('swh-sig-detected');
  if (det) {
    det.textContent = sig ? `${sig} signature detected` : 'No signature header';
    det.className = 'swh-tag swh-mla ' + (sig ? 'swh-tag--ok' : 'swh-tag--mute');
  }
  const fmtTag = el('swh-fmt');
  if (fmtTag) fmtTag.textContent = fmtOf(ev);

  renderOverview(ev);
  renderBody(ev);
  renderHeaders();
  renderQuery(ev);
  renderTelemetry(ev);
  renderRaw(ev);
  renderRecipe();
  if (S.diffOn) renderDiff();
}

/* ── Overview ───────────────────────────────────────────────────────────── */
function stat(dt, dd, small) {
  return `<div class="swh-stat"><dt>${esc(dt)}</dt><dd>${esc(dd == null || dd === '' ? '—' : dd)}` +
    (small ? ` <small>${esc(small)}</small>` : '') + '</dd></div>';
}
export function flatten(val, prefix, out, depth) {
  const acc = out || [];
  if (depth > 6 || acc.length > 400) return acc;
  if (val && typeof val === 'object') {
    const keys = Array.isArray(val) ? val.map((_, i) => String(i)) : Object.keys(val);
    keys.forEach((k) => {
      const p = prefix ? `${prefix}${Array.isArray(val) ? `[${k}]` : `.${k}`}` : k;
      flatten(val[k], p, acc, (depth || 0) + 1);
    });
    if (!keys.length) acc.push([prefix || '(root)', Array.isArray(val) ? '[]' : '{}']);
  } else {
    acc.push([prefix || '(root)', val === undefined ? 'undefined' : String(val)]);
  }
  return acc;
}

function renderOverview(ev) {
  const host = el('swh-ov');
  if (!host) return;
  const hs = headersOf(ev);
  const size = Number(ev.size_bytes) || sizeOf(ev.body);
  const p = parsed(ev);
  const leaves = p ? flatten(p, '', [], 0).slice(0, 12) : [];
  const ua = hs['user-agent'] || hs['User-Agent'] || '';
  const grid = [
    stat('Method', String(ev.method || '—').toUpperCase()),
    stat('Received', clock(ev.timestamp), ago(ev.timestamp) + ' ago'),
    stat('Payload', bytes(size), fmtOf(ev)),
    stat('Signature', sigOf(ev) || 'none'),
    stat('Client IP', ev.client_ip || 'hidden'),
    stat('Headers', String(Object.keys(hs).length), 'sent'),
  ].join('');

  const rows = leaves.length
    ? `<table class="swh-kv"><tbody>${leaves.map(([k, v]) =>
      `<tr><td class="swh-copyable" data-cp="${esc(k)}">${esc(k)}</td>` +
      `<td class="swh-copyable" data-cp="${esc(v)}">${esc(v.length > 220 ? v.slice(0, 220) + '…' : v)}</td></tr>`).join('')}</tbody></table>`
    : `<p class="swh-none">${ev.body ? 'Body is not JSON — see the Body or Raw tab.' : 'This request had no body.'}</p>`;

  host.innerHTML =
    `<div class="swh-grid">${grid}</div>` +
    `<div class="swh-card"><div class="swh-card-h">${ic('hash', 14)}Payload highlights` +
      `<span class="swh-tag swh-tag--mute swh-mla">${leaves.length ? `first ${leaves.length} fields` : fmtOf(ev)}</span></div>` +
      `<div class="swh-card-b" style="padding:0">${rows}</div></div>` +
    `<div class="swh-card"><div class="swh-card-h">${ic('globe', 14)}Delivery</div><div class="swh-card-b" style="padding:0">` +
      `<table class="swh-kv"><tbody>` +
      `<tr><td>path</td><td class="swh-copyable" data-cp="${esc(pathOf(ev))}">${esc(pathOf(ev))}</td></tr>` +
      `<tr><td>endpoint</td><td class="swh-copyable" data-cp="${esc(hookUrl())}">${esc(hookUrl())}</td></tr>` +
      `<tr><td>event id</td><td class="swh-copyable" data-cp="${esc(ev.id)}">${esc(ev.id)}</td></tr>` +
      `<tr><td>timestamp</td><td>${esc(stamp(ev.timestamp))}</td></tr>` +
      (ua ? `<tr><td>user-agent</td><td class="swh-copyable" data-cp="${esc(ua)}">${esc(ua)}</td></tr>` : '') +
      `</tbody></table></div></div>`;
}

/* ── JSON tree ──────────────────────────────────────────────────────────── */
function mark(text, f) {
  const raw = String(text);
  if (!f) return esc(raw);
  const i = raw.toLowerCase().indexOf(f);
  if (i < 0) return esc(raw);
  return esc(raw.slice(0, i)) + '<mark class="swh-hit">' + esc(raw.slice(i, i + f.length)) +
    '</mark>' + esc(raw.slice(i + f.length));
}
function matches(key, val, f) {
  if (!f) return true;
  if (String(key == null ? '' : key).toLowerCase().indexOf(f) > -1) return true;
  if (val && typeof val === 'object') {
    const keys = Array.isArray(val) ? val.map((_, i) => String(i)) : Object.keys(val);
    return keys.some((k) => matches(k, val[k], f));
  }
  return String(val).toLowerCase().indexOf(f) > -1;
}
function node(key, val, depth, f) {
  const label = key === null ? '' :
    `<span class="swh-tk" data-cp="${esc(key)}">${mark(key, f)}</span><span class="p">:</span> `;
  if (!val || typeof val !== 'object') {
    const isStr = typeof val === 'string';
    const shown = val === null ? 'null' : isStr ? `"${val}"` : String(val);
    const cls = val === null || typeof val === 'boolean' ? 'b' : typeof val === 'number' ? 'n' : isStr ? 's' : 'u';
    return `<li>${label}<span class="swh-tv ${cls}" data-cp="${esc(val === null ? 'null' : String(val))}">${mark(shown, f)}</span></li>`;
  }
  const arr = Array.isArray(val);
  const keys = arr ? val.map((_, i) => String(i)) : Object.keys(val);
  const kids = keys.filter((k) => matches(k, val[k], f))
    .map((k) => node(k, arr ? val[Number(k)] : val[k], depth + 1, f)).join('');
  const open = f ? true : depth < 2;
  return `<li><button class="swh-tw" aria-expanded="${open}" tabindex="-1" aria-label="Toggle">${ic('chevronDown', 11)}</button>` +
    `${label}<span class="p">${arr ? '[' : '{'}</span>` +
    `<span class="swh-tc">${keys.length} ${arr ? 'item' : 'key'}${keys.length === 1 ? '' : 's'}</span>` +
    `<ul${open ? '' : ' hidden'}>${kids}</ul><span class="p">${arr ? ']' : '}'}</span></li>`;
}

export function setBodyView(v) {
  const view = ['tree', 'raw', 'table'].indexOf(v) > -1 ? v : 'tree';
  S.prefs.bview = view;
  savePrefs();
  const t = el('swh-tree'), p = el('swh-pretty'), b = el('swh-btable');
  if (t) t.classList.toggle('hidden', view !== 'tree');
  if (p) p.classList.toggle('hidden', view !== 'raw');
  if (b) b.classList.toggle('hidden', view !== 'table');
  $$('#swh [data-bview]').forEach((n) => n.setAttribute('aria-selected', n.dataset.bview === view ? 'true' : 'false'));
}

export function renderBody(ev) {
  const target = ev || current();
  if (!target) return;
  const qEl = el('swh-body-q');
  const f = ((qEl && qEl.value) || '').trim().toLowerCase();
  const p = parsed(target);

  const mail = el('swh-email');
  if (mail) {
    const on = !!(target.is_email && target.email);
    mail.classList.toggle('hidden', !on);
    if (on) {
      const e = target.email || {};
      const set = (id, v) => { const n = el(id); if (n) n.textContent = v || '—'; };
      set('swh-email-subject', e.subject || '(no subject)');
      set('swh-email-from', e.from);
      set('swh-email-to', e.to);
      set('swh-email-body', e.text || e.html || '(empty message)');
    }
  }

  const tree = el('swh-tree');
  if (tree) {
    tree.innerHTML = p === null
      ? `<p class="swh-none">${target.body ? 'This body is not JSON — try Pretty or the Raw tab.' : 'No body was sent with this request.'}</p>`
      : `<ul class="swh-troot">${node(null, p, 0, f)}</ul>`;
  }

  const pre = el('swh-pretty');
  if (pre) {
    const code = pre.querySelector('code') || pre;
    const src = pretty(target.body) || String(target.body || '');
    code.innerHTML = src ? hl(src) : '<span class="u">(empty body)</span>';
  }

  const table = el('swh-btable');
  if (table) {
    const leaves = p !== null ? flatten(p, '', [], 0) : [];
    const rows = leaves.filter(([k, v]) => !f || (k + ' ' + v).toLowerCase().indexOf(f) > -1);
    table.innerHTML = rows.length
      ? `<table class="swh-kv"><thead><tr><th>Path</th><th>Value</th></tr></thead><tbody>${rows.map(([k, v]) =>
        `<tr><td class="swh-copyable" data-cp="${esc(k)}">${mark(k, f)}</td>` +
        `<td class="swh-copyable" data-cp="${esc(v)}">${mark(v.length > 300 ? v.slice(0, 300) + '…' : v, f)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="swh-none">${leaves.length ? 'No field matches that filter.' : 'Only JSON bodies can be tabulated.'}</p>`;
  }
  setBodyView(S.prefs.bview);
}

/* ── Headers & query ────────────────────────────────────────────────────── */
export function renderHeaders() {
  const ev = current();
  const host = el('swh-h-rows');
  if (!ev || !host) return;
  const q = el('swh-h-q');
  const f = ((q && q.value) || '').trim().toLowerCase();
  const hs = headersOf(ev);
  const keys = Object.keys(hs).sort();
  const rows = keys.filter((k) => !f || (k + ' ' + hs[k]).toLowerCase().indexOf(f) > -1);
  host.innerHTML = rows.length
    ? rows.map((k) => `<tr><td class="swh-copyable" data-cp="${esc(k)}">${mark(k, f)}</td>` +
      `<td class="swh-copyable" data-cp="${esc(hs[k])}">${mark(String(hs[k]), f)}</td></tr>`).join('')
    : `<tr><td colspan="2"><p class="swh-none">${keys.length ? 'No header matches that filter.' : 'No headers were captured.'}</p></td></tr>`;
}

export function renderQuery(ev) {
  const target = ev || current();
  const host = el('swh-qs-rows');
  if (!target || !host) return;
  const qs = queryOf(target);
  const keys = Object.keys(qs);
  host.innerHTML = keys.length
    ? keys.map((k) => `<tr><td class="swh-copyable" data-cp="${esc(k)}">${esc(k)}</td>` +
      `<td class="swh-copyable" data-cp="${esc(qs[k])}">${esc(qs[k])}</td></tr>`).join('')
    : '<tr><td colspan="2"><p class="swh-none">This request carried no query string.<br /><small>Try appending <code>?status=422&amp;delay=500</code> to override the response.</small></p></td></tr>';
}

/* ── Raw ────────────────────────────────────────────────────────────────── */
export function renderRaw(ev) {
  const target = ev || current();
  const host = el('swh-raw');
  if (!target || !host) return;
  const hs = headersOf(target);
  const qs = queryOf(target);
  const q = Object.keys(qs).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(qs[k])}`).join('&');
  const head = [`${String(target.method || 'POST').toUpperCase()} ${pathOf(target)}${q ? '?' + q : ''} HTTP/1.1`]
    .concat(Object.keys(hs).sort().map((k) => `${k}: ${hs[k]}`))
    .join('\n');
  const raw = head + '\n\n' + String(target.body == null ? '' : target.body);
  host.innerHTML = numbered(raw, false);
  host.classList.toggle('swh-code--wrap', !!S.prefs.wrap);
  host.classList.toggle('swh-code--nowrap', !S.prefs.wrap);
  const size = el('swh-raw-size');
  if (size) size.textContent = `${bytes(sizeOf(raw))} · ${raw.split('\n').length} lines`;
  return raw;
}

export function rawText(ev) {
  const target = ev || current();
  if (!target) return '';
  const hs = headersOf(target);
  const head = [`${String(target.method || 'POST').toUpperCase()} ${pathOf(target)} HTTP/1.1`]
    .concat(Object.keys(hs).sort().map((k) => `${k}: ${hs[k]}`)).join('\n');
  return head + '\n\n' + String(target.body == null ? '' : target.body);
}

/* ── Telemetry ──────────────────────────────────────────────────────────── */
function senderTs(ev, h) {
  const sig = String(h['stripe-signature'] || '');
  const m = /(?:^|,)t=(\d+)/.exec(sig);
  if (m) return Number(m[1]) * 1000;
  const slack = h['x-slack-request-timestamp'];
  if (slack) return Number(slack) * 1000;
  const svix = h['svix-timestamp'] || h['webhook-timestamp'];
  if (svix) return Number(svix) * 1000;
  const p = parsed(ev);
  if (p && typeof p === 'object') {
    const c = p.created || p.timestamp || p.occurred_at || p.created_at;
    if (typeof c === 'number') return c > 1e12 ? c : c * 1000;
    if (typeof c === 'string') { const d = Date.parse(c); if (!isNaN(d)) return d; }
  }
  return 0;
}

export function renderTelemetry(ev) {
  const target = ev || current();
  const host = el('swh-tele');
  if (!target || !host) return;
  const h = {};
  const raw = headersOf(target);
  Object.keys(raw).forEach((k) => { h[k.toLowerCase()] = raw[k]; });
  const ray = String(h['cf-ray'] || '');
  const colo = ray.indexOf('-') > -1 ? ray.split('-')[1] : '';
  let scheme = '';
  try { scheme = JSON.parse(h['cf-visitor'] || '{}').scheme || ''; } catch { scheme = ''; }
  const declared = Number(h['content-length'] || 0);
  const actual = sizeOf(target.body);
  const sent = senderTs(target, h);
  const got = new Date(target.timestamp).getTime() || 0;
  const skew = sent && got ? got - sent : 0;

  const grid = [
    stat('Edge colo', colo || 'unknown', ray ? 'cf-ray' : ''),
    stat('Country', String(h['cf-ipcountry'] || '—')),
    stat('Scheme', scheme || (String(target.url || '').indexOf('https') === 0 ? 'https' : '—')),
    stat('Body bytes', String(actual), declared ? `declared ${declared}` : 'no content-length'),
    stat('Sender clock', sent ? clock(sent) : 'not signed', sent ? (skew >= 0 ? `+${Math.round(skew / 1000)}s to edge` : `${Math.round(skew / 1000)}s ahead`) : ''),
    stat('Held locally', `${S.events.length}/100`, 'this browser'),
  ].join('');

  const net = ['cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'cf-visitor', 'x-forwarded-for', 'x-real-ip',
    'user-agent', 'accept', 'accept-encoding', 'content-type', 'content-length', 'connection', 'host']
    .filter((k) => h[k])
    .map((k) => `<tr><td>${esc(k)}</td><td class="swh-copyable" data-cp="${esc(h[k])}">${esc(h[k])}</td></tr>`).join('');

  const notes = [];
  if (declared && Math.abs(declared - actual) > 2) notes.push(`content-length says ${declared} B but the stored body is ${actual} B — the sender may have chunked or re-encoded it.`);
  if (skew > 300000) notes.push(`This delivery arrived ${Math.round(skew / 60000)} min after the sender signed it — likely a retry.`);
  if (!h['content-type']) notes.push('No Content-Type header was sent, so the payload was treated as raw text.');
  if (!sigOf(target)) notes.push('No signature header — anyone could have posted this body. Verify signatures in production.');

  host.innerHTML = `<div class="swh-grid">${grid}</div>` +
    `<div class="swh-card"><div class="swh-card-h">${ic('cpu', 14)}Network &amp; edge headers</div>` +
    `<div class="swh-card-b" style="padding:0"><table class="swh-kv"><tbody>${net || '<tr><td colspan="2"><p class="swh-none">Nothing network-related was captured.</p></td></tr>'}</tbody></table></div></div>` +
    (notes.length
      ? `<div class="swh-card"><div class="swh-card-h">${ic('info', 14)}Observations</div><div class="swh-card-b swh-fc">` +
        notes.map((n) => `<p class="swh-hint">${esc(n)}</p>`).join('') + '</div></div>'
      : '');
}

/* ── Verification recipe ────────────────────────────────────────────────── */
export function renderRecipe() {
  const out = el('swh-recipe');
  if (!out) return;
  const sel = el('swh-sig-provider');
  let p = sel ? sel.value : 'auto';
  if (p === 'auto') {
    const ev = current();
    const d = ev ? detect(headersOf(ev)) : null;
    p = d ? d.provider : 'hex';
  }
  out.textContent = recipe(p, S.prefs.recipe);
  $$('#swh-recipe-lang [data-lang]').forEach((b) => b.setAttribute('aria-selected', b.dataset.lang === S.prefs.recipe ? 'true' : 'false'));
}

/* ── Diff against a baseline ────────────────────────────────────────────── */
function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(['same', a[i], b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['del', a[i], null]); i++; }
    else { out.push(['add', null, b[j]]); j++; }
  }
  while (i < n) out.push(['del', a[i++], null]);
  while (j < m) out.push(['add', null, b[j++]]);
  return out;
}

export function renderDiff() {
  const host = el('swh-diff');
  const cur = current();
  if (!host || !cur) return;
  const base = S.events.find((e) => e.id === S.baseline);
  if (!base) {
    host.innerHTML = '<p class="swh-none">Pick a baseline first: open a request and press <kbd>d</kbd>, then open another one.</p>';
    return;
  }
  if (base.id === cur.id) {
    host.innerHTML = '<p class="swh-none">This request <em>is</em> the baseline. Open a different one to compare.</p>';
    return;
  }
  const A = (pretty(base.body) || String(base.body || '')).split('\n').slice(0, 600);
  const B = (pretty(cur.body) || String(cur.body || '')).split('\n').slice(0, 600);
  const ops = lcs(A, B);
  const adds = ops.filter((o) => o[0] === 'add').length;
  const dels = ops.filter((o) => o[0] === 'del').length;
  const col = (idx, kind) => ops.map((o) => {
    const text = o[idx];
    if (text === null) return '<span class="swh-dl--gap">·</span>';
    const cls = o[0] === 'same' ? '' : ` class="swh-dl--${kind}"`;
    return `<span${cls}>${esc(text) || '&nbsp;'}</span>`;
  }).join('');

  host.innerHTML = '<div class="swh-diff">' +
    `<div><div class="swh-diff-h">${ic('star', 13)}Baseline<span class="swh-tag swh-tag--err swh-mla">−${dels}</span></div>` +
    `<pre>${col(1, 'del')}</pre></div>` +
    `<div><div class="swh-diff-h">${ic('chevronRight', 13)}This request<span class="swh-tag swh-tag--ok swh-mla">+${adds}</span></div>` +
    `<pre>${col(2, 'add')}</pre></div></div>`;
}

/* ── Tabs, pins, connection & endpoint chrome ───────────────────────────── */
export function setTab(id) {
  $$('#swh .swh-tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === id ? 'true' : 'false'));
  $$('#swh .swh-pane').forEach((p) => { p.dataset.on = p.id === 'swh-pane-' + id ? '1' : '0'; });
  if (id === 'raw') renderRaw();
  if (id === 'diff') renderDiff();
}

export function togglePin(id) {
  if (S.pins[id]) delete S.pins[id]; else S.pins[id] = 1;
  savePins();
  renderRows();
  if (S.sel === id) {
    const pin = el('swh-i-pin');
    if (pin) pin.setAttribute('aria-pressed', S.pins[id] ? 'true' : 'false');
  }
  return !!S.pins[id];
}

const CONN = {
  live: ['swh-dot swh-dot--live', 'Live'],
  polling: ['swh-dot swh-dot--warn', 'Polling'],
  connecting: ['swh-dot swh-dot--warn', 'Connecting'],
  paused: ['swh-dot swh-dot--warn', 'Paused'],
  offline: ['swh-dot swh-dot--err', 'Offline'],
};
export function setConn(state) {
  S.conn = state;
  const [cls, label] = CONN[state] || CONN.connecting;
  const dot = el('swh-conn-dot');
  const text = el('swh-conn-text');
  if (dot) dot.className = cls;
  if (text) text.textContent = label;
  updateStatus();
}

export function sampleCurl() {
  return `curl -X POST ${hookUrl()} \\\n  -H "Content-Type: application/json" \\\n` +
    `  -d '{"event":"payment_intent.succeeded","amount":4900,"currency":"usd"}'`;
}

export function renderEndpoint() {
  const url = hookUrl();
  const top = el('swh-url');
  if (top) top.value = url;
  const zero = el('swh-zero-url');
  if (zero) zero.value = url;
  const mail = el('swh-zero-email');
  if (mail) mail.textContent = `${S.ep}@safewebhook.com`;
  const curl = el('swh-zero-curl');
  if (curl) curl.innerHTML = hl(sampleCurl());
  updateStatus();
}

