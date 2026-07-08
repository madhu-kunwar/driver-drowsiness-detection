import { Module, Controller, Get } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SessionsModule } from "./sessions/sessions.module";
import { InsurerModule } from "./insurer/insurer.module";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    InsurerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
