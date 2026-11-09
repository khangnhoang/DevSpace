import net from "node:net";
import tls from "node:tls";

// Proof T3: sends a request that declares `declared` bytes of body, delivers `sent` of them and then closes its own
// side of the connection, which `fetch` cannot do. The answer is read until the connection ends. Returns the status
// line's code (null when none came) and how the exchange ended, never a header or a body. An exchange that ends before
// the request was flushed to the socket (a connection, DNS or TLS failure, a write failure, or a timeout while
// connecting) is `not-sent`: it says nothing about the server, unless a status line was already read, which is an
// explicit answer.
/** @param {{ base: string, path: string, cookie: string, origin: string, declared?: number, sent?: number, timeoutMs?: number, connect?: (secure: boolean, host: string, port: number) => import("node:net").Socket }} options */
export function sendTruncatedBody({
  base,
  path,
  cookie,
  origin,
  declared = 4096,
  sent = 1024,
  timeoutMs = 15_000,
  // The socket factory is a parameter so a test can make a write fail after the connection is up.
  connect = (secure, host, port) =>
    secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port }),
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
    let written = false;
    const finish = (ended) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({
        status,
        ended: written || status !== null ? ended : "not-sent",
      });
    };
    const socket = connect(secure, url.hostname, port);
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
      // `write` only queues: the request counts as sent once the last chunk was flushed without an error.
      socket.write(Buffer.alloc(sent, 0x61), (error) => {
        if (!error) written = true;
      });
      socket.end();
    });
  });
}

// A body that never completed is not handled when the server refuses it (4xx or 5xx) or ends the exchange without an
// answer; a 2xx or 3xx means it was acted on, and a connection left hanging or never used shows no verdict at all.
export const wasNotHandled = (outcome) =>
  outcome.ended !== "timeout" &&
  outcome.ended !== "not-sent" &&
  (outcome.status === null || outcome.status >= 400);
