import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { MailerService } from './mailer.service';
import { dueWindowUtc } from './notifications.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private kakao: KakaoService,
  ) {}

  private get daysAhead(): number {
    const n = Number(process.env.NOTIFY_DAYS_AHEAD ?? 3);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  // 매일 09:00 KST
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async runDaily(): Promise<void> {
    await this.runDueNotifications();
  }

  /** D-(daysAhead) 알림 발송. 멱등: 같은 (user,kind,ref,날짜)는 1회만. */
  async runDueNotifications(
    now: Date = new Date(),
  ): Promise<{ sent: number; skipped: number }> {
    const days = this.daysAhead;
    const { gte, lt, dayKey } = dueWindowUtc(now, days);
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    const apps = await this.prisma.application.findMany({
      where: {
        OR: [
          { deadline: { gte, lt } },
          { stages: { some: { scheduledAt: { gte, lt } } } },
        ],
      },
      include: { user: true, stages: true },
    });

    let sent = 0;
    let skipped = 0;

    for (const app of apps) {
      const targets: {
        kind: 'deadline' | 'stage';
        refId: string;
        label: string;
      }[] = [];
      if (app.deadline && app.deadline >= gte && app.deadline < lt) {
        targets.push({ kind: 'deadline', refId: app.id, label: '서류 마감' });
      }
      for (const s of app.stages) {
        if (s.scheduledAt && s.scheduledAt >= gte && s.scheduledAt < lt) {
          targets.push({ kind: 'stage', refId: s.id, label: s.name });
        }
      }

      for (const t of targets) {
        const existing = await this.prisma.sentNotification.findUnique({
          where: {
            userId_kind_refId_sendDate: {
              userId: app.userId,
              kind: t.kind,
              refId: t.refId,
              sendDate: dayKey,
            },
          },
        });
        if (existing) {
          skipped++;
          continue;
        }
        const email = app.user.email;
        const kakaoEligible =
          app.user.notifyKakao && !!app.user.kakaoRefreshToken;
        if (!email && !kakaoEligible) {
          this.logger.log(`skip: ${app.companyName} (알림 수단 없음)`);
          skipped++;
          continue;
        }

        const url = `${base}/applications/${app.id}`;
        const subject = `[JobLog] ${app.companyName} ${t.label} D-${days}`;
        const html =
          `<p><b>${app.companyName}</b> · ${app.position}</p>` +
          `<p>${t.label}이(가) ${days}일 뒤입니다.</p>` +
          `<p><a href="${url}">지원 상세 보기</a></p>`;

        // 이메일·카카오 중 가능한 수단으로 발송. 하나라도 성공하면 기록.
        let ok = false;
        if (email) {
          ok = await this.mailer.send({ to: email, subject, html });
        }
        if (kakaoEligible) {
          const text =
            `[JobLog] ${app.companyName} · ${app.position}\n` +
            `${t.label}이(가) ${days}일 뒤예요. 잊지 마세요!`;
          const kakaoOk = await this.kakao.sendMemo(app.user, text, url);
          ok = ok || kakaoOk;
        }
        if (ok) {
          await this.prisma.sentNotification.create({
            data: {
              userId: app.userId,
              kind: t.kind,
              refId: t.refId,
              sendDate: dayKey,
            },
          });
          sent++;
        } else {
          // 발송 실패/비활성 → 기록 안 함(다음 실행에서 재시도 여지)
          skipped++;
        }
      }
    }

    this.logger.log(`D-${days} 알림: sent=${sent} skipped=${skipped}`);
    return { sent, skipped };
  }
}
