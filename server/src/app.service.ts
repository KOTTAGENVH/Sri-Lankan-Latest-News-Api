import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'Latest Sri Lanka News is up and running! (No updates scheduled as of now) update_status=0 | Note: The Deshaya source is currently unavailable because deshaya.lk is blocking external requests at their firewall. This is an issue on their website, not this API all other sources are working normally.';
  }
}
