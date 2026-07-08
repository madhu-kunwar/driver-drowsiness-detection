import { IsIn } from "class-validator";

export class UpdateClaimDto {
  @IsIn(["open", "investigating", "resolved", "denied"])
  status: string;
}
