import { readFileSync } from "node:fs";
import { join } from "node:path";
import { request, type APIRequestContext } from "@playwright/test";
import { E2E_ORIGIN } from "../helpers/e2e-env";
import { findAction, readActionResponse, type ServerReferenceManifest } from "../helpers/server-action-core";
import { authFile, type Actor } from "./accounts";

export type Caller = Actor | "anon";

const MANIFEST = join(__dirname, "../../.next/server/server-reference-manifest.json");

// The action ID is read from the manifest of the build under test, never written down: a rebuild changes it.
function actionTarget(filename: string, exportedName: string) {
  let manifest: ServerReferenceManifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as ServerReferenceManifest;
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
export type ActionCaller = (caller: Caller, filename: string, exportedName: string, args: unknown[]) => Promise<unknown>;

export async function openActionCaller(): Promise<{ call: ActionCaller; dispose: () => Promise<void> }> {
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

  const call: ActionCaller = async (caller, filename, exportedName, args) => {
    const { id, path } = actionTarget(filename, exportedName);
    const context = await contextFor(caller);
    const response = await context.post(path, {
      headers: {
        "Next-Action": id,
        Accept: "text/x-component",
        Origin: E2E_ORIGIN,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: JSON.stringify(args),
      maxRedirects: 0,
    });
    let outcome;
    try {
      outcome = readActionResponse({
        status: response.status(),
        location: response.headers()["location"] ?? null,
        body: await response.text(),
      });
    } catch (error) {
      throw new Error(`server action ${filename}#${exportedName} as ${caller}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (outcome.kind === "redirect") {
      throw new Error(
        `server action ${filename}#${exportedName} as ${caller}: the server answered a redirect (HTTP ${outcome.status}) to ${outcome.location}`,
      );
    }
    return outcome.value;
  };

  return { call, dispose: async () => void (await Promise.all([...contexts.values()].map((context) => context.dispose()))) };
}
