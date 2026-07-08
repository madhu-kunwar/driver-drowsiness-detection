import { Module } from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { SessionsController, InternalSessionsController } from "./sessions.controller";

@Module({
  providers:   [SessionsService],
  controllers: [SessionsController, InternalSessionsController],
  exports:     [SessionsService],
})
export class SessionsModule {}
