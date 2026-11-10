// Test plan
// Goal: the home page's server read never throws and never leaks: any failure of the API call is an empty list, as the
//   browser read it replaces answered, and the log names the failure without a response body or a cookie (AC9).
// Layer: unit. `apiFetch` is replaced (Playwright cannot intercept a server-side request); the helper's own logic runs.
// Subject: lib/courses.server.ts, AC9 of the TM-U4 detail plan.
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const connection = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ connection }));
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api.server", () => ({
  apiFetch,
  ApiConfigError: class ApiConfigError extends Error {},
}));

import { ApiConfigError } from "@/lib/api.server";
import { getCourseDetail, getHomeCourses } from "@/lib/courses.server";

const error = vi.spyOn(console, "error").mockImplementation(() => {});
const logged = () => JSON.stringify(error.mock.calls);

beforeEach(() => {
  apiFetch.mockReset();
  connection.mockReset().mockResolvedValue(undefined);
  error.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("getCourseDetail", () => {
  it("keeps legacy slug characters in an encoded query on a fixed path", async () => {
    const slug = "lập trình C++ .. bài một";
    apiFetch.mockResolvedValue(Response.json({ id: 1, slug }));
    expect(await getCourseDetail(slug)).toEqual({
      status: "found",
      course: { id: 1, slug },
    });
    const path = apiFetch.mock.calls[0][0] as string;
    expect(path).not.toMatch(/\.\.|\+/);
    const url = new URL(path, "http://localhost");
    expect(url.pathname).toBe("/api/courses/detail");
    expect(url.searchParams.get("slug")).toBe(slug);
  });

  it("distinguishes a missing course from an unavailable API", async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(await getCourseDetail("missing")).toEqual({ status: "missing" });
    expect(await getCourseDetail("example")).toEqual({ status: "unavailable" });
  });
});

describe("getHomeCourses", () => {
  it("returns the list the API sent", async () => {
    const list = [{ id: 1, name: "A", firstLessonSlug: null }];
    apiFetch.mockResolvedValue(Response.json(list));
    expect(await getHomeCourses()).toEqual(list);
    expect(apiFetch).toHaveBeenCalledWith("/api/courses/home");
    expect(error).not.toHaveBeenCalled();
  });

  it("[AC9] returns an empty list and logs the status when the API answers an error, never its body", async () => {
    apiFetch.mockResolvedValue(
      new Response('{"message":"secret-body sb-auth-token=abc"}', {
        status: 503,
      }),
    );
    expect(await getHomeCourses()).toEqual([]);
    expect(logged()).toContain("503");
    expect(logged()).not.toMatch(/secret-body|sb-auth-token/);
  });

  it("[AC9] returns an empty list when the API cannot be reached, and logs only the kind of error", async () => {
    apiFetch.mockRejectedValue(
      Object.assign(new TypeError("fetch failed sb-auth-token=abc"), {
        cause: "connect ECONNREFUSED",
      }),
    );
    expect(await getHomeCourses()).toEqual([]);
    expect(logged()).toContain("TypeError");
    expect(logged()).not.toMatch(/sb-auth-token|ECONNREFUSED/);
  });

  it("[AC9] returns an empty list and says what is missing when the API address is not configured", async () => {
    apiFetch.mockRejectedValue(
      new ApiConfigError("API_INTERNAL_URL is not set."),
    );
    expect(await getHomeCourses()).toEqual([]);
    expect(logged()).toContain("API_INTERNAL_URL is not set.");
  });

  it("[AC9] returns an empty list when the answer is not JSON or not a list", async () => {
    apiFetch.mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await getHomeCourses()).toEqual([]);
    apiFetch.mockResolvedValue(Response.json({ courses: [] }));
    expect(await getHomeCourses()).toEqual([]);
    expect(logged()).not.toContain("<html>");
  });

  it("passes on an error that Next throws to steer the render (a dynamic bailout, a redirect) instead of turning it into an empty list", async () => {
    let thrown: unknown;
    try {
      notFound();
    } catch (error) {
      thrown = error;
    }
    apiFetch.mockRejectedValue(thrown);
    await expect(getHomeCourses()).rejects.toBe(thrown);
  });

  // Without it, a missing API address makes the route static (apiFetch throws before it reads cookies): Next would
  // prerender `/` at build time with an empty list.
  it("[AC9] marks the render as per request before it reads the API, whatever the read does", async () => {
    const order: string[] = [];
    connection.mockImplementation(async () => {
      order.push("connection");
    });
    apiFetch.mockImplementation(async () => {
      order.push("apiFetch");
      throw new ApiConfigError("API_INTERNAL_URL is not set.");
    });
    expect(await getHomeCourses()).toEqual([]);
    expect(order).toEqual(["connection", "apiFetch"]);
  });

  it("does not turn the dynamic signal into an empty list", async () => {
    const signal = new Error("dynamic");
    connection.mockRejectedValue(signal);
    await expect(getHomeCourses()).rejects.toBe(signal);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
