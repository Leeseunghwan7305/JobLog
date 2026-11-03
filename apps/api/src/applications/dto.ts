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
  @IsOptional() @IsInt() employeeCount?: number;
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
  @IsOptional() @IsInt() employeeCount?: number;
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
  @IsOptional() @IsString() scheduledAt?: string | null;
  @IsOptional() @IsString() completedAt?: string | null;
}

/**
 * 전형 진행 단일 액션 (순서 기반 일괄 갱신).
 * - current: 이 단계=진행중, 이전=합격, 이후=대기 ("나 지금 여기")
 * - passed : 이 단계=합격, 다음 단계=진행중(없으면 최종합격), 이전=합격
 * - failed : 이 단계=탈락(→불합격), 이전=합격, 이후=대기
 */
export class StageProgressDto {
  @IsIn(['current', 'passed', 'failed'])
  mode!: 'current' | 'passed' | 'failed';
}
