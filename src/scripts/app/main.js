/* ═════════════════════════════════════════════════════════════════════════
   main.js — boot sequence and event wiring for the /app workspace.
   core.js owns state, view.js paints, actions.js does the work. This file is
   only the bridge: it resolves the endpoint, then connects DOM to behaviour.
   ═════════════════════════════════════════════════════════════════════════ */
import {
  S, K, EP_RE, $$, el, read, newId, setPref, epList,
  ok, oops, note, copy, dl, close, closeTop, closeMenus,
} from './core.js';
import { ic } from './icons.js';
import * as V from './view.js';
import * as A from './actions.js';

/* ── Wiring helpers ─────────────────────────────────────────────────────── */
const at = (node, evt, fn, opts) => { if (node) node.addEventListener(evt, fn, opts); };
const bind = (id, evt, fn) => at(el(id), evt, fn);
const press = (node, on) => { if (node) node.setAttribute('aria-pressed', on ? 'true' : 'false'); };
const shown = (node, yes) => { if (node) node.classList.toggle('hidden', !yes); };
const near = (t, sel) => (t && t.closest ? t.closest(sel) : null);

const TABS = ['overview', 'body', 'headers', 'query', 'security', 'telemetry', 'raw'];

function typing(t) {
  if (!t || !t.tagName) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' || t.isContentEditable === true;
}
function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
async function busy(node, fn) {
  if (node) node.dataset.busy = '1';
  try { return await fn(); } finally { if (node) delete node.dataset.busy; }
}
function newest() {
  if (!S.events.length) return null;
  return S.events.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b));
}

/* ── Colour theme — same storage contract as the inline script in Layout ─── */
const THEMES = ['bright', 'obsidian', 'midnight'];
const THEME_KEY = 'safewebhook_theme';

function readTheme() {
  let v = '';
  try { v = localStorage.getItem(THEME_KEY) || ''; } catch { /* private mode */ }
  return THEMES.indexOf(v) > -1 ? v : 'obsidian';
}
function paintTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.classList.toggle('light', t === 'bright');
  root.classList.toggle('dark', t !== 'bright');
  $$('#swh .swh-theme').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === t)));
}
function setTheme(t) {
  const next = THEMES.indexOf(t) > -1 ? t : 'obsidian';
  try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  paintTheme(next);
}
function cycleTheme() { setTheme(THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length]); }

/* ── Row density ────────────────────────────────────────────────────────── */
function paintDensity(d) {
  const compact = d === 'compact';
  const root = el('swh');
  if (root) root.dataset.density = compact ? 'compact' : 'cosy';
  const b = el('swh-density');
  press(b, compact);
  if (b) b.title = compact ? 'Compact rows — click for roomier ones' : 'Roomy rows — click to fit more on screen';
}
function setDensity(d) { setPref('density', d); paintDensity(d); }
function toggleDensity() { setDensity(S.prefs.density === 'compact' ? 'cosy' : 'compact'); }

/* ── Desktop notifications (ping() in actions.js does the sending) ───────── */
const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

function paintNotify() {
  const b = el('swh-notify');
  if (!b) return;
  const live = !!S.prefs.notify && canNotify() && Notification.permission === 'granted';
  press(b, live);
  b.innerHTML = ic(live ? 'bell' : 'bellOff', 15);
  b.title = live
    ? 'Desktop notifications on — click to mute'
    : 'Notify me when a request lands while this tab is hidden';
}
async function toggleNotify() {
  if (!canNotify()) { oops('Not available here', 'This browser has no Notification API.'); return; }
  if (S.prefs.notify) { setPref('notify', false); paintNotify(); note('Notifications muted'); return; }
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
  if (perm !== 'granted') {
    setPref('notify', false);
    paintNotify();
    oops('Permission blocked', 'Allow notifications for this site in your browser settings.');
    return;
  }
  setPref('notify', true);
  paintNotify();
  ok('Notifications on', 'You will be pinged when a request lands while this tab is hidden.');
}

/* ── Which endpoint are we looking at ───────────────────────────────────── */
function firstEndpoint() {
  let q = '';
  try { q = new URL(window.location.href).searchParams.get('ep') || ''; } catch { /* ignore */ }
  if (EP_RE.test(q)) return q;
  const saved = read(K.ep, '');
  if (typeof saved === 'string' && EP_RE.test(saved)) return saved;
  const recent = epList()[0];
  return recent ? recent.id : newId();
}

/* Deep links are /app?ep=<id>#<event id>. useEndpoint() rewrites the URL and
   drops the fragment, so grab it before booting and retry until history lands. */
let pendingHash = '';

function hashTarget() {
  const raw = String(window.location.hash || '').replace(/^#/, '');
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}
function chaseHash(tries) {
  if (!pendingHash) return;
  if (S.events.some((e) => e.id === pendingHash)) {
    const id = pendingHash;
    pendingHash = '';
    A.pick(id, true);
    V.setTab('body');
    return;
  }
  if (tries > 0) setTimeout(() => chaseHash(tries - 1), 700);
  else pendingHash = '';
}

/* ── Resizable request list ─────────────────────────────────────────────── */
const LIST_MIN = 272;
const LIST_MAX = 640;
let listW = 356;

function applyListWidth(px) {
  listW = Math.max(LIST_MIN, Math.min(LIST_MAX, Math.round(px) || 356));
  const root = el('swh');
  if (root) root.style.setProperty('--list-w', listW + 'px');
  const grip = el('swh-grip');
  if (grip) grip.setAttribute('aria-valuenow', String(listW));
  return listW;
}

function wireGrip() {
  const grip = el('swh-grip');
  const list = el('swh-list');
  applyListWidth(Number(S.prefs.listW) || 356);
  if (!grip || !list) return;
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-valuemin', String(LIST_MIN));
  grip.setAttribute('aria-valuemax', String(LIST_MAX));
  grip.setAttribute('aria-label', 'Resize the request list');

  const move = (e) => applyListWidth(e.clientX - list.getBoundingClientRect().left);
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    delete grip.dataset.drag;
    document.body.style.userSelect = '';
    setPref('listW', listW);
  };
  at(grip, 'pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    grip.dataset.drag = '1';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  });
  at(grip, 'dblclick', () => { applyListWidth(356); setPref('listW', listW); });
  at(grip, 'keydown', (e) => {
    const nudge = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') applyListWidth(listW - nudge);
    else if (e.key === 'ArrowRight') applyListWidth(listW + nudge);
    else if (e.key === 'Home') applyListWidth(356);
    else return;
    e.preventDefault();
    setPref('listW', listW);
  });
}

/* ── Search, filters and sort ───────────────────────────────────────────── */
function paintFilters() {
  $$('#swh-filters [data-method]').forEach((b) => press(b, (b.dataset.method || 'ALL') === S.method));
  press(el('swh-f-pin'), S.pinOnly);
  press(el('swh-f-sig'), S.sigOnly);
  const sort = el('swh-sort');
  if (sort) sort.value = S.prefs.sort;
  const btn = el('swh-filters-btn');
  if (btn) btn.dataset.live = (S.method !== 'ALL' || S.pinOnly || S.sigOnly) ? '1' : '0';
}

function setMethod(m) {
  S.method = m || 'ALL';
  paintFilters();
  V.renderRows();
}

/* ── Request rows ───────────────────────────────────────────────────────── */
const rowNodes = () => $$('#swh-rows .swh-row');

function focusRow(i) {
  const rows = rowNodes();
  if (!rows.length) return;
  const n = rows[Math.max(0, Math.min(rows.length - 1, i))];
  try { n.focus(); } catch { /* ignore */ }
  n.scrollIntoView({ block: 'nearest' });
}
function step(delta) {
  const list = V.filtered();
  if (!list.length) return;
  const i = list.findIndex((e) => e.id === S.sel);
  const next = i < 0
    ? (delta > 0 ? 0 : list.length - 1)
    : Math.max(0, Math.min(list.length - 1, i + delta));
  A.pick(list[next].id, true);
}
function jumpNewest() {
  if (S.paused) A.releaseHeld();
  A.markSeen();
  const host = el('swh-rows');
  if (host) host.scrollTop = 0;
  const target = newest();
  if (target) A.pick(target.id, true);
}

function wireFilters() {
  const q = el('swh-q');
  const repaint = debounce(() => V.renderRows(), 90);
  at(q, 'input', () => { S.q = q.value; repaint(); });
  at(q, 'keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (q.value) { q.value = ''; S.q = ''; V.renderRows(); } else q.blur();
    } else if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(0); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const first = V.filtered()[0];
      if (first) A.pick(first.id, true);
    }
  });
  const panel = el('swh-filters');
  bind('swh-filters-btn', 'click', () => {
    const btn = el('swh-filters-btn');
    const openNow = !!panel && panel.classList.contains('hidden');
    shown(panel, openNow);
    if (btn) btn.setAttribute('aria-expanded', openNow ? 'true' : 'false');
  });
  bind('swh-sort', 'change', (e) => { setPref('sort', e.target.value); V.renderRows(); });
  bind('swh-f-pin', 'click', () => { S.pinOnly = !S.pinOnly; paintFilters(); V.renderRows(); });
  bind('swh-f-sig', 'click', () => { S.sigOnly = !S.sigOnly; paintFilters(); V.renderRows(); });
  paintFilters();
}

function wireRows() {
  const host = el('swh-rows');
  at(host, 'keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const rows = rowNodes();
      const i = rows.indexOf(near(document.activeElement, '.swh-row'));
      focusRow((i < 0 ? 0 : i) + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusRow(e.key === 'Home' ? 0 : rowNodes().length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      const row = near(e.target, '.swh-row');
      if (row) { e.preventDefault(); A.pick(row.dataset.id, true); }
    }
  });
  at(host, 'change', (e) => {
    const chk = near(e.target, '[data-check]');
    if (chk) A.check(chk.dataset.check, chk.checked);
  });
  at(host, 'dblclick', (e) => {
    const row = near(e.target, '.swh-row');
    if (row) { A.pick(row.dataset.id, true); V.setTab('raw'); }
  });
}

/* ── Inspector ──────────────────────────────────────────────────────────── */
const syncDiffTab = () => shown(el('swh-tab-diff'), !!S.baseline);

function treeToggle(btn, force) {
  const li = near(btn, 'li');
  const ul = li && li.querySelector(':scope > ul');
  if (!ul) return;
  const openNow = force == null ? btn.getAttribute('aria-expanded') !== 'true' : !!force;
  btn.setAttribute('aria-expanded', openNow ? 'true' : 'false');
  ul.hidden = !openNow;
}
const treeAll = (openAll) => $$('#swh-tree .swh-tw').forEach((b) => treeToggle(b, openAll));

/* First press marks a baseline, second on the same request clears it, and a
   press on any other request opens the diff. Mirrors the `d` shortcut. */
function toggleBaseline() {
  const ev = V.current();
  if (!ev) { note('Nothing selected', 'Choose a captured request first.'); return; }
  if (S.baseline === ev.id) {
    S.baseline = null;
    S.diffOn = false;
    press(el('swh-compare'), false);
    syncDiffTab();
    V.setTab('overview');
    note('Baseline cleared');
    return;
  }
  if (!S.baseline) {
    S.baseline = ev.id;
    press(el('swh-compare'), true);
    syncDiffTab();
    ok('Baseline set', 'Open another request and press d to compare it against this one.');
    return;
  }
  S.diffOn = true;
  syncDiffTab();
  V.setTab('diff');
}

function wireInspector() {
  bind('swh-back', 'click', () => { const m = el('swh-main'); if (m) m.dataset.view = 'list'; });
  bind('swh-jump', 'click', jumpNewest);
  bind('swh-replay', 'click', () => A.openTool('replay'));
  bind('swh-code', 'click', () => A.openTool('code'));
  bind('swh-compare', 'click', toggleBaseline);
  bind('swh-i-pin', 'click', () => { const ev = V.current(); if (ev) V.togglePin(ev.id); });
  bind('swh-i-del', 'click', () => { const ev = V.current(); if (ev) A.forgetEvent(ev.id); });

  bind('swh-body-q', 'input', debounce(() => { const ev = V.current(); if (ev) V.renderBody(ev); }, 110));
  bind('swh-h-q', 'input', debounce(() => V.renderHeaders(), 110));
  bind('swh-expand', 'click', () => treeAll(true));
  bind('swh-collapse', 'click', () => treeAll(false));
  bind('swh-body-copy', 'click', () => A.icopy('body'));
  bind('swh-h-copy', 'click', () => A.icopy('headers'));
  bind('swh-raw-copy', 'click', () => A.icopy('raw'));
  bind('swh-raw-dl', 'click', () => {
    const ev = V.current();
    if (ev) dl(`${S.ep}-${ev.id}.http.txt`, V.rawText(ev), 'text/plain;charset=utf-8');
  });
  bind('swh-wrap', 'click', () => {
    setPref('wrap', !S.prefs.wrap);
    press(el('swh-wrap'), S.prefs.wrap);
    const ev = V.current();
    if (ev) V.renderRaw(ev);
  });
  bind('swh-recipe-copy', 'click', () => {
    const n = el('swh-recipe');
    copy(n ? n.textContent : '', 'Verification snippet');
  });
}

/* ── Security pane (verification never leaves the browser) ──────────────── */
function wireSecurity() {
  bind('swh-sig-provider', 'change', () => { A.resetVerify(); A.loadSecret(); V.renderRecipe(); });
  bind('swh-sig-eye', 'click', () => A.toggleSecretEye());
  bind('swh-sig-run', 'click', (e) => busy(e.currentTarget, () => A.runVerify(false)));
  bind('swh-sig-auto', 'change', (e) => A.setAutoVerify(e.target.checked));
  bind('swh-sig-remember', 'change', () => A.runVerify(true));
  bind('swh-sig-secret', 'keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    A.runVerify(false);
  });
}

/* ── Modal wiring ───────────────────────────────────────────────────────── */
function wireRespond() {
  bind('swh-resp-delay', 'input', (e) => {
    const n = el('swh-resp-delay-v');
    if (n) n.textContent = `${Number(e.target.value) || 0} ms`;
  });
  bind('swh-resp-body', 'input', debounce(() => A.checkResponseBody(), 140));
  bind('swh-resp-fmt', 'click', () => A.formatResponseBody());
  bind('swh-resp-addh', 'click', () => A.addRow('swh-resp-headers', '', ''));
  bind('swh-resp-save', 'click', (e) => busy(e.currentTarget, () => A.saveConfig()));
}

function wireWorkflow() {
  bind('swh-wf-test', 'click', (e) => busy(e.currentTarget, () => A.testForward()));
  bind('swh-wf-save', 'click', (e) => busy(e.currentTarget, () => A.saveWorkflow()));
}

function wireCompose() {
  bind('swh-c-target', 'change', () => A.syncComposeTarget());
  bind('swh-c-addh', 'click', () => A.addRow('swh-c-headers', '', ''));
  bind('swh-c-fmt', 'click', () => A.formatComposeBody());
  bind('swh-c-preset', 'change', (e) => A.loadComposeTemplate(e.target.value));
  bind('swh-c-send', 'click', (e) => busy(e.currentTarget, () => A.sendComposed()));
}

function wireOutbound() {
  bind('swh-rp-send', 'click', (e) => busy(e.currentTarget, () => A.runReplay()));
  bind('swh-rp-url', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); A.runReplay(); } });
  bind('swh-mon-run', 'click', (e) => busy(e.currentTarget, () => A.runMonitor()));
  bind('swh-mon-url', 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); A.runMonitor(); } });
  bind('swh-stats-refresh', 'click', (e) => busy(e.currentTarget, () => A.loadStats()));
}

function wireTools() {
  bind('swh-ep-create', 'click', () => A.openEndpointFromField());
  bind('swh-ep-name', 'keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    A.openEndpointFromField();
  });
  bind('swh-new-ep', 'click', () => A.spawnEndpoint());
  bind('swh-mock-secret', 'input', (e) => setPref('mockSecret', e.target.value));
  bind('swh-import-go', 'click', (e) => busy(e.currentTarget, () => A.importFromTextarea()));
  bind('swh-fwd-target', 'input', debounce(() => A.renderForwarder(), 220));
  bind('swh-code-copy', 'click', () => {
    const n = el('swh-code-out');
    copy(n ? n.textContent : '', 'Integration snippet');
  });
  bind('swh-fwd-copy', 'click', () => {
    const n = el('swh-fwd-code');
    copy(n ? n.textContent : '', 'Forwarding script');
  });
  A.wireDrop();
}

function wireListChrome() {
  bind('swh-select-mode', 'click', () => A.toggleSelectMode());
  bind('swh-clear', 'click', () => A.clearAll());
  bind('swh-bulk-all', 'click', () => A.checkAll());
  bind('swh-bulk-export', 'click', () => A.exportAs('json'));
  bind('swh-bulk-del', 'click', () => A.deleteChecked());
  bind('swh-bulk-off', 'click', () => A.toggleSelectMode(false));
  bind('swh-density', 'click', toggleDensity);
}

function wireTopBar() {
  bind('swh-pause', 'click', () => A.togglePause());
  bind('swh-cmd', 'click', () => A.openPal());
  bind('swh-copy-url', 'click', () => A.copyKind('url'));
  bind('swh-notify', 'click', toggleNotify);
  at(el('swh-url'), 'focus', (e) => { try { e.target.select(); } catch { /* ignore */ } });
}

/* ── Popup menus ────────────────────────────────────────────────────────── */
const MENUS = [
  ['swh-url-more', 'swh-url-menu'],
  ['swh-tools', 'swh-tools-menu'],
  ['swh-export-btn', 'swh-export-menu'],
  ['swh-copy-btn', 'swh-copy-menu'],
];

function menuItems(menu) {
  return $$('.swh-menu-item, a', menu).filter((n) => n.offsetParent !== null);
}

function wireMenus() {
  MENUS.forEach(([bid, mid]) => {
    const btn = el(bid);
    const menu = el(mid);
    if (!btn || !menu) return;
    at(btn, 'click', (e) => {
      e.stopPropagation();
      const wasOpen = !menu.classList.contains('hidden');
      closeMenus();
      if (wasOpen) return;
      menu.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      const first = menuItems(menu)[0];
      if (first) setTimeout(() => { try { first.focus(); } catch { /* ignore */ } }, 20);
    });
    at(menu, 'keydown', (e) => {
      const items = menuItems(menu);
      if (!items.length) return;
      const i = items.indexOf(near(e.target, '.swh-menu-item, a'));
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1 + items.length) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMenus();
        try { btn.focus(); } catch { /* ignore */ }
      }
    });
  });
  document.addEventListener('click', (e) => {
    if (near(e.target, '#swh .swh-menu') || near(e.target, '#swh [aria-haspopup="menu"]')) return;
    closeMenus();
  });
}

/* ── One delegated handler for every data-* hook the renderers emit ──────── */
function wireDelegates() {
  const root = el('swh');
  if (!root) return;
  at(root, 'click', (e) => {
    const t = e.target;
    if (near(t, '[data-check]')) return;

    const closer = near(t, '[data-close]');
    if (closer) {
      if (near(closer, '#swh-pal')) A.closePal();
      else close(near(closer, '.swh-modal'));
      return;
    }
    const tw = near(t, '.swh-tw');
    if (tw) { treeToggle(tw); return; }

    const palRow = near(t, '[data-pi]');
    if (palRow) { A.palRun(Number(palRow.dataset.pi)); return; }

    const theme = near(t, '.swh-theme');
    if (theme) { setTheme(theme.dataset.theme); return; }

    const tab = near(t, '[data-tab]');
    if (tab) {
      if (tab.dataset.tab === 'diff') S.diffOn = true;
      V.setTab(tab.dataset.tab);
      return;
    }
    const bview = near(t, '[data-bview]');
    if (bview) { setPref('bview', bview.dataset.bview); V.setBodyView(bview.dataset.bview); return; }

    const meth = near(t, '[data-method]');
    if (meth) { setMethod(meth.dataset.method); return; }

    const lang = near(t, '[data-lang]');
    if (lang) {
      const which = lang.dataset.lang;
      if (near(lang, '#swh-code-langs')) A.renderSnippet(which);
      else if (near(lang, '#swh-fwd-langs')) A.renderForwarder(which);
      else if (near(lang, '#swh-recipe-lang')) { setPref('recipe', which); V.renderRecipe(); }
      return;
    }
    const preset = near(t, '[data-preset]');
    if (preset) { A.applyPreset(preset.dataset.preset); return; }

    const hdel = near(t, '[data-hdel]');
    if (hdel) { const row = near(hdel, '.swh-row2'); if (row) row.remove(); return; }

    const kind = near(t, '[data-copy]');
    if (kind) { A.copyKind(kind.dataset.copy); return; }

    const ikind = near(t, '[data-icopy]');
    if (ikind) { A.icopy(ikind.dataset.icopy); return; }

    const ex = near(t, '[data-export]');
    if (ex) { A.exportAs(ex.dataset.export); return; }

    const tool = near(t, '[data-open]');
    if (tool) { A.openTool(tool.dataset.open); return; }

    const mock = near(t, '[data-mock]');
    if (mock) { A.sendMock(mock.dataset.mock); return; }

    const use = near(t, '[data-use]');
    if (use) { A.useEndpoint(use.dataset.use); close('endpoints'); return; }

    const forget = near(t, '[data-forget]');
    if (forget) { A.dropEndpoint(forget.dataset.forget); return; }

    const pin = near(t, '[data-pin]');
    if (pin) { V.togglePin(pin.dataset.pin); return; }

    const cp = near(t, '[data-cp]');
    if (cp) { copy(cp.dataset.cp, 'Copied that value'); return; }

    const row = near(t, '.swh-row');
    if (row && row.dataset.id) A.pick(row.dataset.id);
  });
}

/* ── Keyboard map — kept in step with the KEYS table in actions.js ───────── */
function wireKeys() {
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    const pal = el('swh-pal');
    const palOpen = !!pal && !pal.classList.contains('hidden');

    if (meta && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (palOpen) A.closePal(); else A.openPal();
      return;
    }
    if (palOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); A.palMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); A.palMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); A.palRun(); }
      else if (e.key === 'Escape') { e.preventDefault(); A.closePal(); }
      return;
    }
    if (e.key === 'Escape') {
      if (closeTop()) { e.preventDefault(); return; }
      const q = el('swh-q');
      if (q && q.value) { q.value = ''; S.q = ''; V.renderRows(); e.preventDefault(); }
      return;
    }
    if (meta || e.altKey || typing(e.target)) return;

    const k = e.key;
    const ev = V.current();
    const go = (fn) => { e.preventDefault(); fn(); };

    if (k === '/') return go(() => { const q = el('swh-q'); if (q) q.focus(); });
    if (k === '?') return go(() => A.openTool('keys'));
    if (k === 'j') return go(() => step(1));
    if (k === 'k') return go(() => step(-1));
    if (k === 'g') return go(jumpNewest);
    if (k === ' ') return go(() => A.togglePause());
    if (k >= '1' && k <= '7') return go(() => V.setTab(TABS[Number(k) - 1]));
    if (k === 'u') return go(() => A.copyKind('url'));
    if (k === 'm') return go(() => A.openTool('mock'));
    if (k === 'e') return go(() => A.exportAs('json'));
    if (k === 'n') return go(() => A.spawnEndpoint());
    if (k === 'x') return go(() => A.toggleSelectMode());
    if (k === 't') return go(cycleTheme);
    if (!ev) return;
    if (k === 'y') return go(() => A.icopy('body'));
    if (k === 'c') return go(() => A.icopy('curl'));
    if (k === 'l') return go(() => A.icopy('link'));
    if (k === 'r') return go(() => A.openTool('replay'));
    if (k === 'v') return go(() => { V.setTab('security'); A.runVerify(false); });
    if (k === 'p') return go(() => V.togglePin(ev.id));
    if (k === 'd') return go(toggleBaseline);
    if (k === 'Backspace' || k === 'Delete') return go(() => A.forgetEvent(ev.id));
  });
}

function wirePalette() {
  const q = el('swh-pal-q');
  at(q, 'input', () => A.palPaint(q.value));
}

/* ── Boot ───────────────────────────────────────────────────────────────── */
let booted = false;

export function boot() {
  if (booted) return;
  const root = el('swh');
  if (!root) return;
  booted = true;

  S.origin = window.location.origin;
  pendingHash = hashTarget();

  paintTheme(readTheme());
  paintDensity(S.prefs.density);
  paintNotify();
  press(el('swh-wrap'), S.prefs.wrap);

  const auto = el('swh-sig-auto');
  if (auto) auto.checked = !!S.prefs.autoVerify;
  const secret = el('swh-mock-secret');
  if (secret) secret.value = String(S.prefs.mockSecret || '');
  const fwd = el('swh-fwd-target');
  if (fwd) fwd.value = String(S.prefs.fwdTarget || 'http://localhost:3000/api/webhooks');

  wireGrip();
  wireTopBar();
  wireMenus();
  wireFilters();
  wireListChrome();
  wireRows();
  wireInspector();
  wireSecurity();
  wireRespond();
  wireWorkflow();
  wireCompose();
  wireOutbound();
  wireTools();
  wirePalette();
  wireDelegates();
  wireKeys();

  /* actions.js reaches these through DOM events so it never imports main.js. */
  document.addEventListener('swh:theme', cycleTheme);
  document.addEventListener('swh:density', toggleDensity);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    A.markSeen();
    if (S.conn === 'offline') A.connect();
  });
  window.addEventListener('pagehide', () => A.stopFeed());
  window.addEventListener('hashchange', () => { pendingHash = hashTarget(); chaseHash(2); });
  window.addEventListener('resize', debounce(() => {
    const main = el('swh-main');
    if (main && window.innerWidth > 780) main.dataset.view = 'list';
  }, 150));

  A.useEndpoint(firstEndpoint());
  V.setBodyView(S.prefs.bview);
  syncDiffTab();

  setInterval(() => V.ticks(), 15000);
  setInterval(() => V.updateStatus(), 30000);
  chaseHash(6);
}
