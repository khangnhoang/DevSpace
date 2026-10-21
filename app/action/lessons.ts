"use server";

import { requireAdmin } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.admin";

// Admin lesson list including the private `content` / `video_url` columns,
// which anon/authenticated clients can no longer select.
export async function getLessonsForAdmin() {
  if ("error" in (await requireAdmin())) return [];

  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      "id, title, slug, content, course_id, chapter_id, video_url, order_index, courses (id, name), chapters (id, title)",
    )
    .order("course_id", { ascending: true })
    .order("chapter_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) return [];
  return data || [];
}
