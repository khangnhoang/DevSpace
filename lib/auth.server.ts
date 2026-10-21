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
