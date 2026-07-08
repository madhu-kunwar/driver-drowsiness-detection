import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // Root welcome — visible before /api prefix
  app.use("/", (req: Request, res: Response, next: () => void) => {
    if (req.path === "/" && req.method === "GET") {
      res.json({
        name:    "DrowsyShield API",
        status:  "ok",
        version: "1.0.0",
        docs:    "/api/auth/login — POST to get a JWT",
      });
    } else {
      next();
    }
  });

  const allowedOrigins = [
    "http://localhost:3000",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : []),
  ];
  app.enableCors({
    origin:      (origin, cb) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:        true,
      forbidNonWhitelisted: true,
      transform:        true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`DrowsyShield API running on http://localhost:${port}/api`);
}

bootstrap();
