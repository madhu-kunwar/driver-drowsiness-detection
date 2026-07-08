import { Controller, Get, Post, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { CompleteSessionDto } from "./dto/complete-session.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AiApiKeyGuard } from "../common/guards/ai-api-key.guard";

@Controller("sessions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("driver")
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.sessionsService.findAll(user.id);
  }

  @Get("analytics/heatmap")
  heatmap(@CurrentUser() user: any) {
    return this.sessionsService.getHeatmap(user.id);
  }

  @Get("analytics/alert-frequency")
  alertFrequency(@CurrentUser() user: any) {
    return this.sessionsService.getAlertFrequency(user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.sessionsService.findOne(id, user.id);
  }

  @Post()
  start(@CurrentUser() user: any) {
    return this.sessionsService.startSession(user.id);
  }

  @Patch(":id")
  complete(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Body() dto: CompleteSessionDto,
  ) {
    return this.sessionsService.completeSession(id, user.id, dto);
  }
}

// Separate controller for AI service calls (uses API key, not JWT)
@Controller("internal/sessions")
export class InternalSessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Patch(":driverId/:sessionId")
  @UseGuards(AiApiKeyGuard)
  completeFromAi(
    @Param("driverId") driverId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: CompleteSessionDto,
  ) {
    return this.sessionsService.completeSession(sessionId, driverId, dto);
  }
}
