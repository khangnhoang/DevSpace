// The supported limits (Owner decision 20, ADR 0008 D5 gate). Every unit that moves an upload or a long call behind
// the API stays inside them or re-proves them on the production topology.
export const JSON_LIMIT_BYTES = 4 * 1024 * 1024;
export const UPLOAD_LIMIT_BYTES = 2 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 60_000;
// The longest a session check result is trusted (ADR 0008 D6).
export const SESSION_CACHE_TTL_MS = 30_000;
