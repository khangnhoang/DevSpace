import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";
import { ProofController } from "./proof.controller";
import { ProofTimingMiddleware } from "./proof-timing";

// Registered only when API_PROOF_ENABLED=1 (app.module.ts). Removed by PR 2.
@Module({})
export class ProofModule implements NestModule {
  static register(): DynamicModule {
    return { module: ProofModule, controllers: [ProofController] };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProofTimingMiddleware).forRoutes(ProofController);
  }
}
