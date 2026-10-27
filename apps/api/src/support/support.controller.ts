import type { SupportResponse } from '@joblog/types';
import { Body, Controller, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { SupportDto, SupportService } from './support.service';

// 문의는 비로그인에서도 가능(공개 엔드포인트, companies/reviews와 동일 정책).
// 로그인 상태면 Bearer 토큰을 수동으로 디코드해 "누가 보냈는지"를 신뢰성 있게
// 덧붙인다. 가드를 걸지 않으므로 토큰이 없거나 만료돼도 문의 자체는 통과한다.
@Controller('support')
export class SupportController {
  constructor(
    private svc: SupportService,
    private jwt: JwtService,
  ) {}

  @Post()
  async submit(
    @Body() dto: SupportDto,
    @Req() req: Request,
  ): Promise<SupportResponse> {
    const userId = await this.optionalUserId(req.headers.authorization);
    const sender = await this.svc.identify(userId);
    await this.svc.send(dto, sender);
    return { ok: true };
  }

  /** Bearer 토큰이 유효하면 userId, 아니면(없음·만료·위조) null. 문의를 막지 않는다. */
  private async optionalUserId(header?: string): Promise<string | null> {
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        header.slice(7),
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      return payload.sub;
    } catch {
      return null;
    }
  }
}
