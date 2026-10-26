import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { type AuthedRequest } from './authed-request';

/** 요청에서 인증된 사용자 id를 꺼낸다 (JwtAuthGuard가 req.user 설정) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const id = req.user?.id;
    if (!id) throw new UnauthorizedException();
    return id;
  },
);
