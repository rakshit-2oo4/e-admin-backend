import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { PlatformError } from '../common/platform-error';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { CurrentPlatformUser, ReqMeta } from '../common/platform-roles.decorator';
import { REFRESH_COOKIE, SESSION_COOKIE, toPublicUser } from '../common/platform.types';
import type { RequestMeta } from '../common/platform.types';
import { PlatformUser } from '../entities/platform-user.entity';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { PlatformAuthService } from './platform-auth.service';

const REFRESH_PATH = '/api/platform/auth';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly cfg: ConfigService,
  ) {}

  private setCookies(res: Response, raw: string, expiresAt: Date) {
    const secure = this.cfg.get<string>('nodeEnv') === 'production';
    res.cookie(REFRESH_COOKIE, raw, { httpOnly: true, sameSite: 'lax', secure, path: REFRESH_PATH, expires: expiresAt });
    res.cookie(SESSION_COOKIE, '1', { httpOnly: false, sameSite: 'lax', secure, path: '/', expires: expiresAt });
  }

  private clearCookies(res: Response) {
    const secure = this.cfg.get<string>('nodeEnv') === 'production';
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: REFRESH_PATH });
    res.clearCookie(SESSION_COOKIE, { httpOnly: false, sameSite: 'lax', secure, path: '/' });
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.password, meta);
    this.setCookies(res, r.refresh.raw, r.refresh.expiresAt);
    return { accessToken: r.accessToken, user: r.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new PlatformError(401, 'INVALID_REFRESH_TOKEN');
    try {
      const r = await this.auth.refresh(raw, meta);
      this.setCookies(res, r.refresh.raw, r.refresh.expiresAt);
      return { accessToken: r.accessToken };
    } catch (e) {
      this.clearCookies(res);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined, meta);
    this.clearCookies(res);
    return { loggedOut: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(PlatformAuthGuard)
  async logoutAll(@CurrentPlatformUser() user: PlatformUser, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user, meta);
    this.clearCookies(res);
    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(PlatformAuthGuard)
  me(@CurrentPlatformUser() user: PlatformUser) {
    return toPublicUser(user);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If the account exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto, @ReqMeta() meta: RequestMeta) {
    await this.auth.resetPassword(dto.token, dto.newPassword, meta);
    return { message: 'Password updated.' };
  }
}
