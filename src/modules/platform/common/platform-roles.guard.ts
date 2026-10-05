import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '../entities/platform-user.entity';
import { PlatformError } from './platform-error';
import { PLATFORM_ROLES_KEY, PlatformRequest } from './platform.types';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest<PlatformRequest>().platformUser;
    const known = Object.values(PlatformRole) as string[];
    if (!user || !known.includes(user.role)) throw new PlatformError(403, 'INSUFFICIENT_ROLE');

    const required = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(PLATFORM_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (required && required.length > 0 && !required.includes(user.role)) {
      throw new PlatformError(403, 'INSUFFICIENT_ROLE');
    }
    return true;
  }
}
