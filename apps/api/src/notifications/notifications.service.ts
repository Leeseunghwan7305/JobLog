import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { dueWindowUtc } from './notifications.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
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
        if (!app.user.email) {
          this.logger.log(`skip: ${app.companyName} (이메일 없음)`);
          skipped++;
          continue;
        }

        const subject = `[JobLog] ${app.companyName} ${t.label} D-${days}`;
        const html =
          `<p><b>${app.companyName}</b> · ${app.position}</p>` +
          `<p>${t.label}이(가) ${days}일 뒤입니다.</p>` +
          `<p><a href="${base}/applications/${app.id}">지원 상세 보기</a></p>`;

        const ok = await this.mailer.send({
          to: app.user.email,
          subject,
          html,
        });
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
