import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule], // JwtAuthGuard·JwtModule
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
