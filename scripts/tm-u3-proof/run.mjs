import { createHash, randomBytes } from "node:crypto";
import { sendTruncatedBody, wasNotHandled } from "./truncated.mjs";

const MIB = 1024 * 1024;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Valid JSON of exactly `size` bytes: `{"pad":"` and `"}` around the filler.
const jsonOfSize = (size) => Buffer.from(`{"pad":"${"a".repeat(size - 10)}"}`);

// Run mode of the proof script: what plan T1 to T4 ask of the production topology (T5 is the refresh-race mode), one
// check per line. It prints statuses, sizes, hashes and timings, never a body, a cookie or a token. `skipSlow` leaves out the three long waits
// (35, 58 and 65 seconds), which take about a minute together because they run side by side.
/** @param {{ apiBase: string, cookie: string, origin: string, appBase?: string, skipSlow?: boolean, fetchImpl?: typeof fetch }} options */
export async function runProof({
  apiBase,
  cookie,
  origin,
  appBase = origin,
  skipSlow = false,
  fetchImpl = fetch,
}) {
  const lines = [];
  let failed = 0;
  const check = (name, ok, detail) => {
    if (!ok) failed += 1;
    lines.push(
      `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`,
    );
  };
  const headers = { cookie, origin };
  const url = (path) => new URL(path, apiBase).href;
  const get = (path) => fetchImpl(url(path), { headers });

  // The long waits start first so that they overlap the rest.
  const slow = skipSlow
    ? []
    : [35, 58, 65].map(async (seconds) => {
        const started = Date.now();
        const response = await get(`/api/proof/slow?seconds=${seconds}`);
        const body = await response.text();
        return {
          seconds,
          status: response.status,
          body,
          took: Date.now() - started,
        };
      });

  for (const path of ["/api/session", "/api/proof/session-cold"]) {
    const response = await get(path);
    check(`GET ${path}`, response.status === 200, `status ${response.status}`);
    await response.body?.cancel();
  }
  {
    const response = await get("/api/proof/read");
    const body = response.status === 200 ? await response.json() : null;
    check(
      "GET /api/proof/read answers ok",
      response.status === 200 && body?.ok === true,
      `status ${response.status}`,
    );
  }

  // T1: the hash is over the bytes as sent: a JSON content type with whitespace a re-serializer would change, JSON of
  // 1 MiB and of exactly the limit (valid JSON, so a body parser that reads it has nothing to reject), then binary that
  // is not text at all, then exactly the limit.
  for (const [name, bytes, type] of [
    [
      "JSON as sent",
      Buffer.from('{ "b": 1,\n  "a": [1, 2,3] }'),
      "application/json",
    ],
    ["1 MiB JSON", jsonOfSize(1 * MIB), "application/json"],
    ["exactly 4 MiB JSON", jsonOfSize(4 * MIB), "application/json"],
    ["3 MiB binary", randomBytes(3 * MIB), "application/octet-stream"],
    ["exactly 4 MiB", randomBytes(4 * MIB), "application/octet-stream"],
  ]) {
    const response = await fetchImpl(url("/api/proof/echo"), {
      method: "POST",
      headers: { ...headers, "content-type": type },
      body: bytes,
    });
    const body = response.status === 200 ? await response.json() : null;
    check(
      `POST /api/proof/echo ${name}`,
      body?.length === bytes.length && body?.sha256 === sha256(bytes),
      `status ${response.status}, ${bytes.length} bytes`,
    );
  }
  {
    const response = await fetchImpl(url("/api/proof/echo"), {
      method: "POST",
      headers: { ...headers, "content-type": "application/octet-stream" },
      body: randomBytes(4 * MIB + 1),
    });
    check(
      "POST /api/proof/echo 4 MiB + 1 is 413",
      response.status === 413,
      `status ${response.status}`,
    );
    await response.body?.cancel();
  }
  // T3: a body that ends before its declared length is never handled. It goes through `appBase` (the app; the origin
  // header's value by default), so the hop that forwards it is part of what is shown.
  {
    const outcome = await sendTruncatedBody({
      base: appBase,
      path: "/api/proof/echo",
      cookie,
      origin,
    });
    check(
      "POST /api/proof/echo truncated body is not handled",
      wasNotHandled(outcome),
      outcome.status === null
        ? `connection ended without an answer (${outcome.ended})`
        : `status ${outcome.status}`,
    );
  }
  for (const [name, size, expected] of [
    ["2 MiB", 2 * MIB, 200],
    ["2 MiB + 1 is 413", 2 * MIB + 1, 413],
  ]) {
    const bytes = randomBytes(size);
    const form = new FormData();
    form.append("file", new Blob([bytes]), "file.bin");
    const response = await fetchImpl(url("/api/proof/upload"), {
      method: "POST",
      headers,
      body: form,
    });
    const body = response.status === 200 ? await response.json() : null;
    const good =
      response.status === expected &&
      (expected !== 200 ||
        (body?.length === size && body?.sha256 === sha256(bytes)));
    check(`POST /api/proof/upload ${name}`, good, `status ${response.status}`);
    // A 200 was read as JSON above; only an unread body is cancelled.
    if (!response.bodyUsed) await response.body?.cancel();
  }

  // T4: the chunks of the stream arrive as they are written, not all at the end.
  {
    const started = Date.now();
    const response = await get("/api/proof/stream");
    const reader = response.body.getReader();
    const arrivals = [];
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
      arrivals.push(Date.now() - started);
    }
    const overTime = arrivals[0] < 2000 && arrivals.at(-1) > 3500;
    check(
      "GET /api/proof/stream arrives over time",
      response.status === 200 && overTime,
      `${arrivals.length} reads, first ${arrivals[0]} ms, last ${arrivals.at(-1)} ms`,
    );
  }

  for (const result of await Promise.all(slow)) {
    const expected = result.seconds === 65 ? 504 : 200;
    const explicit = result.seconds !== 65 || /took too long/.test(result.body);
    check(
      `GET /api/proof/slow ${result.seconds} s`,
      result.status === expected && explicit,
      `status ${result.status} after ${Math.round(result.took / 1000)} s`,
    );
  }
  return { lines, failed };
}
