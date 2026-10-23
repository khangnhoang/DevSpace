import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { join } from "node:path";
import { readLocalStack } from "../helpers/local-stack";
import { IDS } from "./accounts";

// Service role: bypasses RLS. Only for checking a precondition and for cleanup, never for a request under test.
// The keys come from `npx supabase status` and the host check runs inside readLocalStack.
let client: SupabaseClient | undefined;
function serviceRole(): SupabaseClient {
  if (!client) {
    const stack = readLocalStack(join(__dirname, "../.."));
    client = createClient(stack.apiUrl, stack.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(`e2e service-role query failed: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

export async function learnerEnrollmentCount(courseId: number): Promise<number> {
  const rows = must(
    await serviceRole().from("enrollments").select("id").eq("user_id", IDS.learner).eq("course_id", courseId),
  );
  return rows.length;
}

// Removes what enrolling the learner in a free course writes: the enrollment and the admin notifications
// that `enrollCourse` inserts with the learner as actor.
export async function removeLearnerEnrollment(courseId: number): Promise<void> {
  must(await serviceRole().from("enrollments").delete().eq("user_id", IDS.learner).eq("course_id", courseId).select("id"));
  must(await serviceRole().from("notifications").delete().eq("actor_id", IDS.learner).eq("type", "enrollment").select("id"));
}
