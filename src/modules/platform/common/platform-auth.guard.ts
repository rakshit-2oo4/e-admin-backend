import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformUser } from '../entities/platform-user.entity';
import { PlatformError } from './platform-error';
import { PlatformRequest } from './platform.types';

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(PlatformUser) private readonly users: Repository<PlatformUser>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new PlatformError(401, 'UNAUTHORIZED', 'Missing access token');

    let payload: { sub?: string; kind?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new PlatformError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
    }

    if (payload.kind !== 'platform') throw new PlatformError(401, 'WRONG_TOKEN_KIND');

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new PlatformError(401, 'UNAUTHORIZED', 'Unknown user');
    if (!user.isActive) throw new PlatformError(401, 'ACCOUNT_DISABLED');

    req.platformUser = user;
    return true;
  }
}
