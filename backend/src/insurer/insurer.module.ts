import { Module } from "@nestjs/common";
import { InsurerService } from "./insurer.service";
import { InsurerController } from "./insurer.controller";

@Module({
  providers:   [InsurerService],
  controllers: [InsurerController],
})
export class InsurerModule {}
