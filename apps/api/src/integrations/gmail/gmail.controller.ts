import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GmailService } from './gmail.service';

@Controller('integrations/gmail')
export class GmailController {
  constructor(
    private svc: GmailService,
    private jwt: JwtService,
  ) {}

  /** 연결 시작: 구글 동의 URL을 돌려준다(프론트가 window.location으로 이동). */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@CurrentUser() userId: string): Promise<{ url: string }> {
    // 공개 콜백에서 '누구의 연결'인지 식별하기 위한 짧은 수명 state(JWT).
    const state = await this.jwt.signAsync(
      { sub: userId, kind: 'gmail' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' },
    );
    return { url: this.svc.buildAuthUrl(state) };
  }

  /** 구글 리다이렉트(공개). state 검증 → 토큰 저장 → 웹 /profile로 복귀. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const web = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; kind: string }>(
        state,
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      if (payload.kind !== 'gmail') throw new Error('bad state');
      await this.svc.handleCallback(payload.sub, code);
      res.redirect(`${web}/profile?gmail=connected`);
    } catch {
      res.redirect(`${web}/profile?gmail=error`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  status(@CurrentUser() userId: string) {
    return this.svc.status(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('scan')
  scan(@CurrentUser() userId: string) {
    return this.svc.scan(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  async disconnect(@CurrentUser() userId: string): Promise<{ ok: true }> {
    await this.svc.disconnect(userId);
    return { ok: true };
  }
}
