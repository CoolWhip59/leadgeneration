import { Injectable } from '@nestjs/common';
import { fetch } from 'undici';
import { WebsiteCheckStatus } from '@prisma/client';

const SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
]);

@Injectable()
export class WebsiteCheckService {
  isSocialOnly(url?: string | null) {
    if (!url) return false;
    try {
      const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
      return SOCIAL_DOMAINS.has(hostname);
    } catch {
      return false;
    }
  }

  async checkWebsite(url?: string | null) {
    if (!url) {
      return { status: WebsiteCheckStatus.NO_WEBSITE };
    }

    if (this.isSocialOnly(url)) {
      return { status: WebsiteCheckStatus.SOCIAL_ONLY };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const started = Date.now();

    try {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (response.status === 405) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
        });
      }

      const duration = Date.now() - started;
      clearTimeout(timeout);

      if (response.status >= 400) {
        return {
          status: WebsiteCheckStatus.HTTP_ERROR,
          httpStatus: response.status,
          responseMs: duration,
        };
      }

      return {
        status: WebsiteCheckStatus.OK,
        httpStatus: response.status,
        responseMs: duration,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (String(error).includes('AbortError')) {
        return { status: WebsiteCheckStatus.TIMEOUT };
      }

      return { status: WebsiteCheckStatus.HTTP_ERROR };
    }
  }
}
