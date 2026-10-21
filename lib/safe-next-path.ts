const ALLOWED_NEXT_PATHS = ["/", "/auth/reset-password"] as const;

export type SafeNextPath = (typeof ALLOWED_NEXT_PATHS)[number];

// Only exact allowlisted paths are accepted; anything else (absolute URLs,
// `//host`, `javascript:`, unknown paths) falls back to "/".
export function safeNextPath(raw: string | null): SafeNextPath {
  return ALLOWED_NEXT_PATHS.find((path) => path === raw) ?? "/";
}
