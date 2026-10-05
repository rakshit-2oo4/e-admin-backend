import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly log = new Logger('Exceptions');

    catch(e: unknown, host: ArgumentsHost) {
        const res = host.switchToHttp().getResponse<Response>();

        if (e instanceof HttpException) {
            const status = e.getStatus();
            const body = e.getResponse() as any;
            if (body && body.ok === false) return res.status(status).json(body);
            const message = Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? e.message);
            return res.status(status).json({
                ok: false,
                error: { code: CODE_BY_STATUS[status] ?? 'ERROR', message },
            });
        }

        this.log.error((e as Error)?.message ?? 'Unknown error');
        return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
    }
}
