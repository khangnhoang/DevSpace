import { describe, expect, it } from "vitest";
import { TEST_PORTS, requiredContainerNames } from "../../scripts/test-stack/config.mjs";
import { checkStart, checkStop, checkWrite, describeProblems, parseContainer, requiredProblems } from "../../scripts/test-stack/docker.mjs";

type Fake = { name: string; project: string; state?: string; health?: string; ports?: number[] };
function engine(containers: Fake[], { host = "npipe:////./pipe/dockerDesktopLinuxEngine", busy = [] as number[] } = {}) {
  return {
    host: () => host,
    containers: () => containers.map((container) => ({ id: container.name, state: "running", health: "", ports: [], ...container })),
    volumeExists: () => true,
    portFree: async (port: number) => !busy.includes(port),
  };
}
const dev: Fake[] = [
  { name: "supabase_db_devspace-local", project: "devspace-local", ports: [54322] },
  { name: "supabase_kong_devspace-local", project: "devspace-local", ports: [54321] },
];
const test: Fake[] = [
  { name: "supabase_db_devspace-test", project: "devspace-test", ports: [TEST_PORTS.db] },
  { name: "supabase_kong_devspace-test", project: "devspace-test", ports: [TEST_PORTS.api] },
];
const ports = [TEST_PORTS.api, TEST_PORTS.db];
const write = { dbPort: TEST_PORTS.db, apiPort: TEST_PORTS.api };

describe("test stack identity check", () => {
  it("parses the labels and published ports Docker reports", () => {
    expect(parseContainer({ ID: "a", Names: "n", State: "running", HealthStatus: "none", Labels: "x=1,com.supabase.cli.project=devspace-test", Ports: "0.0.0.0:55322->5432/tcp, [::]:55322->5432/tcp" }))
      .toMatchObject({ project: "devspace-test", health: "", ports: [55322, 55322] });
  });

  it("start: accepts free ports and ports held by the test project, refuses ports held by another project", async () => {
    await expect(checkStart(engine(dev), { ports })).resolves.toBeUndefined();
    await expect(checkStart(engine([...dev, ...test]), { ports })).resolves.toBeUndefined();
    const squatter = [{ name: "supabase_db_other", project: "other", ports: [TEST_PORTS.db] }];
    await expect(checkStart(engine(squatter), { ports })).rejects.toThrow(/held by container supabase_db_other/);
    await expect(checkStart(engine([], { busy: [TEST_PORTS.api] }), { ports })).rejects.toThrow(/outside Docker/);
  });

  it("write: needs the test project's running containers on the reported ports", () => {
    expect(() => checkWrite(engine([...dev, ...test]), write)).not.toThrow();
    expect(() => checkWrite(engine(dev), write)).toThrow(/supabase_db_devspace-test is not running/);
    expect(() => checkWrite(engine([...dev, ...test]), { dbPort: 54322, apiPort: 54321 })).toThrow(/not published by supabase_db_devspace-test/);
    expect(() => checkWrite(engine([{ ...test[0], state: "exited" }, test[1]]), write)).toThrow(/not running/);
  });

  it("refuses a container named like a test container that belongs to another project", async () => {
    const impostor = [{ name: "supabase_db_devspace-test", project: "devspace-local", ports: [TEST_PORTS.db] }, test[1]];
    expect(() => checkWrite(engine(impostor), write)).toThrow(/belongs to project "devspace-local"/);
    await expect(checkStart(engine(impostor), { ports })).rejects.toThrow(/named like a test stack container/);
    expect(() => checkStop(engine(impostor), {})).toThrow(/named like a test stack container/);
  });

  it("stop: accepts missing containers and a stopped project, refuses another project and a remote engine", () => {
    expect(() => checkStop(engine(dev), {})).not.toThrow();
    expect(() => checkStop(engine([test[0]]), {})).not.toThrow();
    expect(() => checkStop(engine([]), { project: "devspace-local" })).toThrow(/not the test project/);
    expect(() => checkStop(engine(test, { host: "tcp://build-host:2375" }), {})).toThrow(/not local/);
  });

  it("required containers: names the missing, stopped and unhealthy ones and waits only for starting ones", () => {
    const all = requiredContainerNames().map((name) => ({ name, project: "devspace-test" }));
    expect(requiredProblems(engine(all))).toEqual([]);
    const without = all.filter((container) => !container.name.includes("storage"));
    const [missing] = requiredProblems(engine(without));
    expect(missing).toMatchObject({ name: "supabase_storage_devspace-test", reason: "is missing", final: true });
    expect(describeProblems([missing])).toMatch(/supabase_storage_devspace-test is missing.*No reset and no test ran.*test:stack:stop/);
    expect(requiredProblems(engine(all.map((container) => ({ ...container, health: "starting" }))))[0].final).toBe(false);
    expect(requiredProblems(engine(all.map((container) => ({ ...container, health: "unhealthy" }))))[0].reason).toBe("is unhealthy");
  });
});
