import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase.proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname, search } = request.nextUrl;
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return response;

  // `/api/*` belongs to the API (TM-U3). The rewrite lives here and not in next.config because only the proxy sees the
  // cookies that getUser() just refreshed: a config rewrite drops them (ADR 0008 D5, spike S1).
  const base = process.env.API_INTERNAL_URL;
  if (!base) return new NextResponse(null, { status: 503 });
  // `request` carries the refreshed cookies, so the API receives them; the response carries them back to the browser.
  const rewrite = NextResponse.rewrite(new URL(`${pathname}${search}`, base), {
    request,
  });
  for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) rewrite.headers.set("cache-control", cacheControl);
  return rewrite;
}

export const config = {
  matcher: [
    "/((?!sitemap\\.xml$|robots\\.txt$|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
