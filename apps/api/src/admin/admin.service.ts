import type {
  AdminApplicationRow,
  AdminOverview,
  AdminUserRow,
  AppStatus,
} from '@joblog/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

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

  /** 전체 사용자 (가입 순). 이력서 원문은 싣지 않고 유무만. */
  async users(): Promise<AdminUserRow[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nickname: true,
        kakaoId: true,
        email: true,
        homeAddress: true,
        createdAt: true,
        _count: { select: { applications: true } },
      },
    });
    return rows.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      kakaoId: u.kakaoId,
      email: u.email,
      homeAddress: u.homeAddress,
      applicationCount: u._count.applications,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /** 전체 지원 (최신 순, 소유자 포함). */
  async applications(): Promise<AdminApplicationRow[]> {
    const rows = await this.prisma.application.findMany({
      orderBy: { createdAt: 'desc' },
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
    });
    return rows.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      position: a.position,
      status: a.status,
      deadline: a.deadline?.toISOString() ?? null,
      stageCount: a._count.stages,
      ownerId: a.user.id,
      ownerNickname: a.user.nickname,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
