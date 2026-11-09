import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase.proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname, search } = request.nextUrl;
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return response;

  // `/api/*` belongs to the API (TM-U3). The rewrite lives here and not in next.config because only the proxy sees the
  // cookies that getUser() just refreshed: a config rewrite drops them (ADR 0008 D5, spike S1).
  const base = process.env.API_INTERNAL_URL;
  // `request` carries the refreshed cookies, so the API receives them; the response carries them back to the browser.
  // The 503 of an unset address carries them too: getUser() has already rotated the refresh token, so a response that
  // dropped the new cookies would lose the session between the Vercel deploy and the setting of the address.
  const answer = base
    ? NextResponse.rewrite(new URL(`${pathname}${search}`, base), { request })
    : new NextResponse(null, { status: 503 });
  for (const cookie of response.cookies.getAll()) answer.cookies.set(cookie);
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) answer.headers.set("cache-control", cacheControl);
  return answer;
}

export const config = {
  matcher: [
    // `/api/*` always reaches the proxy, whatever it ends with: the exclusion below would let `/api/file.png` skip both
    // the rewrite and the 503 (AC10). Every other exclusion is unchanged.
    "/api",
    "/api/:path*",
    "/((?!sitemap\\.xml$|robots\\.txt$|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
