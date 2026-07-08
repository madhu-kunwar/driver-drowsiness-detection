import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class AlertEventDto {
  @IsString()
  timestamp: string;

  @IsNumber()
  @Min(0) @Max(3)
  level: number;

  @IsNumber()
  score: number;

  @IsOptional() @IsNumber() ear?: number;
  @IsOptional() @IsNumber() perclos?: number;
  @IsOptional() @IsNumber() mar?: number;
}

export class CompleteSessionDto {
  @IsString()
  endedAt: string;

  @IsNumber()
  durationS: number;

  @IsNumber()
  avgScore: number;

  @IsNumber()
  peakScore: number;

  @IsString()
  riskBand: string;

  @IsNumber()
  premiumAdjustment: number;

  @IsNumber() alertCount0: number;
  @IsNumber() alertCount1: number;
  @IsNumber() alertCount2: number;
  @IsNumber() alertCount3: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlertEventDto)
  events?: AlertEventDto[];
}
