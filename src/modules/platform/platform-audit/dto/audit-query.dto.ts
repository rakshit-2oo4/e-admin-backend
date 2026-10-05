import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AuditQueryDto {
  @IsOptional() @IsString() @MaxLength(500)
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;

  @IsOptional() @IsString() @MaxLength(80)
  action?: string;

  @IsOptional() @IsString() @MaxLength(80)
  entityType?: string;

  @IsOptional() @IsUUID()
  platformUserId?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  from?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  to?: Date;
}
