import type {
  AdminApplicationRow,
  AdminOverview,
  AdminPage,
  AdminUserRow,
  AppStatus,
} from '@joblog/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { maskEmail, maskRegion, parsePaging } from './admin.util';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /** 전역 통계 — 테이블 카운트 + 상태별 지원 수. */
  async overview(): Promise<AdminOverview> {
    const [users, applications, stages, reviews, profiles, byStatus] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.application.count(),
        this.prisma.stage.count(),
        this.prisma.companyReview.count(),
        this.prisma.companyProfile.count(),
        this.prisma.application.groupBy({ by: ['status'], _count: true }),
      ]);
    const countBy = (s: AppStatus) =>
      byStatus.find((r) => r.status === s)?._count ?? 0;
    return {
      users,
      applications,
      stages,
      reviews,
      profiles,
      byStatus: {
        inProgress: countBy('IN_PROGRESS'),
        offer: countBy('OFFER'),
        rejected: countBy('REJECTED'),
        closed: countBy('CLOSED'),
      },
    };
  }

  /**
   * 전체 사용자 (가입 순, 페이지네이션). 이력서 원문은 싣지 않고,
   * 이메일·집주소는 PII라 부분 마스킹해 내려준다.
   */
  async users(
    page?: string,
    pageSize?: string,
  ): Promise<AdminPage<AdminUserRow>> {
    const { page: p, pageSize: s, skip, take } = parsePaging(page, pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        skip,
        take,
        select: {
          id: true,
          nickname: true,
          kakaoId: true,
          email: true,
          homeAddress: true,
          createdAt: true,
          _count: { select: { applications: true } },
        },
      }),
    ]);
    return {
      page: p,
      pageSize: s,
      total,
      rows: rows.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        kakaoId: u.kakaoId,
        email: maskEmail(u.email),
        homeAddress: maskRegion(u.homeAddress),
        applicationCount: u._count.applications,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  /** 전체 지원 (최신 순, 소유자 포함, 페이지네이션). */
  async applications(
    page?: string,
    pageSize?: string,
  ): Promise<AdminPage<AdminApplicationRow>> {
    const { page: p, pageSize: s, skip, take } = parsePaging(page, pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.application.count(),
      this.prisma.application.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          companyName: true,
          position: true,
          status: true,
          deadline: true,
          createdAt: true,
          user: { select: { id: true, nickname: true } },
          _count: { select: { stages: true } },
        },
      }),
    ]);
    return {
      page: p,
      pageSize: s,
      total,
      rows: rows.map((a) => ({
        id: a.id,
        companyName: a.companyName,
        position: a.position,
        status: a.status,
        deadline: a.deadline?.toISOString() ?? null,
        stageCount: a._count.stages,
        ownerId: a.user.id,
        ownerNickname: a.user.nickname,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}
