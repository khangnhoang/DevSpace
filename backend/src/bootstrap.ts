import "reflect-metadata";
import { DynamicModule } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ServerEnv } from "./common/env";
import { DbService } from "./db/db.service";

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

// Builds the app, checks the database role and only then listens, so a process with the wrong role never serves.
export async function startApp(
  env: ServerEnv,
  extraModules: DynamicModule[] = [],
): Promise<NestExpressApplication> {
  const app = await createApp(env, extraModules);
  try {
    await app.get(DbService).verifyIdentity();
    await app.listen(env.port, env.host);
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}
