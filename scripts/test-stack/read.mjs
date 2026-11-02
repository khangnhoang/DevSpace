// The one way a suite or launcher learns where the test stack is: the status of the generated test workdir,
// whose URLs are local (readLocalStack), and whose ports belong to the running containers of the test project
// (AC8). A stack that is not the test project is refused, so nothing can write to the dev stack by reading the
// wrong endpoint.
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";
import { TEST_PORTS, TEST_PROJECT_ID, testWorkdir } from "./config.mjs";
import { checkWrite, createDocker } from "./docker.mjs";

/** @param {string} root @returns {import("../../__tests__/helpers/local-stack.ts").LocalStack & { project: string }} */
export function readTestStack(root, docker = createDocker()) {
  const stack = readLocalStack(root, testWorkdir(root));
  const dbPort = Number(new URL(stack.dbUrl).port);
  const apiPort = Number(new URL(stack.apiUrl).port);
  if (dbPort !== TEST_PORTS.db || apiPort !== TEST_PORTS.api) {
    throw new Error(`The stack reports ports ${apiPort}/${dbPort}, not the test ports ${TEST_PORTS.api}/${TEST_PORTS.db}. Run npm test or npm run test:e2e, which start the test stack.`);
  }
  checkWrite(docker, { project: TEST_PROJECT_ID, dbPort, apiPort });
  return { ...stack, project: TEST_PROJECT_ID };
}
