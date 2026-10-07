import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlatformRole } from '../../entities/platform-user.entity';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePlatformUserDto {
  @Transform(trimLower) @IsEmail() @MaxLength(254)
  email!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsString() @MinLength(12) @MaxLength(128)
  password!: string;

  @IsEnum(PlatformRole)
  role!: PlatformRole;
}

export class UpdatePlatformUserDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @IsOptional() @IsEnum(PlatformRole)
  role?: PlatformRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(128)
  currentPassword!: string;

  @IsString() @MinLength(12) @MaxLength(128)
  newPassword!: string;
}

export class AdminResetPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128)
  newPassword!: string;
}

