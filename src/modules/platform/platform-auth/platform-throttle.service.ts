import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../../../common/redis/redis.module';
import { PlatformError } from '../common/platform-error';

const WINDOW_SECONDS = 15 * 60;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

@Injectable()
export class PlatformThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private emailKey = (email: string) => `platform:login:email:${email}`;
  private ipKey = (ip: string) => `platform:login:ip:${ip}`;

  async assertNotBlocked(email: string, ip: string | null): Promise<void> {
    const [e, i] = await Promise.all([
      this.redis.get(this.emailKey(email)),
      ip ? this.redis.get(this.ipKey(ip)) : Promise.resolve(null),
    ]);
    if (Number(e ?? 0) >= MAX_PER_EMAIL || Number(i ?? 0) >= MAX_PER_IP) {
      throw new PlatformError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Try again later.');
    }
  }

  async recordFailure(email: string, ip: string | null): Promise<void> {
    const keys = [this.emailKey(email), ...(ip ? [this.ipKey(ip)] : [])];
    const pipe = this.redis.multi();
    for (const k of keys) pipe.incr(k).expire(k, WINDOW_SECONDS, 'NX');
    await pipe.exec();
  }

  async clearEmail(email: string): Promise<void> {
    await this.redis.del(this.emailKey(email));
  }
}
