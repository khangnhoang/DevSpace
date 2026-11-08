import { DynamicModule, Module } from "@nestjs/common";
import { ServerEnv } from "./common/env";
import { SERVER_ENV } from "./common/tokens";
import { HealthController } from "./health/health.controller";

@Module({})
export class AppModule {
  static register(
    env: ServerEnv,
    extraModules: DynamicModule[] = [],
  ): DynamicModule {
    return {
      module: AppModule,
      imports: extraModules,
      controllers: [HealthController],
      providers: [{ provide: SERVER_ENV, useValue: env }],
    };
  }
}
