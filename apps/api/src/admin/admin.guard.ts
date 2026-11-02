import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { type AuthedRequest } from '../auth/authed-request';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminKakaoId } from './admin.util';

/**
 * 어드민 전용 가드. JwtAuthGuard 뒤에 둬서(req.user 설정됨) 그 사용자의
 * kakaoId가 ADMIN_KAKAO_IDS 허용목록에 있는지 확인한다. 소유권을 넘어
 * 전체 데이터를 보는 라우트이므로 이 가드로만 통과시킨다.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const id = req.user?.id;
    if (!id) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { kakaoId: true },
    });
    if (!isAdminKakaoId(user?.kakaoId, process.env.ADMIN_KAKAO_IDS)) {
      throw new ForbiddenException('관리자만 접근할 수 있어요.');
    }
    return true;
  }
}
