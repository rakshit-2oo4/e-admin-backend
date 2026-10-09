import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = 'REDIS';

@Global()
@Module({
    providers: [
        {
            provide: REDIS,
            inject: [ConfigService],
            useFactory: (c: ConfigService) => {
                const log = new Logger('Redis');
                const client = new Redis(c.getOrThrow<string>('redisUrl'), {
                    maxRetriesPerRequest: 3,
                    connectTimeout: 10_000,
                });
                client.on('ready', () => log.log('Connected'));
                client.on('error', (e) => log.error(`Redis error: ${e.message}`));
                return client;
            },
        },
    ],
    exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
    constructor(@Inject(REDIS) private readonly redis: Redis) { }

    async onApplicationShutdown() {
        await this.redis.quit().catch(() => undefined);
    }
}