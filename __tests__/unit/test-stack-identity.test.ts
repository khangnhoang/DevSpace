import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  TEST_PORTS,
  requiredContainerNames,
  TEST_MAILPIT_IMAGE,
  TEST_NETWORK,
} from "../../scripts/test-stack/config.mjs";
import {
  assertMailReady,
  ensureMailNetwork,
  assertRunnerMailbox,
  ensureRunnerMailbox,
  checkStart,
  checkStop,
  checkWrite,
  describeProblems,
  parseContainer,
  requiredProblems,
} from "../../scripts/test-stack/docker.mjs";
import { ensureTestStack } from "../../scripts/test-stack/ensure.mjs";

type Fake = {
  name: string;
  project: string;
  state?: string;
  health?: string;
  ports?: number[];
};
function engine(
  containers: Fake[],
  {
    host = "npipe:////./pipe/dockerDesktopLinuxEngine",
    busy = [] as number[],
  } = {},
) {
  return {
    host: () => host,
    containers: () =>
      containers.map((container) => ({
        id: container.name,
        state: "running",
        health: "",
        ports: [],
        ...container,
      })),
    volumeExists: () => true,
    portFree: async (port: number) => !busy.includes(port),
  };
}
const dev: Fake[] = [
  {
    name: "supabase_db_devspace-local",
    project: "devspace-local",
    ports: [54322],
  },
  {
    name: "supabase_kong_devspace-local",
    project: "devspace-local",
    ports: [54321],
  },
];
const test: Fake[] = [
  {
    name: "supabase_db_devspace-test",
    project: "devspace-test",
    ports: [TEST_PORTS.db],
  },
  {
    name: "supabase_kong_devspace-test",
    project: "devspace-test",
    ports: [TEST_PORTS.api],
  },
];
const ports = [TEST_PORTS.api, TEST_PORTS.db];
const write = { dbPort: TEST_PORTS.db, apiPort: TEST_PORTS.api };
const testNetwork = {
  Id: "verified-test-network-id",
  Labels: { "com.supabase.cli.project": "devspace-test" },
  Driver: "bridge",
  Internal: false,
  Options: { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" },
};
const mailbox = (
  ports: Record<string, unknown> = {
    "8025/tcp": [{ HostIp: "127.0.0.1", HostPort: "55324" }],
  },
) => ({
  project: "devspace-test",
  owner: "v1",
  image: TEST_MAILPIT_IMAGE,
  network: TEST_NETWORK,
  networks: {
    [TEST_NETWORK]: { NetworkID: testNetwork.Id, Aliases: ["inbucket"] },
  },
  health: ["CMD-SHELL", "/mailpit readyz"],
  ports,
});
const retainedEngine = () =>
  engine(
    requiredContainerNames().map((name) => ({
      name,
      project: "devspace-test",
    })),
  );

describe("test stack identity check", () => {
  it("reuses only the owned loopback mailbox and never replaces a foreign or wildcard mailbox", () => {
    for (const invalid of [
      { ...mailbox(), owner: "" },
      { ...mailbox(), project: "other" },
      mailbox({ "8025/tcp": [{ HostIp: "0.0.0.0", HostPort: "55324" }] }),
    ]) {
      expect(() =>
        ensureRunnerMailbox({
          ...engine([]),
          mailbox: () => invalid,
          createMailbox: () => {
            throw new Error("must not replace");
          },
        }),
      ).toThrow();
    }
    expect(() => assertRunnerMailbox(mailbox())).not.toThrow();
    let current: ReturnType<typeof mailbox> | null = null;
    let created = 0;
    const docker = {
      ...engine([]),
      mailbox: () => current,
      createMailbox: () => {
        created++;
        current = mailbox();
      },
    };
    ensureRunnerMailbox(docker);
    ensureRunnerMailbox(docker);
    expect(created).toBe(1);
  });
  it("Mailpit refuses a public web bind, published SMTP, external SMTP or a missing service", () => {
    const valid = {
      "8025/tcp": [{ HostIp: "127.0.0.1", HostPort: "55324" }],
      "1025/tcp": null,
    };
    const mail = (ports = valid, localSmtp = true) => ({
      ...retainedEngine(),
      network: () => testNetwork,
      mailConfiguration: () => ({ localSmtp, authNetworkId: testNetwork.Id }),
      mailbox: () => mailbox(ports),
    });
    expect(() => assertMailReady(mail())).not.toThrow();
    expect(() =>
      assertMailReady(
        mail({
          ...valid,
          "8025/tcp": [{ HostIp: "0.0.0.0", HostPort: "55324" }],
        }),
      ),
    ).toThrow(/readiness refused/);
    expect(() =>
      assertMailReady(
        mail({
          ...valid,
          "1025/tcp": [{ HostIp: "127.0.0.1", HostPort: "55325" }],
        } as unknown as typeof valid),
      ),
    ).toThrow(/readiness refused/);
    expect(() => assertMailReady(mail(valid, false))).toThrow(
      /readiness refused/,
    );
    expect(() =>
      assertMailReady({
        ...engine(test),
        network: () => testNetwork,
        mailbox: () => mailbox(),
        mailConfiguration: () => {
          throw new Error("must not inspect");
        },
      }),
    ).toThrow(/missing/);
  });

  it.each([
    {
      name: "Mailpit on a second bridge",
      extraNetwork: true,
      authNetworkId: testNetwork.Id,
      message: /mailbox identity/,
    },
    {
      name: "Auth missing from the test network",
      extraNetwork: false,
      authNetworkId: "",
      message: /must share the verified test network/,
    },
  ])(
    "refuses a retained stack with $name before mailbox I/O or a forced reset",
    async ({ extraNetwork, authNetworkId, message }) => {
      const root = mkdtempSync(join(tmpdir(), "devspace-mail-readiness-"));
      const fetch = vi.fn();
      const onMutate = vi.fn(() => {
        throw new Error("unexpected stack mutation");
      });
      vi.stubGlobal("fetch", fetch);
      try {
        const source = join(root, "supabase");
        mkdirSync(join(source, "migrations"), { recursive: true });
        for (const file of ["config.toml", "seed.sql"])
          cpSync(join(process.cwd(), "supabase", file), join(source, file));
        const retainedMailbox = mailbox();
        const docker = {
          ...retainedEngine(),
          network: () => testNetwork,
          createMailNetwork: vi.fn(),
          createMailbox: vi.fn(),
          mailbox: () =>
            extraNetwork
              ? {
                  ...retainedMailbox,
                  networks: {
                    ...retainedMailbox.networks,
                    other: { NetworkID: "other-network", Aliases: [] },
                  },
                }
              : retainedMailbox,
          mailConfiguration: () => ({ localSmtp: true, authNetworkId }),
        };
        await expect(
          ensureTestStack({ root, reset: true, docker, onMutate }),
        ).rejects.toThrow(message);
        expect(fetch).not.toHaveBeenCalled();
        expect(onMutate).not.toHaveBeenCalled();
        expect(docker.createMailNetwork).not.toHaveBeenCalled();
        expect(docker.createMailbox).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("Mailpit network preflight refuses an old or foreign network without replacing it", () => {
    const network = testNetwork;
    const check = (value: typeof network) => ({
      ...engine([]),
      network: () => value,
      createMailNetwork: () => {
        throw new Error("must not replace");
      },
    });
    expect(() => ensureMailNetwork(check(network))).not.toThrow();
    expect(() =>
      ensureMailNetwork(check({ ...network, Options: {} } as typeof network)),
    ).toThrow(/test network/);
    expect(() =>
      ensureMailNetwork(
        check({ ...network, Labels: { "com.supabase.cli.project": "other" } }),
      ),
    ).toThrow(/test network/);
  });
  it("parses the labels and published ports Docker reports", () => {
    expect(
      parseContainer({
        ID: "a",
        Names: "n",
        State: "running",
        HealthStatus: "none",
        Labels: "x=1,com.supabase.cli.project=devspace-test",
        Ports: "0.0.0.0:55322->5432/tcp, [::]:55322->5432/tcp",
      }),
    ).toMatchObject({
      project: "devspace-test",
      health: "",
      ports: [55322, 55322],
    });
  });

  it("start: accepts free ports and ports held by the test project, refuses ports held by another project", async () => {
    await expect(checkStart(engine(dev), { ports })).resolves.toBeUndefined();
    await expect(
      checkStart(engine([...dev, ...test]), { ports }),
    ).resolves.toBeUndefined();
    const squatter = [
      { name: "supabase_db_other", project: "other", ports: [TEST_PORTS.db] },
    ];
    await expect(checkStart(engine(squatter), { ports })).rejects.toThrow(
      /held by container supabase_db_other/,
    );
    await expect(
      checkStart(engine([], { busy: [TEST_PORTS.api] }), { ports }),
    ).rejects.toThrow(/outside Docker/);
  });

  it("write: needs the test project's running containers on the reported ports", () => {
    expect(() => checkWrite(engine([...dev, ...test]), write)).not.toThrow();
    expect(() => checkWrite(engine(dev), write)).toThrow(
      /supabase_db_devspace-test is not running/,
    );
    expect(() =>
      checkWrite(engine([...dev, ...test]), { dbPort: 54322, apiPort: 54321 }),
    ).toThrow(/not published by supabase_db_devspace-test/);
    expect(() =>
      checkWrite(engine([{ ...test[0], state: "exited" }, test[1]]), write),
    ).toThrow(/not running/);
  });

  it("refuses a container named like a test container that belongs to another project", async () => {
    const impostor = [
      {
        name: "supabase_db_devspace-test",
        project: "devspace-local",
        ports: [TEST_PORTS.db],
      },
      test[1],
    ];
    expect(() => checkWrite(engine(impostor), write)).toThrow(
      /belongs to project "devspace-local"/,
    );
    await expect(checkStart(engine(impostor), { ports })).rejects.toThrow(
      /named like a test stack container/,
    );
    expect(() => checkStop(engine(impostor), {})).toThrow(
      /named like a test stack container/,
    );
  });

  it("stop: accepts missing containers and a stopped project, refuses another project and a remote engine", () => {
    expect(() => checkStop(engine(dev), {})).not.toThrow();
    expect(() => checkStop(engine([test[0]]), {})).not.toThrow();
    expect(() => checkStop(engine([]), { project: "devspace-local" })).toThrow(
      /not the test project/,
    );
    expect(() =>
      checkStop(engine(test, { host: "tcp://build-host:2375" }), {}),
    ).toThrow(/not local/);
  });

  it("required containers: names the missing, stopped and unhealthy ones and waits only for starting ones", () => {
    const all = requiredContainerNames().map((name) => ({
      name,
      project: "devspace-test",
    }));
    expect(requiredProblems(engine(all))).toEqual([]);
    const without = all.filter(
      (container) => !container.name.includes("storage"),
    );
    const [missing] = requiredProblems(engine(without));
    expect(missing).toMatchObject({
      name: "supabase_storage_devspace-test",
      reason: "is missing",
      final: true,
    });
    expect(describeProblems([missing])).toMatch(
      /supabase_storage_devspace-test is missing.*No reset and no test ran.*test:stack:stop/,
    );
    expect(
      requiredProblems(
        engine(all.map((container) => ({ ...container, health: "starting" }))),
      )[0].final,
    ).toBe(false);
    expect(
      requiredProblems(
        engine(all.map((container) => ({ ...container, health: "unhealthy" }))),
      )[0].reason,
    ).toBe("is unhealthy");
  });
});
