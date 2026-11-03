import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { isAdminKakaoId } from '../admin/admin.util';
import { PrismaService } from '../prisma/prisma.service';

interface KakaoProfile {
  kakaoId: string;
  email: string | null;
  nickname: string;
  profileImage: string | null;
}

interface KakaoTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** 카카오 인가 페이지 URL (REST 키는 서버에서만 사용) */
  buildKakaoAuthorizeUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.KAKAO_REST_API_KEY ?? '',
      redirect_uri: process.env.KAKAO_REDIRECT_URI ?? '',
      response_type: 'code',
    });
    // '나에게 보내기' 리마인더용 scope. 카카오 콘솔에서 talk_message 동의항목을
    // 먼저 켠 뒤 KAKAO_TALK_MESSAGE=on 으로 활성화한다(미설정 시 로그인 영향 없음).
    if (process.env.KAKAO_TALK_MESSAGE === 'on') {
      params.set('scope', 'talk_message');
    }
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  /** 인가 코드 → 사용자 생성/조회 → 자체 JWT 발급 */
  async loginWithKakaoCode(code: string): Promise<string> {
    const tokens = await this.exchangeCode(code);
    const profile = await this.fetchProfile(tokens.accessToken);

    const user = await this.prisma.user.upsert({
      where: { kakaoId: profile.kakaoId },
      update: {
        nickname: profile.nickname,
        email: profile.email,
        profileImage: profile.profileImage,
        kakaoAccessToken: tokens.accessToken,
        kakaoTokenExpiresAt: tokens.expiresAt,
        // 재로그인 시 refresh_token이 응답에 없을 수 있어, 있을 때만 갱신(undefined=유지)
        kakaoRefreshToken: tokens.refreshToken ?? undefined,
      },
      create: {
        kakaoId: profile.kakaoId,
        nickname: profile.nickname,
        email: profile.email,
        profileImage: profile.profileImage,
        kakaoAccessToken: tokens.accessToken,
        kakaoRefreshToken: tokens.refreshToken,
        kakaoTokenExpiresAt: tokens.expiresAt,
      },
    });

    return this.jwt.signAsync(
      { sub: user.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '7d' },
    );
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      profileImage: user.profileImage,
      isAdmin: isAdminKakaoId(user.kakaoId, process.env.ADMIN_KAKAO_IDS),
    };
  }

  private async exchangeCode(code: string): Promise<KakaoTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY ?? '',
      redirect_uri: process.env.KAKAO_REDIRECT_URI ?? '',
      code,
    });
    // 카카오 앱에서 Client Secret을 활성화한 경우 필수
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
    if (!res.ok) throw new UnauthorizedException('카카오 토큰 교환 실패');
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null,
    };
  }

  private async fetchProfile(accessToken: string): Promise<KakaoProfile> {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedException('카카오 프로필 조회 실패');
    const json = (await res.json()) as {
      id: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    };
    const account = json.kakao_account ?? {};
    const profile = account.profile ?? {};
    return {
      kakaoId: String(json.id),
      email: account.email ?? null,
      nickname: profile.nickname ?? '카카오사용자',
      profileImage: profile.profile_image_url ?? null,
    };
  }
}
