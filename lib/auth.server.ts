import "server-only";

import type { User } from "@supabase/supabase-js";
import { learnOutcome } from "@/lib/learn-api";
import { getCourseOutline } from "@/lib/learn.server";
import { createSupabaseServerClient } from "@/lib/supabase.server";

export type AuthResult = { user: User } | { error: string };

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bạn chưa đăng nhập" };
  return { user };
}

// The role is read from profiles with the caller's own session, never from
// user_metadata (which the user controls).
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireUser();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { error: "Không có quyền truy cập" };
  return auth;
}

export type CourseAccess =
  | {
      // The id the API answer names; the quiz page is its only reader, and it needs nothing else of the session.
      user: { id: string };
      course: { id: number; slug: string };
      isAdmin: boolean;
    }
  | { redirect: string }
  | { notFound: true }
  // The API failed without a refusal (a 5xx, an unreachable API, an answer that does not match its schema). A page
  // shows its message and never redirects, so an outage does not read as "not signed in" or "not enrolled" (G4).
  | { unavailable: true };

// Gate for /learn pages whose own read is the outline: the API decides everything (session, course, enrollment or
// admin) and answers 401, 403 or 404, which map to the same redirects and not-found screen as before (TM-U5). No
// `getCurrentUser()` runs here: the API is the one authority, and only its 401 sends a visitor to /login. The lesson
// and quiz pages take the same verdict from their own routes' answers (`lib/learn.server.ts`) instead of a second call.
export async function requireCourseAccess(
  courseSlug: string,
): Promise<CourseAccess> {
  const read = await getCourseOutline(courseSlug);
  const outcome = learnOutcome(read, courseSlug);
  if (outcome) return outcome;
  if (read.status !== "ok") return { unavailable: true };
  const { user, course, isAdmin } = read.data;
  return { user, course, isAdmin };
}
