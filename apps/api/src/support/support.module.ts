import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

// AuthModule은 JwtModule을 export → 컨트롤러에서 JwtService로 선택적 인증.
// PrismaService는 PrismaModule(@Global)로 주입되므로 별도 import 불필요.
@Module({
  imports: [AuthModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
