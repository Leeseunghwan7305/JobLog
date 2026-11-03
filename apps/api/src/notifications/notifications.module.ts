import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KakaoService } from './kakao.service';
import { MailerService } from './mailer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MailerService, KakaoService],
})
export class NotificationsModule {}
