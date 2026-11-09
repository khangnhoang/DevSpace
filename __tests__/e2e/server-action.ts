import { readFileSync } from "node:fs";
import { join } from "node:path";
import { request, type APIRequestContext } from "@playwright/test";
import { E2E_ORIGIN } from "../helpers/e2e-env";
import {
  findAction,
  readActionResponse,
  type ServerReferenceManifest,
} from "../helpers/server-action-core";
import { authFile, type Actor } from "./accounts";

export type Caller = Actor | "anon";

const MANIFEST = join(
  __dirname,
  "../../.next/server/server-reference-manifest.json",
);

// The action ID is read from the manifest of the build under test, never written down: a rebuild changes it.
function actionTarget(filename: string, exportedName: string) {
  let manifest: ServerReferenceManifest;
  try {
    manifest = JSON.parse(
      readFileSync(MANIFEST, "utf8"),
    ) as ServerReferenceManifest;
  } catch (error) {
    throw new Error(
      `server action ${filename}#${exportedName}: cannot read the server reference manifest (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return findAction(manifest, filename, exportedName);
}

// Calls a server action the way a hostile client does: a POST to the page that owns the action, with the
// `Next-Action` header, the actor's saved session (none for anon) and the e2e server's origin. The service role
// is never involved (G1). A redirect, an HTTP error or a response this reader cannot parse throws an error that
// names the file and export; there is no fallback.
export type ActionCaller = (
  caller: Caller,
  filename: string,
  exportedName: string,
  args: unknown[],
) => Promise<unknown>;

// A call that is expected to be refused before the action runs: it names the origin it sends and the exact statuses
// the refusal may have. A status outside that list (an unexpected 5xx included) throws; a success is a refusal that did
// not happen and throws too. It returns the refusal, so a row can then assert that nothing reached the API.
export type ActionRefusal = (
  caller: Caller,
  filename: string,
  exportedName: string,
  args: unknown[],
  expected: {
    origin: string;
    statuses: number[];
    identified: () => boolean | Promise<boolean>;
  },
) => Promise<{ status: number; body: string }>;

export async function openActionCaller(): Promise<{
  call: ActionCaller;
  refuse: ActionRefusal;
  dispose: () => Promise<void>;
}> {
  const contexts = new Map<Caller, APIRequestContext>();

  const contextFor = async (caller: Caller) => {
    let context = contexts.get(caller);
    if (!context) {
      context = await request.newContext({
        baseURL: E2E_ORIGIN,
        storageState: caller === "anon" ? undefined : authFile(caller),
      });
      contexts.set(caller, context);
    }
    return context;
  };

  const post = async (
    caller: Caller,
    filename: string,
    exportedName: string,
    args: unknown[],
    origin: string,
  ) => {
    const { id, path } = actionTarget(filename, exportedName);
    const context = await contextFor(caller);
    return await context.post(path, {
      headers: {
        "Next-Action": id,
        Accept: "text/x-component",
        Origin: origin,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: JSON.stringify(args),
      maxRedirects: 0,
    });
  };

  const refuse: ActionRefusal = async (
    caller,
    filename,
    exportedName,
    args,
    expected,
  ) => {
    const response = await post(
      caller,
      filename,
      exportedName,
      args,
      expected.origin,
    );
    const status = response.status();
    const body = await response.text();
    if (!expected.statuses.includes(status)) {
      throw new Error(
        `server action ${filename}#${exportedName} as ${caller} from ${expected.origin}: expected a refusal with HTTP ${expected.statuses.join(" or ")}, got HTTP ${status}: ${body.slice(0, 200)}`,
      );
    }
    // A status alone does not identify a refusal: any other 500 (a crash in the action, an API failure) has the same
    // code, and Next's answer to an invalid origin carries only an error digest. The row therefore supplies a check
    // against what the server logged (Next's own "Invalid Server Actions request" report), polled for a moment because
    // the log line is written as the response ends.
    let identified = false;
    for (let attempt = 0; attempt < 30 && !identified; attempt += 1) {
      identified = await expected.identified();
      if (!identified) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!identified) {
      throw new Error(
        `server action ${filename}#${exportedName} as ${caller} from ${expected.origin}: HTTP ${status} is not the expected refusal (the server did not log it): ${body.slice(0, 300)}`,
      );
    }
    return { status, body };
  };

  const call: ActionCaller = async (caller, filename, exportedName, args) => {
    const response = await post(
      caller,
      filename,
      exportedName,
      args,
      E2E_ORIGIN,
    );
    let outcome;
    try {
      outcome = readActionResponse({
        status: response.status(),
        location: response.headers()["location"] ?? null,
        body: await response.text(),
      });
    } catch (error) {
      throw new Error(
        `server action ${filename}#${exportedName} as ${caller}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (outcome.kind === "redirect") {
      throw new Error(
        `server action ${filename}#${exportedName} as ${caller}: the server answered a redirect (HTTP ${outcome.status}) to ${outcome.location}`,
      );
    }
    return outcome.value;
  };

  return {
    call,
    refuse,
    dispose: async () =>
      void (await Promise.all(
        [...contexts.values()].map((context) => context.dispose()),
      )),
  };
}
