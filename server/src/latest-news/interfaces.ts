export interface LankadeepaArticle {
  title: string;
  description?: string;
  source: string | null;
  image?: string | null;
  time?: string;
}

export interface BBCSinhalaArticle {
  title: string;
  source: string | null;
  image?: string | null;
  dateISO?: string;
}

export interface DeshayaArticle {
  title: string;
  description?: string;
  source: string | null;
  time?: string;
}

export interface IRDItem {
  category: string | null;
  title: string | null;
  source: string | null;
  date: string | null;
  dateISO: string | null;
  fileType: string | null;
  isNew: boolean;
  isUpdated: boolean;
}

export type Severity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface Cvss {
  score: number;
  version: string | null;
  vector: string | null;
  severity: Severity;
}

export interface VulnItem {
  id: string;
  cveId: string | null;
  euvdId: string | null;
  title: string | null;
  description: string | null;
  vendor: string | null;
  product: string | null;
  cvss: Cvss | null;
  epss: number | null;
  knownExploited: boolean;
  ransomwareUse: boolean;
  publishedISO: string | null;
  updatedISO: string | null;
  kevDateAdded: string | null;
  kevDueDate: string | null;
  references: string[];
  sources: string[];
  link: string;
}

export type UnRegion =
  'all' | 'africa' | 'americas' | 'asia-pacific' | 'europe' | 'middle-east';

export const UN_REGIONS: UnRegion[] = [
  'all',
  'africa',
  'americas',
  'asia-pacific',
  'europe',
  'middle-east',
];

export interface FeedArticle {
  title: string | null;
  source: string | null;
  description: string | null;
  publishedISO: string | null;
  publisher: string | null;
  sourceName: string;
  sourceType: 'un' | 'wiki' | 'media' | 'ngo' | 'official';
}

export interface SourceMeta {
  name: string;
  url: string;
  method: 'rss' | 'api' | 'scrape';
  license?: string;
}