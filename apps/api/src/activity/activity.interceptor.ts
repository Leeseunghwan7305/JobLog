import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';

import { type AuthedRequest } from '../auth/authed-request';
import { ActivityService } from './activity.service';

/**
 * 전역 인터셉터. 가드 이후 실행되므로 req.user가 세팅돼 있다.
 * 인증된 사용자의 "오늘 활동"을 비동기로 기록(요청을 지연시키지 않음).
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private activity: ActivityService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    this.activity.touch(req.user?.id);
    return next.handle();
  }
}
