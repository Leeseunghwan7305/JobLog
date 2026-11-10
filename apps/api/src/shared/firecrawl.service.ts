import { Injectable, Logger } from '@nestjs/common';

/** 공고 링크 → 본문 텍스트. 키가 없거나 실패하면 null (→ 붙여넣기 폴백) */
@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);

  get enabled(): boolean {
    return !!process.env.FIRECRAWL_API_KEY;
  }

  async scrape(
    url: string,
    opts?: { waitFor?: number },
  ): Promise<string | null> {
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
          // JS 렌더가 필요한 페이지(잡플래닛 검색 결과 등)는 waitFor로 대기
          ...(opts?.waitFor ? { waitFor: opts.waitFor } : {}),
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Firecrawl ${res.status} for ${url}`);
        return null;
      }
      const json = (await res.json()) as {
        data?: {
          markdown?: string;
          metadata?: { title?: string; ogTitle?: string };
        };
      };
      const md = json.data?.markdown;
      if (!md) return null;
      // onlyMainContent가 헤더의 직무 제목(H1)을 잘라내는 사이트가 있다(ATS형
      // 자체 채용 페이지 등). 페이지 타이틀을 맨 앞 H1로 복원해, LLM이 직무명을
      // 본문의 캠페인 배너 문구와 혼동하지 않게 한다. 이미 앞부분에 있으면 생략.
      const title = (
        json.data?.metadata?.ogTitle ??
        json.data?.metadata?.title ??
        ''
      ).trim();
      return title && !md.slice(0, 200).includes(title) ? `# ${title}\n\n${md}` : md;
    } catch (e) {
      this.logger.warn(`Firecrawl failed: ${String(e)}`);
      return null;
    }
  }
}
