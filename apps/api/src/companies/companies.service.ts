import type {
  CompanyProfileDto,
  CompanyReviewDto,
  CompanySearchResult,
  NpsMetrics,
} from '@joblog/types';
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

  /** 회사명으로 국민연금 사업장 후보 검색 (검색→선택 UX용). */
  async searchCompanies(nameRaw: string): Promise<CompanySearchResult[]> {
    const name = this.normalize(nameRaw);
    if (!name || !this.nps.enabled) return [];
    return this.nps.searchCandidates(name);
  }

  /**
   * 회사 통합 프로필: 국민연금 지표(캐시 7일, seq 키) + 잡플래닛 후기 + 바로가기.
   * seq 지정 시 그 사업장, 없으면 이름 완전일치 단일 사업장을 자동 해소.
   */
  async getProfile(nameRaw: string, seq?: string): Promise<CompanyProfileDto> {
    const name = this.normalize(nameRaw);
    const links = buildLinks(name || nameRaw);
    const review = await this.getReviews(name);
    const reviewDto = {
      rating: review.rating,
      summary: review.summary,
      sourceUrl: review.sourceUrl,
    };

    let nps: CompanyProfileDto['nps'] = null;
    let resolvedSeq: string | null = seq ?? null;

    if (seq) {
      nps = await this.loadBySeq(seq, name);
    } else if (name && this.nps.enabled) {
      const r = await this.nps.fetchByName(name, (s) => this.normalize(s));
      if (r) {
        resolvedSeq = r.seq;
        nps = r.metrics;
        await this.cacheProfile(r.seq, name, r.metrics);
      }
    }

    return { companyName: name, seq: resolvedSeq, nps, review: reviewDto, links };
  }

  /** seq 캐시(7일) 우선, 없으면 국민연금 조회 후 캐시. */
  private async loadBySeq(
    seq: string,
    name: string,
  ): Promise<CompanyProfileDto['nps']> {
    const cached = await this.prisma.companyProfile.findUnique({
      where: { seq },
    });
    if (cached && isCacheFresh(cached.fetchedAt.getTime(), Date.now())) {
      return (cached.nps as unknown as CompanyProfileDto['nps']) ?? null;
    }
    if (!this.nps.enabled) return null;
    const metrics = await this.nps.fetchProfile(name, seq);
    if (metrics) await this.cacheProfile(seq, name, metrics);
    return metrics;
  }

  private async cacheProfile(
    seq: string,
    name: string,
    metrics: NpsMetrics,
  ): Promise<void> {
    const snapshot = metrics as unknown as Prisma.InputJsonObject;
    await this.prisma.companyProfile.upsert({
      where: { seq },
      update: { name, nps: snapshot, fetchedAt: new Date() },
      create: { seq, name, nps: snapshot },
    });
  }
}
