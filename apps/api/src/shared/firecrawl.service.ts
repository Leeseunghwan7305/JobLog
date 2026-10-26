import { Injectable, Logger } from '@nestjs/common';

/** 공고 링크 → 본문 텍스트. 키가 없거나 실패하면 null (→ 붙여넣기 폴백) */
@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);

  get enabled(): boolean {
    return !!process.env.FIRECRAWL_API_KEY;
  }

  async scrape(url: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Firecrawl ${res.status} for ${url}`);
        return null;
      }
      const json = (await res.json()) as { data?: { markdown?: string } };
      return json.data?.markdown ?? null;
    } catch (e) {
      this.logger.warn(`Firecrawl failed: ${String(e)}`);
      return null;
    }
  }
}
