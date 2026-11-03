import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';

@Module({
  imports: [AuthModule],
  controllers: [GmailController],
  providers: [GmailService],
})
export class GmailModule {}
