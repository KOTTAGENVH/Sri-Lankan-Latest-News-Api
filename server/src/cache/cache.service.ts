import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';

export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');

export interface CacheOptions {
  max?: number;
  ttl?: number;
  sweepIntervalMs?: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  wrap<T>(key: string, producer: () => Promise<T>, ttl?: number): Promise<T>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class MemoryCacheService implements CacheStore, OnModuleDestroy {
  private readonly store = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly max: number;
  private readonly defaultTtl: number;
  private readonly sweeper?: ReturnType<typeof setInterval>;

  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(@Optional() @Inject(CACHE_OPTIONS) options: CacheOptions = {}) {
    this.max = options.max ?? 2000;
    this.defaultTtl = options.ttl ?? 60_000;

    const interval = options.sweepIntervalMs ?? 60_000;
    if (interval > 0) {
      this.sweeper = setInterval(() => this.sweep(), interval);
      this.sweeper.unref?.();
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const lifetime = ttl ?? this.defaultTtl;

    if (lifetime <= 0) {
      this.store.delete(key);
      return;
    }

    const expiresAt = Number.isFinite(lifetime)
      ? Date.now() + lifetime
      : Infinity;

    this.store.delete(key);
    this.store.set(key, { value, expiresAt });
    this.evictOverflow();
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async wrap<T>(
    key: string,
    producer: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const run = (async () => {
      const value = await producer();
      if (value !== undefined && value !== null) {
        await this.set(key, value, ttl);
      }
      return value;
    })().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, run);
    return run;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      max: this.max,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(4)),
      inflight: this.inflight.size,
    };
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.clear();
  }

  private evictOverflow(): void {
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
      this.evictions++;
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}
