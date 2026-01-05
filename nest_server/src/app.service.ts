import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'Latest Sri Lanka News is up and running! (No updates scheduled as of now)';
  }
}
