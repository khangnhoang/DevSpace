// Test plan
// Goal: E2E preflight rejects identities outside its ownership selectors before acquiring or writing data.
// Layer: rls/local API persistence, calling the actual E2E setup helpers.
// Subject: enrollment notification prerequisites, route-to-course identity and unknown-course absence.
// Allowed paths: the normal seed baseline remains covered by the full E2E suite.
// Denied paths: null/empty learner name, reassigned UI slugs and an occupied unknown-course ID.
// Known bugs: none.
// Invariants: probe-owned setup is restored; rejected scopes acquire nothing and preserve unrelated rows.
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  beginFixtureScope,
  prepareLearnerEnrollment,
  assertPaymentFixturesClean,
  UNKNOWN_COURSE_ID,
} from "../e2e/service-role";
import {
  fixtures,
  cleanupFixtures,
  must,
  IDS,
  learner,
  fixtureScope,
  startFixtureScope,
  finishFixtureScope,
  ownedInsert,
} from "./helpers";

beforeEach(startFixtureScope);
afterEach(finishFixtureScope);

async function snapshot() {
  const tables = [
    "profiles",
    "courses",
    "enrollments",
    "payments",
    "notifications",
    "coupons",
  ];
  return Promise.all(
    tables.map(async (table) => [
      table,
      must(await fixtures.from(table).select("*").order("id")),
    ]),
  );
}

async function expectReadOnlyRejection(
  prepare: () => Promise<void>,
  message: string,
) {
  // The occupied slots are the probe's own; a preflight that finds them must not mark the real run unclean.
  const failed = beginFixtureScope({
    run: { check: () => null, mark: () => {} },
  });
  try {
    const before = await snapshot();
    await expect(prepare()).rejects.toThrow(message);
    expect(failed.entries).toEqual([]);
    await failed.cleanup();
    expect(await snapshot()).toEqual(before);
  } finally {
    await failed.cleanup();
  }
}

async function sentinel() {
  const title = fixtureScope().label("E2E unrelated preflight sentinel");
  must(
    await ownedInsert(
      "notifications",
      { receiver_id: IDS.admin, title, type: "system" },
      (values) => fixtures.from("notifications").insert(values),
    ),
  );
}

it.each([null, ""])(
  "rejects learner name %j before enrollment acquisition and preserves unrelated data",
  async (fullName) => {
    await fixtureScope().acquire("profiles", IDS.learner, ["full_name"]);
    must(
      await learner
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", IDS.learner),
    );
    expect(
      must(
        await fixtures
          .from("profiles")
          .select("full_name")
          .eq("id", IDS.learner)
          .single(),
      ).full_name,
    ).toBe(fullName);
    await sentinel();
    await expectReadOnlyRejection(
      () => prepareLearnerEnrollment(1),
      "learner name is absent",
    );
  },
);

it.each([
  [
    1,
    "lam-quen-voi-html",
    () => prepareLearnerEnrollment(1),
    "Free-enrollment course identity differs",
  ],
  [
    2,
    "javascript-can-ban",
    assertPaymentFixturesClean,
    "Payment course identity differs",
  ],
] as const)(
  "rejects reassigned course slug %s/%s before acquisition and preserves both courses",
  async (id, slug, prepare, message) => {
    const owner = fixtureScope();
    const temporarySlug = `e2e-preflight-${owner.tag}`;
    await owner.acquire("courses", id, ["slug"], { slug });
    const foreignId = must(
      await ownedInsert(
        "courses",
        {
          name: owner.label("unrelated course"),
          slug: temporarySlug,
          price: 0,
        },
        (values) =>
          fixtures.from("courses").insert(values).select("id").single(),
      ),
    ).id;
    try {
      must(
        await fixtures
          .from("courses")
          .update({ slug: `${temporarySlug}-seed` })
          .eq("id", id),
      );
      must(await fixtures.from("courses").update({ slug }).eq("id", foreignId));
      expect(
        must(
          await fixtures.from("courses").select("id").eq("slug", slug).single(),
        ).id,
      ).toBe(foreignId);
      expect(foreignId).not.toBe(id);
      await sentinel();
      await expectReadOnlyRejection(prepare, message);
    } finally {
      // Release the canonical slug before the outer scope restores the acquired seed field.
      must(
        await cleanupFixtures
          .from("courses")
          .update({ slug: temporarySlug })
          .eq("id", foreignId),
      );
    }
  },
);

it("rejects an occupied unknown-course ID before payment acquisition and preserves that course", async () => {
  const owner = fixtureScope();
  await owner.reserve("courses", { id: UNKNOWN_COURSE_ID });
  must(
    await fixtures.from("courses").insert({
      id: UNKNOWN_COURSE_ID,
      name: owner.label("E2E unrelated 9999"),
      slug: `e2e-unknown-${owner.tag}`,
      price: 100,
    }),
  );
  await sentinel();
  await expectReadOnlyRejection(
    assertPaymentFixturesClean,
    "Unknown-course fixture ID is occupied",
  );
});
