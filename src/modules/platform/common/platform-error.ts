import { HttpException } from '@nestjs/common';

export class PlatformError extends HttpException {
  constructor(status: number, code: string, message?: string) {
    super({ ok: false, error: { code, message: message ?? code } }, status);
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as any)?.driverError?.code === '23505' || (err as any)?.code === '23505';
}
