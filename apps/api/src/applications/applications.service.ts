import { Injectable, NotFoundException } from '@nestjs/common';
import { AppStatus, StageStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateApplicationDto,
  CreateStageDto,
  UpdateApplicationDto,
  UpdateStageDto,
} from './dto';
import { deriveStatus } from './status.util';

const withStages = { stages: { orderBy: { order: 'asc' as const } } };

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateApplicationDto) {
    return this.prisma.application.create({
      data: {
        userId,
        companyName: dto.companyName,
        position: dto.position,
        jobUrl: dto.jobUrl,
        rawPosting: dto.rawPosting,
        location: dto.location,
        employmentType: dto.employmentType,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : null,
        memo: dto.memo,
        stages: {
          create: dto.stages.map((s, i) => ({
            name: s.name,
            order: s.order ?? i,
          })),
        },
      },
      include: withStages,
    });
  }

  findAll(userId: string, status?: string) {
    return this.prisma.application.findMany({
      where: {
        userId,
        ...(status ? { status: status as AppStatus } : {}),
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
    if (!app || app.userId !== userId) throw new NotFoundException();
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
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : undefined,
        memo: dto.memo,
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
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
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
}
