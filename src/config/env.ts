export const env = () => ({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '8080', 10),
    databaseUrl: process.env.DATABASE_URL as string,
    redisUrl: process.env.REDIS_URL as string,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtAccessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900', 10),
    pepper: process.env.INVITE_HASH_PEPPER as string,
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10),
});
