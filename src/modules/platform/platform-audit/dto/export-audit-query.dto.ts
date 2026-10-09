import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ExportAuditQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(80)
  action?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(80)
  entityType?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  actor?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(20)
  outcome?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(20)
  date?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  from?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  to?: Date;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  limit: number = 5000;
}
