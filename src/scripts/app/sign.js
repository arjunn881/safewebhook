/* ═════════════════════════════════════════════════════════════════════════
   sign.js — HMAC signature detection, in-browser verification (WebCrypto),
   outbound signing for the composer/mock library, and copy-paste recipes.
   ═════════════════════════════════════════════════════════════════════════ */

const TE = new TextEncoder();

export const SCHEMES = {
  stripe:   { label: 'Stripe',            hdr: 'stripe-signature',        hash: 'sha256', enc: 'hex',    base: 'ts.body' },
  github:   { label: 'GitHub',            hdr: 'x-hub-signature-256',     hash: 'sha256', enc: 'hex',    base: 'body', prefix: 'sha256=' },
  github1:  { label: 'GitHub legacy',     hdr: 'x-hub-signature',         hash: 'sha1',   enc: 'hex',    base: 'body', prefix: 'sha1=' },
  shopify:  { label: 'Shopify',           hdr: 'x-shopify-hmac-sha256',   hash: 'sha256', enc: 'base64', base: 'body' },
  slack:    { label: 'Slack',             hdr: 'x-slack-signature',       hash: 'sha256', enc: 'hex',    base: 'v0.ts.body', prefix: 'v0=', tsHdr: 'x-slack-request-timestamp' },
  svix:     { label: 'Svix / Clerk',      hdr: 'svix-signature',          hash: 'sha256', enc: 'base64', base: 'id.ts.body', tsHdr: 'svix-timestamp', idHdr: 'svix-id', keyB64: true },
  razorpay: { label: 'Razorpay',          hdr: 'x-razorpay-signature',    hash: 'sha256', enc: 'hex',    base: 'body' },
  hex:      { label: 'Generic hex',       hdr: 'x-signature',             hash: 'sha256', enc: 'hex',    base: 'body' },
  b64:      { label: 'Generic base64',    hdr: 'x-signature',             hash: 'sha256', enc: 'base64', base: 'body' },
};

/* Header → scheme, most specific first. */
const SNIFF = [
  ['stripe-signature', 'stripe'],
  ['x-hub-signature-256', 'github'],
  ['x-hub-signature', 'github1'],
  ['x-shopify-hmac-sha256', 'shopify'],
  ['x-slack-signature', 'slack'],
  ['svix-signature', 'svix'],
  ['webhook-signature', 'svix'],
  ['x-razorpay-signature', 'razorpay'],
  ['x-signature', 'hex'],
  ['x-webhook-signature', 'hex'],
  ['x-hook-signature', 'hex'],
  ['x-pusher-signature', 'hex'],
  ['x-paystack-signature', 'hex'],
  ['x-sendgrid-signature', 'b64'],
];

export function lower(headers) {
  const out = {};
  Object.keys(headers || {}).forEach((k) => { out[String(k).toLowerCase()] = headers[k]; });
  return out;
}

export function detect(headers) {
  const h = lower(headers);
  for (const [name, provider] of SNIFF) {
    if (h[name]) return { provider, header: name, value: String(h[name]) };
  }
  return null;
}

/* ── Byte helpers ───────────────────────────────────────────────────────── */
export function toHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(str) {
  const clean = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean + '==='.slice((clean.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(keyBytes, message, hash) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, TE.encode(message));
  return new Uint8Array(sig);
}

function keyBytes(scheme, secret) {
  if (scheme.keyB64) {
    const body = String(secret || '').replace(/^whsec_/, '');
    try { return fromB64(body); } catch { return TE.encode(secret || ''); }
  }
  return TE.encode(secret || '');
}

function eq(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function headerFor(h, scheme, provider) {
  if (provider === 'svix') return h['svix-signature'] || h['webhook-signature'] || '';
  return h[scheme.hdr] || '';
}

function pairs(header) {
  const out = {};
  String(header).split(',').forEach((p) => {
    const i = p.indexOf('=');
    if (i < 1) return;
    const k = p.slice(0, i).trim();
    if (out[k] === undefined) out[k] = p.slice(i + 1).trim();
  });
  return out;
}

function candidates(header, scheme, provider) {
  const v = String(header || '').trim();
  if (provider === 'stripe') {
    return v.split(',').map((p) => p.trim()).filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  }
  if (provider === 'svix') {
    return v.split(/\s+/).filter((p) => p.startsWith('v1,')).map((p) => p.slice(3));
  }
  if (scheme.prefix && v.toLowerCase().startsWith(scheme.prefix)) return [v.slice(scheme.prefix.length)];
  return [v];
}

/**
 * Verify a captured request in the browser. Never leaves the tab.
 * → { state:'ok'|'bad'|'na', provider, base, got, exp, ageMs, msg }
 */
export async function verify(provider, headers, body, secret) {
  const h = lower(headers);
  let p = provider && provider !== 'auto' ? provider : (detect(h) || {}).provider;
  if (!p) return { state: 'na', msg: 'No known signature header on this request.' };
  const sc = SCHEMES[p];
  if (!sc) return { state: 'na', provider: p, msg: 'That scheme is not supported yet.' };

  const header = headerFor(h, sc, p);
  if (!header) return { state: 'na', provider: p, msg: `Header ${sc.hdr} is missing.` };
  if (!secret) return { state: 'na', provider: p, msg: 'Enter the signing secret to verify.' };

  const raw = body == null ? '' : String(body);
  const kv = pairs(header);
  let base = raw, tsSec = 0;

  if (sc.base === 'ts.body') { tsSec = Number(kv.t) || 0; base = `${kv.t || ''}.${raw}`; }
  else if (sc.base === 'v0.ts.body') { const ts = h[sc.tsHdr] || ''; tsSec = Number(ts) || 0; base = `v0:${ts}:${raw}`; }
  else if (sc.base === 'id.ts.body') {
    const id = h[sc.idHdr] || h['webhook-id'] || '';
    const ts = h[sc.tsHdr] || h['webhook-timestamp'] || '';
    tsSec = Number(ts) || 0;
    base = `${id}.${ts}.${raw}`;
  }

  let mac;
  try { mac = await hmac(keyBytes(sc, secret), base, sc.hash === 'sha1' ? 'SHA-1' : 'SHA-256'); }
  catch (e) { return { state: 'na', provider: p, msg: 'WebCrypto rejected that secret: ' + (e && e.message ? e.message : 'unknown error') }; }

  const exp = sc.enc === 'base64' ? toB64(mac) : toHex(mac);
  const list = candidates(header, sc, p);
  const good = list.some((c) => eq(c, exp) || eq(c.toLowerCase(), exp.toLowerCase()));
  return {
    state: good ? 'ok' : 'bad',
    provider: p,
    base,
    got: list[0] || header,
    exp,
    ageMs: tsSec ? Date.now() - tsSec * 1000 : 0,
    msg: good ? `${sc.label} signature matches.` : `${sc.label} signature does not match this body.`,
  };
}

/** Build provider-shaped signature headers for an outbound request. */
export async function signHeaders(provider, secret, body) {
  const sc = SCHEMES[provider];
  if (!sc || !secret) return {};
  const raw = body == null ? '' : String(body);
  const hash = sc.hash === 'sha1' ? 'SHA-1' : 'SHA-256';
  const kb = keyBytes(sc, secret);
  const t = Math.floor(Date.now() / 1000);

  if (provider === 'stripe') {
    return { 'Stripe-Signature': `t=${t},v1=${toHex(await hmac(kb, `${t}.${raw}`, hash))}` };
  }
  if (provider === 'github') {
    return { 'X-Hub-Signature-256': 'sha256=' + toHex(await hmac(kb, raw, hash)) };
  }
  if (provider === 'github1') {
    return { 'X-Hub-Signature': 'sha1=' + toHex(await hmac(kb, raw, 'SHA-1')) };
  }
  if (provider === 'shopify') {
    return { 'X-Shopify-Hmac-Sha256': toB64(await hmac(kb, raw, hash)) };
  }
  if (provider === 'slack') {
    return {
      'X-Slack-Request-Timestamp': String(t),
      'X-Slack-Signature': 'v0=' + toHex(await hmac(kb, `v0:${t}:${raw}`, hash)),
    };
  }
  if (provider === 'svix') {
    const id = 'msg_' + Math.random().toString(36).slice(2, 14);
    return {
      'svix-id': id,
      'svix-timestamp': String(t),
      'svix-signature': 'v1,' + toB64(await hmac(kb, `${id}.${t}.${raw}`, hash)),
    };
  }
  if (provider === 'razorpay') {
    return { 'X-Razorpay-Signature': toHex(await hmac(kb, raw, hash)) };
  }
  const mac = await hmac(kb, raw, hash);
  return { 'X-Signature': sc.enc === 'base64' ? toB64(mac) : toHex(mac) };
}

/* ── Verification recipes ───────────────────────────────────────────────── */
function titleCase(h) { return h.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-'); }

function nodeFrag(sc, p) {
  if (p === 'stripe') return [
    "  const parts = Object.fromEntries(header.split(',').map((s) => s.split('=')));",
    "  const signature = parts.v1 || '';",
    "  const base = parts.t + '.' + raw;",
  ];
  if (p === 'svix') return [
    "  const signature = (header.split(' ').find((s) => s.startsWith('v1,')) || '').slice(3);",
    "  const id = String(req.headers['svix-id'] || '');",
    "  const ts = String(req.headers['svix-timestamp'] || '');",
    "  const base = id + '.' + ts + '.' + raw;",
  ];
  if (p === 'slack') return [
    "  const signature = header.replace(/^v0=/, '');",
    "  const ts = String(req.headers['x-slack-request-timestamp'] || '');",
    "  const base = 'v0:' + ts + ':' + raw;",
  ];
  return [
    sc.prefix ? `  const signature = header.replace(/^${sc.prefix.replace('=', '=')}/, '');` : '  const signature = header;',
    '  const base = raw;',
  ];
}

function nodeRecipe(sc, p) {
  const key = sc.keyB64 ? "Buffer.from(secret.replace(/^whsec_/, ''), 'base64')" : 'secret';
  return [
    "const crypto = require('crypto');",
    '',
    `// ${sc.label} — verify the RAW body, before any JSON parsing.`,
    "// Express: app.post('/hook', express.raw({ type: '*/*' }), handler)",
    'function verifyWebhook(req, raw) {',
    '  const secret = process.env.WEBHOOK_SECRET;',
    `  const header = String(req.headers['${sc.hdr}'] || '');`,
    ...nodeFrag(sc, p),
    `  const expected = crypto.createHmac('${sc.hash}', ${key})`,
    "    .update(base, 'utf8')",
    `    .digest('${sc.enc}');`,
    '  const a = Buffer.from(expected);',
    '  const b = Buffer.from(signature);',
    '  return a.length === b.length && crypto.timingSafeEqual(a, b);',
    '}',
  ].join('\n');
}

function pyFrag(sc, p) {
  if (p === 'stripe') return [
    '    parts = dict(s.split("=", 1) for s in header.split(","))',
    '    signature = parts.get("v1", "")',
    '    base = parts.get("t", "").encode() + b"." + raw',
  ];
  if (p === 'svix') return [
    '    signature = next((s[3:] for s in header.split(" ") if s.startswith("v1,")), "")',
    '    msg_id = headers.get("svix-id", "")',
    '    ts = headers.get("svix-timestamp", "")',
    '    base = msg_id.encode() + b"." + ts.encode() + b"." + raw',
  ];
  if (p === 'slack') return [
    '    signature = header.split("=", 1)[-1]',
    '    ts = headers.get("x-slack-request-timestamp", "")',
    '    base = b"v0:" + ts.encode() + b":" + raw',
  ];
  return [
    sc.prefix ? '    signature = header.split("=", 1)[-1]' : '    signature = header',
    '    base = raw',
  ];
}

function pyRecipe(sc, p) {
  const key = sc.keyB64 ? 'base64.b64decode(secret.replace("whsec_", "", 1))' : 'secret.encode()';
  const digest = sc.enc === 'base64' ? 'base64.b64encode(mac.digest()).decode()' : 'mac.hexdigest()';
  const imports = sc.enc === 'base64' || sc.keyB64 ? 'import base64, hashlib, hmac, os' : 'import hashlib, hmac, os';
  return [
    imports,
    '',
    `# ${sc.label} — Flask/FastAPI: read the body with request.get_data() (bytes, untouched).`,
    'def verify_webhook(headers: dict, raw: bytes) -> bool:',
    '    secret = os.environ["WEBHOOK_SECRET"]',
    `    header = headers.get("${sc.hdr}", "")`,
    ...pyFrag(sc, p),
    `    mac = hmac.new(${key}, base, hashlib.${sc.hash})`,
    `    expected = ${digest}`,
    '    return hmac.compare_digest(expected, signature)',
  ].join('\n');
}

function phpFrag(sc, p) {
  if (p === 'stripe') return [
    "    $parts = [];",
    "    foreach (explode(',', $header) as $seg) { [$k, $v] = array_pad(explode('=', $seg, 2), 2, ''); $parts[$k] = $v; }",
    "    $signature = $parts['v1'] ?? '';",
    "    $base = ($parts['t'] ?? '') . '.' . $raw;",
  ];
  if (p === 'svix') return [
    "    $signature = '';",
    "    foreach (explode(' ', $header) as $seg) { if (str_starts_with($seg, 'v1,')) { $signature = substr($seg, 3); break; } }",
    "    $base = ($headers['svix-id'] ?? '') . '.' . ($headers['svix-timestamp'] ?? '') . '.' . $raw;",
  ];
  if (p === 'slack') return [
    "    $signature = substr($header, 3);",
    "    $base = 'v0:' . ($headers['x-slack-request-timestamp'] ?? '') . ':' . $raw;",
  ];
  return [
    sc.prefix ? "    $signature = substr($header, strpos($header, '=') + 1);" : '    $signature = $header;',
    '    $base = $raw;',
  ];
}

function phpRecipe(sc, p) {
  const key = sc.keyB64 ? "base64_decode(preg_replace('/^whsec_/', '', $secret))" : '$secret';
  const expected = sc.enc === 'base64'
    ? `base64_encode(hash_hmac('${sc.hash}', $base, ${key}, true))`
    : `hash_hmac('${sc.hash}', $base, ${key})`;
  return [
    '<?php',
    `// ${sc.label} — grab the raw body first: $raw = file_get_contents('php://input');`,
    '// $headers must be lower-cased keys, e.g. array_change_key_case(getallheaders());',
    'function verify_webhook(array $headers, string $raw): bool {',
    "    $secret = getenv('WEBHOOK_SECRET');",
    `    $header = $headers['${sc.hdr}'] ?? '';`,
    ...phpFrag(sc, p),
    `    $expected = ${expected};`,
    '    return hash_equals($expected, $signature);',
    '}',
  ].join('\n');
}

function goFrag(sc, p) {
  if (p === 'stripe') return [
    '\tvar ts, signature string',
    '\tfor _, seg := range strings.Split(header, ",") {',
    '\t\tkv := strings.SplitN(seg, "=", 2)',
    '\t\tif len(kv) != 2 { continue }',
    '\t\tif kv[0] == "t" { ts = kv[1] } else if kv[0] == "v1" && signature == "" { signature = kv[1] }',
    '\t}',
    '\tbase := []byte(ts + "." + string(raw))',
  ];
  if (p === 'svix') return [
    '\tvar signature string',
    '\tfor _, seg := range strings.Fields(header) {',
    '\t\tif strings.HasPrefix(seg, "v1,") { signature = seg[3:]; break }',
    '\t}',
    '\tbase := []byte(r.Header.Get("svix-id") + "." + r.Header.Get("svix-timestamp") + "." + string(raw))',
  ];
  if (p === 'slack') return [
    '\tsignature := strings.TrimPrefix(header, "v0=")',
    '\tbase := []byte("v0:" + r.Header.Get("X-Slack-Request-Timestamp") + ":" + string(raw))',
  ];
  return [
    sc.prefix ? `\tsignature := strings.TrimPrefix(header, "${sc.prefix}")` : '\tsignature := header',
    '\tbase := raw',
  ];
}

function goRecipe(sc, p) {
  const hashPkg = sc.hash === 'sha1' ? 'sha1' : 'sha256';
  const b64 = sc.enc === 'base64';
  const key = sc.keyB64
    ? '\tkey, _ := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))'
    : '\tkey := []byte(secret)';
  const encImports = [b64 || sc.keyB64 ? '\t"encoding/base64"' : '', b64 ? '' : '\t"encoding/hex"'].filter(Boolean);
  return [
    'import (',
    '\t"crypto/hmac"',
    `\t"crypto/${hashPkg}"`,
    ...encImports,
    '\t"net/http"',
    '\t"os"',
    '\t"strings"',
    ')',
    '',
    `// ${sc.label} — read the body with io.ReadAll(r.Body) and keep those bytes.`,
    'func verifyWebhook(r *http.Request, raw []byte) bool {',
    '\tsecret := os.Getenv("WEBHOOK_SECRET")',
    key,
    `\theader := r.Header.Get("${titleCase(sc.hdr)}")`,
    ...goFrag(sc, p),
    `\tmac := hmac.New(${hashPkg}.New, key)`,
    '\tmac.Write(base)',
    b64
      ? '\texpected := base64.StdEncoding.EncodeToString(mac.Sum(nil))'
      : '\texpected := hex.EncodeToString(mac.Sum(nil))',
    '\treturn hmac.Equal([]byte(expected), []byte(signature))',
    '}',
  ].join('\n');
}

/** Copy-paste verification code for the Security tab. */
export function recipe(provider, lang) {
  const p = SCHEMES[provider] ? provider : 'hex';
  const sc = SCHEMES[p];
  if (lang === 'python') return pyRecipe(sc, p);
  if (lang === 'php') return phpRecipe(sc, p);
  if (lang === 'go') return goRecipe(sc, p);
  return nodeRecipe(sc, p);
}

