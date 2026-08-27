import { Inject, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { safeUrl, cleanField } from '../helper/fieldCleaner';
import { createHash } from 'crypto';
import { clampPage, clampSection } from '../helper/pagination';

import {
  BBCSinhalaArticle,
  Cvss,
  IRDItem,
  LankadeepaArticle,
  Severity,
  VulnItem,
  SourceMeta,
} from './interfaces';

@Injectable()
export class LatestNewsService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  //urls
  private readonly ird_site = 'https://www.ird.gov.lk';
  private readonly kev_primary =
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
  private readonly kev_mirror =
    'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json';
  private readonly euvd = 'https://euvdservices.enisa.europa.eu';
  private readonly nvd = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  private readonly un = 'https://news.un.org';
  private readonly un_feeds = {
    all: '/feed/subscribe/en/news/all/rss.xml',
    africa: '/feed/subscribe/en/news/region/africa/feed/rss.xml',
    americas: '/feed/subscribe/en/news/region/americas/feed/rss.xml',
    asia: '/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml',
    europe: '/feed/subscribe/en/news/region/europe/feed/rss.xml',
    'middle-east': '/feed/subscribe/en/news/region/middle-east/feed/rss.xml',
  } as const;
  private readonly wikiVoyage = 'https://en.wikivoyage.org';
  private readonly wm_ua =
    'SriLankanLatestNewsApi/1.0 (https://github.com/KOTTAGENVH/Sri-Lankan-Latest-News-Api; https://www.nowenkottage.com/contactus)';
  private wikiDayPage(d = new Date()): string {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `Portal:Current_events/${d.getUTCFullYear()}_${months[d.getUTCMonth()]}_${d.getUTCDate()}`;
  }
  private readonly LEGAL = 'https://www.nowenkottage.com/legal';

  //Helpers
  private static readonly SOURCE_META: { [key: string]: SourceMeta } = {
    adaderana: {
      name: 'Ada Derana',
      url: 'https://www.adaderana.lk/',
      method: 'rss',
    },
    newswire: {
      name: 'Newswire',
      url: 'https://www.newswire.lk/',
      method: 'rss',
    },
    bbcSinhala: {
      name: 'BBC News සිංහල',
      url: 'https://www.bbc.com/sinhala',
      method: 'scrape',
    },
    newsFirstTamil: {
      name: 'News 1st Tamil',
      url: 'https://tamil.newsfirst.lk/',
      method: 'scrape',
    },
    lankadeepa: {
      name: 'Lankadeepa',
      url: 'https://www.lankadeepa.lk/',
      method: 'scrape',
    },
    ird: {
      name: 'Inland Revenue Department, Sri Lanka',
      url: 'https://www.ird.gov.lk/',
      method: 'scrape',
    },
    un: {
      name: 'UN News',
      url: 'https://news.un.org/',
      method: 'rss',
    },
    wikievents: {
      name: 'Wikipedia — Portal:Current events',
      url: 'https://en.wikipedia.org/wiki/Portal:Current_events',
      method: 'api',
      license: 'CC BY-SA 4.0',
    },
    wikivoyage: {
      name: 'Wikivoyage',
      url: 'https://en.wikivoyage.org/',
      method: 'api',
      license: 'CC BY-SA 4.0',
    },
    cisa: {
      name: 'CISA Known Exploited Vulnerabilities Catalog',
      url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      method: 'api',
      license: 'U.S. Government work — public domain',
    },
    euvd: {
      name: 'ENISA EU Vulnerability Database',
      url: 'https://euvd.enisa.europa.eu/',
      method: 'api',
    },
    nvd: {
      name: 'NIST National Vulnerability Database',
      url: 'https://nvd.nist.gov/',
      method: 'api',
      license: 'U.S. Government work — public domain',
    },
  };

  private async stampFetch(sourceKey: string) {
    await this.cache.set(
      `fetched-at:${sourceKey}`,
      new Date().toISOString(),
      86_400_000,
    );
  }

  private async fetchWithTimeout(
    url: string,
    timeout = 8000,
    asArrayBuffer = false,
    maxBytes = 5_000_000,
    init?: { method?: string; body?: string; headers?: Record<string, string> },
  ): Promise<string | ArrayBuffer> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: init?.method ?? 'GET',
        body: init?.body,
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,si;q=0.8',
          ...(init?.headers ?? {}),
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `HTTP ${response.status} body for ${url}:`,
          body.slice(0, 800),
        );
        console.error(
          'Response headers:',
          Object.fromEntries(response.headers),
        );
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error(`Response too large: ${declared} bytes`);
      }

      const buf = await this.readWithLimit(response, maxBytes);
      if (asArrayBuffer) return buf as ArrayBuffer;
      const contentType = response.headers.get('content-type') ?? '';
      const charset = contentType.match(/charset=([^\s;]+)/i)?.[1] ?? 'utf-8';

      try {
        return new TextDecoder(charset).decode(buf);
      } catch {
        return new TextDecoder('utf-8').decode(buf);
      }
    } finally {
      clearTimeout(id);
    }
  }

  private async readWithLimit(
    response: Response,
    maxBytes: number,
  ): Promise<ArrayBuffer> {
    const reader = response.body?.getReader();
    if (!reader) {
      const ab = await response.arrayBuffer();
      if (ab.byteLength > maxBytes) throw new Error('Response too large');
      return ab;
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Response exceeded max size');
      }
      chunks.push(value);
    }

    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out.buffer as ArrayBuffer;
  }

  private async fetchJson<T>(
    url: string,
    timeout = 15_000,
    headers?: Record<string, string>,
  ): Promise<T | null> {
    const text = (await this.fetchWithTimeout(url, timeout, false, 25_000_000, {
      headers: { Accept: 'application/json', ...headers },
    })) as string;
    try {
      return JSON.parse(text) as T;
    } catch {
      console.warn(`fetchJson: non JSON response from ${url}`);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private toISO(input?: string | null): string | null {
    if (!input) return null;
    const d = new Date(input); // handles "May 6, 2025, 12:30:24 PM"
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  private splitLines(s?: string | null): string[] {
    return (s ?? '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  //Really Simple Syndication - xml load
  private parseRss(xml: string, base: string) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const out: Array<{
      title: string | null;
      source: string | null;
      description: string | null;
      publishedISO: string | null;
      publisher: string | null;
    }> = [];

    $('item').each((_, el) => {
      const it = $(el);
      out.push({
        title: cleanField(it.find('title').first().text(), 300, {
          typographic: true,
        }),
        source: safeUrl(it.find('link').first().text().trim(), base),
        description: cleanField(
          cheerio.load(it.find('description').first().text()).text(),
          1000,
          { typographic: true },
        ),
        publishedISO: this.toISO(it.find('pubDate').first().text()),
        publisher: cleanField(it.find('source').first().text(), 120) || null,
      });
    });

    if (out.length === 0) {
      $('entry').each((_, el) => {
        const it = $(el);
        out.push({
          title: cleanField(it.find('title').first().text(), 300, {
            typographic: true,
          }),
          source: safeUrl(it.find('link').first().attr('href'), base),
          description: cleanField(it.find('summary').first().text(), 1000, {
            typographic: true,
          }),
          publishedISO: this.toISO(
            it.find('published').first().text() ||
              it.find('updated').first().text(),
          ),
          publisher: null,
        });
      });
    }

    return out.filter((a) => a.title && a.source);
  }

  //for ada derana
  private articleId(href: string | undefined): string | null {
    const m = href?.match(/\/news\/([a-z0-9]{6,})/i);
    return m ? m[1] : null;
  }

  private decodeNextImage(
    src: string | undefined,
    site: string,
    channel: string,
  ): string | null {
    if (!src) return null;
    const raw = src.startsWith('http')
      ? src
      : `${site.replace(/\/$/, '')}${src}`;

    let inner: string | null = null;
    try {
      const u = new URL(raw);
      if (u.pathname === '/_next/image') inner = u.searchParams.get('url');
    } catch (e) {
      console.warn(`${channel}: unparseable image src`, {
        src,
        raw,
        err: String(e),
      });
    }

    return inner ? safeUrl(inner, site) : safeUrl(raw, site);
  }

  private readonly ird_pages = {
    news: `${this.ird_site}/en/sitepages/News%20and%20Notices.aspx`,
    content: `${this.ird_site}/en/sitepages/Latest%20Content%20Listing.aspx`,
  } as const;

  private irdDateToISO(d?: string | null): string | null {
    const m = d?.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!m) return null;
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  private parseIrdTable(html: string): IRDItem[] {
    const $ = cheerio.load(html);
    const items: IRDItem[] = [];
    let current: IRDItem | null = null;

    const flush = () => {
      if (current && (current.title || current.category)) items.push(current);
      current = null;
    };

    $('table.news-table tr').each((_, tr) => {
      const row = $(tr);
      const h5 = row.find('h5').first();

      if (h5.length) {
        flush();
        const badge = h5.find('img').attr('src') ?? '';
        current = {
          category: cleanField(h5.text(), 300, { typographic: true }),
          title: null,
          source: null,
          date: null,
          dateISO: null,
          fileType: null,
          isNew: /Img_New/i.test(badge),
          isUpdated: /Img_Up/i.test(badge),
        };
        return;
      }

      const cur = current;
      if (!cur) return;

      const link = row.find('a[href]').first();
      if (link.length) {
        const href = link.attr('href')?.trim();
        cur.title = cleanField(link.find('p').text() || link.text(), 500, {
          typographic: true,
        });
        cur.source = safeUrl(href ? encodeURI(href) : undefined, this.ird_site);
        cur.fileType =
          href
            ?.match(/\.(pdf|jpe?g|png|gif|docx?|xlsx?)(?:$|\?)/i)?.[1]
            .toLowerCase() ?? 'page';
        return;
      }

      const timeCell = row.find('td.td-ntime').first();
      if (timeCell.length) {
        const d = cleanField(timeCell.text(), 40);
        cur.date = d;
        cur.dateISO = this.irdDateToISO(d);
        flush();
      }
    });

    flush();
    return items;
  }

  private async fetchIrdPage(url: string, page: number): Promise<string> {
    const first = (await this.fetchWithTimeout(url, 12_000)) as string;
    if (page <= 1) return first;

    const $ = cheerio.load(first);
    const form = new URLSearchParams();
    $('input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name');
      if (name) form.set(name, $(el).attr('value') ?? '');
    });

    const pagerInput = $('input[name$="aspNetPager1_input"]').attr('name');
    if (!pagerInput || !form.has('__VIEWSTATE')) {
      console.warn('ird: pager/viewstate not found — falling back to page 1');
      return first;
    }

    form.set('__EVENTTARGET', pagerInput.replace(/_input$/, ''));
    form.set('__EVENTARGUMENT', String(page));
    form.set(pagerInput, String(page));

    return (await this.fetchWithTimeout(url, 15_000, false, 10_000_000, {
      method: 'POST',
      body: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: url,
        Origin: this.ird_site,
      },
    })) as string;
  }

  private async scrapeIrd(
    kind: 'news' | 'content',
    page: number,
  ): Promise<IRDItem[]> {
    const safePage = clampPage(page);
    const key = `latest-news:ird:${kind}:${safePage}`;

    try {
      const cached = await this.cache.get<IRDItem[]>(key);
      if (cached) return cached;

      const html = await this.fetchIrdPage(this.ird_pages[kind], safePage);
      const items = this.parseIrdTable(html);

      if (items.length === 0) {
        console.warn(`ird:${kind}: 0 items parsed — markup may have changed`);
        return [];
      }
      await this.stampFetch('ird');
      await this.cache.set(key, items, 600_000);
      return items;
    } catch (error) {
      console.error(`ird:${kind} scrape error:`, error);
      return [];
    }
  }

  private nvdChain: Promise<unknown> = Promise.resolve();

  private cvssSeverity(score: number): Severity {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    if (score > 0) return 'low';
    return 'none';
  }

  private pickCve(aliases?: string | null): string | null {
    for (const line of this.splitLines(aliases)) {
      const m = line.match(/CVE-\d{4}-\d{4,}/i);
      if (m) return m[0].toUpperCase();
    }
    return null;
  }

  private async kevRaw(): Promise<any[]> {
    const key = 'cyber:kev:raw';
    const cached = await this.cache.get<any[]>(key);
    if (cached) return cached;

    let rows: any[] = [];
    const sources: Array<[string, string]> = [
      ['cisa.gov', this.kev_primary],
      ['github-mirror', this.kev_mirror],
    ];

    for (const [label, url] of sources) {
      try {
        const data = await this.fetchJson<{ vulnerabilities?: any[] }>(
          url,
          25_000,
        );
        if (data && data.vulnerabilities && data.vulnerabilities.length) {
          rows = data.vulnerabilities;
          if (label !== 'cisa.gov') {
            console.warn('kev: served from GitHub mirror');
          }
          break;
        }
      } catch (e) {
        console.warn(`kev: ${label} fetch failed`, e);
      }
    }

    if (rows.length) {
      await this.cache.set(key, rows, 3_600_000);
      await this.stampFetch('cisa');
    }
    return rows;
  }

  private kevToVuln(v: any): VulnItem {
    return {
      id: v.cveID,
      cveId: v.cveID ?? null,
      euvdId: null,
      title: cleanField(v.vulnerabilityName, 300),
      description: cleanField(v.shortDescription, 2000),
      vendor: cleanField(v.vendorProject, 120),
      product: cleanField(v.product, 200),
      cvss: null,
      epss: null,
      knownExploited: true,
      ransomwareUse:
        String(v.knownRansomwareCampaignUse).toLowerCase() === 'known',
      publishedISO: v.dateAdded ? `${v.dateAdded}T00:00:00Z` : null,
      updatedISO: null,
      kevDateAdded: v.dateAdded ?? null,
      kevDueDate: v.dueDate ?? null,
      references: this.splitLines(v.notes).filter((n) => n.startsWith('http')),
      sources: ['cisa-kev'],
      link: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
    };
  }

  private euvdToVuln(v: any): VulnItem {
    const cveId = this.pickCve(v.aliases);
    const score = Number(v.baseScore);
    const hasScore = Number.isFinite(score) && score > 0;

    const cvss: Cvss | null = hasScore
      ? {
          score,
          version: v.baseScoreVersion ?? null,
          vector: v.baseScoreVector ?? null,
          severity: this.cvssSeverity(score),
        }
      : null;

    const vendorName =
      v.enisaIdVendor && v.enisaIdVendor[0] && v.enisaIdVendor[0].vendor
        ? v.enisaIdVendor[0].vendor.name
        : null;
    const productName =
      v.enisaIdProduct && v.enisaIdProduct[0] && v.enisaIdProduct[0].product
        ? v.enisaIdProduct[0].product.name
        : null;

    return {
      id: cveId ?? v.id,
      cveId,
      euvdId: v.id ?? null,
      title: null,
      description: cleanField(v.description, 2000, { typographic: true }),
      vendor: cleanField(vendorName, 120),
      product: cleanField(productName, 200),
      cvss,
      epss: Number.isFinite(Number(v.epss)) ? Number(v.epss) : null,
      knownExploited: v.exploitedSince != null || v.exploited === true,
      ransomwareUse: false,
      publishedISO: this.toISO(v.datePublished),
      updatedISO: this.toISO(v.dateUpdated),
      kevDateAdded: null,
      kevDueDate: null,
      references: this.splitLines(v.references),
      sources: ['euvd'],
      link: `https://euvd.enisa.europa.eu/vulnerability/${v.id}`,
    };
  }

  private async euvdCall(path: string, ttl: number): Promise<VulnItem[]> {
    const key = path.startsWith('/api/search')
      ? `cyber:euvd:search:${createHash('sha1').update(path).digest('hex')}`
      : `cyber:euvd:${path}`;
    try {
      const cached = await this.cache.get<VulnItem[]>(key);
      if (cached) return cached;

      const raw = await this.fetchJson<any>(`${this.euvd}${path}`, 20_000);
      const rows: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const out = rows.map((r) => this.euvdToVuln(r));

      if (out.length) {
        await this.cache.set(key, out, ttl);
        await this.stampFetch('euvd');
      }
      return out;
    } catch (error) {
      console.error(`euvd ${path} error:`, error);
      return [];
    }
  }

  private nvdQueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.nvdChain.then(() => fn());
    const hold = () => this.sleep(6500);
    this.nvdChain = run.then(hold, hold);
    return run;
  }

  private mergeVuln(a: VulnItem, b: VulnItem): VulnItem {
    const refs = new Set([...a.references, ...b.references]);
    const srcs = new Set([...a.sources, ...b.sources]);
    return {
      ...a,
      title: a.title ?? b.title,
      description: a.description ?? b.description,
      vendor: a.vendor ?? b.vendor,
      product: a.product ?? b.product,
      cvss: a.cvss ?? b.cvss,
      epss: a.epss ?? b.epss,
      euvdId: a.euvdId ?? b.euvdId,
      knownExploited: a.knownExploited || b.knownExploited,
      ransomwareUse: a.ransomwareUse || b.ransomwareUse,
      publishedISO: a.publishedISO ?? b.publishedISO,
      updatedISO: a.updatedISO ?? b.updatedISO,
      kevDateAdded: a.kevDateAdded ?? b.kevDateAdded,
      kevDueDate: a.kevDueDate ?? b.kevDueDate,
      references: [...refs],
      sources: [...srcs],
    };
  }

  /*=============================================End of helpers===========================================================*/

  async attribution(sourceKey: string) {
    const m = LatestNewsService.SOURCE_META[sourceKey];
    if (!m) return null;

    const retrievedAt =
      (await this.cache.get<string>(`fetched-at:${sourceKey}`)) ?? null;

    return {
      source: m.name,
      sourceUrl: m.url,
      retrievalMethod: m.method,
      retrievedAt,
      license: m.license ?? 'All rights reserved by the original publisher',
      notice:
        `Headlines and excerpts are the property of ${m.name} and are ` +
        `reproduced here with attribution and a link to the original. ` +
        `This API claims no ownership of the content.`,
      legal: this.LEGAL,
    };
  }

  async currentWikiEvents(date?: string) {
    const d = date ? new Date(`${date}T00:00:00Z`) : new Date();
    if (Number.isNaN(d.getTime())) return [];

    const page = this.wikiDayPage(d);
    const key = `latest-news:wikievents:${page}`;

    try {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const url =
        `https://en.wikipedia.org/w/api.php?action=parse&format=json` +
        `&prop=text&formatversion=2&page=${encodeURIComponent(page)}`;

      const data = await this.fetchJson<any>(url, 15_000, {
        'User-Agent': this.wm_ua,
      });
      const html = data?.parse?.text;
      if (!html) {
        console.warn(`wikievents: no content for ${page}`);
        return [];
      }

      const $ = cheerio.load(html);
      const sections: Array<{ category: string; events: any[] }> = [];

      $(
        '.current-events-content > p b, .current-events-content > div > p b',
      ).each((_, el) => {
        const heading = $(el);
        const category = cleanField(heading.text(), 120);
        const list = heading.closest('p').next('ul');
        if (!list.length) return;

        const events = list
          .children('li')
          .toArray()
          .map((li) => {
            const item = $(li);
            const refs = item
              .find('a[href^="http"]')
              .toArray()
              .map((a) => $(a).attr('href'))
              .filter(Boolean) as string[];
            return {
              text: cleanField(item.text(), 1000, { typographic: true }),
              references: [...new Set(refs)],
            };
          })
          .filter((e) => e.text);

        if (events.length) sections.push({ category, events });
      });

      const payload = {
        date: d.toISOString().slice(0, 10),
        source: `https://en.wikipedia.org/wiki/${page}`,
        license: 'CC BY-SA 4.0',
        sections,
      };

      if (sections.length === 0) {
        console.warn(
          `wikievents: 0 sections parsed for ${page} - markup changed?`,
        );
        return payload;
      }

      const isToday = payload.date === new Date().toISOString().slice(0, 10);
      await this.stampFetch('wikievents');
      await this.cache.set(key, payload, isToday ? 900_000 : 86_400_000);
      return payload;
    } catch (error) {
      console.error('currentEvents error:', error);
      return {
        date: null,
        source: null,
        license: 'CC BY-SA 4.0',
        sections: [],
      };
    }
  }

  async countryGuide(destination: string) {
    const page = String(destination ?? '')
      .trim()
      .replace(/\s+/g, '_');

    if (!/^[\p{L}\p{N}_()'-]{2,80}$/u.test(page)) return null;

    const key = `latest-news:wikivoyage:${page.toLowerCase()}`;
    try {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const data = await this.fetchJson<any>(
        `${this.wikiVoyage}/api/rest_v1/page/summary/${encodeURIComponent(page)}`,
        12_000,
        { 'User-Agent': this.wm_ua },
      );

      if (!data || !data.title) {
        console.warn(`wikivoyage: no page for ${page}`);
        return null;
      }

      const payload = {
        title: cleanField(data.title, 200),
        description: cleanField(data.extract, 2000, { typographic: true }),
        image: safeUrl(data.thumbnail?.source, this.wikiVoyage),
        source: safeUrl(data.content_urls?.desktop?.page, this.wikiVoyage),
        canonical: data.titles?.canonical ?? null,
        license: 'CC BY-SA 4.0',
        attribution: 'Wikivoyage contributors',
        sourceName: 'Wikivoyage',
      };

      await this.stampFetch('wikivoyage');
      await this.cache.set(key, payload, 86_400_000);
      return payload;
    } catch (error) {
      console.error(`countryGuide(${destination}) error:`, error);
      return null;
    }
  }

  async latestUnNews(region: keyof typeof this.un_feeds = 'all') {
    const key = `latest-news:un:${region}`;
    try {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const xml = (await this.fetchWithTimeout(
        `${this.un}${this.un_feeds[region]}`,
        12_000,
        false,
        5_000_000,
        { headers: { Accept: 'application/rss+xml, application/xml' } },
      )) as string;

      const items = this.parseRss(xml, this.un).map((a) => ({
        ...a,
        sourceName: 'UN News',
        sourceType: 'un' as const,
      }));

      if (items.length === 0) {
        console.warn(`un:${region}: 0 items parsed`);
        return [];
      }
      await this.stampFetch('un');
      await this.cache.set(key, items, 600_000); // 10 min
      return items;
    } catch (error) {
      console.error(`latestUnNews(${region}) error:`, error);
      return [];
    }
  }

  async latestIrdNotices(page = 1): Promise<IRDItem[]> {
    return this.scrapeIrd('news', page);
  }

  async latestIrdContent(page = 1): Promise<IRDItem[]> {
    return this.scrapeIrd('content', page);
  }

  async latestKev(limit = 50): Promise<VulnItem[]> {
    try {
      const rows = await this.kevRaw();
      const capped = Math.min(Math.max(limit, 1), 500);
      return rows
        .slice()
        .sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)))
        .slice(0, capped)
        .map((v) => this.kevToVuln(v));
    } catch (error) {
      console.error('latestKev error:', error);
      return [];
    }
  }

  async latestEuvd(
    type: 'latest' | 'critical' | 'exploited',
  ): Promise<VulnItem[]> {
    if (type === 'critical') {
      return this.euvdCall('/api/criticalvulnerabilities', 1_800_000);
    }
    if (type === 'exploited') {
      return this.euvdCall('/api/exploitedvulnerabilities', 1_800_000);
    }
    return this.euvdCall('/api/lastvulnerabilities', 900_000);
  }

  async searchEuvd(opts: {
    text?: string;
    vendor?: string;
    product?: string;
    fromScore?: number;
    toScore?: number;
    fromDate?: string;
    exploited?: boolean;
    size?: number;
  }): Promise<VulnItem[]> {
    const qs = new URLSearchParams();

    for (const [k, v] of Object.entries(opts)) {
      if (v === undefined || v === null || v === '') continue;

      if (typeof v === 'number') {
        if (!Number.isFinite(v)) continue;
        qs.set(k, String(v));
        continue;
      }

      qs.set(k, String(v).slice(0, 200));
    }

    return this.euvdCall(`/api/search?${qs.toString()}`, 600_000);
  }

  async nvdCvss(cveId: string): Promise<{
    cveId: string;
    cvss: Cvss | null;
    description: string | null;
    link: string;
  } | null> {
    if (!/^CVE-\d{4}-\d{4,}$/i.test(cveId)) return null;
    const key = `cyber:nvd:${cveId.toUpperCase()}`;
    const cached = await this.cache.get<{
      cveId: string;
      cvss: Cvss | null;
      description: string | null;
      link: string;
    }>(key);
    if (cached) return cached;

    const result = await this.nvdQueue(async () => {
      try {
        const data = await this.fetchJson<any>(
          `${this.nvd}?cveId=${encodeURIComponent(cveId)}`,
          8_000,
        );

        const cve =
          data && data.vulnerabilities && data.vulnerabilities[0]
            ? data.vulnerabilities[0].cve
            : null;
        if (!cve) return { cvss: null, description: null };

        const m = cve.metrics ?? {};
        const entry =
          (m.cvssMetricV40 && m.cvssMetricV40[0]) ||
          (m.cvssMetricV31 && m.cvssMetricV31[0]) ||
          (m.cvssMetricV30 && m.cvssMetricV30[0]) ||
          (m.cvssMetricV2 && m.cvssMetricV2[0]);
        const d = entry ? entry.cvssData : null;

        const en = (cve.descriptions ?? []).find((x: any) => x.lang === 'en');

        return {
          cvss: d
            ? {
                score: d.baseScore,
                version: d.version ?? null,
                vector: d.vectorString ?? null,
                severity: this.cvssSeverity(d.baseScore),
              }
            : null,
          description: cleanField(en ? en.value : null, 2000),
        };
      } catch (e) {
        console.warn(`nvd: ${cveId} lookup failed`, e);
        return { cvss: null, description: null };
      }
    });

    const upper = cveId.toUpperCase();
    const payload = {
      cveId: upper,
      cvss: result.cvss,
      description: result.description,
      link: `https://nvd.nist.gov/vuln/detail/${upper}`,
    };

    const ttl = result.cvss || result.description ? 86_400_000 : 120_000;
    await this.cache.set(key, payload, ttl);
    await this.stampFetch('nvd');
    return payload;
  }

  async latestVulnFeed(limit = 40): Promise<VulnItem[]> {
    const key = `cyber:vulnfeed:${limit}`;
    try {
      const cached = await this.cache.get<VulnItem[]>(key);
      if (cached) return cached;

      const [kev, crit, last] = await Promise.all([
        this.latestKev(limit),
        this.latestEuvd('critical'),
        this.latestEuvd('latest'),
      ]);

      const byCve = new Map<string, VulnItem>();
      for (const item of [...kev, ...crit, ...last]) {
        const k = (item.cveId ?? item.id).toUpperCase();
        const prev = byCve.get(k);
        byCve.set(k, prev ? this.mergeVuln(prev, item) : item);
      }
      const items = [...byCve.values()];

      items.sort((a, b) => {
        if (a.knownExploited !== b.knownExploited) {
          return a.knownExploited ? -1 : 1;
        }
        const sa = a.cvss ? a.cvss.score : 0;
        const sb = b.cvss ? b.cvss.score : 0;
        return sb - sa;
      });

      const out = items.slice(0, limit);
      if (out.length) await this.cache.set(key, out, 900_000);
      return out;
    } catch (error) {
      console.error('latestVulnFeed error:', error);
      return [];
    }
  }

  async vulnStats(): Promise<{
    generatedAt: string;
    total: number;
    knownExploited: number;
    ransomwareLinked: number;
    bySeverity: { [k: string]: number };
    sources: string[];
  }> {
    try {
      const items = await this.latestVulnFeed(200);
      const bySeverity: { [k: string]: number } = {};
      const sources = new Set<string>();
      let knownExploited = 0;
      let ransomwareLinked = 0;

      for (const i of items) {
        const sev = i.cvss ? i.cvss.severity : 'none';
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
        if (i.knownExploited) knownExploited++;
        if (i.ransomwareUse) ransomwareLinked++;
        for (const s of i.sources) sources.add(s);
      }

      return {
        generatedAt: new Date().toISOString(),
        total: items.length,
        knownExploited,
        ransomwareLinked,
        bySeverity,
        sources: [...sources],
      };
    } catch (error) {
      console.error('vulnStats error:', error);
      return {
        generatedAt: new Date().toISOString(),
        total: 0,
        knownExploited: 0,
        ransomwareLinked: 0,
        bySeverity: {},
        sources: [],
      };
    }
  }

  async latestLankadeepa(
    page: number,
    section?: number,
  ): Promise<LankadeepaArticle[]> {
    try {
      const safePage = clampPage(page);
      const safeSection = clampSection(section);

      const key = `latest-news:lankadeepa:${safePage}:${safeSection ?? ''}`;
      const cached = await this.cache.get<LankadeepaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const site = 'https://www.lankadeepa.lk';
      const url = safeSection
        ? `${site}/latest_news/${safePage}/${safeSection}`
        : `${site}/latest_news/${safePage}`;

      const html = (await this.fetchWithTimeout(url)) as string;
      const $ = cheerio.load(html);

      const articles_lead = $(
        'section.category-page div.row article.cat-lead-story',
      );
      const articles_list = $(
        'section.category-page div.cat-list article.cat-list-item',
      );

      const articles_trending = $('section.middle-east-block article');

      if (
        articles_lead.length === 0 &&
        articles_list.length === 0 &&
        articles_trending.length === 0
      ) {
        return [];
      }

      const result: LankadeepaArticle[] = [];

      articles_lead.each((_, article) => {
        const el = $(article);
        result.push({
          source: safeUrl(el.find('a').attr('href'), site),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            site,
          ),
          title: cleanField(el.find('h2.cat-lead-title').text(), 300),
          description: cleanField(el.find('p.cat-lead-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      articles_list.each((_, article) => {
        const el = $(article);

        result.push({
          source: safeUrl(el.find('a').attr('href'), site),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            site,
          ),
          title: cleanField(el.find('h3.cat-item-title').text(), 300),
          description: cleanField(el.find('p.cat-item-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      articles_trending.each((_, article) => {
        const el = $(article);

        result.push({
          source: safeUrl(el.find('a').attr('href'), site),
          image: safeUrl(
            el.find('img').attr('src') || el.find('img').attr('data-src'),
            site,
          ),
          title: cleanField(
            el.find('h3.me-feature-title').text() ||
              el.find('h4.me-item-title').text(),
            300,
          ),
          description: cleanField(el.find('p.me-feature-teaser').text(), 1000),
          time: cleanField(el.find('.story-meta span').text(), 100),
        });
      });

      if (result.length === 0 || !result) {
        return [];
      }
      await this.stampFetch('lankadeepa');
      await this.cache.set(key, result, 60_000); // 60 seconds
      return result;
    } catch (error) {
      console.error('latestLankadeepa error:', error);
      return [];
    }
  }

  async latestBBCSinhala(page: number): Promise<BBCSinhalaArticle[]> {
    try {
      const safePage = clampPage(page);
      const key = `latest-news:bbcSinhala:${safePage}`;
      const cached = await this.cache.get<BBCSinhalaArticle[]>(key);
      if (cached) {
        return cached;
      }

      const bbc = 'https://www.bbc.com';
      const html = (await this.fetchWithTimeout(
        `${bbc}/sinhala/topics/cg7267dz901t?page=${safePage}`,
      )) as string;
      const $ = cheerio.load(html);

      const nextDataRaw = $('#__NEXT_DATA__').html();
      if (!nextDataRaw) {
        console.warn('BBC Sinhala: __NEXT_DATA__ not found');
        return [];
      }

      let nextData: any;
      try {
        nextData = JSON.parse(nextDataRaw);
      } catch {
        console.warn('BBC Sinhala: failed to parse __NEXT_DATA__');
        return [];
      }

      const pageData = nextData?.props?.pageProps?.pageData;
      if (!pageData) {
        console.warn('BBC Sinhala: pageData missing');
        return [];
      }

      const news: BBCSinhalaArticle[] = [];

      const curations = pageData?.curations ?? [];

      for (const curation of curations) {
        const summaries = curation?.summaries ?? [];

        for (const item of summaries) {
          if (item.type !== 'article') continue;

          const title = cleanField(item?.title, 300);
          const source = safeUrl(item?.link, bbc);
          const image = item?.imageUrl
            ? safeUrl(String(item.imageUrl).replace('{width}', '640'), bbc)
            : null;
          const dateISO = cleanField(item?.firstPublished, 40) || null;

          if (title && source) {
            news.push({ title, source, image, dateISO });
          }
        }
      }

      if (news.length === 0) {
        console.warn('bbcSinhala: 0 articles parsed');
        return news;
      }
      await this.stampFetch('bbcSinhala');
      await this.cache.set(key, news, 60_000);
      return news;
    } catch (error) {
      console.error('BBC Sinhala scrape error:', error);
      return [];
    }
  }

  async latestNewsFirstTamil() {
    try {
      const key = `latest-news:newsFirstTamil`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const site = 'https://tamil.newsfirst.lk';
      const html = (await this.fetchWithTimeout(`${site}/`)) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const breaking = [];
      const breaking_latest = [];
      const archive = [];

      $('.latest_news_main_div').each((_, el) => {
        const item = $(el);
        latest.push({
          title: cleanField(item.find('h4.sub_news_title').text(), 300),
          source: safeUrl(item.find('a').attr('href'), site),
          image: safeUrl(item.find('img.latest_news_img').attr('src'), site),
          description: cleanField(
            item.find('p.latest_news_detail').text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });
      $(
        '.main_div.top_stories > .ng-star-inserted > a, .top_stories_sub_news a',
      ).each((_, el) => {
        const item = $(el);

        breaking_latest.push({
          title: cleanField(
            item
              .find('h1.top_stories_header, h2.top_stories_sub_title')
              .first()
              .text(),
            300,
          ),

          source: safeUrl(item.attr('href'), site),
          image: safeUrl(
            item.find('img.top_stories_img, img.sub_img').attr('src'),
            site,
          ),

          description: cleanField(
            item
              .find('.top_stories_details, .top_stories_sub_title_detail')
              .first()
              .text(),
            1000,
          ),

          date: cleanField(item.find('.time_date').first().text(), 100),
        });
      });

      $('.top_stories_main a, .top_stories_sub_news a').each((_, el) => {
        const item = $(el);
        breaking.push({
          title: cleanField(
            item.find('h1, h2.top_stories_sub_title').first().text(),
            300,
          ),
          source: safeUrl(item.attr('href'), site),
          image: safeUrl(item.find('img').attr('src'), site),
          description: cleanField(
            item
              .find('.top_stories_details, .top_stories_sub_title_detail')
              .text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });

      $('.featured_news_main a').each((_, el) => {
        const item = $(el);
        archive.push({
          title: cleanField(item.find('h4.sub_news_title').text(), 300),
          source: safeUrl(item.attr('href'), site),
          image: safeUrl(item.find('img').attr('src'), site),
          description: cleanField(
            item.find('.sub_news_detail_guest').text(),
            1000,
          ),
          date: cleanField(item.find('.time_date').text(), 100),
        });
      });

      const payload = { latest, breaking_latest, breaking, archive };
      const total =
        latest.length +
        breaking_latest.length +
        breaking.length +
        archive.length;
      if (total === 0) {
        console.warn('newsFirstTamil: 0 articles parsed');
        return payload;
      }
      await this.stampFetch('newsFirstTamil');
      await this.cache.set(key, payload, 60_000);

      return payload;
    } catch (error) {
      console.error('latestNewsFirstTamil error:', error);
      return { latest: [], breaking_latest: [], breaking: [], archive: [] };
    }
  }

  async latestNewsWire() {
    try {
      const key = `latest-news:newsWire`;
      const cached = await this.cache.get(key);
      if (cached) {
        return cached;
      }

      const site = 'https://www.newswire.lk';
      const html = (await this.fetchWithTimeout(`${site}/`)) as string;
      const $ = cheerio.load(html);

      const latest = [];
      const lead_story = [];
      const trending = [];
      const moreNews = [];

      $('.content-block').each((_, el) => {
        const item = $(el);
        lead_story.push({
          title: cleanField(item.find('.content-block-title a').text(), 300),
          source: safeUrl(
            item.find('.content-block-title a').attr('href'),
            site,
          ),
          image: safeUrl(
            item.find('.entry-featured-img-wrap img').attr('src'),
            site,
          ),
        });
      });

      $('#hootkit-posts-list-5 .posts-listunit').each((_, el) => {
        const item = $(el);
        latest.push({
          title: cleanField(item.find('.posts-listunit-title a').text(), 300),
          source: safeUrl(
            item.find('.posts-listunit-title a').attr('href'),
            site,
          ),
          image: safeUrl(
            item.find('.posts-listunit-image img').attr('src'),
            site,
          ),
          date: cleanField(item.find('time.entry-published').text(), 100),
          datetime:
            cleanField(
              item.find('time.entry-published').attr('datetime'),
              40,
            ) || null,
        });
      });

      $('#hootkit-posts-grid-1 .post-gridunit').each((_, el) => {
        const item = $(el);
        trending.push({
          title: cleanField(item.find('.post-gridunit-title').text(), 300),
          source: safeUrl(
            item.find('.post-gridunit-title a').attr('href'),
            site,
          ),
          image: safeUrl(item.find('.post-gridunit-img').attr('src'), site),
        });
      });

      $('#super_rss_reader-10 .srr-item').each((_, el) => {
        const item = $(el);

        moreNews.push({
          title: cleanField(item.find('.srr-title a').text(), 300),
          source: safeUrl(item.find('.srr-title a').attr('href'), site),
          image: safeUrl(item.find('.srr-thumb img').attr('src'), site),
          description: cleanField(item.find('.srr-summary p').text(), 1000),
          date: cleanField(item.find('time.srr-date').text(), 100),
          datetime:
            cleanField(item.find('time.srr-date').attr('title'), 80) || null,
        });
      });

      const payload = { lead_story, latest, trending, moreNews };
      const total =
        lead_story.length + latest.length + trending.length + moreNews.length;
      if (total === 0) {
        console.warn('newsWire: 0 articles parsed');
        return payload;
      }
      await this.stampFetch('newswire');
      await this.cache.set(key, payload, 60_000);

      return payload;
    } catch (error) {
      console.error('latestNewsWire error:', error);
      return { lead_story: [], latest: [], trending: [], moreNews: [] };
    }
  }

  async latestAdaDerana() {
    const key = `latest-news:adaDerana`;
    try {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const site = 'https://www.adaderana.lk/';

      const xml = (await this.fetchWithTimeout(
        'https://www.adaderana.lk/rss.xml',
        10_000,
        false,
        5_000_000,
        { headers: { Accept: 'application/rss+xml, application/xml' } },
      )) as string;

      const $x = cheerio.load(xml, { xmlMode: true });
      const feed: any[] = [];

      $x('item').each((_, el) => {
        const it = $x(el);
        const link = it.find('link').first().text().trim();
        const id = this.articleId(link);
        if (!id) return;

        feed.push({
          id,
          title: cleanField(it.find('title').first().text(), 300, {
            typographic: true,
          }),
          source: safeUrl(link, site),
          category: cleanField(it.find('category').first().text(), 60),
          image: null,
          description: null,
          time: null,
          video: false,
        });
      });

      const byId = new Map<string, any>();
      try {
        const html = (await this.fetchWithTimeout(site, 8000)) as string;
        const $ = cheerio.load(html);

        $('a[href^="/news/"]').each((_, el) => {
          const a = $(el);
          const id = this.articleId(a.attr('href'));
          if (!id) return;

          const img = a.find('img').first();
          const item = {
            image: this.decodeNextImage(img.attr('src'), site, 'adaderana'),
            description: cleanField(
              a.find('p[class*="text-grey-summarylight"]').first().text(),
              1000,
              { typographic: true },
            ),
            time: cleanField(
              a.find('span[class*="text-muted-foreground"]').first().text(),
              100,
            ),
            video: a.find('svg').length > 0,
          };

          const prev = byId.get(id);
          const score = (o: any) => (o.description ? 2 : 0) + (o.image ? 1 : 0);
          if (!prev || score(item) > score(prev)) byId.set(id, item);
        });

        if (byId.size === 0) {
          console.warn('adaderana: enrichment matched 0 articles');
        }
      } catch (e) {
        console.warn('adaderana: enrichment failed, serving feed-only', e);
      }

      const all = feed
        .map((a) => {
          const extra = byId.get(a.id);
          return extra ? { ...a, ...extra } : a;
        })
        .filter((a) => a.title && a.source);

      const byCat = (c: string) => all.filter((a) => a.category === c);

      const payload = {
        all,
        lead_story: all.slice(0, 1),
        latest: byCat('latest'),
        sports: byCat('sports'),
        technology: byCat('science-and-tech'),
        entertainment: byCat('entertainment'),
        other: byCat('other'),
      };

      if (all.length === 0) {
        console.warn('adaderana: feed returned 0 items');
        return payload;
      }

      await this.stampFetch('adaderana');
      await this.cache.set(key, payload, 60_000);
      return payload;
    } catch (error) {
      console.error('latestAdaDerana error:', error);
      return {
        all: [],
        lead_story: [],
        latest: [],
        sports: [],
        technology: [],
        entertainment: [],
        other: [],
      };
    }
  }
}
