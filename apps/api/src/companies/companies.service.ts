import type { CompanyProfileDto, CompanyReviewDto } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import {
  extractCompanyCandidates,
  isCacheFresh,
  parseRatingSummary,
  pickCandidate,
  SCRAPE_WAIT_MS,
  searchUrl,
} from './jobplanet';
import { buildLinks } from './nps';
import { NpsService } from './nps.service';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private firecrawl: FirecrawlService,
    private nps: NpsService,
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
   * 정규화 → 캐시(7일) → 잡플래닛 검색(waitFor) → 이름 일치 후보 선택 → 회사 페이지 평점 파싱.
   * 이름 일치 후보가 없거나 수집/파싱 실패면 저장하지 않고 검색 딥링크만 반환 (spec 6.1).
   */
  async getReviews(nameRaw: string): Promise<CompanyReviewDto> {
    const name = this.normalize(nameRaw);
    const deepLink = searchUrl(name);
    const fallback: CompanyReviewDto = {
      companyName: name,
      rating: null,
      summary: null,
      sourceUrl: deepLink,
    };
    if (!name) return fallback;

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
    if (!this.firecrawl.enabled) return fallback;

    // 3) best-effort 수집
    try {
      const searchMd = await this.firecrawl.scrape(deepLink, {
        waitFor: SCRAPE_WAIT_MS,
      });
      const candidates = searchMd ? extractCompanyCandidates(searchMd) : [];
      const match = pickCandidate(candidates, name, (s) => this.normalize(s));
      // 이름 일치 후보 없음 → 자신 있게 틀린 정보 대신 딥링크
      if (!match) return fallback;

      const pageMd = await this.firecrawl.scrape(match.url, {
        waitFor: SCRAPE_WAIT_MS,
      });
      const { rating, summary } = pageMd
        ? parseRatingSummary(pageMd)
        : { rating: null, summary: null };

      const saved = await this.prisma.companyReview.upsert({
        where: { companyName: name },
        update: {
          rating,
          summary,
          sourceUrl: match.url,
          fetchedAt: new Date(),
        },
        create: { companyName: name, rating, summary, sourceUrl: match.url },
      });
      return {
        companyName: name,
        rating: saved.rating,
        summary: saved.summary,
        sourceUrl: saved.sourceUrl ?? deepLink,
      };
    } catch (e) {
      this.logger.warn(`jobplanet 수집 실패 (${name}): ${String(e)}`);
      return fallback;
    }
  }

  /** 회사 통합 프로필: 국민연금 지표(캐시 7일) + 잡플래닛 후기 + 바로가기. */
  async getProfile(nameRaw: string): Promise<CompanyProfileDto> {
    const name = this.normalize(nameRaw);
    const links = buildLinks(name || nameRaw);
    if (!name) {
      return { companyName: name, nps: null, review: null, links };
    }

    // 1) 국민연금 지표 (캐시 우선)
    let nps: CompanyProfileDto['nps'] = null;
    const cached = await this.prisma.companyProfile.findUnique({
      where: { companyName: name },
    });
    if (cached && isCacheFresh(cached.fetchedAt.getTime(), Date.now())) {
      nps = (cached.nps as unknown as CompanyProfileDto['nps']) ?? null;
    } else if (this.nps.enabled) {
      nps = await this.nps.fetchMetrics(name, (s) => this.normalize(s));
      if (nps) {
        const snapshot = nps as unknown as Prisma.InputJsonObject;
        await this.prisma.companyProfile.upsert({
          where: { companyName: name },
          update: { nps: snapshot, fetchedAt: new Date() },
          create: { companyName: name, nps: snapshot },
        });
      }
    }

    // 2) 잡플래닛 후기 (기존 로직 재사용)
    const review = await this.getReviews(name);

    return {
      companyName: name,
      nps,
      review: {
        rating: review.rating,
        summary: review.summary,
        sourceUrl: review.sourceUrl,
      },
      links,
    };
  }
}
