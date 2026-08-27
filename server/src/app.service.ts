import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'Latest Sri Lanka News API',
      version: 'v1.5',
      updateStatus: 0,
      sources: {
        news: [
          'lankadeepa',
          'bbcSinhala',
          'newswire',
          'adaderana',
          'newsfirst_tamil',
          'un_news',
        ],
        government: ['ird_news', 'ird_content'],
        cyber: ['cisa_kev', 'euvd', 'nvd'],
        reference: ['wikipedia_current_events', 'wikivoyage'],
      },
      changelog: [
        'v1.5 - Added UN News, Wikipedia current events, Wikivoyage guides, and ENISA EUVD. NVD is a standalone single CVE lookup rather than part of the merged vulnerability feed.',
        'v1.4 - Removed the Deshaya source permanently; deshaya.lk blocks external requests at their firewall.',
      ],
      notes: [
        'Vulnerability feed items may have cvss: null when neither CISA KEV nor ENISA EUVD published a score. Use /cyber/nvd/v1/:id to look one up.',
        'In vulnerability stats, bySeverity.none means unscored, not harmless.',
      ],
    };
  }
}
