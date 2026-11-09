import { createServer } from "node:net";

// The e2e servers never reuse a process: a port that is taken could hold a server built with other variables, so the
// run stops before it starts anything (TM-U3 AC16: Next on 3100 and the API on 3101).
export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is in use, and the e2e servers never reuse a process. Stop whatever listens on it, then run the command again.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

export async function assertPortsFree(ports) {
  for (const port of ports) await assertPortFree(port);
}
