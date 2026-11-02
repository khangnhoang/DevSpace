import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXCLUDED_SERVICES, REQUIRED_SERVICES, TEST_PORTS, TEST_PROJECT_ID, generateTestConfig, prepareTestWorkdir, requiredContainerNames } from "../../scripts/test-stack/config.mjs";

const root = process.cwd();
const temps: string[] = [];
function checkoutCopy() {
  const dir = mkdtempSync(join(tmpdir(), "devspace-test-config-"));
  temps.push(dir);
  cpSync(join(root, "supabase", "config.toml"), join(dir, "supabase", "config.toml"));
  cpSync(join(root, "supabase", "migrations"), join(dir, "supabase", "migrations"), { recursive: true });
  cpSync(join(root, "supabase", "seed.sql"), join(dir, "supabase", "seed.sql"));
  return dir;
}
afterEach(() => { while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true }); });

describe("generated test stack config", () => {
  const source = readFileSync(join(root, "supabase", "config.toml"), "utf8");
  const generated = generateTestConfig(source);

  it("names the test project, never the dev project", () => {
    expect(generated).toMatch(new RegExp(`^project_id = "${TEST_PROJECT_ID}"`, "m"));
    expect(generated).not.toContain("devspace-local");
  });

  it("keeps every port out of the dev range 54320-54329 and the VocaSpace ports 45321-45324", () => {
    const ports = [...generated.matchAll(/^(?:port|shadow_port|inspector_port)\s*=\s*(\d+)/gm)].map((match) => Number(match[1]));
    expect(ports.length).toBeGreaterThan(5);
    for (const port of ports) {
      expect(port >= 54320 && port <= 54329).toBe(false);
      expect(port >= 45321 && port <= 45324).toBe(false);
    }
    expect(Object.values(TEST_PORTS).every((port) => port >= 55320 && port <= 55329)).toBe(true);
  });

  it("points Auth at the e2e server and keeps Studio and the mail server off", () => {
    expect(generated).toContain('site_url = "http://127.0.0.1:3100"');
    expect(generated).toMatch(/\[studio\]\r?\nenabled = false/);
    expect(generated).toMatch(/\[local_smtp\]\r?\nenabled = false/);
  });

  it("fails loudly when the dev config no longer has a key the test config rewrites", () => {
    expect(() => generateTestConfig(source.replace("shadow_port", "renamed_port"))).toThrow(/shadow_port/);
  });

  it("starts without the services the suites do not use but requires the ones they do", () => {
    expect(EXCLUDED_SERVICES).toContain("realtime");
    expect(REQUIRED_SERVICES.filter((service) => EXCLUDED_SERVICES.includes(service))).toEqual([]);
    expect(requiredContainerNames()).toContain(`supabase_db_${TEST_PROJECT_ID}`);
  });
});

describe("generated test workdir", () => {
  it("copies migrations and seed exactly, carries no project link and changes its hash with an input", () => {
    const dir = checkoutCopy();
    const first = prepareTestWorkdir(dir);
    const target = join(first.workdir, "supabase");
    expect(readdirSync(join(target, "migrations")).sort()).toEqual(readdirSync(join(root, "supabase", "migrations")).sort());
    for (const file of readdirSync(join(root, "supabase", "migrations"))) {
      expect(readFileSync(join(target, "migrations", file))).toEqual(readFileSync(join(root, "supabase", "migrations", file)));
    }
    expect(readFileSync(join(target, "seed.sql"))).toEqual(readFileSync(join(root, "supabase", "seed.sql")));
    expect(existsSync(join(target, ".temp"))).toBe(false);
    expect(prepareTestWorkdir(dir).hash).toBe(first.hash);

    rmSync(join(dir, "supabase", "migrations", readdirSync(join(dir, "supabase", "migrations"))[0]));
    const changed = prepareTestWorkdir(dir);
    expect(changed.hash).not.toBe(first.hash);
    expect(readdirSync(join(changed.workdir, "supabase", "migrations")).length).toBe(readdirSync(join(root, "supabase", "migrations")).length - 1);
  });
});
