// Pure parts of the direct server-action call (__tests__/e2e/server-action.ts): finding an action in the
// server reference manifest of the build under test, and reading the flight response. Both rely on Next 16.4.3
// internals (`next` is pinned); a format they do not know fails with a message instead of a guess.

type ManifestEntry = { workers?: Record<string, unknown>; filename?: string; exportedName?: string };
export type ServerReferenceManifest = { node?: Record<string, ManifestEntry> };

// Page workers of the actions the payment rows call, and a URL that renders that page. A POST with the action ID
// to any other URL would answer "Failed to find Server Action".
const WORKER_URLS: Record<string, string> = {
  "app/(main)/course/[slug]/page": "/course/javascript-can-ban",
  "app/admin/transactions/page": "/admin/transactions",
};

export function findAction(
  manifest: ServerReferenceManifest,
  filename: string,
  exportedName: string,
): { id: string; path: string } {
  const label = `${filename}#${exportedName}`;
  const matches = Object.entries(manifest.node ?? {}).filter(
    ([, entry]) => entry.filename === filename && entry.exportedName === exportedName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `server action ${label} ${matches.length === 0 ? "is not in the server reference manifest" : "is in the server reference manifest more than once"} of the build under test`,
    );
  }
  const [id, entry] = matches[0];
  const workers = Object.keys(entry.workers ?? {});
  const worker = workers.find((name) => name in WORKER_URLS);
  if (!worker) {
    throw new Error(`server action ${label} has no known page worker (workers: ${workers.join(", ") || "none"})`);
  }
  return { id, path: WORKER_URLS[worker] };
}

export type ActionResponse = { status: number; location?: string | null; body: string };
export type ActionOutcome = { kind: "result"; value: unknown } | { kind: "redirect"; status: number; location: string };

// Flight values are JSON, except that a string starting with `$` is a reference (`$$` escapes a literal `$`).
// The payment actions return plain objects, so any other reference is a format this reader does not know.
function decodeFlight(value: unknown): unknown {
  if (typeof value === "string") {
    if (value === "$undefined") return undefined;
    if (value.startsWith("$$")) return value.slice(1);
    if (value.startsWith("$")) throw new Error(`unknown flight reference "${value}"`);
    return value;
  }
  if (Array.isArray(value)) return value.map(decodeFlight);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decodeFlight(entry)]));
  }
  return value;
}

export function readActionResponse(response: ActionResponse): ActionOutcome {
  const { status, body } = response;
  if (status >= 300 && status < 400) {
    if (!response.location) throw new Error(`cannot read the server action response: HTTP ${status} without a location`);
    return { kind: "redirect", status, location: response.location };
  }
  if (status !== 200) {
    throw new Error(`cannot read the server action response: HTTP ${status}: ${body.slice(0, 200)}`);
  }

  const rows = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^([0-9a-f]+):(.*)$/.exec(line);
    if (match) rows.set(match[1], match[2]);
  }
  const root = rows.get("0");
  if (root === undefined) throw new Error(`cannot read the server action response: no root row in ${body.slice(0, 200)}`);

  let reference: unknown;
  try {
    reference = (JSON.parse(root) as { a?: unknown }).a;
  } catch {
    throw new Error(`cannot read the server action response: the root row is not JSON: ${root.slice(0, 200)}`);
  }
  const match = typeof reference === "string" ? /^\$@([0-9a-f]+)$/.exec(reference) : null;
  const row = match ? rows.get(match[1]) : undefined;
  if (row === undefined) {
    throw new Error(`cannot read the server action response: the root row points at no result row (${String(reference)})`);
  }
  if (row.startsWith("E")) throw new Error(`the server action threw (the server answered an error row): ${row.slice(0, 200)}`);

  try {
    return { kind: "result", value: decodeFlight(JSON.parse(row)) };
  } catch (error) {
    throw new Error(
      `cannot read the server action response: ${error instanceof Error ? error.message : String(error)}: ${row.slice(0, 200)}`,
    );
  }
}
