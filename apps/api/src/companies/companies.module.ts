import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { NpsService } from './nps.service';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, NpsService],
})
export class CompaniesModule {}
