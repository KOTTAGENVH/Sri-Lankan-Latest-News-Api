import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LatestNewsModule } from './latest-news/latest_news.module';
import { NotFoundFilter } from './not-found-filter';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { HistoryModule } from './history/history.module';
import { CronJobModule } from './cron_job/cron_job.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { CustomThrottlerGuard } from './throtler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }) => ({ req, res }),
      plugins:
        process.env.NODE_ENV === 'production'
          ? [ApolloServerPluginLandingPageDisabled()]
          : [],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const username = encodeURIComponent(config.get<string>('MONGODB_USER'));
        const password = encodeURIComponent(
          config.get<string>('MONGODB_PASSWORD'),
        );
        const cluster = config.get<string>('MONGODB_CLUSTER');
        const dbName = config.get<string>('MONGODB_DBNAME');

        if (!username || !password || !cluster || !dbName) {
          throw new Error('MongoDB env variables missing');
        }

        return {
          uri: `mongodb+srv://${username}:${password}@${cluster}/${dbName}?retryWrites=true&w=majority`,
        };
      },
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // seconds
      max: 100,
      store: 'memory',
    }),
    LatestNewsModule,
    HistoryModule,
    CronJobModule
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: NotFoundFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    AppService,
  ],
})
export class AppModule {}
