import { IsString, IsOptional, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vehicle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  avatarInitials?: string;
}
