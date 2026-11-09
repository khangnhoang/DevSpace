import net from "node:net";
import tls from "node:tls";

// Proof T3: sends a request that declares `declared` bytes of body, delivers `sent` of them and then closes its own
// side of the connection, which `fetch` cannot do. The answer is read until the connection ends. Returns the status
// line's code (null when none came) and how the exchange ended, never a header or a body.
/** @param {{ base: string, path: string, cookie: string, origin: string, declared?: number, sent?: number, timeoutMs?: number }} options */
export function sendTruncatedBody({
  base,
  path,
  cookie,
  origin,
  declared = 4096,
  sent = 1024,
  timeoutMs = 15_000,
}) {
  for (const value of [path, cookie, origin]) {
    if (/[\r\n]/.test(value))
      throw new Error("a header value holds a line break");
  }
  const url = new URL(base);
  const secure = url.protocol === "https:";
  const port = Number(url.port || (secure ? 443 : 80));
  return new Promise((resolve) => {
    let status = null;
    let settled = false;
    const finish = (ended) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ status, ended });
    };
    const socket = secure
      ? tls.connect({ host: url.hostname, port, servername: url.hostname })
      : net.connect({ host: url.hostname, port });
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    socket.on("data", (chunk) => {
      if (status === null) {
        const line = /^HTTP\/1\.[01] (\d{3})/.exec(chunk.toString("latin1"));
        if (line) status = Number(line[1]);
      }
    });
    socket.on("error", () => finish("reset"));
    socket.on("close", () => finish(status === null ? "closed" : "answered"));
    socket.once(secure ? "secureConnect" : "connect", () => {
      socket.write(
        `POST ${path} HTTP/1.1\r\nHost: ${url.host}\r\ncookie: ${cookie}\r\norigin: ${origin}\r\n` +
          `content-type: application/octet-stream\r\ncontent-length: ${declared}\r\nconnection: close\r\n\r\n`,
      );
      socket.write(Buffer.alloc(sent, 0x61));
      socket.end();
    });
  });
}

// A body that never completed is not handled when the server refuses it (4xx or 5xx) or ends the exchange without an
// answer; a 2xx or 3xx means it was acted on, and a connection left hanging shows no verdict at all.
export const wasNotHandled = (outcome) =>
  outcome.ended !== "timeout" &&
  (outcome.status === null || outcome.status >= 400);
