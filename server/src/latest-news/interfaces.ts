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
