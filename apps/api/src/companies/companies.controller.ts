import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { CompaniesService } from './companies.service';

// 기업 후기 조회는 비로그인에서도 열람 가능 (spec §3.2: /companies/reviews는 JWT 가드 제외).
// 후기는 best-effort 참고용이고 사용자 리소스가 아니므로 소유권 검증 대상도 아니다.
@Controller('companies')
export class CompaniesController {
  constructor(private svc: CompaniesService) {}

  @Get('reviews')
  reviews(@Query('name') name: string) {
    return this.svc.getReviews(name ?? '');
  }

  // 공개 회사 정보 페이지(SEO 유입)용. 비로그인·색인 대상. NPS 지표만 반환(7일 캐시).
  // 웹은 ISR로 캐시하므로 API 호출은 드물다. 남용 방지로 넉넉한 IP 레이트리밋만 둔다.
  @Get('public')
  publicProfile(@Query('name') name: string, @Req() req: Request) {
    this.rateLimit(this.clientIp(req));
    return this.svc.getPublicProfile(name ?? '');
  }

  // 국민연금 사업장 후보 검색 (검색→선택 UX). 로그인 전용.
  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(@Query('name') name: string) {
    return this.svc.searchCompanies(name ?? '');
  }

  // 회사 통합 프로필(국민연금 지표 포함)은 로그인 사용자 전용 (spec §3.2: reviews만 공개).
  // seq 지정 시 그 사업장, 없으면 이름 완전일치 단일 사업장 자동 해소.
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Query('name') name: string, @Query('seq') seq?: string) {
    return this.svc.getProfile(name ?? '', seq);
  }

  // ── 공개 엔드포인트 남용 방지(인메모리 슬라이딩 윈도우, 단일 EC2라 충분) ──
  private static readonly WINDOW_MS = 60 * 1000;
  private static readonly MAX = 60; // IP당 분당 60회(정상 크롤링엔 영향 없음)
  private readonly hits = new Map<string, number[]>();

  private rateLimit(ip: string): void {
    const now = Date.now();
    const recent = (this.hits.get(ip) ?? []).filter(
      (t) => now - t < CompaniesController.WINDOW_MS,
    );
    if (recent.length >= CompaniesController.MAX) {
      this.hits.set(ip, recent);
      throw new HttpException('요청이 많아요. 잠시 후 다시.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(ip, recent);
  }

  private clientIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}
