import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'Latest Sri Lanka News is up and running! V2.2 (Update Scheduled for 31/05/2025) update_status=1 | Note: The Deshaya source is currently unavailable because deshaya.lk is blocking external requests at their firewall. This is an issue on their website, not this API all other sources are working normally.';
  }
}
