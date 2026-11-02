import { Controller, Get, UseGuards } from '@nestjs/common';

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

  @Get('users')
  users() {
    return this.svc.users();
  }

  @Get('applications')
  applications() {
    return this.svc.applications();
  }
}
