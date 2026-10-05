import type { Request } from 'express';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  role: PlatformRole;
  kind: 'platform';
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export type PlatformRequest = Request & { platformUser: PlatformUser };

export const PLATFORM_ROLES_KEY = 'platform_roles';
export const REFRESH_COOKIE = 'ebc_prt';
export const SESSION_COOKIE = 'ebc_psession';

export function toPublicUser(u: PlatformUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
