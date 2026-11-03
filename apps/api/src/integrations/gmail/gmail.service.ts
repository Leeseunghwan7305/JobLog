import type { GmailScanResult, GmailStatus, GmailSuggestion } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/** scan에 필요한 사용자 토큰 필드 */
interface GoogleTokenUser {
  id: string;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiresAt: Date | null;
}

interface MailMeta {
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

/** 본문에서 합격/불합격 신호를 뽑는다. 불합격 단어가 '합격'을 포함하므로 fail 우선. */
export function classify(text: string): 'passed' | 'failed' | null {
  const fail =
    /불합격|불합|안타깝게|아쉽게|죄송하게도|탈락|부적합|선발되지|함께하지\s*못/;
  if (fail.test(text)) return 'failed';
  const pass =
    /합격|축하드립니다|최종\s*합격|다음\s*전형|면접\s*(제안|안내|일정|대상)|인터뷰\s*안내|서류\s*통과|합격하셨/;
  if (pass.test(text)) return 'passed';
  return null;
}

/** 반영 대상이 될 '현재' 전형: 진행중 우선, 없으면 첫 대기. */
function currentStage(
  stages: { id: string; name: string; order: number; status: string }[],
): { id: string; name: string } | null {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const inProgress = sorted.find((s) => s.status === 'IN_PROGRESS');
  const pending = sorted.find((s) => s.status === 'PENDING');
  const target = inProgress ?? pending ?? sorted[sorted.length - 1];
  return target ? { id: target.id, name: target.name } : null;
}

/**
 * Gmail(gmail.readonly)로 지원 회사 관련 합격/불합격 메일을 '감지'해 제안한다.
 * - 메일 본문은 저장하지 않는다(제목·스니펫만 일시 사용).
 * - 감지는 제안일 뿐, 반영은 사용자가 progress 엔드포인트로 직접 한다.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private prisma: PrismaService) {}

  get enabled(): boolean {
    return (
      !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
    );
  }

  private get redirectUri(): string {
    return (
      process.env.GOOGLE_REDIRECT_URI ??
      'https://joblog.duckdns.org/integrations/gmail/callback'
    );
  }

  /** 구글 동의 URL. state에 서명된 JWT(userId)를 담아 콜백에서 식별한다. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline', // refresh_token 수신
      prompt: 'consent', // 매번 refresh_token 보장
      include_granted_scopes: 'true',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** 인가 코드 → 토큰 교환 + 이메일 조회 후 저장. */
  async handleCallback(userId: string, code: string): Promise<void> {
    const tokens = await this.exchangeCode(code);
    const email = await this.fetchEmail(tokens.accessToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleEmail: email,
        googleAccessToken: tokens.accessToken,
        googleTokenExpiresAt: tokens.expiresAt,
        googleRefreshToken: tokens.refreshToken ?? undefined,
      },
    });
  }

  async status(userId: string): Promise<GmailStatus> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true, googleEmail: true },
    });
    return {
      connected: !!u?.googleRefreshToken,
      email: u?.googleEmail ?? null,
    };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
      },
    });
  }

  /** 최근 메일에서 지원 회사별 합격/불합격을 감지해 제안 목록을 돌려준다. */
  async scan(userId: string): Promise<GmailScanResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleRefreshToken) return { suggestions: [], scanned: 0 };

    const token = await this.validAccessToken(user);
    if (!token) return { suggestions: [], scanned: 0 };

    // 아직 결론나지 않은 지원만 대상(이미 합격/탈락/마감된 건 제외).
    const apps = await this.prisma.application.findMany({
      where: { userId, status: 'IN_PROGRESS' },
      include: { stages: true },
    });
    if (apps.length === 0) return { suggestions: [], scanned: 0 };

    const q =
      'newer_than:30d (합격 OR 불합격 OR 전형 OR 면접 OR 지원 OR 채용 OR 서류)';
    const ids = await this.listMessages(token, q, 40);
    const metas = (
      await Promise.all(ids.map((id) => this.getMessage(token, id)))
    ).filter((m): m is MailMeta => m !== null);

    const suggestions: GmailSuggestion[] = [];
    const used = new Set<string>();
    for (const m of metas) {
      const hay = `${m.subject} ${m.snippet} ${m.from}`;
      const detected = classify(hay);
      if (!detected) continue;
      const app = apps.find(
        (a) => a.companyName && hay.includes(a.companyName) && !used.has(a.id),
      );
      if (!app) continue;
      used.add(app.id);
      const cur = currentStage(app.stages);
      suggestions.push({
        applicationId: app.id,
        companyName: app.companyName,
        stageId: cur?.id ?? null,
        stageName: cur?.name ?? null,
        detected,
        subject: m.subject,
        date: m.date,
      });
    }
    return { suggestions, scanned: metas.length };
  }

  /* ─────────────── Google OAuth ─────────────── */

  private async exchangeCode(code: string): Promise<GoogleTokens> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token ${res.status}: ${await res.text()}`);
    }
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

  /** 만료 임박(2분 이내)이면 미리 갱신, 아니면 저장된 access_token. */
  private async validAccessToken(
    user: GoogleTokenUser,
  ): Promise<string | null> {
    if (!user.googleAccessToken) return this.refresh(user);
    const expMs = user.googleTokenExpiresAt?.getTime();
    if (expMs !== undefined && expMs - Date.now() < 120_000) {
      return this.refresh(user);
    }
    return user.googleAccessToken;
  }

  /** refresh_token으로 access_token 갱신 + DB 저장. 실패 시 null. */
  private async refresh(user: GoogleTokenUser): Promise<string | null> {
    if (!user.googleRefreshToken) return null;
    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          refresh_token: user.googleRefreshToken,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Google refresh ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        access_token: string;
        expires_in?: number;
      };
      const expiresAt = json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: json.access_token,
          googleTokenExpiresAt: expiresAt,
        },
      });
      return json.access_token;
    } catch (e) {
      this.logger.warn(`Google refresh 실패: ${String(e)}`);
      return null;
    }
  }

  /* ─────────────── Gmail API ─────────────── */

  private async fetchEmail(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${GMAIL_API}/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { emailAddress?: string };
      return json.emailAddress ?? null;
    } catch (e) {
      this.logger.warn(`Gmail profile 실패: ${String(e)}`);
      return null;
    }
  }

  private async listMessages(
    accessToken: string,
    query: string,
    maxResults: number,
  ): Promise<string[]> {
    try {
      const url = `${GMAIL_API}/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        this.logger.warn(`Gmail list ${res.status}`);
        return [];
      }
      const json = (await res.json()) as {
        messages?: { id: string }[];
      };
      return (json.messages ?? []).map((m) => m.id);
    } catch (e) {
      this.logger.warn(`Gmail list 실패: ${String(e)}`);
      return [];
    }
  }

  private async getMessage(
    accessToken: string,
    id: string,
  ): Promise<MailMeta | null> {
    try {
      const url =
        `${GMAIL_API}/messages/${id}` +
        '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        snippet?: string;
        internalDate?: string;
        payload?: { headers?: { name: string; value: string }[] };
      };
      const headers = json.payload?.headers ?? [];
      const h = (name: string): string =>
        headers.find((x) => x.name.toLowerCase() === name.toLowerCase())
          ?.value ?? '';
      const date = json.internalDate
        ? new Date(Number(json.internalDate)).toISOString()
        : h('Date');
      return {
        subject: h('Subject'),
        from: h('From'),
        snippet: json.snippet ?? '',
        date,
      };
    } catch (e) {
      this.logger.warn(`Gmail get 실패: ${String(e)}`);
      return null;
    }
  }
}
