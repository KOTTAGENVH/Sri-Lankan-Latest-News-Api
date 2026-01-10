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
    const cronSecret = request.query?.cron_secret;

    const isApiKeyValid =
      apiKey && apiKey === process.env.API_KEY;

    const isCronKeyValid =
      cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!isApiKeyValid && !isCronKeyValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
