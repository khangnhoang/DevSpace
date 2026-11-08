import { createServer, connect, type Server, type Socket } from "node:net";

// A loopback TCP proxy in front of Postgres that reads the frontend messages it forwards, so a test can count the
// statements an application sent and the connections it opened. It parses only the framing: the startup packet
// (no type byte), then typed messages. `Q` (simple query) and `P` (parse) carry statement text.
export type CountingProxy = {
  port: number;
  statements: string[];
  connections(): number;
  close(): Promise<void>;
};

function frontendStatements(
  buffer: Buffer,
  state: { started: boolean },
  sink: string[],
): Buffer {
  let rest = buffer;
  for (;;) {
    if (!state.started) {
      if (rest.length < 4) return rest;
      const length = rest.readInt32BE(0);
      if (rest.length < length) return rest;
      state.started = true;
      rest = rest.subarray(length);
      continue;
    }
    if (rest.length < 5) return rest;
    const length = rest.readInt32BE(1);
    if (rest.length < 1 + length) return rest;
    const type = String.fromCharCode(rest[0]);
    const body = rest.subarray(5, 1 + length);
    if (type === "Q") sink.push(body.toString("utf8").replace(/\0$/, ""));
    if (type === "P") {
      // name\0 query\0 ...
      const nameEnd = body.indexOf(0);
      const queryEnd = body.indexOf(0, nameEnd + 1);
      if (nameEnd >= 0 && queryEnd > nameEnd)
        sink.push(body.subarray(nameEnd + 1, queryEnd).toString("utf8"));
    }
    rest = rest.subarray(1 + length);
  }
}

export async function startCountingProxy(target: {
  host: string;
  port: number;
}): Promise<CountingProxy> {
  const statements: string[] = [];
  const sockets = new Set<Socket>();
  let connections = 0;
  const server: Server = createServer((client) => {
    connections += 1;
    const upstream = connect(target.port, target.host);
    sockets.add(client);
    sockets.add(upstream);
    const state = { started: false };
    let pending: Buffer = Buffer.alloc(0);
    client.on("data", (chunk: Buffer) => {
      pending = frontendStatements(
        Buffer.concat([pending, chunk]),
        state,
        statements,
      );
      upstream.write(chunk);
    });
    upstream.on("data", (chunk: Buffer) => client.write(chunk));
    const end = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", end);
    upstream.on("error", end);
    client.on("close", end);
    upstream.on("close", end);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    port,
    statements,
    connections: () => connections,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
