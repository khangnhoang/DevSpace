import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase.server";
import { safeNextPath } from "@/lib/safe-next-path";

// Exchanges the PKCE `code` on the server. Success is only reported when this
// very request exchanged the code, so an already signed-in user can never be
// mistaken for the owner of someone else's link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = NextResponse.redirect(`${origin}/auth/error`);

  if (!code || searchParams.get("error") || searchParams.get("error_description")) {
    return failed;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failed;

  return NextResponse.redirect(`${origin}${safeNextPath(searchParams.get("next"))}`);
}
