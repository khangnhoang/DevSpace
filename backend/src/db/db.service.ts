import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ProbeCache } from "../common/probe-cache";
import { ServerEnv } from "../common/env";
import { SERVER_ENV } from "../common/tokens";
import { poolConfig } from "./pool";
import * as relations from "./relations";
import * as tables from "./schema";

// The generated files (scripts/api/schema.mjs); a hand edit is lost at the next pull.
const schema = { ...tables, ...relations };

export const API_ROLE = "devspace_api";
// At most one database probe per window however many callers arrive (AC4).
export const PROBE_WINDOW_MS = 10_000;

// The API must never run with owner rights (ADR 0008 D7, plan G3). A different user is a fatal configuration error.
export class DatabaseIdentityError extends Error {}

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;
  private readonly logger = new Logger(DbService.name);
  private readonly probeCache = new ProbeCache(PROBE_WINDOW_MS);
  private verified = false;

  constructor(@Inject(SERVER_ENV) env: ServerEnv) {
    this.pool = new Pool(poolConfig(env.databaseUrl));
    this.db = drizzle({ client: this.pool, schema });
    // An idle client that the pooler closes emits here; without a listener Node would end the process.
    this.pool.on("error", (error: Error & { code?: string }) => {
      this.logger.warn(
        `idle database client error (${error.code ?? "no code"})`,
      );
    });
  }

  // Runs at startup. A wrong user stops the process. A database that cannot be reached does not: a paused Supabase
  // project must not put the API in a restart loop (ADR 0008 D2), so the check repeats on the next probe.
  async verifyIdentity(): Promise<void> {
    let user: string;
    try {
      user = (
        await this.pool.query<{ user: string }>("select current_user as user")
      ).rows[0].user;
    } catch (error) {
      this.logger.warn(
        `the database could not be reached at startup (${(error as { code?: string }).code ?? "no code"}); the role check repeats on the next probe`,
      );
      return;
    }
    this.assertRole(user);
  }

  private assertRole(user: string) {
    if (user !== API_ROLE) {
      throw new DatabaseIdentityError(
        `The database connection runs as "${user}", not "${API_ROLE}". The API connects only as ${API_ROLE}.`,
      );
    }
    this.verified = true;
  }

  // `select 1` through the pool, shared between callers and kept for the window. False carries no detail.
  probe(): Promise<boolean> {
    return this.probeCache.run(async () => {
      if (!this.verified) {
        const user = (
          await this.pool.query<{ user: string }>("select current_user as user")
        ).rows[0].user;
        this.assertRole(user);
      }
      await this.pool.query("select 1");
      return true;
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
