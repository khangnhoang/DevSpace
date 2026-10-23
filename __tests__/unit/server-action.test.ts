import { describe, expect, it } from "vitest";
import { findAction, readActionResponse, type ServerReferenceManifest } from "../helpers/server-action-core";

// Shaped like .next/server/server-reference-manifest.json of Next 16.4.3 (ids shortened).
const manifest: ServerReferenceManifest = {
  node: {
    "6052c6275cbc": {
      workers: { "app/(main)/course/[slug]/page": { moduleId: 1, async: false } },
      filename: "app/action/payment.ts",
      exportedName: "createPendingPayment",
    },
    "4040ef769714": {
      workers: { "app/admin/transactions/page": { moduleId: 2, async: false } },
      filename: "app/action/payment.ts",
      exportedName: "approvePayment",
    },
    "409f40801acb": {
      workers: { "app/other/page": { moduleId: 3, async: false } },
      filename: "app/action/other.ts",
      exportedName: "somethingElse",
    },
  },
};

// Responses captured from the e2e server of this repo (the Next 16.4.3 build): an error object, a result with an
// array, and the error row of a request whose origin did not match.
const ERROR_BODY = `0:{"a":"$@1","q":"","i":false,"b":"MbdNzVneZBcyxnazx8yXW"}\n1:{"error":"Bạn chưa đăng nhập"}\n`;
const LIST_BODY =
  `0:{"a":"$@1","q":"","i":false,"b":"MbdNzVneZBcyxnazx8yXW"}\n` +
  `1:[{"id":1,"amount":199000,"status":"approved","courses":{"name":"JavaScript căn bản","price":199000},"users":{"email":"student@devspace.test","avatar_url":null}}]\n`;
const ORIGIN_BODY = `0:{"a":"$@1","q":"","i":false,"b":"MbdNzVneZBcyxnazx8yXW"}\n1:E{"digest":"3690472329"}\n`;

describe("findAction", () => {
  it("finds an action by source file and export name and maps its page worker to a URL", () => {
    expect(findAction(manifest, "app/action/payment.ts", "createPendingPayment")).toEqual({
      id: "6052c6275cbc",
      path: "/course/javascript-can-ban",
    });
    expect(findAction(manifest, "app/action/payment.ts", "approvePayment")).toEqual({
      id: "4040ef769714",
      path: "/admin/transactions",
    });
  });

  it("fails with a message naming the pair when the manifest does not list it", () => {
    expect(() => findAction(manifest, "app/action/payment.ts", "refundPayment")).toThrow(
      /app\/action\/payment\.ts#refundPayment is not in the server reference manifest/,
    );
    expect(() => findAction({}, "app/action/payment.ts", "approvePayment")).toThrow(/approvePayment is not in the server reference manifest/);
  });

  it("fails when the pair is listed twice or has no page worker the helper knows", () => {
    const twice: ServerReferenceManifest = { node: { a: manifest.node!["4040ef769714"], b: manifest.node!["4040ef769714"] } };
    expect(() => findAction(twice, "app/action/payment.ts", "approvePayment")).toThrow(/more than once/);
    expect(() => findAction(manifest, "app/action/other.ts", "somethingElse")).toThrow(/no known page worker/);
  });
});

describe("readActionResponse", () => {
  it("returns the result object of an action", () => {
    expect(readActionResponse({ status: 200, body: ERROR_BODY })).toEqual({ kind: "result", value: { error: "Bạn chưa đăng nhập" } });
  });

  it("returns an array result", () => {
    const outcome = readActionResponse({ status: 200, body: LIST_BODY });
    expect(outcome).toMatchObject({ kind: "result", value: [{ id: 1, amount: 199000, users: { avatar_url: null } }] });
  });

  it("decodes the flight escape of a string that starts with a dollar sign", () => {
    const body = `0:{"a":"$@1"}\n1:{"note":"$$5 off","none":"$undefined"}\n`;
    expect(readActionResponse({ status: 200, body })).toEqual({ kind: "result", value: { note: "$5 off", none: undefined } });
  });

  it("reports a redirect with its status and location", () => {
    expect(readActionResponse({ status: 307, location: "http://127.0.0.1:3100/login", body: "" })).toEqual({
      kind: "redirect",
      status: 307,
      location: "http://127.0.0.1:3100/login",
    });
  });

  it("fails on the error row the server answers for a refused request", () => {
    expect(() => readActionResponse({ status: 200, body: ORIGIN_BODY })).toThrow(/answered an error row/);
  });

  it("fails on an HTTP error, a missing root row and a reference it does not know", () => {
    expect(() => readActionResponse({ status: 404, body: "Not found" })).toThrow(/HTTP 404/);
    expect(() => readActionResponse({ status: 200, body: "<html>login</html>" })).toThrow(/no root row/);
    expect(() => readActionResponse({ status: 200, body: `0:{"a":"$@2"}\n1:{}\n` })).toThrow(/points at no result row/);
    expect(() => readActionResponse({ status: 200, body: `0:{"a":"$@1"}\n1:{"when":"$D2026-01-01"}\n` })).toThrow(/unknown flight reference/);
    expect(() => readActionResponse({ status: 302, body: "" })).toThrow(/without a location/);
  });
});
