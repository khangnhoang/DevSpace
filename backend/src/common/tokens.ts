// Injection tokens. Plain strings, because esbuild-based tools do not emit decorator metadata and the API is
// compiled by tsc only; explicit @Inject keeps a provider usable either way.
export const SERVER_ENV = "SERVER_ENV";
