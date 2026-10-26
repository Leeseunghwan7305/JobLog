import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { type AuthedRequest } from './authed-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        header.slice(7),
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      req.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
