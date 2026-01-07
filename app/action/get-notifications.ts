"use server";

import { createSupabaseServerClient } from "@/lib/supabase.server";

export async function markAsRead(notificationId: number) {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}
