import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { PlatformRole } from '../entities/platform-user.entity';
import { PLATFORM_ROLES_KEY, PlatformRequest, RequestMeta } from './platform.types';

export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);

export const CurrentPlatformUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<PlatformRequest>().platformUser;
});

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<PlatformRequest>();
  const ua = req.headers['user-agent'];
  return { ip: req.ip ?? null, userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null };
});
