"use server";

import { notificationIdSchema } from "@/lib/schemas/notification";
import { createSupabaseServerClient } from "@/lib/supabase.server";

export async function markAsRead(notificationId: number) {
  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", parsed.data);
}
