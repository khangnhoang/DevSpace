import "server-only";

import type { User } from "@supabase/supabase-js";
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
  | { user: User; course: { id: number; slug: string }; isAdmin: boolean }
  | { redirect: string }
  | { notFound: true };

// Gate for /learn pages: signed in, course exists, and the user is enrolled or
// an admin. Runs with the caller's own session, so RLS only exposes their rows.
export async function requireCourseAccess(
  courseSlug: string,
): Promise<CourseAccess> {
  const user = await getCurrentUser();
  if (!user) return { redirect: "/login" };

  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return { notFound: true };

  const [{ data: profile }, { data: enrollment }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle(),
  ]);

  const isAdmin = profile?.role === "admin";
  if (!isAdmin && !enrollment) return { redirect: `/course/${course.slug}` };

  return { user, course, isAdmin };
}
