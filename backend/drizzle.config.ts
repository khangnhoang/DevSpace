// Used only by scripts/api/schema.mjs, which runs `drizzle-kit pull` against a loopback database and keeps schema.ts and
// relations.ts. The baseline SQL and meta/ that pull also writes are discarded and never applied: supabase/migrations
// owns the schema (ADR 0008 D9). No push, generate or migrate command exists in package.json.
import { defineConfig } from "drizzle-kit";
import { assertLocalUrl } from "../__tests__/helpers/local-stack";

// The wrapper checks the host before it starts drizzle-kit, but a direct `drizzle-kit pull --config` call skips the
// wrapper, so the same check runs when the config loads (plan G7, AC14). An unset URL is refused too.
const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? "";
assertLocalUrl("DRIZZLE_DATABASE_URL", databaseUrl, [
  "postgresql:",
  "postgres:",
]);

export default defineConfig({
  dialect: "postgresql",
  out: process.env.DRIZZLE_OUT ?? "./src/db/.pull",
  schemaFilter: ["public"],
  introspect: { casing: "camel" },
  dbCredentials: { url: databaseUrl },
});
