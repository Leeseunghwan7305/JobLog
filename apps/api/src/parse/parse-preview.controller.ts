import type { ParseResponse } from '@joblog/types';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { ParseDto, ParseService } from './parse.service';

/**
 * 비로그인 '체험 분석' 엔드포인트. 로그인 전에 AI 파싱 결과를 보여줘
 * 핵심 가치를 먼저 전달하고(활성화 이탈 개선), 저장은 하지 않는다(draft만 반환).
 * 남용·비용(Firecrawl/LLM) 방지를 위해 IP당 레이트리밋 — 단일 EC2라 인메모리로 충분.
 */
@Controller('parse')
export class ParsePreviewController {
  constructor(private svc: ParseService) {}

  private static readonly WINDOW_MS = 60 * 60 * 1000; // 1시간
  private static readonly MAX = 5; // IP당 시간당 체험 횟수
  private readonly hits = new Map<string, number[]>();

  @Post('preview')
  preview(@Body() dto: ParseDto, @Req() req: Request): Promise<ParseResponse> {
    if (!this.allow(this.clientIp(req))) {
      throw new HttpException(
        '체험 분석 횟수를 초과했어요. 로그인하면 제한 없이 이용할 수 있어요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.svc.parse(dto);
  }

  /** 슬라이딩 윈도우 카운터. 윈도우 안 요청이 MAX 미만이면 허용. */
  private allow(ip: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(ip) ?? []).filter(
      (t) => now - t < ParsePreviewController.WINDOW_MS,
    );
    if (recent.length >= ParsePreviewController.MAX) {
      this.hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(ip, recent);
    return true;
  }

  /** 리버스 프록시(Caddy/nginx) 뒤라 x-forwarded-for 우선. */
  private clientIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}
