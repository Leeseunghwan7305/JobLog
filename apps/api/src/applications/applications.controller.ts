import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  CreateStageDto,
  UpdateApplicationDto,
  UpdateStageDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ApplicationsController {
  constructor(private svc: ApplicationsService) {}

  @Get('dashboard/stats')
  stats(@CurrentUser() userId: string) {
    return this.svc.stats(userId);
  }

  @Get('dashboard/insights')
  insights(@CurrentUser() userId: string) {
    return this.svc.insights(userId);
  }

  @Get('calendar')
  calendar(
    @CurrentUser() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.calendar(userId, from, to);
  }

  @Post('applications')
  create(@CurrentUser() userId: string, @Body() dto: CreateApplicationDto) {
    return this.svc.create(userId, dto);
  }

  @Get('applications')
  findAll(
    @CurrentUser() userId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('archived') archived?: string,
  ) {
    return this.svc.findAll(userId, status, q, archived === 'true');
  }

  @Get('applications/:id')
  findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.svc.findOne(userId, id);
  }

  @Patch('applications/:id')
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.svc.update(userId, id, dto);
  }

  @Delete('applications/:id')
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.svc.remove(userId, id);
  }

  @Post('applications/:id/stages')
  addStage(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.svc.addStage(userId, id, dto);
  }

  @Patch('applications/:id/stages/:stageId')
  updateStage(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.svc.updateStage(userId, id, stageId, dto);
  }

  @Delete('applications/:id/stages/:stageId')
  removeStage(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
  ) {
    return this.svc.removeStage(userId, id, stageId);
  }
}
