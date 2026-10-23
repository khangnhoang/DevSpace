import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { GuardRecord, MailRecord } from "../helpers/e2e-server";

const root = fileURLToPath(new URL("../..", import.meta.url));
const guard = join(root, "__tests__", "e2e", "server-guard.cjs");
const { patchMailerSource } = createRequire(import.meta.url)("../e2e/server-mail.cjs") as {
  patchMailerSource: (source: string) => string;
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function lines<T>(file: string): T[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

// Runs `script` in a child Node process that preloads the server guard, like `next start` does. The guard
// refuses before any query or socket, so no packet leaves the machine for a refused host.
function runGuarded(script: string, options: { mail?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-guard-"));
  dirs.push(dir);
  const guardFile = join(dir, "guard.jsonl");
  const mailFile = join(dir, "mail.jsonl");
  writeFileSync(guardFile, "");
  writeFileSync(mailFile, "");

  const env: NodeJS.ProcessEnv = { ...process.env, E2E_GUARD_FILE: guardFile };
  delete env.E2E_MAIL_FILE;
  if (options.mail) env.E2E_MAIL_FILE = mailFile;

  const result = spawnSync(process.execPath, ["--require", guard, "-e", script], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status, dir, guard: lines<GuardRecord>(guardFile), mail: lines<MailRecord>(mailFile) };
}

describe("the e2e server guard", () => {
  it("allows a connection to 127.0.0.1 and records nothing", () => {
    const run = runGuarded(`
      const net = require("node:net");
      const server = net.createServer((socket) => socket.end("hello")).listen(0, "127.0.0.1", () => {
        const client = net.connect(server.address().port, "127.0.0.1");
        client.on("data", (chunk) => console.log("got " + chunk));
        client.on("close", () => server.close());
      });
    `);
    expect(run.stdout.trim()).toBe("got hello");
    expect(run.guard).toEqual([]);
  });

  it("refuses and records a connection to smtp.gmail.com", () => {
    const run = runGuarded(`
      require("node:net").connect({ host: "smtp.gmail.com", port: 587 }).on("error", (error) => console.log("error " + error.code));
    `);
    expect(run.stdout.trim()).toBe("error E2E_GUARD");
    expect(run.guard).toMatchObject([{ kind: "connect", host: "smtp.gmail.com", port: 587 }]);
  });

  it("refuses and records a connection to an IP address that is not loopback", () => {
    const run = runGuarded(`
      require("node:net").connect(443, "203.0.113.7").on("error", (error) => console.log("error " + error.code));
    `);
    expect(run.stdout.trim()).toBe("error E2E_GUARD");
    expect(run.guard).toMatchObject([{ kind: "connect", host: "203.0.113.7", port: 443 }]);
  });

  it("refuses and records every way to resolve a name that is not loopback", () => {
    const run = runGuarded(`
      const dns = require("node:dns");
      const lookup = new Promise((resolve) => dns.lookup("lookup.example", (error) => resolve(error.code)));
      const resolver = new Promise((resolve) => new dns.Resolver().resolve4("resolver.example", (error) => resolve(error.code)));
      const moduleLevel = new Promise((resolve) => dns.resolve6("module.example", (error) => resolve(error.code)));
      const promises = dns.promises.resolve4("promises.example").then(() => "resolved", (error) => error.code);
      const promisesResolver = new dns.promises.Resolver().resolve4("promises-resolver.example").then(() => "resolved", (error) => error.code);
      Promise.all([lookup, resolver, moduleLevel, promises, promisesResolver]).then((codes) => console.log(codes.join(",")));
    `);
    expect(run.stdout.trim()).toBe("E2E_GUARD,E2E_GUARD,E2E_GUARD,E2E_GUARD,E2E_GUARD");
    expect(run.guard.map((record) => [record.kind, record.host]).sort()).toEqual([
      ["dns", "lookup.example"],
      ["dns", "module.example"],
      ["dns", "promises-resolver.example"],
      ["dns", "promises.example"],
      ["dns", "resolver.example"],
    ]);
  });

  it("lets localhost resolve", () => {
    const run = runGuarded(`require("node:dns").lookup("localhost", (error) => console.log(error ? "failed" : "resolved"));`);
    expect(run.stdout.trim()).toBe("resolved");
    expect(run.guard).toEqual([]);
  });

  it("refuses a nodemailer send through service gmail at name resolution when the mail record is off", () => {
    const run = runGuarded(`
      const nodemailer = require("nodemailer");
      nodemailer
        .createTransport({ service: "gmail", auth: { user: "sender@devspace.test", pass: "placeholder" } })
        .sendMail({ from: "sender@devspace.test", to: "learner@devspace.test", subject: "subject", text: "body" })
        .then(() => console.log("sent"), (error) => console.log("failed " + error.code));
    `);
    // nodemailer reports a failed lookup as its own EDNS error, so the guard file is the proof of the refusal.
    expect(run.stdout.trim()).toBe("failed EDNS");
    expect(run.guard.length).toBeGreaterThan(0);
    expect(run.guard.every((record) => record.kind === "dns" && record.host === "smtp.gmail.com")).toBe(true);
    expect(run.mail).toEqual([]);
  });
});

describe("the e2e mail record", () => {
  // A stand-in for a Turbopack server chunk: nodemailer's `Mailer` is bundled into one, and the runtime loads
  // the chunk with `require`. The file must sit under `.next/server/chunks/` for the guard to rewrite it.
  function writeChunk(dir: string, path: string[]) {
    const folder = join(dir, ...path);
    mkdirSync(folder, { recursive: true });
    const file = join(folder, "[root-of-the-server]__fixture._.js");
    writeFileSync(
      file,
      mailerChunk(true),
    );
    return file;
  }

  // The class has nodemailer's markers (the strings are no-op statements here) or, without them, is an
  // unrelated class with the same signature.
  function mailerChunk(withMarkers: boolean) {
    const markers = withMarkers ? `"this.transporter.getSocket";"Sending mail using %s/%s";` : "";
    return `module.exports=[[1,a=>{class M{sendMail(a,b=null){${markers}throw new Error("the real sendMail ran")}}a.exports=M}]];`;
  }

  const send = (file: string) => `
    const holder = {};
    require(${JSON.stringify(file)})[0][1](holder);
    (async () => {
      try {
        const info = await new holder.exports().sendMail({ to: ["learner@devspace.test"], subject: "[Xác nhận] Kích hoạt thành công: JavaScript căn bản" });
        console.log("accepted " + info.accepted);
      } catch (error) {
        console.log("failed " + error.message);
      }
    })();
  `;

  it("records the recipient and subject of a send from a server chunk and sends nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-mail-"));
    dirs.push(dir);
    const chunk = writeChunk(dir, [".next", "server", "chunks", "ssr"]);

    const run = runGuarded(send(chunk), { mail: true });
    expect(run.stdout.trim()).toBe("accepted learner@devspace.test");
    expect(run.mail).toMatchObject([{ to: "learner@devspace.test", subject: "[Xác nhận] Kích hoạt thành công: JavaScript căn bản" }]);
    expect(run.guard).toEqual([]);
  });

  it("leaves a file outside .next/server/chunks alone", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-mail-"));
    dirs.push(dir);
    const file = writeChunk(dir, ["elsewhere"]);

    const run = runGuarded(send(file), { mail: true });
    expect(run.stdout.trim()).toBe("failed the real sendMail ran");
    expect(run.mail).toEqual([]);
  });

  it("leaves a chunk whose class is not nodemailer's alone", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-mail-"));
    dirs.push(dir);
    const folder = join(dir, ".next", "server", "chunks", "ssr");
    mkdirSync(folder, { recursive: true });
    const file = join(folder, "[root-of-the-server]__unrelated._.js");
    writeFileSync(file, mailerChunk(false));

    const run = runGuarded(send(file), { mail: true });
    expect(run.stdout.trim()).toBe("failed the real sendMail ran");
    expect(run.mail).toEqual([]);
  });

  describe("patchMailerSource", () => {
    it("rewrites a minified and an unminified definition", () => {
      const markers = '"this.transporter.getSocket";"Sending mail using %s/%s";';
      expect(patchMailerSource(`class M{sendMail(a,b=null){${markers}}}`)).toBe(
        `class M{sendMail(a,b=null){return globalThis.__e2eRecordMail(a,b);${markers}}}`,
      );
      const unminified = `class M {\n  sendMail(data, callback = null) {\n    ${markers}\n  }\n}`;
      expect(patchMailerSource(unminified)).toContain("return globalThis.__e2eRecordMail(data,callback);");
    });

    it("leaves calls and sources without a definition alone", () => {
      const source = "transporter.sendMail(a,b);transporter.sendMail({to:1}).then(f);";
      expect(patchMailerSource(source)).toBe(source);
    });

    it("leaves an unrelated class with the same signature alone", () => {
      const source = "class Other{sendMail(a,b=null){return a+b}}";
      expect(patchMailerSource(source)).toBe(source);
    });

    it("leaves the signature inside a string alone", () => {
      const source = 'const doc="class Other{sendMail(a,b=null){return 1}}";export{doc}';
      expect(patchMailerSource(source)).toBe(source);
    });

    it("patches only the definition that carries the nodemailer markers", () => {
      const mailer = 'class Mailer{sendMail(a,b=null){let c;"function"==typeof this.transporter.getSocket&&(c=1);this.logger.debug({},"Sending mail using %s/%s")}}';
      const decoy = 'const doc="{sendMail(x,y=null){}";class Other{sendMail(p,q=null){return p}}';
      const patched = patchMailerSource(`${decoy}${mailer}`);
      const expected = mailer.replace("sendMail(a,b=null){", "sendMail(a,b=null){return globalThis.__e2eRecordMail(a,b);");
      expect(patched).toBe(`${decoy}${expected}`);
    });

    it("fails when a chunk bundles nodemailer but holds no definition of its sendMail or two", () => {
      expect(() => patchMailerSource('log("Sending mail using %s/%s");')).toThrow(/0 nodemailer sendMail definitions/);
      const mailer = 'class M{sendMail(a,b=null){this.transporter.getSocket;log("Sending mail using %s/%s")}}';
      expect(() => patchMailerSource(`${mailer}${mailer}`)).toThrow(/2 nodemailer sendMail definitions/);
    });
  });
});
