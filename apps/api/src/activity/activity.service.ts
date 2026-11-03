import { Injectable } from '@nestjs/common';

import { kstDayOf } from '../admin/metrics.util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사용자 활동(DAU/MAU) 기록. 인증 요청마다 호출되지만,
 * 프로세스 내 dedupe로 사용자·날짜당 실제 DB 쓰기는 1회만.
 * 요청 경로를 막지 않도록 fire-and-forget이며, 실패해도 요청에 영향 없음.
 */
@Injectable()
export class ActivityService {
  // userId → 마지막으로 기록한 날짜(KST 'YYYY-MM-DD'). 사용자 수만큼만 커짐.
  private readonly seen = new Map<string, string>();

  constructor(private prisma: PrismaService) {}

  touch(userId: string | undefined): void {
    if (!userId) return;
    const day = kstDayOf(new Date());
    if (this.seen.get(userId) === day) return;
    this.seen.set(userId, day);
    void this.prisma.dailyActive
      .upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day },
        update: {},
      })
      .catch(() => {
        // 실패 시 캐시에서 지워 다음 요청에 재시도 가능하게.
        this.seen.delete(userId);
      });
  }
}
