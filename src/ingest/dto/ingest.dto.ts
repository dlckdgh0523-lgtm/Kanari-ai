import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// SDK가 보내는 에러 이벤트 한 건의 모양
export class IngestEventDto {
  // 에러 클래스 이름 (예: TypeError, PrismaClientKnownRequestError)
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  stack?: string;

  @IsOptional()
  @IsIn(['error', 'warn', 'info'])
  level?: string;

  // 같은 요청에서 나온 로그를 한 줄로 꿰는 ID. 보내는 쪽이 만들어서 넣는다
  @IsOptional()
  @IsString()
  @MaxLength(100)
  traceId?: string;

  // 그 외 부가 정보 (요청 경로, 사용자 ID 해시 등). 개인정보 금지 - docs/logging-standard.md 참조
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

// 네트워크 왕복을 줄이려고 SDK는 이벤트를 모아서 배치로 보낸다
export class IngestBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events: IngestEventDto[];
}
