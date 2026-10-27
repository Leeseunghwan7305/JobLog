import type { CalendarEvent } from '@joblog/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppStatus, Prisma, StageStatus } from '@prisma/client';

import { LlmService } from '../parse/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { archiveWhere, resolveArchivedAt } from './archive.util';
import { toCalendarEvents } from './calendar.util';
import { parseDateStrict } from './date.util';
import {
  CreateApplicationDto,
  CreateStageDto,
  UpdateApplicationDto,
  UpdateStageDto,
} from './dto';
import { computeInsights } from './insights.util';
import { applicationSearchWhere } from './search.util';
import { deriveStatus } from './status.util';

const withStages = { stages: { orderBy: { order: 'asc' as const } } };

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  create(userId: string, dto: CreateApplicationDto) {
    const orders = dto.stages.map((s, i) => s.order ?? i);
    const minOrder = orders.length ? Math.min(...orders) : 0;
    return this.prisma.application.create({
      data: {
        userId,
        companyName: dto.companyName,
        position: dto.position,
        jobUrl: dto.jobUrl,
        rawPosting: dto.rawPosting,
        location: dto.location,
        employmentType: dto.employmentType,
        deadline: dto.deadline ? parseDateStrict(dto.deadline, '마감일') : null,
        appliedAt: dto.appliedAt
          ? parseDateStrict(dto.appliedAt, '지원일')
          : null,
        employeeCount: dto.employeeCount ?? null,
        memo: dto.memo,
        tags: dto.tags ?? [],
        stages: {
          create: dto.stages.map((s, i) => {
            const order = s.order ?? i;
            return {
              name: s.name,
              order,
              // 첫 단계는 진행중으로 시작(지원 완료 = 첫 전형 진행중), 이후 단계는 대기
              status:
                order === minOrder
                  ? StageStatus.IN_PROGRESS
                  : StageStatus.PENDING,
            };
          }),
        },
      },
      include: withStages,
    });
  }

  findAll(userId: string, status?: string, q?: string, archived = false) {
    return this.prisma.application.findMany({
      where: {
        userId,
        ...archiveWhere(archived),
        ...(status ? { status: status as AppStatus } : {}),
        ...applicationSearchWhere(q),
      },
      include: withStages,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: withStages,
    });
    // 소유권 불일치는 존재를 숨기기 위해 404
    if (app?.userId !== userId) throw new NotFoundException();
    return app;
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    await this.findOne(userId, id);
    return this.prisma.application.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        position: dto.position,
        jobUrl: dto.jobUrl,
        location: dto.location,
        employmentType: dto.employmentType,
        deadline: dto.deadline
          ? parseDateStrict(dto.deadline, '마감일')
          : undefined,
        appliedAt: dto.appliedAt
          ? parseDateStrict(dto.appliedAt, '지원일')
          : undefined,
        employeeCount: dto.employeeCount,
        memo: dto.memo,
        tags: dto.tags,
        archivedAt: resolveArchivedAt(dto.archived, new Date()),
        status: dto.status ? (dto.status as AppStatus) : undefined,
      },
      include: withStages,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.application.delete({ where: { id } });
    return { ok: true };
  }

  async addStage(userId: string, id: string, dto: CreateStageDto) {
    const app = await this.findOne(userId, id);
    const order =
      dto.order ??
      (app.stages.length ? Math.max(...app.stages.map((s) => s.order)) + 1 : 0);
    await this.prisma.stage.create({
      data: { applicationId: id, name: dto.name, order },
    });
    return this.recompute(id);
  }

  async updateStage(
    userId: string,
    id: string,
    stageId: string,
    dto: UpdateStageDto,
  ) {
    const app = await this.findOne(userId, id);
    const stage = app.stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException();

    if (dto.status && dto.status !== stage.status) {
      await this.prisma.statusLog.create({
        data: {
          applicationId: id,
          stageName: stage.name,
          fromStatus: stage.status,
          toStatus: dto.status,
        },
      });
    }

    await this.prisma.stage.update({
      where: { id: stageId },
      data: {
        status: dto.status ? (dto.status as StageStatus) : undefined,
        scheduledAt:
          dto.scheduledAt === undefined
            ? undefined
            : dto.scheduledAt
              ? parseDateStrict(dto.scheduledAt, '예정일')
              : null,
        completedAt:
          dto.completedAt === undefined
            ? undefined
            : dto.completedAt
              ? parseDateStrict(dto.completedAt, '완료일')
              : null,
      },
    });
    return this.recompute(id);
  }

  async removeStage(userId: string, id: string, stageId: string) {
    const app = await this.findOne(userId, id);
    if (!app.stages.find((s) => s.id === stageId)) {
      throw new NotFoundException();
    }
    await this.prisma.stage.delete({ where: { id: stageId } });
    return this.recompute(id);
  }

  async stats(userId: string) {
    const apps = await this.prisma.application.findMany({
      where: { userId },
      select: { status: true },
    });
    return {
      total: apps.length,
      inProgress: apps.filter((a) => a.status === 'IN_PROGRESS').length,
      offer: apps.filter((a) => a.status === 'OFFER').length,
      rejected: apps.filter((a) => a.status === 'REJECTED').length,
    };
  }

  async insights(userId: string) {
    const apps = await this.prisma.application.findMany({
      where: { userId },
      select: { status: true, stages: { select: { name: true, status: true } } },
    });
    return computeInsights(apps);
  }

  async calendar(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const start = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = to
      ? new Date(to)
      : new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const apps = await this.prisma.application.findMany({
      where: {
        userId,
        OR: [
          { deadline: { gte: start, lte: end } },
          { stages: { some: { scheduledAt: { gte: start, lte: end } } } },
        ],
      },
      include: { stages: true },
    });

    const inRange = (d: Date | null) => !!d && d >= start && d <= end;
    const filtered = apps.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      deadline: inRange(a.deadline) ? a.deadline : null,
      stages: a.stages
        .filter((s) => inRange(s.scheduledAt))
        .map((s) => ({
          name: s.name,
          status: s.status,
          scheduledAt: s.scheduledAt,
        })),
    }));
    return toCalendarEvents(filtered);
  }

  /** 단계 변경 후 전체 상태 재계산 (CLOSED는 유지) */
  private async recompute(id: string) {
    const [stages, current] = await Promise.all([
      this.prisma.stage.findMany({ where: { applicationId: id } }),
      this.prisma.application.findUnique({ where: { id } }),
    ]);
    const status =
      current?.status === 'CLOSED' ? AppStatus.CLOSED : deriveStatus(stages);
    return this.prisma.application.update({
      where: { id },
      data: { status },
      include: withStages,
    });
  }

  /** 이력서 ↔ 공고 핏 분석(온디맨드). 결과를 지원에 캐시. */
  async analyzeFit(userId: string, id: string) {
    const app = await this.findOne(userId, id); // 소유권 검증
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { resumeText: true },
    });
    if (!user?.resumeText) {
      throw new BadRequestException(
        '먼저 이력서를 업로드해 주세요. (상단 "이력서" 메뉴)',
      );
    }
    const result = await this.llm.analyzeFit({
      resumeText: user.resumeText,
      companyName: app.companyName,
      position: app.position,
      posting: app.rawPosting ?? '',
    });
    if (!result) {
      throw new ServiceUnavailableException(
        '핏 분석에 실패했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
    return this.prisma.application.update({
      where: { id },
      data: {
        fitResult: result as unknown as Prisma.InputJsonValue,
        fitAt: new Date(),
      },
      include: withStages,
    });
  }
}
