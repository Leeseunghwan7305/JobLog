import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';

/** 문의 폼 입력. 전역 ValidationPipe(whitelist·transform)가 검증·정리한다. */
export class SupportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000) // Discord embed description 한도 안쪽으로 제한
  message!: string;

  // 답장용 이메일은 선택. 엄격한 형식 검증 대신(틀렸다고 문의를 막지 않음) 길이만 제한.
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;
}

/**
 * 개발자 문의를 Discord 웹훅으로 전달한다.
 * 웹훅 URL은 백엔드 env(DISCORD_WEBHOOK_URL)에만 두고 프론트에 노출하지 않는다.
 * 전송 실패는 조용히 삼키지 않고 예외로 올려 프론트가 재시도 안내를 띄우게 한다.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private prisma: PrismaService) {}

  /** 로그인 사용자면 식별 문자열("닉네임 <이메일>"), 아니면 null. */
  async identify(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { nickname: true, email: true },
      });
      if (!u) return null;
      return u.email ? `${u.nickname} <${u.email}>` : u.nickname;
    } catch (e) {
      this.logger.warn(`user lookup failed: ${String(e)}`);
      return null;
    }
  }

  async send(dto: SupportDto, sender: string | null): Promise<void> {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) {
      // 서버 미설정도 조용한 성공으로 위장하지 않는다.
      this.logger.error('DISCORD_WEBHOOK_URL 미설정 — 문의를 전달할 수 없음');
      throw new ServiceUnavailableException('문의 전송이 일시적으로 불가합니다.');
    }

    // 빈 문자열·미입력은 '—'로 표기(?? 는 빈 문자열을 거르지 못하므로 명시적 분기).
    let replyEmail = '—';
    const trimmedEmail = dto.email?.trim();
    if (trimmedEmail) replyEmail = trimmedEmail;

    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: '보낸 사람', value: sender ?? '비로그인 사용자', inline: true },
      { name: '답장 이메일', value: replyEmail, inline: true },
    ];
    if (dto.path) fields.push({ name: '페이지', value: dto.path });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'JobLog 문의',
          embeds: [
            {
              title: '📮 새 문의가 도착했어요',
              description: dto.message,
              color: 0x3858e9, // JobLog primary
              fields,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Discord ${res.status}`);
        throw new ServiceUnavailableException('문의 전송에 실패했습니다.');
      }
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.logger.warn(`Discord 전송 실패: ${String(e)}`);
      throw new ServiceUnavailableException('문의 전송에 실패했습니다.');
    }
  }
}
