import { DynamicModule, Module } from "@nestjs/common";
import { E2eController } from "./e2e.controller";

@Module({})
export class E2eModule {
  static register(): DynamicModule {
    return { module: E2eModule, controllers: [E2eController] };
  }
}
