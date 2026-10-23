import { describe, expect, it } from "vitest";
import { classifyRequest } from "../helpers/e2e-network";

const HOSTED = "https://lkvxxrxojjlkchzzqidu.supabase.co";

describe("classifyRequest", () => {
  it.each([
    ["a local page", "http://127.0.0.1:3100/course/lam-quen-voi-html"],
    ["a request to the local Supabase API", "http://127.0.0.1:54321/rest/v1/courses?select=*"],
    ["a localhost page", "http://localhost:3100/"],
    ["a local image with a relative source", "http://127.0.0.1:3100/_next/image?url=/x.png&w=64&q=75"],
    ["a local image with a local absolute source", "http://127.0.0.1:3100/_next/image?url=http%3A%2F%2F127.0.0.1%3A54321%2Fx.png"],
    ["a data URL", "data:image/png;base64,AAAA"],
  ])("allows %s", (_label, url) => {
    expect(classifyRequest(url)).toBe("allow");
  });

  it.each([
    ["an external image", "https://placehold.co/600x400"],
    ["an external image through /_next/image", "http://127.0.0.1:3100/_next/image?url=https%3A%2F%2Fplacehold.co%2F600x400&w=64&q=75"],
    ["a protocol-relative image source", "http://127.0.0.1:3100/_next/image?url=%2F%2Fplacehold.co%2Fx.png"],
    ["a backslash host in an image source", "http://127.0.0.1:3100/_next/image?url=%2F%5Cplacehold.co%2Fx.png"],
    ["a host that only starts with 127.0.0.1", "http://127.0.0.1.evil.example/"],
    ["a request that cannot be parsed", "not a url"],
  ])("aborts %s", (_label, url) => {
    expect(classifyRequest(url)).toBe("abort");
  });

  it.each([
    ["the hosted Supabase API", `${HOSTED}/rest/v1/courses`],
    ["the hosted Supabase API through /_next/image", `http://127.0.0.1:3100/_next/image?url=${encodeURIComponent(`${HOSTED}/storage/v1/object/public/avatars/a.png`)}&w=64&q=75`],
    ["the production site", "https://devspace-lms.vercel.app/"],
    ["the production site through /_next/image", `http://127.0.0.1:3100/_next/image?url=${encodeURIComponent("https://devspace-lms.vercel.app/a.png")}`],
  ])("flags %s as hosted", (_label, url) => {
    expect(classifyRequest(url)).toBe("hosted");
  });
});
