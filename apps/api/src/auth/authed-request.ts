import type { Request } from 'express';

/** JwtAuthGuard가 인증 후 주입하는 사용자 정보를 포함한 요청 타입. */
export interface AuthedRequest extends Request {
  user?: { id: string };
}
