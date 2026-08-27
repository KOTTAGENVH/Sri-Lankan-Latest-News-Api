import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: unknown, b?: string): boolean {
  if (typeof a !== 'string' || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getRequest(context: ExecutionContext) {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext().req;
  }
  return context.switchToHttp().getRequest();
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor() {
    if (!process.env.API_KEY) {
      throw new Error('ApiKeyGuard: API_KEY is not set');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = getRequest(context);
    if (!request) return false;

    const auth = request.headers?.['authorization'];

    const apiKey =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7)
        : auth;

    if (!safeEqual(apiKey, process.env.API_KEY)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

@Injectable()
export class PublicApiGuard implements CanActivate {
  private readonly logger = new Logger(PublicApiGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = getRequest(context);
    if (!request) return false;
    const headers = request.headers ?? {};

    const auth = headers['authorization'];
    const key =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7)
        : auth;

    const isOwner = safeEqual(key, process.env.API_KEY);
    const isRapid =
      safeEqual(key, process.env.RAPIDAPI_KEY) ||
      safeEqual(
        headers['x-rapidapi-proxy-secret'],
        process.env.RAPIDAPI_PROXY_SECRET,
      );

    if (!isOwner && !isRapid) {
      this.logger.warn(
        `Blocked: ${request.method} ${request.originalUrl ?? request.url} ` +
          `ip=${headers['x-forwarded-for'] ?? request.ip}`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiConsumer = isOwner ? 'owner' : 'rapidapi';
    return true;
  }
}
