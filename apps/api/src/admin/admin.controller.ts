import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

// JwtAuthGuard(인증) → AdminGuard(인가) 이중 게이트. 전체 데이터 조회 전용.
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('overview')
  overview() {
    return this.svc.overview();
  }

  @Get('metrics')
  metrics() {
    return this.svc.metrics();
  }

  @Get('users')
  users(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.users(page, pageSize);
  }

  @Get('applications')
  applications(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.applications(page, pageSize);
  }
}
