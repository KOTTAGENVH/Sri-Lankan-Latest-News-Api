import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Header based auth (Postman / curl)
    const apiKey =
      request.headers['latest-news-api-key'] ||
      request.headers['authorization'];

    // Query parameter based auth (Vercel cron)
    const cronSecret =
      request.query?.cron_secret ?? request.query?.['cron_secret'];
    const isApiKeyValid =
      typeof apiKey === 'string' && apiKey === process.env.API_KEY;
    const isCronKeyValid =
      typeof cronSecret === 'string' && cronSecret === process.env.CRON_SECRET;
    if (!isApiKeyValid && !isCronKeyValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
