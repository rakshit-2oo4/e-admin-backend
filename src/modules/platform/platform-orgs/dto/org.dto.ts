import { Transform, Type } from 'class-transformer';
import {
  IsDate, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateOrgDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @Transform(trimLower) @IsString() @MinLength(3) @MaxLength(63)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug must be lowercase letters, numbers and single hyphens' })
  slug!: string;

  @IsOptional() @Transform(trimLower) @IsString() @MaxLength(40)
  plan?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  trialEndsAt?: Date;

  @Transform(trimLower) @IsEmail() @MaxLength(254)
  ownerEmail!: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  ownerName?: string;

  @IsString() @MinLength(12) @MaxLength(128)
  ownerPassword!: string;
}

export class UpdateOrgDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @Transform(trimLower) @IsString() @MinLength(1) @MaxLength(40)
  plan?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650)
  retentionDays?: number;
}

export class SuspendOrgDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;
}

export enum OrgStatusFilter {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
  ALL = 'all',
}

export class ListOrgsQueryDto extends PageQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @Transform(trimLower) @IsString() @MaxLength(40)
  plan?: string;

  @IsOptional() @IsEnum(OrgStatusFilter)
  status?: OrgStatusFilter;
}
