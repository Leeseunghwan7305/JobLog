import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
