import { EnvError, readServerEnv } from "./common/env";
import { createApp } from "./bootstrap";

async function main() {
  const env = readServerEnv();
  const app = await createApp(env);
  await app.listen(env.port, env.host);
}

main().catch((error: unknown) => {
  // A configuration error prints its own message; anything else prints the stack for the Railway log.
  console.error(error instanceof EnvError ? `api: ${error.message}` : error);
  process.exit(1);
});
