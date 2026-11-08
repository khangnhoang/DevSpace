import { EnvError, readServerEnv } from "./common/env";
import { startApp } from "./bootstrap";
import { DatabaseIdentityError } from "./db/db.service";

async function main() {
  await startApp(readServerEnv());
}

main().catch((error: unknown) => {
  // A configuration error prints its own message; anything else prints the stack for the Railway log.
  const known =
    error instanceof EnvError || error instanceof DatabaseIdentityError;
  console.error(known ? `api: ${error.message}` : error);
  process.exit(1);
});
