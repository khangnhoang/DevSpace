// The supplemental SE-U3 database shares the machine-wide lock and recovery boundary with the test stack.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./state.mjs";

export const GRAPHQL_COMPAT_IMAGE =
  "public.ecr.aws/supabase/postgres@sha256:95d92e9563121189086690a4b7f8f2b711a4809a2499f45592199aae68ebae5f";
export const GRAPHQL_COMPAT_LABEL = "devspace.se-u3.compat.owner";
export const graphqlCompatJournal = (dir = stateDir()) =>
  join(dir, "se-u3-compat-owner.json");

const invokeDocker = (args) =>
  spawnSync("docker", args, { encoding: "utf8", timeout: 60_000 });

function output(result) {
  if (result.error || result.status !== 0)
    throw new Error(
      "Cannot establish compatibility-container state; retain its ownership journal",
    );
  return result.stdout;
}

export function assertLocalCompatDocker(docker = invokeDocker) {
  // An explicit context takes precedence over DOCKER_HOST in the Docker CLI.
  const endpoint =
    process.env.DOCKER_CONTEXT || !process.env.DOCKER_HOST
      ? output(
          docker([
            "context",
            "inspect",
            "--format",
            "{{.Endpoints.docker.Host}}",
          ]),
        ).trim()
      : process.env.DOCKER_HOST;
  assert.match(
    endpoint,
    /^(npipe:|unix:)/,
    "Compatibility probe requires a local Docker engine",
  );
}

function validate(record) {
  assert.match(
    record.owner,
    /^devspace-se-u3-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  assert.equal(record.name, `${record.owner}-db`);
  assert.equal(record.image, GRAPHQL_COMPAT_IMAGE);
  if (record.id !== undefined) assert.match(record.id, /^[0-9a-f]{64}$/);
}

export function inspectGraphqlCompatibility(record, docker = invokeDocker) {
  validate(record);
  assertLocalCompatDocker(docker);
  const result = docker(["inspect", "--type", "container", record.name]);
  if (
    !result.error &&
    result.status !== 0 &&
    /No such (object|container)/i.test(result.stderr)
  )
    return null;
  const [item] = JSON.parse(output(result));
  assert.match(item.Id, /^[0-9a-f]{64}$/);
  assert.equal(item.Config.Labels?.[GRAPHQL_COMPAT_LABEL], record.owner);
  assert.equal(item.Config.Image, record.image);
  assert.equal(item.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(item.HostConfig.PortBindings ?? {}).length, 0);
  assert.ok(
    item.Mounts.every((mount) => mount.Type === "tmpfs"),
    "compatibility container must have no host/volume mounts",
  );
  if (record.id) assert.equal(item.Id, record.id);
  return item;
}

export function removeGraphqlCompatibility(
  record,
  dir = stateDir(),
  docker = invokeDocker,
) {
  const path = graphqlCompatJournal(dir);
  const saved = JSON.parse(readFileSync(path, "utf8"));
  validate(saved);
  assert.equal(saved.owner, record.owner);
  assert.equal(saved.id, record.id);
  const found = inspectGraphqlCompatibility(saved, docker);
  if (found) output(docker(["rm", "-f", found.Id]));
  assert.equal(
    inspectGraphqlCompatibility(saved, docker),
    null,
    "compatibility container survived cleanup",
  );
  // An interrupted ID update can leave this sibling behind; the intent remains authoritative until removal.
  rmSync(`${path}.next`, { force: true });
  unlinkSync(path);
}

// Call only while holding the shared lock, after earlier/current writers have settled.
export function reconcileGraphqlCompatibility({
  dir = stateDir(),
  docker = invokeDocker,
} = {}) {
  let text;
  try {
    text = readFileSync(graphqlCompatJournal(dir), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  removeGraphqlCompatibility(JSON.parse(text), dir, docker);
  return true;
}
