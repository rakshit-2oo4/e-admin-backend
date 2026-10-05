import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(trimLower) @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @Transform(trimLower) @IsEmail() @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200)
  token!: string;

  @IsString() @MinLength(12) @MaxLength(128)
  newPassword!: string;
}
