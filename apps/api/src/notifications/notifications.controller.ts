import {
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  // 개발/테스트용 수동 트리거 (실제 발송은 cron이 담당).
  // 프로덕션에서는 전체 사용자 발송을 앞당기지 못하도록 숨긴다(404).
  @Post('run')
  run() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return this.svc.runDueNotifications();
  }
}
