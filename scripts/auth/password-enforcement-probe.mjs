// SE-U2 CP1: disposable local Auth proof, independent of both Supabase stacks.
// Never print request/response bodies: they contain passwords, sessions and recovery links.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID, createHash } from "node:crypto";
import { createServer } from "node:net";

const images = {
  db: "public.ecr.aws/supabase/postgres:17.11.0.004",
  auth: "public.ecr.aws/supabase/gotrue:v2.197.0",
  mail: "public.ecr.aws/supabase/mailpit:v1.22.3",
};
const owner = `devspace-se-u2-${randomUUID()}`;
const label = "devspace.se-u2.probe";
const names = {
  network: `${owner}-net`,
  db: `${owner}-db`,
  auth: `${owner}-auth`,
  mail: `${owner}-mail`,
};
const created = new Set();
let networkCreated = false;
let stage = "preflight";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function docker(args, input, extraEnv) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      input,
      ...(extraEnv ? { env: { ...process.env, ...extraEnv } } : {}),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 90_000,
    });
  } catch {
    // child_process errors include the command, which can include generated credentials.
    throw new Error(
      `Docker operation ${args[0]} failed during ${stage}; output suppressed to protect probe credentials`,
    );
  }
}
const inspect = (name, format) =>
  docker(["inspect", name, "--format", format]).trim();
function assertOwned(name) {
  assert.equal(
    inspect(name, `{{index .Config.Labels "${label}"}}`),
    owner,
    "container ownership mismatch",
  );
  assert.equal(
    inspect(name, "{{.HostConfig.NetworkMode}}"),
    names.network,
    "probe network mismatch",
  );
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function waitFor(check, description) {
  for (let i = 0; i < 60; i++) {
    if (await check()) return;
    await delay(500);
  }
  throw new Error(`${description} readiness failed`);
}
function start(service, args, env) {
  docker(
    [
      "run",
      "--pull=never",
      "-d",
      "--name",
      names[service],
      "--label",
      `${label}=${owner}`,
      "--network",
      names.network,
      ...args,
    ],
    undefined,
    env,
  );
  created.add(service);
  assertOwned(names[service]);
}
function assertLoopback(name, containerPort, hostPort) {
  const state = inspect(name, "{{.State.Status}}");
  if (state !== "running") {
    // This runs before any account/request exists. Retain only sanitized startup messages.
    const logs = spawnSync("docker", ["logs", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const messages = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line).msg ?? "";
        } catch {
          return "non-JSON startup output suppressed";
        }
      })
      .join(" | ")
      .replaceAll(jwtSecret, "[redacted]")
      .replace(/(?:postgres|https?):\/\/\S+/g, "[local URL redacted]");
    throw new Error(`probe service ${state}: ${messages.slice(-1500)}`);
  }
  const bindings = JSON.parse(inspect(name, "{{json .NetworkSettings.Ports}}"));
  const published = Object.entries(bindings).filter(
    ([, values]) => values?.length,
  );
  assert.equal(published.length, 1, "unexpected published probe port");
  assert.deepEqual(
    published[0],
    [
      `${containerPort}/tcp`,
      [{ HostIp: "127.0.0.1", HostPort: String(hostPort) }],
    ],
    "probe must publish only on loopback",
  );
}
const jwtSecret = randomBytes(48).toString("base64url");
function adminToken() {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      role: "service_role",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac("sha256", jwtSecret).update(unsigned).digest("base64url")}`;
}
const password = () => `Probe-${randomBytes(18).toString("base64url")}`;
async function request(origin, path, { method = "GET", body, token } = {}) {
  assert.equal(
    new URL(origin).hostname,
    "127.0.0.1",
    "HTTP target must be loopback",
  );
  const response = await fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return {
    status: response.status,
    data,
    location: response.headers.get("location"),
  };
}
const passed = (name) => console.log(`PASS ${name}`);
try {
  const host =
    process.env.DOCKER_HOST ||
    docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.match(host, /^(npipe:|unix:)/, "Docker engine must be local");
  for (const image of Object.values(images))
    docker(["image", "inspect", image, "--format", "{{.Id}}"]);
  // Docker 29 does not publish ports on an internal-only network. A run-owned bridge
  // isolates project services; only loopback HTTP is published, and SMTP targets this run's sink.
  docker([
    "network",
    "create",
    "--opt",
    "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
    "--label",
    `${label}=${owner}`,
    names.network,
  ]);
  networkCreated = true;
  assert.equal(
    docker([
      "network",
      "inspect",
      names.network,
      "--format",
      "{{.Driver}}",
    ]).trim(),
    "bridge",
  );
  stage = "private database";
  // This disposable cluster has no host port and is reachable only on the run-owned bridge.
  start("db", [
    "--user",
    "postgres",
    "--entrypoint",
    "/bin/sh",
    images.db,
    "-c",
    "initdb -D /tmp/se-u2-db -U postgres --auth=trust >/dev/null 2>&1 && echo 'host all all 0.0.0.0/0 trust' >> /tmp/se-u2-db/pg_hba.conf && exec postgres -D /tmp/se-u2-db -c listen_addresses='*'",
  ]);
  await waitFor(() => {
    try {
      return docker([
        "exec",
        names.db,
        "pg_isready",
        "-U",
        "postgres",
      ]).includes("accepting connections");
    } catch {
      return false;
    }
  }, "private Postgres");
  assertOwned(names.db);
  docker(
    ["exec", "-i", names.db, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    "create schema auth; alter role postgres set search_path = auth, public;\n",
  );
  const mailPort = await freePort();
  start("mail", ["-p", `127.0.0.1:${mailPort}:8025`, images.mail]);
  assertLoopback(names.mail, 8025, mailPort);
  const mailbox = `http://127.0.0.1:${mailPort}`;
  await waitFor(async () => {
    try {
      return (await request(mailbox, "/readyz")).status === 200;
    } catch {
      return false;
    }
  }, "Mailpit");
  for (const enforce of [false, true]) {
    stage = `Auth enforcement ${enforce ? "on" : "off"}`;
    const authPort = await freePort();
    const origin = `http://127.0.0.1:${authPort}`;
    const config = {
      GOTRUE_API_HOST: "0.0.0.0",
      PORT: "9999",
      API_EXTERNAL_URL: origin,
      GOTRUE_SITE_URL: "http://127.0.0.1:3100",
      GOTRUE_URI_ALLOW_LIST: "http://127.0.0.1:3100/**",
      GOTRUE_DB_DRIVER: "postgres",
      GOTRUE_DB_DATABASE_URL: `postgres://postgres@${names.db}:5432/postgres?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_JWT_SECRET: jwtSecret,
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_MAILER_AUTOCONFIRM: "true",
      GOTRUE_PASSWORD_MIN_LENGTH: "8",
      GOTRUE_SMTP_HOST: names.mail,
      GOTRUE_SMTP_PORT: "1025",
      GOTRUE_SMTP_ADMIN_EMAIL: "probe@devspace.test",
      GOTRUE_SMTP_MAX_FREQUENCY: "0s",
      GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
      GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "1000",
      GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD: String(enforce),
    };
    start(
      "auth",
      [
        "-p",
        `127.0.0.1:${authPort}:9999`,
        ...Object.keys(config).flatMap((key) => ["-e", key]),
        images.auth,
      ],
      config,
    );
    assertLoopback(names.auth, 9999, authPort);
    await waitFor(async () => {
      try {
        return (await request(origin, "/health")).status === 200;
      } catch {
        return false;
      }
    }, "GoTrue");
    const admin = adminToken();
    const email = `${randomUUID()}@devspace.test`;
    const oldPassword = password();
    const proposed = password();
    assertOwned(names.auth);
    const user = await request(origin, "/admin/users", {
      method: "POST",
      token: admin,
      body: { email, password: oldPassword, email_confirm: true },
    });
    if (user.status !== 200) {
      const logs = spawnSync("docker", ["logs", names.auth], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const errors = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`
        .split("\n")
        .flatMap((line) => {
          try {
            const entry = JSON.parse(line);
            return entry.error ? [String(entry.error)] : [];
          } catch {
            return [];
          }
        })
        .join(" | ")
        .replaceAll(oldPassword, "[redacted]")
        .replaceAll(admin, "[redacted]")
        .replaceAll(jwtSecret, "[redacted]");
      throw new Error(
        `fixture preparation HTTP ${user.status}: ${errors.slice(-1500)}`,
      );
    }
    const id = user.data.id;
    assert.ok(id, "fixture user has no id");
    const signIn = (value) =>
      request(origin, "/token?grant_type=password", {
        method: "POST",
        body: { email, password: value },
      });
    const session = await signIn(oldPassword);
    assert.equal(session.status, 200, "fresh ordinary sign-in failed");
    const claims = JSON.parse(
      Buffer.from(
        session.data.access_token.split(".")[1],
        "base64url",
      ).toString(),
    );
    assert.ok(
      claims.amr.some((entry) => entry.method === "password"),
      "ordinary session not password-authenticated",
    );
    assert.ok(
      !claims.amr.some((entry) => entry.method === "recovery"),
      "ordinary session unexpectedly recovery",
    );
    const update = (body, token = session.data.access_token) =>
      request(origin, "/user", { method: "PUT", token, body });
    if (!enforce) {
      assert.equal(
        (await update({ password: proposed })).status,
        200,
        "stock exposure not reproduced",
      );
      assert.equal(
        (await signIn(proposed)).status,
        200,
        "stock replacement did not persist",
      );
      assert.notEqual(
        (await signIn(oldPassword)).status,
        200,
        "stock old password still works",
      );
      passed(
        "flag off: fresh normal session replaces existing password without proof",
      );
    } else {
      for (const [name, body, code] of [
        [
          "missing current password",
          { password: proposed },
          "current_password_required",
        ],
        [
          "wrong current password",
          { password: proposed, current_password: password() },
          "current_password_invalid",
        ],
        [
          "blank current password",
          { password: proposed, current_password: "" },
          "current_password_required",
        ],
        [
          "blank replacement",
          { password: "", current_password: oldPassword },
          "weak_password",
        ],
      ]) {
        const result = await update(body);
        assert.ok(
          result.status >= 400 && result.status < 500,
          `${name}: expected refusal`,
        );
        assert.equal(
          result.data.error_code,
          code,
          `${name}: unexpected refusal reason`,
        );
        assert.equal(
          (await signIn(oldPassword)).status,
          200,
          `${name}: old password changed`,
        );
        assert.notEqual(
          (await signIn(proposed)).status,
          200,
          `${name}: proposed password accepted`,
        );
        passed(`flag on: ${name} refused; credential unchanged`);
      }
      assert.equal(
        (await update({ password: proposed, current_password: oldPassword }))
          .status,
        200,
        "correct current password refused",
      );
      assert.equal(
        (await signIn(proposed)).status,
        200,
        "authorized password did not persist",
      );
      assert.notEqual(
        (await signIn(oldPassword)).status,
        200,
        "old password survived authorized update",
      );
      passed("flag on: correct current password succeeds and persists");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      assert.equal(
        (
          await request(
            origin,
            "/recover?redirect_to=" +
              encodeURIComponent(
                "http://127.0.0.1:3100/auth/callback?next=/auth/reset-password",
              ),
            {
              method: "POST",
              body: {
                email,
                code_challenge: challenge,
                code_challenge_method: "s256",
              },
            },
          )
        ).status,
        200,
        "recovery request failed",
      );
      let message;
      await waitFor(async () => {
        const list = await request(mailbox, "/api/v1/messages");
        message = list.data.messages?.find((entry) =>
          entry.To?.some((recipient) => recipient.Address === email),
        );
        return !!message;
      }, "exact fixture recovery mail");
      const mail = await request(mailbox, `/api/v1/message/${message.ID}`);
      const hrefs = String(mail.data.HTML).match(/https?:\/\/[^\s"<>]+/g) ?? [];
      const link = hrefs
        .map((href) => new URL(href.replaceAll("&amp;", "&")))
        .find(
          (url) =>
            url.origin === origin &&
            url.pathname === "/verify" &&
            url.searchParams.get("type") === "recovery",
        );
      assert.ok(link, "no recovery link at exact local Auth origin");
      const verify = await request(origin, `${link.pathname}${link.search}`);
      assert.equal(
        verify.status,
        303,
        "recovery verification did not redirect",
      );
      const callback = new URL(verify.location);
      assert.equal(callback.origin, "http://127.0.0.1:3100");
      const code = callback.searchParams.get("code");
      assert.ok(code, "recovery callback has no PKCE code");
      const recovered = await request(origin, "/token?grant_type=pkce", {
        method: "POST",
        body: { auth_code: code, code_verifier: verifier },
      });
      assert.equal(recovered.status, 200, "real PKCE recovery exchange failed");
      const recoveryClaims = JSON.parse(
        Buffer.from(
          recovered.data.access_token.split(".")[1],
          "base64url",
        ).toString(),
      );
      assert.ok(
        recoveryClaims.amr.some((entry) => entry.method === "recovery"),
        "PKCE session lacks recovery method",
      );
      assert.equal(recoveryClaims.sub, id, "recovery subject mismatch");
      assert.equal(
        (await request(origin, "/user", { token: recovered.data.access_token }))
          .status,
        200,
        "recovery token not verified by Auth",
      );
      const replacement = password();
      assert.equal(
        (await update({ password: replacement }, recovered.data.access_token))
          .status,
        200,
        "recovery without current password refused",
      );
      assert.equal(
        (await signIn(replacement)).status,
        200,
        "recovery replacement did not persist",
      );
      assert.notEqual(
        (await signIn(proposed)).status,
        200,
        "pre-recovery password still works",
      );
      passed(
        "flag on: genuine email/PKCE recovery changes password without old proof; persistence verified",
      );
      assert.equal(
        (
          await request(mailbox, `/api/v1/messages`, {
            method: "DELETE",
            body: { IDs: [message.ID] },
          })
        ).status,
        200,
        "owned mail cleanup failed",
      );
    }
    assertOwned(names.auth);
    assert.equal(
      (
        await request(origin, `/admin/users/${id}`, {
          method: "DELETE",
          token: admin,
        })
      ).status,
      200,
      "fixture user cleanup failed",
    );
    assert.equal(
      (await request(origin, `/admin/users/${id}`, { token: admin })).status,
      404,
      "fixture user remains",
    );
    passed(
      `flag ${enforce ? "on" : "off"}: exact fixture user cleanup read-back`,
    );
    docker(["rm", "-fv", names.auth]);
    created.delete("auth");
  }
} catch (error) {
  console.error(
    `FAIL ${stage}: ${error instanceof Error ? error.message : "probe failed"}`,
  );
  process.exitCode = 1;
} finally {
  stage = "cleanup";
  const failures = [];
  for (const service of ["auth", "mail", "db"]) {
    if (!created.has(service)) continue;
    try {
      assertOwned(names[service]);
      docker(["rm", "-fv", names[service]]);
    } catch {
      failures.push(service);
    }
  }
  if (networkCreated) {
    try {
      assert.equal(
        docker([
          "network",
          "inspect",
          names.network,
          "--format",
          `{{index .Labels "${label}"}}`,
        ]).trim(),
        owner,
      );
      docker(["network", "rm", names.network]);
    } catch {
      failures.push("network");
    }
  }
  const residue = docker([
    "ps",
    "-a",
    "--filter",
    `label=${label}=${owner}`,
    "--format",
    "{{.Names}}",
  ]).trim();
  const networks = docker([
    "network",
    "ls",
    "--filter",
    `label=${label}=${owner}`,
    "--format",
    "{{.Name}}",
  ]).trim();
  if (failures.length || residue || networks) {
    console.error("FAIL owned resource cleanup/read-back");
    process.exitCode = 1;
  } else
    passed(
      "owned containers removed with -v; container/network absence verified",
    );
}
