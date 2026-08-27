export interface SafeUrlOptions {
  allowedHosts?: string[];
  blockPrivate?: boolean;
  stripTracking?: boolean;
  rejectPunycode?: boolean;
  maxLen?: number;
}

const control_chars = /[\u0000-\u001F\u007F-\u009F]/g;

// Trojan source prevention
const bidi_control = /[\u202A-\u202E\u2066-\u2069]/g;

// Zero-width invisibles: BOM, ZWSP, soft hyphen, math ops - filter evasion + steganography risk
const invisibles = /[\u00AD\u200B\u2060-\u2064\uFEFF]/g;

const private_host =
  /^(localhost$|0\.0\.0\.0$|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|\[::1\]|\[::\]|\[fc|\[fd|\[fe80)/i;

const tracking_params =
  /^(utm_|fb|ga_|mc_|hsa_|_hs|pk_|mtm_|yclid$|gclid$|dclid$|msclkid$|igshid$|si$|ref$|ref_src$|spm$|scid$|twclid$|ttclid$|wickedid$|_openstat$)/i;

export function cleanField(
  raw?: string | null,
  maxLen = 1000,
  opts: { typographic?: boolean } = {},
): string {
  if (raw == null) return '';
  let s = String(raw);
  s = s.normalize('NFC');
  s = s
    .replace(control_chars, ' ')
    .replace(bidi_control, '')
    .replace(invisibles, '');
  if (opts.typographic) s = normalizeTypography(s);
  s = s.replace(/\s+/g, ' ').trim();
  return truncateGraphemes(s, maxLen);
}

export function normalizeTypography(text = ''): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^\|\s*/, '')
    .trim();
}

function truncateGraphemes(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const Segmenter = (Intl as any).Segmenter;
  if (typeof Segmenter === 'function') {
    const seg = new Segmenter(undefined, { granularity: 'grapheme' });
    let out = '';
    let count = 0;
    for (const { segment } of seg.segment(s)) {
      if (count >= maxLen) return out;
      out += segment;
      count++;
    }
    return out;
  }
  return Array.from(s).slice(0, maxLen).join('');
}

export function stripTracking(u: URL): URL {
  for (const k of [...u.searchParams.keys()]) {
    if (tracking_params.test(k)) u.searchParams.delete(k);
  }
  return u;
}

export function safeUrl(
  raw?: string | null,
  base?: string,
  opts: SafeUrlOptions = {},
): string | null {
  const {
    allowedHosts,
    blockPrivate = true,
    stripTracking: doStrip = false,
    rejectPunycode = false,
    maxLen = 2048,
  } = opts;

  try {
    const t = raw?.trim();
    if (!t) return null;

    const u = new URL(t, base);

    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;

    const host = u.hostname;

    if (rejectPunycode && host.includes('xn--')) return null;
    if (blockPrivate && private_host.test(host)) return null;

    if (allowedHosts?.length) {
      const ok = allowedHosts.some((h) => {
        const allowed = h.toLowerCase();
        return host === allowed || host.endsWith('.' + allowed);
      });
      if (!ok) return null;
    }

    if (doStrip) stripTracking(u);

    const out = u.toString();
    return out.length <= maxLen ? out : null;
  } catch {
    return null;
  }
}
