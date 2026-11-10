import "server-only";

import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { ApiConfigError, apiFetch } from "@/lib/api.server";
import type { CourseDetail, HomeCourseData } from "@/lib/types";

// The public course list of the home page, read through the API (TM-U4, `GET /api/courses/home`). Every failure is an
// empty list, as the browser read it replaces answered, so the page keeps rendering "Không tìm thấy khóa học nào."
// (AC9). The log names the kind of failure only: no response body and no cookie, which the helper forwarded.
export async function getHomeCourses(): Promise<HomeCourseData[]> {
  // The answer is per request and must never be prerendered. `apiFetch` signals that by reading cookies, but it throws
  // a configuration error before it gets there when an address is missing, and that error ends in the catch below as an
  // empty list, so the build would prerender `/` with no courses. This call comes first and outside the try, so the
  // route is dynamic whatever the read does.
  await connection();
  try {
    const response = await apiFetch("/api/courses/home");
    if (!response.ok) {
      console.error(`Lỗi lấy khóa học: the API answered ${response.status}`);
      return [];
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      console.error("Lỗi lấy khóa học: the API answer is not a list");
      return [];
    }
    return body as HomeCourseData[];
  } catch (error) {
    // Next signals "this render is dynamic" (the helper reads cookies) by throwing; swallowing it would let the build
    // treat the route as static and prerender an empty list.
    unstable_rethrow(error);
    // A configuration error carries its own safe message; a network error is named by its type alone.
    console.error(
      "Lỗi lấy khóa học: the API could not be read",
      error instanceof ApiConfigError
        ? error.message
        : error instanceof Error
          ? error.name
          : "unknown error",
    );
    return [];
  }
}

export async function getCourseDetail(
  slug: string,
): Promise<
  | { status: "found"; course: CourseDetail }
  | { status: "missing" | "unavailable" }
> {
  await connection();
  try {
    // Keep the route fixed. apiFetch rejects literal ".." even in a query, and legacy slugs can contain dots.
    const value = encodeURIComponent(slug).replaceAll(".", "%2E");
    const response = await apiFetch(`/api/courses/detail?slug=${value}`);
    if (response.status === 404) return { status: "missing" };
    if (response.ok) {
      return {
        status: "found",
        course: (await response.json()) as CourseDetail,
      };
    }
    console.error(
      `Lỗi lấy chi tiết khóa học: the API answered ${response.status}`,
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Lỗi lấy chi tiết khóa học",
      error instanceof Error ? error.name : "unknown error",
    );
  }
  return { status: "unavailable" };
}
