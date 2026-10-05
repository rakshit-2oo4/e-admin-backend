import { Transform } from 'class-transformer';
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

export class StartImpersonationDto {
  @IsUUID() orgId!: string;
  @IsUUID() targetUserId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(10) @MaxLength(500)
  reason!: string;
}

export class EndImpersonationDto {
  @IsUUID() sessionId!: string;
}
