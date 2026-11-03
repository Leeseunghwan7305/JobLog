import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** sendMemo에 필요한 사용자 토큰 필드 (User에서 구조적으로 전달받음) */
interface KakaoTokenUser {
  id: string;
  kakaoAccessToken: string | null;
  kakaoRefreshToken: string | null;
  kakaoTokenExpiresAt: Date | null;
}

/**
 * 카카오 '나에게 보내기'(메시지 API)로 리마인더를 전송한다.
 * 알림톡(비즈메시지)이 아니라 talk_message 동의로 보내는 본인 대상 메시지라
 * 별도 템플릿 심사가 필요 없다. access_token 만료 시 refresh_token으로 갱신.
 */
@Injectable()
export class KakaoService {
  private readonly logger = new Logger(KakaoService.name);

  constructor(private prisma: PrismaService) {}

  /** 본인에게 텍스트 메시지 전송. 성공 시 true. */
  async sendMemo(
    user: KakaoTokenUser,
    text: string,
    webUrl: string,
  ): Promise<boolean> {
    let accessToken = await this.validAccessToken(user);
    if (!accessToken) return false;

    let status = await this.postMemo(accessToken, text, webUrl);
    if (status === 401) {
      // 만료/무효 → 갱신 후 1회 재시도
      accessToken = await this.refresh(user);
      if (!accessToken) return false;
      status = await this.postMemo(accessToken, text, webUrl);
    }
    return status === 200;
  }

  /** 만료 임박(2분 이내)이면 미리 갱신한 access_token, 아니면 저장된 토큰. */
  private async validAccessToken(user: KakaoTokenUser): Promise<string | null> {
    if (!user.kakaoAccessToken) return this.refresh(user);
    const expMs = user.kakaoTokenExpiresAt?.getTime();
    if (expMs !== undefined && expMs - Date.now() < 120_000) {
      return this.refresh(user);
    }
    return user.kakaoAccessToken;
  }

  private async postMemo(
    accessToken: string,
    text: string,
    webUrl: string,
  ): Promise<number> {
    try {
      const template = {
        object_type: 'text',
        text,
        link: { web_url: webUrl, mobile_web_url: webUrl },
      };
      const res = await fetch(
        'https://kapi.kakao.com/v2/api/talk/memo/default/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          body: new URLSearchParams({
            template_object: JSON.stringify(template),
          }),
        },
      );
      if (!res.ok) this.logger.warn(`Kakao memo ${res.status}`);
      return res.status;
    } catch (e) {
      this.logger.warn(`Kakao memo 실패: ${String(e)}`);
      return 0;
    }
  }

  /** refresh_token으로 access_token 갱신 + DB 저장. 실패 시 null. */
  private async refresh(user: KakaoTokenUser): Promise<string | null> {
    if (!user.kakaoRefreshToken) return null;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KAKAO_REST_API_KEY ?? '',
        refresh_token: user.kakaoRefreshToken,
      });
      if (process.env.KAKAO_CLIENT_SECRET) {
        body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
      }
      const res = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body,
      });
      if (!res.ok) {
        this.logger.warn(`Kakao refresh ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      const expiresAt = json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          kakaoAccessToken: json.access_token,
          kakaoTokenExpiresAt: expiresAt,
          // 리프레시 토큰은 갱신 응답에 포함될 때만 교체
          kakaoRefreshToken: json.refresh_token ?? undefined,
        },
      });
      return json.access_token;
    } catch (e) {
      this.logger.warn(`Kakao refresh 실패: ${String(e)}`);
      return null;
    }
  }
}
