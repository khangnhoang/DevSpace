import { DynamicModule, Module } from "@nestjs/common";
import { ProofController } from "./proof.controller";

// Registered only when API_PROOF_ENABLED=1 (app.module.ts). Removed by PR 2.
@Module({})
export class ProofModule {
  static register(): DynamicModule {
    return { module: ProofModule, controllers: [ProofController] };
  }
}
