import { Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  // 개발/테스트용 수동 트리거 (실제 발송은 cron이 담당)
  @Post('run')
  run() {
    return this.svc.runDueNotifications();
  }
}
