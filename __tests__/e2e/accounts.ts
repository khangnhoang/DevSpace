import { join } from "node:path";

export type Actor = "learner" | "student" | "admin";

// The one local test password written in supabase/seed.sql for every seed user; only test code on the local server
// uses it.
const SEED_PASSWORD = "localpassword123";

export const ACCOUNTS: Record<Actor, { email: string; password: string; fullName: string }> = {
  learner: { email: "learner@devspace.test", password: SEED_PASSWORD, fullName: "Nguyễn Văn Học" },
  student: { email: "student@devspace.test", password: SEED_PASSWORD, fullName: "Lê Minh Học Viên" },
  admin: { email: "admin@devspace.test", password: SEED_PASSWORD, fullName: "Trần Thị Quản" },
};

export const IDS: Record<Actor, string> = {
  learner: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  student: "33333333-3333-4333-8333-333333333333",
};

// Saved sessions: ignored by git (`.gitignore`), written by auth.setup.ts, loaded by the specs.
export const authFile = (actor: Actor) => join(__dirname, ".auth", `${actor}.json`);
