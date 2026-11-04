import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { MailerService } from './mailer.service';
import {
  dueWindowUtc,
  isStale,
  kstWeekKey,
  kstWeekWindowUtc,
} from './notifications.util';

/** 상태 변동이 이보다 오래 없으면 nudge 대상(진행중 지원). */
const NUDGE_DAYS = 14;

/** 이메일·카카오 발송에 필요한 사용자 필드(구조적) */
interface NotifiableUser {
  id: string;
  email: string | null;
  notifyKakao: boolean;
  kakaoAccessToken: string | null;
  kakaoRefreshToken: string | null;
  kakaoTokenExpiresAt: Date | null;
}

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

  // 매일 09:00 KST — 임박 알림 + 무변동 nudge
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async runDaily(): Promise<void> {
    await this.runDueNotifications();
    await this.runStaleNudges();
  }

  // 매주 월 09:00 KST — 주간 요약
  @Cron('0 9 * * 1', { timeZone: 'Asia/Seoul' })
  async runWeekly(): Promise<void> {
    await this.runWeeklySummary();
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

  /**
   * 무변동 nudge: 진행중인데 2주 넘게 상태 변동이 없는 지원에 "소식 있나요?" 알림.
   * 멱등: 같은 지원엔 주당 1회만(sendDate=주차 키). 수단 없으면 조용히 건너뜀.
   */
  async runStaleNudges(
    now: Date = new Date(),
  ): Promise<{ sent: number; skipped: number }> {
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const weekKey = kstWeekKey(now);
    const apps = await this.prisma.application.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        user: true,
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    let sent = 0;
    let skipped = 0;
    for (const app of apps) {
      const last = app.logs[0]?.createdAt ?? app.createdAt;
      if (!isStale(last, now, NUDGE_DAYS)) {
        skipped++;
        continue;
      }
      const existing = await this.prisma.sentNotification.findUnique({
        where: {
          userId_kind_refId_sendDate: {
            userId: app.userId,
            kind: 'nudge',
            refId: app.id,
            sendDate: weekKey,
          },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const url = `${base}/applications/${app.id}`;
      const subject = `[JobLog] ${app.companyName} 전형, 진행 소식 있나요?`;
      const html =
        `<p><b>${app.companyName}</b> · ${app.position}</p>` +
        `<p>2주 넘게 상태 변동이 없어요. 면접 결과나 다음 전형 소식이 있으면 업데이트해 두세요.</p>` +
        `<p><a href="${url}">상태 업데이트</a></p>`;
      const text =
        `[JobLog] ${app.companyName} 전형, 2주째 변동이 없어요.\n` +
        `합격/탈락·다음 전형 소식이 있으면 업데이트해 두세요.\n${url}`;
      const ok = await this.deliver(app.user, subject, html, text, url);
      if (ok) {
        await this.prisma.sentNotification.create({
          data: {
            userId: app.userId,
            kind: 'nudge',
            refId: app.id,
            sendDate: weekKey,
          },
        });
        sent++;
      } else {
        skipped++;
      }
    }
    this.logger.log(`nudge: sent=${sent} skipped=${skipped}`);
    return { sent, skipped };
  }

  /**
   * 주간 요약: 이번 주(월~일) 전형 일정·마감 건수를 사용자별로 묶어 1통.
   * 이번 주에 아무 일정/마감이 없으면 보내지 않는다(소음 방지). 멱등: 주당 1회.
   */
  async runWeeklySummary(
    now: Date = new Date(),
  ): Promise<{ sent: number; skipped: number }> {
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const { gte, lt } = kstWeekWindowUtc(now);
    const weekKey = kstWeekKey(now);
    const apps = await this.prisma.application.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { user: true, stages: true },
    });

    const byUser = new Map<
      string,
      {
        user: NotifiableUser;
        inProgress: number;
        deadlines: number;
        stageEvents: number;
      }
    >();
    for (const app of apps) {
      const e = byUser.get(app.userId) ?? {
        user: app.user,
        inProgress: 0,
        deadlines: 0,
        stageEvents: 0,
      };
      e.inProgress += 1;
      if (app.deadline && app.deadline >= gte && app.deadline < lt) {
        e.deadlines += 1;
      }
      for (const s of app.stages) {
        if (s.scheduledAt && s.scheduledAt >= gte && s.scheduledAt < lt) {
          e.stageEvents += 1;
        }
      }
      byUser.set(app.userId, e);
    }

    let sent = 0;
    let skipped = 0;
    for (const [userId, e] of byUser) {
      if (e.deadlines === 0 && e.stageEvents === 0) {
        skipped++; // 이번 주 할 일 없음 → 보내지 않음
        continue;
      }
      const existing = await this.prisma.sentNotification.findUnique({
        where: {
          userId_kind_refId_sendDate: {
            userId,
            kind: 'weekly',
            refId: userId,
            sendDate: weekKey,
          },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const url = `${base}/`;
      const subject = `[JobLog] 이번 주 전형 ${e.stageEvents}건 · 마감 ${e.deadlines}건`;
      const html =
        `<p>진행 중인 지원 <b>${e.inProgress}건</b></p>` +
        `<p>이번 주 전형 일정 ${e.stageEvents}건, 마감 ${e.deadlines}건이 있어요.</p>` +
        `<p><a href="${url}">대시보드에서 확인</a></p>`;
      const text =
        `[JobLog] 이번 주 전형 ${e.stageEvents}건·마감 ${e.deadlines}건 ` +
        `(진행중 ${e.inProgress}건)\n${url}`;
      const ok = await this.deliver(e.user, subject, html, text, url);
      if (ok) {
        await this.prisma.sentNotification.create({
          data: { userId, kind: 'weekly', refId: userId, sendDate: weekKey },
        });
        sent++;
      } else {
        skipped++;
      }
    }
    this.logger.log(`주간 요약: sent=${sent} skipped=${skipped}`);
    return { sent, skipped };
  }

  /** 이메일·카카오 중 가능한 수단으로 발송. 하나라도 성공하면 true. */
  private async deliver(
    user: NotifiableUser,
    subject: string,
    html: string,
    text: string,
    url: string,
  ): Promise<boolean> {
    const email = user.email;
    const kakaoEligible = user.notifyKakao && !!user.kakaoRefreshToken;
    if (!email && !kakaoEligible) return false;
    let ok = false;
    if (email) ok = await this.mailer.send({ to: email, subject, html });
    if (kakaoEligible) {
      const kakaoOk = await this.kakao.sendMemo(user, text, url);
      ok = ok || kakaoOk;
    }
    return ok;
  }
}
