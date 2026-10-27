import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ParseModule } from '../parse/parse.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [AuthModule, ParseModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
