import { Injectable, Logger } from '@nestjs/common';
import type { CompanyReviewDto } from '@joblog/types';

import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import {
  extractCompanyCandidates,
  isCacheFresh,
  parseRatingSummary,
  searchUrl,
} from './jobplanet';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private firecrawl: FirecrawlService,
  ) {}

  /** 회사명 정규화: 법인 접미사·여분 공백 제거 (spec 6.1) */
  normalize(name: string): string {
    return (name ?? '')
      .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 기업 후기 조회 (M4, best-effort).
   * 정규화 → 캐시(7일) → Firecrawl 검색·회사 페이지 수집 → 평점/요약 파싱.
   * 후보가 모호(0/복수)하거나 수집 실패면 저장하지 않고 검색 딥링크만 반환한다 (spec 6.1).
   * 전체 후기 본문은 수집·저장하지 않는다.
   */
  async getReviews(nameRaw: string): Promise<CompanyReviewDto> {
    const name = this.normalize(nameRaw);
    const deepLink = searchUrl(name);
    if (!name) {
      return { companyName: name, rating: null, summary: null, sourceUrl: deepLink };
    }

    // 1) 캐시 (정규화 키 기준)
    const cached = await this.prisma.companyReview.findUnique({
      where: { companyName: name },
    });
    if (cached && isCacheFresh(cached.fetchedAt.getTime(), Date.now())) {
      return {
        companyName: name,
        rating: cached.rating,
        summary: cached.summary,
        sourceUrl: cached.sourceUrl ?? deepLink,
      };
    }

    // 2) 수집 비활성이면 딥링크만
    if (!this.firecrawl.enabled) {
      return { companyName: name, rating: null, summary: null, sourceUrl: deepLink };
    }

    // 3) best-effort 수집
    try {
      const searchMd = await this.firecrawl.scrape(deepLink);
      const candidates = searchMd ? extractCompanyCandidates(searchMd) : [];
      // 모호하면(0개/복수) 자신 있게 틀린 정보 대신 딥링크
      if (candidates.length !== 1) {
        return { companyName: name, rating: null, summary: null, sourceUrl: deepLink };
      }

      const companyUrl = candidates[0].url;
      const pageMd = await this.firecrawl.scrape(companyUrl);
      const { rating, summary } = pageMd
        ? parseRatingSummary(pageMd)
        : { rating: null, summary: null };

      const saved = await this.prisma.companyReview.upsert({
        where: { companyName: name },
        update: { rating, summary, sourceUrl: companyUrl, fetchedAt: new Date() },
        create: { companyName: name, rating, summary, sourceUrl: companyUrl },
      });
      return {
        companyName: name,
        rating: saved.rating,
        summary: saved.summary,
        sourceUrl: saved.sourceUrl ?? deepLink,
      };
    } catch (e) {
      this.logger.warn(`jobplanet 수집 실패 (${name}): ${String(e)}`);
      return { companyName: name, rating: null, summary: null, sourceUrl: deepLink };
    }
  }
}
