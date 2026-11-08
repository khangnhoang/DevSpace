// Used only by scripts/api/schema.mjs, which runs `drizzle-kit pull` against a loopback database and keeps schema.ts and
// relations.ts. The baseline SQL and meta/ that pull also writes are discarded and never applied: supabase/migrations
// owns the schema until TM-U11 (ADR 0008 D9). No push, generate or migrate command exists in package.json.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: process.env.DRIZZLE_OUT ?? "./src/db/.pull",
  schemaFilter: ["public"],
  introspect: { casing: "camel" },
  dbCredentials: { url: process.env.DRIZZLE_DATABASE_URL ?? "" },
});
