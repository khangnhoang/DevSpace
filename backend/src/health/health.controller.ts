import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/decorators";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";
import { DbService } from "../db/db.service";

// The health routes: a monitor and Railway call them without a session. The other public route is
// `GET /api/courses/home` (TM-U4); a test names the whole public set.
@Public()
@Controller("health")
export class HealthController {
  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly db: DbService,
  ) {}

  // Touches no database: Railway's health check calls it, and a paused or unreachable database must not put the
  // API in a restart loop (ADR 0008 D2). The production gate reads `commit` to see which backend is live
  // (ADR 0008 D10): keep the field and its meaning.
  @Get()
  health() {
    return { ok: true, commit: this.env.commit };
  }

  // `select 1` through the pool: the uptime monitor's keyword path, which also fails when the Supabase project is
  // paused. It answers 503 with no detail when the database cannot be used.
  @Get("db")
  async healthDb(@Res({ passthrough: true }) res: Response) {
    const ok = await this.db.probe();
    if (!ok) res.status(503);
    return { ok };
  }
}
