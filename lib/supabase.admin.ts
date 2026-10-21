import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only reads that must bypass RLS (e.g. private
// lesson columns after an access check). Never import this from client code.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
