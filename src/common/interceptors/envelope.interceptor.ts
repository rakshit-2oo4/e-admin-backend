import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
    intercept(_ctx: ExecutionContext, next: CallHandler) {
        return next.handle().pipe(map((data) => ({ ok: true, data })));
    }
}
