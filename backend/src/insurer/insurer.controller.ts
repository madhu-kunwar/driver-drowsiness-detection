import { Controller, Get, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { InsurerService } from "./insurer.service";
import { UpdateClaimDto } from "./dto/update-claim.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@Controller("insurer")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("insurer")
export class InsurerController {
  constructor(private insurerService: InsurerService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: any) {
    return this.insurerService.getFleetSummary(user.companyId ?? "");
  }

  @Get("drivers")
  getDrivers(@CurrentUser() user: any) {
    return this.insurerService.getDrivers(user.companyId ?? "");
  }

  @Get("drivers/:id")
  getDriver(@Param("id") id: string) {
    return this.insurerService.getDriver(id);
  }

  @Get("claims")
  getClaims(@CurrentUser() user: any) {
    return this.insurerService.getClaims(user.companyId ?? "");
  }

  @Get("claims/:id")
  getClaim(@Param("id") id: string) {
    return this.insurerService.getClaim(id);
  }

  @Patch("claims/:id")
  updateClaim(@Param("id") id: string, @Body() dto: UpdateClaimDto) {
    return this.insurerService.updateClaimStatus(id, dto);
  }
}
