import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = 'REDIS';

@Global()
@Module({
    providers: [
        {
            provide: REDIS,
            inject: [ConfigService],
            useFactory: (c: ConfigService) => new Redis(c.getOrThrow<string>('redisUrl')),
        },
    ],
    exports: [REDIS],
})
export class RedisModule { }
