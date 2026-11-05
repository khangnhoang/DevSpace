// Identity checks for the test stack, done through Docker. A port number from a config or a status command
// is never trusted on its own: a start, a reset or a database write and a stop each first prove, from the
// containers Docker reports, that the target is the test project and not the dev stack or another project.
// The checks take a `docker` object so unit rows can stand in for the engine.
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import {
  TEST_PROJECT_ID,
  TEST_NETWORK,
  TEST_MAILPIT_IMAGE,
  MAILBOX_OWNER,
  TEST_PORTS,
  requiredContainerNames,
} from "./config.mjs";

const run = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });

export function parseContainer(row) {
  const labels = Object.fromEntries(
    String(row.Labels ?? "")
      .split(",")
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf("=");
        return [pair.slice(0, at), pair.slice(at + 1)];
      }),
  );
  return {
    id: row.ID,
    name: row.Names,
    state: row.State,
    // "none" is what Docker reports for a container without a health check (PostgREST has none).
    health:
      row.HealthStatus && row.HealthStatus !== "none" ? row.HealthStatus : "",
    project: labels["com.supabase.cli.project"] ?? "",
    ports: [...String(row.Ports ?? "").matchAll(/:(\d+)->/g)].map((match) =>
      Number(match[1]),
    ),
  };
}

export function createDocker() {
  return {
    host: () => {
      const context = run([
        "context",
        "inspect",
        "--format",
        "{{.Endpoints.docker.Host}}",
      ]).trim();
      return process.env.DOCKER_HOST || context;
    },
    containers: () =>
      run(["ps", "-a", "--format", "json"])
        .split("\n")
        .filter(Boolean)
        .map((line) => parseContainer(JSON.parse(line))),
    volumeExists: (name) => {
      try {
        run(["volume", "inspect", name]);
        return true;
      } catch {
        return false;
      }
    },
    portFree: (port) =>
      new Promise((resolve) => {
        const server = createServer();
        server.once("error", () => resolve(false));
        server.listen(port, "127.0.0.1", () =>
          server.close(() => resolve(true)),
        );
      }),
    network: () => {
      const found = run([
        "network",
        "ls",
        "--filter",
        `name=^${TEST_NETWORK}$`,
        "--format",
        "{{.Name}}",
      ]).trim();
      if (!found) return null;
      return JSON.parse(run(["network", "inspect", TEST_NETWORK]))[0];
    },
    createMailNetwork: () =>
      run([
        "network",
        "create",
        "--label",
        `com.supabase.cli.project=${TEST_PROJECT_ID}`,
        "--opt",
        "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
        TEST_NETWORK,
      ]),
    mailbox: () => {
      const names = run([
        "ps",
        "-a",
        "--filter",
        `name=^supabase_inbucket_${TEST_PROJECT_ID}$`,
        "--format",
        "{{.Names}}",
      ]).trim();
      if (!names) return null;
      const name = `supabase_inbucket_${TEST_PROJECT_ID}`;
      return {
        image: run(["inspect", name, "--format", "{{.Config.Image}}"]).trim(),
        owner: run([
          "inspect",
          name,
          "--format",
          `{{index .Config.Labels "${MAILBOX_OWNER}"}}`,
        ]).trim(),
        project: run([
          "inspect",
          name,
          "--format",
          '{{index .Config.Labels "com.supabase.cli.project"}}',
        ]).trim(),
        network: run([
          "inspect",
          name,
          "--format",
          "{{.HostConfig.NetworkMode}}",
        ]).trim(),
        ports: JSON.parse(
          run(["inspect", name, "--format", "{{json .NetworkSettings.Ports}}"]),
        ),
        aliases: JSON.parse(
          run([
            "inspect",
            name,
            "--format",
            `{{json (index .NetworkSettings.Networks "${TEST_NETWORK}").Aliases}}`,
          ]),
        ),
        health: JSON.parse(
          run([
            "inspect",
            name,
            "--format",
            "{{json .Config.Healthcheck.Test}}",
          ]),
        ),
      };
    },
    createMailbox: () =>
      run([
        "run",
        "-d",
        "--pull=missing",
        "--name",
        `supabase_inbucket_${TEST_PROJECT_ID}`,
        "--label",
        `com.supabase.cli.project=${TEST_PROJECT_ID}`,
        "--label",
        `${MAILBOX_OWNER}=v1`,
        "--network",
        TEST_NETWORK,
        "--network-alias",
        "inbucket",
        "--publish",
        `127.0.0.1:${TEST_PORTS.smtp}:8025`,
        "--env",
        "MP_SMTP_DISABLE_RDNS=true",
        "--health-cmd",
        "/mailpit readyz",
        "--health-interval",
        "10s",
        "--health-timeout",
        "2s",
        "--health-retries",
        "3",
        "--health-start-period",
        "10s",
        "--restart",
        "unless-stopped",
        TEST_MAILPIT_IMAGE,
      ]),
    mailConfiguration: () => {
      const mailbox = `supabase_inbucket_${TEST_PROJECT_ID}`;
      const ports = JSON.parse(
        run([
          "inspect",
          mailbox,
          "--format",
          "{{json .NetworkSettings.Ports}}",
        ]),
      );
      const smtp = run([
        "inspect",
        `supabase_auth_${TEST_PROJECT_ID}`,
        "--format",
        '{{range .Config.Env}}{{if or (eq . "GOTRUE_SMTP_HOST=supabase_inbucket_devspace-test") (eq . "GOTRUE_SMTP_PORT=1025")}}{{println .}}{{end}}{{end}}',
      ]);
      return {
        ports,
        localSmtp: smtp.trim().split(/\r?\n/).filter(Boolean).length === 2,
      };
    },
  };
}

// The selected project network is shared with CLI services; publication is explicit on the mailbox itself.
export function ensureMailNetwork(docker) {
  assertLocalEngine(docker);
  let network = docker.network();
  if (!network) {
    docker.createMailNetwork();
    network = docker.network();
  }
  if (
    network?.Labels?.["com.supabase.cli.project"] !== TEST_PROJECT_ID ||
    network?.Driver !== "bridge" ||
    network?.Internal ||
    network?.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
      "127.0.0.1"
  ) {
    throw new Error(
      "The test network lacks the owned loopback default option. Run npm run test:stack:stop, then retry; no mailbox request or reset ran.",
    );
  }
}

export function assertRunnerMailbox(mailbox) {
  if (
    mailbox?.project !== TEST_PROJECT_ID ||
    mailbox?.owner !== "v1" ||
    mailbox?.image !== TEST_MAILPIT_IMAGE ||
    mailbox?.network !== TEST_NETWORK ||
    !mailbox?.aliases?.includes("inbucket") ||
    ![
      JSON.stringify(["CMD", "/mailpit", "readyz"]),
      JSON.stringify(["CMD-SHELL", "/mailpit readyz"]),
    ].includes(JSON.stringify(mailbox?.health))
  ) {
    throw new Error(
      "Test mailbox identity/configuration is not runner-owned; nothing was replaced. Run the managed test stop before retrying.",
    );
  }
  assertMailboxPorts(mailbox.ports);
}

export function ensureRunnerMailbox(docker, onCreate = () => {}) {
  assertLocalEngine(docker);
  const existing = docker.mailbox();
  if (existing) {
    assertRunnerMailbox(existing);
    return;
  }
  onCreate();
  docker.createMailbox();
  assertRunnerMailbox(docker.mailbox());
}

function assertMailboxPorts(ports) {
  const published = Object.entries(ports ?? {}).filter(
    ([, values]) => values?.length,
  );
  const valid =
    published.length === 1 &&
    published[0][0] === "8025/tcp" &&
    published[0][1].length === 1 &&
    published[0][1][0].HostIp === "127.0.0.1" &&
    published[0][1][0].HostPort === String(TEST_PORTS.smtp);
  if (!valid)
    throw new Error(
      "Mailpit readiness refused: require loopback-only HTTP and unpublished SMTP/POP3. No mailbox request or reset ran.",
    );
}

export function assertMailReady(docker) {
  assertLocalEngine(docker);
  const required = requiredProblems(docker);
  if (required.length) throw new Error(describeProblems(required));
  const { ports, localSmtp } = docker.mailConfiguration();
  assertMailboxPorts(ports);
  assertRunnerMailbox(docker.mailbox());
  if (!localSmtp)
    throw new Error(
      "Mailpit readiness refused: require loopback-only HTTP, unpublished SMTP/POP3 and Auth SMTP pointing at the test sink. No mailbox request or reset ran.",
    );
}

export function assertLocalEngine(docker) {
  if (!/^(npipe:|unix:)/.test(docker.host())) {
    throw new Error(
      "The Docker engine is not local (DOCKER_HOST or the Docker context points elsewhere), so the test stack is not touched. Use the local Docker Desktop engine.",
    );
  }
}

const isTestName = (name, project) => name.endsWith(`_${project}`);

// A container may be named like a test container and still belong to another project; every check refuses it.
function assertNamedContainersAreTest(containers, project) {
  const stray = containers.find(
    (container) =>
      isTestName(container.name, project) && container.project !== project,
  );
  if (stray) {
    throw new Error(
      `Container ${stray.name} is named like a test stack container but belongs to project "${stray.project || "(none)"}", not "${project}". Nothing was changed; remove or rename that container.`,
    );
  }
}

// Before a start: each test port is free, or held by a container of the test project.
export async function checkStart(docker, { project = TEST_PROJECT_ID, ports }) {
  assertLocalEngine(docker);
  const containers = docker.containers();
  assertNamedContainersAreTest(containers, project);
  for (const port of ports) {
    const holder = containers.find((container) =>
      container.ports.includes(port),
    );
    if (holder) {
      if (holder.project !== project) {
        throw new Error(
          `Test port ${port} is held by container ${holder.name} (project "${holder.project || "(none)"}"), not the test project "${project}". Stop that project or free the port; the test stack was not started.`,
        );
      }
    } else if (!(await docker.portFree(port))) {
      throw new Error(
        `Test port ${port} is in use by a process outside Docker. Free the port; the test stack was not started.`,
      );
    }
  }
}

// Before a reset or a database write: the database and gateway ports belong to the test project's running containers.
export function checkWrite(
  docker,
  { project = TEST_PROJECT_ID, dbPort, apiPort },
) {
  assertLocalEngine(docker);
  const containers = docker.containers();
  assertNamedContainersAreTest(containers, project);
  for (const [service, port] of [
    ["db", dbPort],
    ["kong", apiPort],
  ]) {
    const name = `supabase_${service}_${project}`;
    const container = containers.find((candidate) => candidate.name === name);
    if (!container || container.state !== "running") {
      throw new Error(
        `Container ${name} is not running, so the database at port ${port} is not proven to be the test stack. Run npm run test:stack:stop and start the command again.`,
      );
    }
    if (!container.ports.includes(port)) {
      throw new Error(
        `Port ${port} is not published by ${name}; the reported endpoint is not the test project's. Nothing was written.`,
      );
    }
  }
}

// Before a stop: every container the stop would touch carries the test project's label. Missing containers and an
// already stopped project are fine.
export function checkStop(docker, { project = TEST_PROJECT_ID }) {
  if (project !== TEST_PROJECT_ID)
    throw new Error(
      `The stop targets project "${project}", not the test project "${TEST_PROJECT_ID}". Nothing was stopped.`,
    );
  assertLocalEngine(docker);
  assertNamedContainersAreTest(docker.containers(), project);
}

// Required containers must exist, run and be healthy. A container still `starting` is waited for; the result lists
// only what is wrong now.
export function requiredProblems(docker, project = TEST_PROJECT_ID) {
  const containers = docker.containers();
  return requiredContainerNames(project).flatMap((name) => {
    const container = containers.find(
      (candidate) => candidate.name === name && candidate.project === project,
    );
    if (!container) return [{ name, reason: "is missing", final: true }];
    if (container.state !== "running")
      return [
        { name, reason: `is ${container.state}, not running`, final: true },
      ];
    if (container.health === "starting")
      return [{ name, reason: "is still starting", final: false }];
    if (container.health && container.health !== "healthy")
      return [{ name, reason: `is ${container.health}`, final: true }];
    return [];
  });
}

export async function waitForRequired(
  docker,
  { project = TEST_PROJECT_ID, timeoutMs = 90_000, pollMs = 1000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let problems = requiredProblems(docker, project);
  while (
    problems.length &&
    problems.every((problem) => !problem.final) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    problems = requiredProblems(docker, project);
  }
  return problems;
}

export const describeProblems = (problems) => {
  const [first] = problems;
  return (
    `Test stack container ${first.name} ${first.reason}${
      problems.length > 1
        ? ` (and ${problems.length - 1} more: ${problems
            .slice(1)
            .map((problem) => problem.name)
            .join(", ")})`
        : ""
    }. ` +
    "No reset and no test ran. Next action: run npm run test:stack:stop, then run the command again; if it repeats, check Docker Desktop's memory and the container's logs (docker logs <container>)."
  );
};
