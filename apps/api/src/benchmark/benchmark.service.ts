import type { Benchmark } from '@joblog/types';
import { Injectable } from '@nestjs/common';

import { computeInsights } from '../applications/insights.util';
import { PrismaService } from '../prisma/prisma.service';
import { computeBenchmark } from './benchmark.util';

const CACHE_TTL_MS = 10 * 60 * 1000; // 전 사용자 집계라 10분 캐시

@Injectable()
export class BenchmarkService {
  private cache: { at: number; value: Benchmark } | null = null;

  constructor(private prisma: PrismaService) {}

  /** 전 사용자 익명 집계. 개인정보 없이 전형별 통과율·합격률만. 10분 캐시. */
  async get(now: Date = new Date()): Promise<Benchmark> {
    if (this.cache && now.getTime() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    const [apps, users] = await Promise.all([
      this.prisma.application.findMany({
        select: { status: true, stages: { select: { name: true, status: true } } },
      }),
      this.prisma.user.count(),
    ]);
    const insights = computeInsights(apps);
    const value = computeBenchmark(insights, users, now.toISOString());
    this.cache = { at: now.getTime(), value };
    return value;
  }
}
