import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // 로그인 시작: 카카오 인가 페이지로 리다이렉트
  @Get('kakao/login')
  login(@Res() res: Response) {
    res.redirect(this.auth.buildKakaoAuthorizeUrl());
  }

  // 카카오 콜백: 토큰 발급 후 웹으로 리다이렉트 (토큰은 URL fragment로)
  @Get('kakao/callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const web = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    try {
      const token = await this.auth.loginWithKakaoCode(code);
      res.redirect(`${web}/auth/callback#token=${token}`);
    } catch {
      res.redirect(`${web}/login?error=kakao`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() userId: string) {
    return this.auth.getUser(userId);
  }
}
