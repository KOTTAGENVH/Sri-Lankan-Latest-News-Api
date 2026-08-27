import { Severity } from '../latest-news/interfaces';

export function cvssSeverity(score: number): Severity {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

export function toISO(input?: string | null): string | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function splitLines(s?: string | null): string[] {
  return (s ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export const cve_re = /CVE-\d{4}-\d{4,}/i;

export function pickCve(aliases?: string | null): string | null {
  return (
    splitLines(aliases)
      .find((a) => cve_re.test(a))
      ?.toUpperCase() ?? null
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
