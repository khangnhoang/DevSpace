import "reflect-metadata";
import { DynamicModule } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ServerEnv } from "./common/env";

// The one place the application is assembled, so the production entry point (main.ts) and the e2e entry point,
// which adds the test-only fixtures, cannot differ in anything else.
export async function createApp(
  env: ServerEnv,
  extraModules: DynamicModule[] = [],
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(env, extraModules),
    {
      logger: ["error", "warn", "log"],
    },
  );
  app.disable("x-powered-by");
  app.setGlobalPrefix("api");
  return app;
}
