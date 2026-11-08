"use server";

import { apiFetch } from "@/lib/api.server";

// A server-side POST through the helper: the one write the rows of AC11 drive. It sends no argument and returns only
// the status the API answered, so the caller's session and the helper's Origin decide the outcome.
export async function fixturePost(): Promise<{ status: number }> {
  const response = await apiFetch("/api/e2e/mutate", { method: "POST" });
  await response.arrayBuffer();
  return { status: response.status };
}
