import { Controller, Get, Inject } from "@nestjs/common";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";

// Touches no database: Railway's health check calls it, and a paused or unreachable database must not put the API
// in a restart loop (ADR 0008 D2). The database path is /api/health/db.
@Controller("health")
export class HealthController {
  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {}

  @Get()
  health() {
    return { ok: true, commit: this.env.commit };
  }
}
