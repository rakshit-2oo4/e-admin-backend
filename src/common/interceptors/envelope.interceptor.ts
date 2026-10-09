import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { map } from 'rxjs';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
    intercept(ctx: ExecutionContext, next: CallHandler) {
        const res = ctx.switchToHttp().getResponse<Response>();
        return next.handle().pipe(
            map((data) => {
                if (res.headersSent) return data;
                if (data instanceof StreamableFile) return data;
                const contentType = res.getHeader?.('content-type');
                if (typeof contentType === 'string' && contentType.includes('text/csv')) {
                    return data;
                }
                return { ok: true, data };
            }),
        );
    }
}

