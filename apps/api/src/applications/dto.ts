import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class StageInputDto {
  @IsString() name: string;
  @IsInt() order: number;
}

export class CreateApplicationDto {
  @IsString() companyName: string;
  @IsString() position: string;
  @IsOptional() @IsString() jobUrl?: string;
  @IsOptional() @IsString() rawPosting?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() appliedAt?: string;
  @IsOptional() @IsString() memo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageInputDto)
  stages: StageInputDto[];
}

export class UpdateApplicationDto {
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() jobUrl?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() appliedAt?: string;
  @IsOptional() @IsString() memo?: string;
  @IsOptional()
  @IsIn(['IN_PROGRESS', 'OFFER', 'REJECTED', 'CLOSED'])
  status?: string;
}

export class CreateStageDto {
  @IsString() name: string;
  @IsOptional() @IsInt() order?: number;
}

export class UpdateStageDto {
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED'])
  status?: string;
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsString() completedAt?: string;
}
