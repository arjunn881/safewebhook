/**
 * SSRF Protection Utility — SafeWebhook Edge Security Layer
 * Prevents Server-Side Request Forgery attacks on the replay and workflow engine
 * by blocking requests to private, loopback, and link-local IP ranges.
 */

/** Private/reserved IPv4 CIDR ranges that must never be reached */
const BLOCKED_CIDRS = [
  { base: 0x7f000000, mask: 0xff000000 }, // 127.0.0.0/8  — Loopback
  { base: 0x0a000000, mask: 0xff000000 }, // 10.0.0.0/8   — RFC1918 private
  { base: 0xac100000, mask: 0xfff00000 }, // 172.16.0.0/12 — RFC1918 private
  { base: 0xc0a80000, mask: 0xffff0000 }, // 192.168.0.0/16 — RFC1918 private
  { base: 0xa9fe0000, mask: 0xffff0000 }, // 169.254.0.0/16 — Link-local (APIPA)
  { base: 0xe0000000, mask: 0xf0000000 }, // 224.0.0.0/4  — Multicast
  { base: 0xf0000000, mask: 0xf0000000 }, // 240.0.0.0/4  — Reserved
  { base: 0x00000000, mask: 0xff000000 }, // 0.0.0.0/8    — This network
  { base: 0xc0000200, mask: 0xffffff00 }, // 192.0.2.0/24 — TEST-NET-1
  { base: 0xc6336400, mask: 0xffffff00 }, // 198.51.100.0/24 — TEST-NET-2
  { base: 0xcb007100, mask: 0xffffff00 }, // 203.0.113.0/24 — TEST-NET-3
];

/** Blocked hostnames that could resolve to private addresses */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'corp',
  '0.0.0.0',
  '::1',           // IPv6 loopback
  'fe80::1',       // IPv6 link-local
  'metadata.google.internal', // GCP metadata
  '169.254.169.254',          // AWS/Azure/GCP metadata service IP
  '100.100.100.200',          // Alibaba Cloud metadata
]);

/** Blocked TLDs that typically point to internal services */
const BLOCKED_TLDS = ['.local', '.internal', '.corp', '.lan', '.home', '.arpa'];

/**
 * Parses an IPv4 string into its 32-bit unsigned integer representation
 */
function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // Ensure unsigned
}

/**
 * Checks if an IPv4 address falls within any blocked CIDR range
 */
function isPrivateIPv4(ip: string): boolean {
  const int = ipToInt(ip);
  if (int === null) return false;
  return BLOCKED_CIDRS.some(({ base, mask }) => (int & mask) === base);
}

function ipv6Words(raw: string): number[] | null {
  let value = raw.toLowerCase();
  if (value.includes('.')) {
    const dot = value.lastIndexOf(':');
    if (dot < 0) return null;
    const mapped = ipToInt(value.slice(dot + 1));
    if (mapped === null) return null;
    value = `${value.slice(0, dot)}:${(mapped >>> 16).toString(16)}:${(mapped & 0xffff).toString(16)}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const parse = (part: string) => /^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : null;
  const leftParsed = left.map(parse);
  const rightParsed = right.map(parse);
  if (leftParsed.some((v) => v === null) || rightParsed.some((v) => v === null)) return null;
  const leftWords = leftParsed as number[];
  const rightWords = rightParsed as number[];
  const words = [...leftWords, ...rightWords];
  if (halves.length === 1) return words.length === 8 ? words : null;
  const missing = 8 - words.length;
  return missing > 0 ? [...leftWords, ...new Array(missing).fill(0), ...rightWords] : null;
}

function isPrivateIPv6(raw: string): boolean {
  const words = ipv6Words(raw);
  if (!words) return false;
  if (words.every((word) => word === 0) || (words.slice(0, 7).every((word) => word === 0) && words[7] === 1)) return true;
  if ((words[0] & 0xfe00) === 0xfc00 || (words[0] >= 0xfe80 && words[0] <= 0xfebf) || (words[0] & 0xff00) === 0xff00) return true;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const mapped = `${words[6] >>> 8}.${words[6] & 255}.${words[7] >>> 8}.${words[7] & 255}`;
    return isPrivateIPv4(mapped);
  }
  return false;
}

/**
 * Validates that a URL is safe to fetch without SSRF risk.
 *
 * @returns null if the URL is safe, or an error string explaining the block reason
 */
export function checkSSRF(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL format';
  }

  // 1. Only allow http and https schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Forbidden URL scheme: ${parsed.protocol}. Only http:// and https:// are allowed.`;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');

  // 2. Block explicitly known dangerous hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return `Blocked hostname: "${hostname}" resolves to a private/reserved address.`;
  }

  // 3. Block dangerous TLDs
  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      return `Blocked TLD: "${tld}" is reserved for private/local networks.`;
    }
  }

  // 4. If hostname looks like an IPv4 address, check the CIDR ranges
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return `Blocked IP: ${hostname} falls within a private/reserved IPv4 range.`;
    }
  }

  // 5. Block IPv6 loopback, unspecified, private, link-local, multicast and
  // IPv4-mapped private addresses. URL.hostname includes brackets for IPv6.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const v6 = hostname.slice(1, -1).toLowerCase();
    if (isPrivateIPv6(v6)) {
      return `Blocked IPv6 address: ${v6} is a private/loopback address.`;
    }
  }

  // 6. Reject credentials in URLs (user:pass@host)
  if (parsed.username || parsed.password) {
    return 'URLs with embedded credentials are not allowed.';
  }

  return null; // URL is safe
}

/**
 * Throws an Error if the URL is unsafe (convenience wrapper)
 */
export function assertSafeURL(rawUrl: string): void {
  const reason = checkSSRF(rawUrl);
  if (reason) {
    throw new Error(`SSRF protection blocked request: ${reason}`);
  }
}
