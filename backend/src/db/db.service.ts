import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
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

export type Db = NodePgDatabase<typeof schema>;
type Check = "verified" | "unreachable";

@Injectable()
export class DbService implements OnModuleDestroy {
  // Private, both of them: a query goes through `connection()`, which returns the Drizzle instance only after the role
  // was verified, and the probe verifies first.
  private readonly pool: Pool;
  private readonly db: Db;
  private readonly logger = new Logger(DbService.name);
  private readonly probeCache = new ProbeCache(PROBE_WINDOW_MS);
  private verified = false;
  private verifying: Promise<Check> | null = null;

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

  // Runs at startup. A wrong user stops the process (the error reaches main.ts). A database that cannot be reached does
  // not: a paused Supabase project must not put the API in a restart loop (ADR 0008 D2), so the check repeats before
  // the first query that needs it, and no query runs until it has passed.
  async verifyIdentity(): Promise<void> {
    await this.verify();
  }

  // The role check, shared by every caller that arrives while it runs. It throws DatabaseIdentityError for a wrong
  // user and answers "unreachable" (nothing remembered, so the next caller asks again) when the database says nothing.
  private verify(): Promise<Check> {
    if (this.verified) return Promise.resolve("verified");
    this.verifying ??= (async (): Promise<Check> => {
      try {
        let user: string;
        try {
          user = (
            await this.pool.query<{ user: string }>(
              "select current_user as user",
            )
          ).rows[0].user;
        } catch (error) {
          this.logger.warn(
            `the database could not be reached (${(error as { code?: string }).code ?? "no code"}); the role check repeats before the next query`,
          );
          return "unreachable";
        }
        this.assertRole(user);
        return "verified";
      } finally {
        this.verifying = null;
      }
    })();
    return this.verifying;
  }

  private assertRole(user: string) {
    if (user !== API_ROLE) {
      throw new DatabaseIdentityError(
        `The database connection runs as "${user}", not "${API_ROLE}". The API connects only as ${API_ROLE}.`,
      );
    }
    this.verified = true;
  }

  // After startup a wrong user ends the process from whichever path finds it, a handler or the probe: the pool must
  // never serve a query as another role, and nothing downstream (the probe cache, a handler's error path) may turn it
  // into a quiet `false`.
  private async checked(): Promise<Check> {
    try {
      return await this.verify();
    } catch (error) {
      if (error instanceof DatabaseIdentityError) {
        console.error(`api: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  }

  // The only way to query. Unverified means verified first; a database that cannot be asked is a 503 with no detail.
  async connection(): Promise<Db> {
    if ((await this.checked()) === "unreachable") {
      throw new ServiceUnavailableException();
    }
    return this.db;
  }

  // `select 1` through the pool, shared between callers and kept for the window. False carries no detail.
  probe(): Promise<boolean> {
    return this.probeCache.run(async () => {
      if ((await this.checked()) === "unreachable") return false;
      await this.pool.query("select 1");
      return true;
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
