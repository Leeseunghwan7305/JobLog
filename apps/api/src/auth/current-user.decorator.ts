import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 요청에서 인증된 사용자 id를 꺼낸다 (JwtAuthGuard가 req.user 설정) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.user?.id;
  },
);
