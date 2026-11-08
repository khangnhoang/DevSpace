import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
} from "node:http";
import type { Socket } from "node:net";

// A loopback HTTP proxy in front of one upstream that records the method and path of every request it forwards, so a
// test can count what the API sent to the Auth server (cache hits send nothing). It can also be told to answer a
// status itself, which simulates an Auth server that fails.
export type HttpCountingProxy = {
  url: string;
  requests: { method: string; path: string }[];
  count(path: string): number;
  // The next requests are answered with this status instead of being forwarded; null forwards again.
  failWith(status: number | null, body?: string): void;
  close(): Promise<void>;
};

export async function startHttpCountingProxy(
  upstream: string,
): Promise<HttpCountingProxy> {
  const target = new URL(upstream);
  const requests: { method: string; path: string }[] = [];
  const sockets = new Set<Socket>();
  let failure: { status: number; body: string } | null = null;
  const server: Server = createServer((incoming: IncomingMessage, outgoing) => {
    requests.push({
      method: incoming.method ?? "GET",
      path: incoming.url ?? "/",
    });
    if (failure !== null) {
      incoming.resume();
      outgoing.writeHead(failure.status, {
        "content-type": "application/json",
      });
      outgoing.end(failure.body);
      return;
    }
    const forwarded = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        method: incoming.method,
        path: incoming.url,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    forwarded.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forwarded);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    count: (path) =>
      requests.filter((entry) => entry.path.split("?")[0] === path).length,
    failWith: (status, body = "{}") => {
      failure = status === null ? null : { status, body };
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
