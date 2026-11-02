import { describe, expect, it } from "vitest";
import { localStorageImages } from "@/lib/image-hosts";

const NOTHING = { remotePatterns: [] };

describe("localStorageImages", () => {
  it.each([
    ["the dev stack", "http://127.0.0.1:54321", "127.0.0.1", "54321"],
    ["the test stack", "http://127.0.0.1:55321", "127.0.0.1", "55321"],
    ["localhost", "http://localhost:54321/", "localhost", "54321"],
  ])("lists the Storage public path of %s and allows the local address", (_label, url, hostname, port) => {
    expect(localStorageImages(url)).toEqual({
      remotePatterns: [{ protocol: "http", hostname, port, pathname: "/storage/v1/object/public/**" }],
      dangerouslyAllowLocalIP: true,
    });
  });

  it("keeps the scheme and a default port of a local https URL", () => {
    expect(localStorageImages("https://localhost").remotePatterns).toEqual([
      { protocol: "https", hostname: "localhost", port: "", pathname: "/storage/v1/object/public/**" },
    ]);
  });

  it.each([
    ["the hosted project", "https://lkvxxrxojjlkchzzqidu.supabase.co"],
    ["a host that only starts like a local one", "http://127.0.0.1.example.com:54321"],
    ["a local name in the path", "https://example.com/127.0.0.1"],
    ["a private address that is not the loopback pair", "http://192.168.0.5:54321"],
    ["an IPv6 loopback", "http://[::1]:54321"],
    ["a non-http scheme", "ftp://127.0.0.1"],
  ])("adds nothing for %s", (_label, url) => {
    expect(localStorageImages(url)).toEqual(NOTHING);
  });

  it.each([
    ["a missing URL", undefined],
    ["an empty URL", ""],
    ["a value that does not parse", "not a url"],
  ])("adds nothing and does not throw for %s", (_label, url) => {
    expect(localStorageImages(url)).toEqual(NOTHING);
  });
});
