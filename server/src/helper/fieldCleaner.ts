export interface SafeUrlOptions {
  allowedHosts?: string[];
  blockPrivate?: boolean;
  maxLen?: number;
}

// NULL, tab, newline, ESC (terminal log injection prevention), DEL and C1 non printing controls
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

//Trojan source prevention
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/g;

// Zero-width invisibles: BOM, ZWSP, soft hyphen, math ops - filter evasion + steganography risk
const INVISIBLES = /[\u00AD\u200B\u2060-\u2064\uFEFF]/g;

const PRIVATE_HOST =
  /^(localhost|0\.0\.0\.0|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc|\[?fd)/i;

export function cleanField(
  raw?: string | null,
  maxLen = 1000,
  opts: { typographic?: boolean } = {},
): string {
  if (raw == null) return '';
  let s = String(raw);
  s = s.normalize('NFC');
  s = s
    .replace(CONTROL_CHARS, ' ')
    .replace(BIDI_CONTROL, '')
    .replace(INVISIBLES, '');
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


export const cleanText = (text = ''): string =>
  normalizeTypography(text).replace(/\s+/g, ' ').trim();

function truncateGraphemes(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const Segmenter = (Intl as any).Segmenter;
  if (typeof Segmenter === 'function') {
    const seg = new Segmenter(undefined, { granularity: 'grapheme' });
    let out = '';
    for (const { segment } of seg.segment(s)) {
      if (out.length + segment.length > maxLen) break;
      out += segment;
    }
    return out;
  }
  return Array.from(s).slice(0, maxLen).join('');
}

export function safeUrl(
  raw?: string | null,
  base?: string,
  opts: SafeUrlOptions = {},
): string | null {
  const { allowedHosts, blockPrivate = false, maxLen = 2048 } = opts;
  try {
    const t = raw?.trim();
    if (!t) return null;

    const u = new URL(t, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (allowedHosts?.length) {
      const host = u.hostname.toLowerCase();
      const ok = allowedHosts.some((h) => {
        const allowed = h.toLowerCase();
        return host === allowed || host.endsWith('.' + allowed);
      });
      if (!ok) return null;
    }

    if (blockPrivate && PRIVATE_HOST.test(u.hostname)) return null;

    const out = u.toString();
    return out.length <= maxLen ? out : null;
  } catch {
    return null;
  }
}