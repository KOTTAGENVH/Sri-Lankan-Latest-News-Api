import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  CACHE_OPTIONS,
  CacheOptions,
  MemoryCacheService,
} from './cache.service';

@Global()
@Module({})
export class CacheModule {
  static forRoot(options: CacheOptions = {}): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        { provide: CACHE_OPTIONS, useValue: options },
        MemoryCacheService,
      ],
      exports: [MemoryCacheService],
    };
  }
}