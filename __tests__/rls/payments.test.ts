// Test plan
// Goal: every payment and coupon-usage change goes through one security definer function per transition, a use is
//   reserved on apply and released on cancel, reject, switch or deletion of a pending order, and direct writes by any
//   role but the table owner are held to the payment contract (SE-U1, SE-P8 to SE-P12).
// Layer: rls (local Supabase stack). Actors are checked through the API; the functions are callable only by the service
//   role, so their own rows run as service_role inside `withPg` transactions (plan G7). Row-level scenarios roll back;
//   race and cascade rows that need committed data own and remove their fixtures.
// Subject: payments.coupon_id, the partial unique index of pending orders, create_pending_payment, apply_payment_coupon,
//   close_pending_payment, approve_payment, payments_guard (three triggers), payments_release_on_delete and the table
//   privileges of public.payments after se_u1_payment_write_lock.
// Allowed paths: the service role (and the table owner) runs the functions; a plain pending order at the course price
//   without a coupon can still be written directly until the write lock migration.
// Denied paths: anon, learner, student and admin sessions cannot execute the functions; a direct write that discounts,
//   sets a coupon, changes a processed order or touches a coupon-holding order is refused with 42501.
// Known bugs: none (SE-P8 to SE-P12 are resolved by this unit's code and migration).
// Invariants: scenario rows roll back; committed rows are recorded by exact selector before the request and removed in
//   afterEach; the guard is never tested as the table owner except in the one row that proves the owner passes.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, inject, it } from "vitest";
import {
  admin,
  anon,
  expectDenied,
  finishFixtureScope,
  fixtureScope,
  fixtures,
  IDS,
  learner,
  must,
  startFixtureScope,
  student,
  withPg,
} from "./helpers";

type Row = Record<string, unknown>;
type SqlError = { code?: string; message?: string };
const stack = inject("localStack");
const RUN = randomUUID().replaceAll("-", "").slice(0, 10);
let counter = 0;

beforeEach(startFixtureScope);
afterEach(finishFixtureScope);

// ---------- transaction helpers (rolled back) ----------

async function inTx<T>(run: (c: pg.Client) => Promise<T>): Promise<T> {
  return withPg(async (c) => {
    await c.query("begin");
    try {
      return await run(c);
    } finally {
      await c.query("rollback");
    }
  });
}
const asService = (c: pg.Client) => c.query("set local role service_role");
const asOwner = (c: pg.Client) => c.query("reset role");
// G7: a guard row that expects a direct service_role write to succeed grants insert and update first (a no-op before
// the write lock migration), so the row tests the guard and not the revoked privilege.
const asServiceWithWrites = async (c: pg.Client) => {
  // Back to the owner first: a GRANT issued while still service_role grants nothing and would make every refusal row
  // pass on the missing privilege instead of on the guard.
  await asOwner(c);
  await c.query("grant insert, update on public.payments to service_role");
  await asService(c);
};
async function call(
  c: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<Row> {
  return (await c.query(`select ${sql} as r`, params)).rows[0].r as Row;
}
async function attempt(
  c: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<SqlError | null> {
  await c.query("savepoint attempt");
  try {
    await c.query(sql, params);
    await c.query("release savepoint attempt");
    return null;
  } catch (error) {
    await c.query("rollback to savepoint attempt");
    return error as SqlError;
  }
}

const slug = () => `w-${RUN}-${counter++}`;
async function course(
  c: pg.Client,
  price: number | null = 199000,
): Promise<string> {
  const s = slug();
  return (
    await c.query(
      "insert into public.courses (name, slug, price) values ($1, $1, $2) returning id",
      [s, price],
    )
  ).rows[0].id;
}
type CouponOpts = {
  percent?: number;
  max?: number | null;
  used?: number | null;
  active?: boolean;
};
async function coupon(
  c: pg.Client,
  o: CouponOpts = {},
): Promise<{ id: string; code: string }> {
  const code = `W${RUN}${counter++}`.toUpperCase();
  const max = o.max === undefined ? 100 : o.max;
  const used = o.used === undefined ? 0 : o.used;
  const { rows } = await c.query(
    "insert into public.coupons (code, discount_percent, max_uses, used_count, is_active) values ($1, $2, $3, $4, $5) returning id",
    [code, o.percent ?? 10, max, used, o.active ?? true],
  );
  return { id: rows[0].id, code };
}
async function usedCount(c: pg.Client, id: string) {
  return (
    await c.query("select used_count from public.coupons where id = $1", [id])
  ).rows[0].used_count as number | null;
}
async function payment(c: pg.Client, id: unknown) {
  return (
    await c.query(
      "select user_id, course_id, amount, status, coupon_id from public.payments where id = $1",
      [id],
    )
  ).rows[0] as Row | undefined;
}
async function createOrder(
  c: pg.Client,
  user: string,
  courseId: string,
): Promise<number> {
  const r = await call(c, "public.create_pending_payment($1, $2)", [
    user,
    courseId,
  ]);
  expect(r.result).toBe("created");
  return r.payment_id as number;
}

// ---------- catalog ----------

const FUNCTIONS = [
  "create_pending_payment",
  "apply_payment_coupon",
  "close_pending_payment",
  "approve_payment",
] as const;

async function functionCatalog(c: pg.Client, names: readonly string[]) {
  return (
    await c.query(
      `select p.proname, p.prosecdef, pg_get_userbyid(p.proowner) as owner, p.proconfig,
         (select coalesce(array_agg(g order by g), '{}'::text[]) from (
            select (case when a.grantee = 0 then 'public' else pg_get_userbyid(a.grantee) end)::text as g
            from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
            where a.privilege_type = 'EXECUTE') s) as grantees
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1) order by p.proname`,
      [names],
    )
  ).rows;
}
async function triggerCatalog(c: pg.Client) {
  return (
    await c.query(
      `select t.tgname, regexp_replace(pg_get_triggerdef(t.oid), '[[:space:]]+', ' ', 'g') as def
       from pg_trigger t where t.tgrelid = 'public.payments'::regclass and not t.tgisinternal order by t.tgname`,
    )
  ).rows;
}
// Everything M1 adds, for the exact before/after comparison of the rollback.
async function m1Catalog(c: pg.Client) {
  const q = async (sql: string) => (await c.query(sql)).rows;
  return {
    columns:
      await q(`select column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'payments' order by ordinal_position`),
    constraints:
      await q(`select conname, pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'public.payments'::regclass order by conname`),
    indexes: await q(
      `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'payments' order by indexname`,
    ),
    triggers: await triggerCatalog(c),
    functions:
      await q(`select p.proname, pg_get_functiondef(p.oid) as def, p.proacl::text as acl, pg_get_userbyid(p.proowner) as owner
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('create_pending_payment', 'apply_payment_coupon', 'close_pending_payment',
        'approve_payment', 'payments_guard', 'payments_release_on_delete') order by p.proname`),
  };
}

describe("payment functions: catalog", () => {
  it("[W1] payments.coupon_id references coupons with ON DELETE RESTRICT and one pending order per user and course is indexed", async () => {
    await withPg(async (c) => {
      const column = (
        await c.query(`select data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'payments' and column_name = 'coupon_id'`)
      ).rows;
      expect(column).toEqual([{ data_type: "bigint", is_nullable: "YES" }]);
      const fk = (
        await c.query(`select confrelid::regclass::text as target, confdeltype from pg_constraint
        where conrelid = 'public.payments'::regclass and contype = 'f' and conkey = (select array_agg(attnum) from pg_attribute
          where attrelid = 'public.payments'::regclass and attname = 'coupon_id')`)
      ).rows;
      expect(fk).toEqual([{ target: "coupons", confdeltype: "r" }]);
      const index = (
        await c.query(`select i.indisunique, pg_get_expr(i.indpred, i.indrelid) as predicate,
          (select array_agg(a.attname::text order by k.ord) from unnest(i.indkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as columns
        from pg_index i join pg_class ic on ic.oid = i.indexrelid
        where ic.relname = 'payments_one_pending_per_user_course'`)
      ).rows;
      expect(index).toEqual([
        {
          indisunique: true,
          predicate: "(status = 'pending'::text)",
          columns: ["user_id", "course_id"],
        },
      ]);
    });
  });

  it("[W2] each payment function is security definer, owned by postgres, has an empty search_path and is executable only by its owner and the service role", async () => {
    await withPg(async (c) => {
      const rows = await functionCatalog(c, FUNCTIONS);
      expect(rows.map((r) => r.proname)).toEqual([...FUNCTIONS].sort());
      for (const r of rows) {
        expect(r, r.proname).toMatchObject({
          prosecdef: true,
          owner: "postgres",
          proconfig: ['search_path=""'],
          grantees: ["postgres", "service_role"],
        });
      }
      const triggers = await functionCatalog(c, [
        "payments_guard",
        "payments_release_on_delete",
      ]);
      expect(triggers).toEqual([
        {
          proname: "payments_guard",
          prosecdef: false,
          owner: "postgres",
          proconfig: ['search_path=""'],
          grantees: ["postgres"],
        },
        {
          proname: "payments_release_on_delete",
          prosecdef: true,
          owner: "postgres",
          proconfig: ['search_path=""'],
          grantees: ["postgres"],
        },
      ]);
    });
  });

  it("[W3] the guard has an insert trigger and two update triggers, and the release trigger is statement-level with a transition table", async () => {
    await withPg(async (c) => {
      const defs = Object.fromEntries(
        (await triggerCatalog(c)).map((r) => [r.tgname, r.def]),
      );
      expect(defs).toEqual({
        payments_guard_insert:
          "CREATE TRIGGER payments_guard_insert BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION payments_guard()",
        payments_guard_update_any:
          "CREATE TRIGGER payments_guard_update_any BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION payments_guard('any')",
        payments_guard_update_columns:
          "CREATE TRIGGER payments_guard_update_columns BEFORE UPDATE OF status, amount, coupon_id ON public.payments FOR EACH ROW EXECUTE FUNCTION payments_guard('columns')",
        payments_release_on_delete:
          "CREATE TRIGGER payments_release_on_delete AFTER DELETE ON public.payments REFERENCING OLD TABLE AS deleted_payments FOR EACH STATEMENT EXECUTE FUNCTION payments_release_on_delete()",
      });
    });
  });

  it("[W4] anon, learner, student and admin sessions cannot execute any payment function, and nothing is written", async () => {
    // If a denial failed, create_pending_payment would write. Its exact selector is reserved before the first call, so
    // the scope removes whatever a broken grant created, also when an assertion below fails.
    const s = slug();
    await fixtureScope().reserve("courses", { slug: s });
    const courseId = must(
      await fixtures
        .from("courses")
        .insert({ name: s, slug: s, price: 100000 })
        .select("id")
        .single(),
    ).id;
    await fixtureScope().reserve("payments", {
      user_id: IDS.learner,
      course_id: courseId,
    });
    const before = must(
      await fixtures.from("payments").select("id, status, coupon_id"),
    );
    const calls: [string, Row][] = [
      [
        "create_pending_payment",
        { p_user_id: IDS.learner, p_course_id: courseId },
      ],
      [
        "apply_payment_coupon",
        { p_payment_id: 1, p_user_id: IDS.student, p_code: "LOCAL10" },
      ],
      ["close_pending_payment", { p_payment_id: 1, p_user_id: null }],
      ["approve_payment", { p_payment_id: 1 }],
    ];
    for (const [actor, client] of [
      ["anon", anon],
      ["learner", learner],
      ["student", student],
      ["admin", admin],
    ] as const) {
      for (const [name, args] of calls) {
        const { error } = await client.rpc(name, args);
        expect(error, `${actor} ${name}`).not.toBeNull();
        expectDenied(error);
      }
    }
    expect(
      must(await fixtures.from("payments").select("id, status, coupon_id")),
    ).toEqual(before);
  });

  it("[W5] the service role reaches a function through the API; an unknown course answers invalid_course and writes nothing", async () => {
    const { data, error } = await fixtures.rpc("create_pending_payment", {
      p_user_id: IDS.learner,
      p_course_id: 987654321,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ result: "invalid_course" });
    expect(
      must(
        await fixtures.from("payments").select("id").eq("user_id", IDS.learner),
      ),
    ).toEqual([]);
  });
});

describe("payment functions: create_pending_payment", () => {
  it("[W6] AC7/AC8 creates a pending order at the course price without a coupon and returns the same order on repeat", async () => {
    await inTx(async (c) => {
      const id = await course(c, 199000);
      await asService(c);
      const created = await call(c, "public.create_pending_payment($1, $2)", [
        IDS.learner,
        id,
      ]);
      expect(created).toMatchObject({ result: "created", amount: 199000 });
      expect(await payment(c, created.payment_id)).toMatchObject({
        user_id: IDS.learner,
        amount: 199000,
        status: "pending",
        coupon_id: null,
      });
      const again = await call(c, "public.create_pending_payment($1, $2)", [
        IDS.learner,
        id,
      ]);
      expect(again).toEqual({
        result: "resumed",
        payment_id: created.payment_id,
        amount: 199000,
      });
      const count = (
        await c.query(
          "select count(*)::int as n from public.payments where user_id = $1 and course_id = $2",
          [IDS.learner, id],
        )
      ).rows[0].n;
      expect(count).toBe(1);
    });
  });

  it("[W7] AC7 refuses an unknown or unpriced course, a free course and an already enrolled learner without writing a row", async () => {
    await inTx(async (c) => {
      const free = await course(c, 0);
      const unpriced = await course(c, null);
      const paid = await course(c, 50000);
      await c.query(
        "insert into public.enrollments (user_id, course_id) values ($1, $2)",
        [IDS.learner, paid],
      );
      await asService(c);
      expect(
        await call(c, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          free,
        ]),
      ).toEqual({ result: "free_course" });
      expect(
        await call(c, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          unpriced,
        ]),
      ).toEqual({ result: "invalid_course" });
      expect(
        await call(c, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          987654321,
        ]),
      ).toEqual({ result: "invalid_course" });
      expect(
        await call(c, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          paid,
        ]),
      ).toEqual({ result: "enrolled" });
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.payments where user_id = $1",
            [IDS.learner],
          )
        ).rows[0].n,
      ).toBe(0);
    });
  });

  it("[W8] AC8 the partial unique index refuses a second pending order of the same user and course but not a closed one", async () => {
    await inTx(async (c) => {
      const id = await course(c);
      await c.query(
        "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 199000, 'failed')",
        [IDS.learner, id],
      );
      await c.query(
        "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 199000, 'pending')",
        [IDS.learner, id],
      );
      const error = await attempt(
        c,
        "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 199000, 'pending')",
        [IDS.learner, id],
      );
      expect(error?.code).toBe("23505");
      // The function infers the partial index for ON CONFLICT and resumes the existing order instead of failing.
      await asService(c);
      const r = await call(c, "public.create_pending_payment($1, $2)", [
        IDS.learner,
        id,
      ]);
      expect(r.result).toBe("resumed");
    });
  });
});

describe("payment functions: apply_payment_coupon", () => {
  it("[W9] AC1 discounts the order, stores the coupon and reserves exactly one use; the code is matched trimmed and case-insensitively", async () => {
    await inTx(async (c) => {
      const id = await course(c, 199000);
      const cp = await coupon(c, { percent: 10, max: 5, used: 0 });
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      const r = await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        `  ${cp.code.toLowerCase()} `,
      ]);
      expect(r).toEqual({ amount: 179100, discount_percent: 10 });
      expect(await payment(c, order)).toMatchObject({
        amount: 179100,
        status: "pending",
        coupon_id: cp.id,
      });
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });

  it("[W10] AC1 clamps the amount to 0..price for a percent above 100 or below 0", async () => {
    await inTx(async (c) => {
      const id = await course(c, 1000);
      const over = await coupon(c, { percent: 150 });
      const under = await coupon(c, { percent: -20 });
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          IDS.learner,
          over.code,
        ]),
      ).toMatchObject({ amount: 0 });
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          IDS.learner,
          under.code,
        ]),
      ).toMatchObject({ amount: 1000 });
      expect(await usedCount(c, over.id)).toBe(0);
      expect(await usedCount(c, under.id)).toBe(1);
    });
  });

  it("[W10a] AC1 the amount is computed in numeric: a price above 23.9 million and a percent far outside 0..100 do not overflow", async () => {
    await inTx(async (c) => {
      const big = await course(c, 30000000);
      const max = await course(c, 2147483647);
      const ten = await coupon(c, { percent: 10 });
      const none = await coupon(c, { percent: 0 });
      const full = await coupon(c, { percent: 100 });
      const hugeOver = await coupon(c, { percent: 2147483647 });
      const hugeUnder = await coupon(c, { percent: -2147483648 });
      await asService(c);
      const bigOrder = await createOrder(c, IDS.learner, big);
      const maxOrder = await createOrder(c, IDS.learner, max);
      const amountOf = async (order: number, cp: { code: string }) =>
        (
          await call(c, "public.apply_payment_coupon($1, $2, $3)", [
            order,
            IDS.learner,
            cp.code,
          ])
        ).amount;
      expect(await amountOf(bigOrder, ten)).toBe(27000000);
      expect(await amountOf(bigOrder, none)).toBe(30000000);
      expect(await amountOf(bigOrder, full)).toBe(0);
      expect(await amountOf(bigOrder, hugeOver)).toBe(0);
      expect(await amountOf(bigOrder, hugeUnder)).toBe(30000000);
      expect(await amountOf(maxOrder, ten)).toBe(1932735282);
      expect(await amountOf(maxOrder, none)).toBe(2147483647);
      expect(await amountOf(maxOrder, hugeOver)).toBe(0);
      expect(await amountOf(maxOrder, hugeUnder)).toBe(2147483647);
      expect(await payment(c, maxOrder)).toMatchObject({
        amount: 2147483647,
        coupon_id: hugeUnder.id,
      });
    });
  });

  it("[W11] AC2 applying the same code again changes no count; switching reserves the new code and releases the old one", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const m = await coupon(c, { percent: 10 });
      const n = await coupon(c, { percent: 50 });
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        m.code,
      ]);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        m.code,
      ]);
      expect([await usedCount(c, m.id), await usedCount(c, n.id)]).toEqual([
        1, 0,
      ]);
      const r = await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        n.code,
      ]);
      expect(r).toEqual({ amount: 50000, discount_percent: 50 });
      expect([await usedCount(c, m.id), await usedCount(c, n.id)]).toEqual([
        0, 1,
      ]);
      expect(await payment(c, order)).toMatchObject({
        amount: 50000,
        coupon_id: n.id,
      });
    });
  });

  it("[W12] AC2 a refused apply changes no count, amount or stored coupon and answers the stable error", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const good = await coupon(c, { percent: 10 });
      const inactive = await coupon(c, { active: false });
      const full = await coupon(c, { max: 3, used: 3 });
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      const other = await createOrder(c, IDS.student, id);
      const closed = await createOrder(c, IDS.admin, id);
      await call(c, "public.close_pending_payment($1, $2)", [
        closed,
        IDS.admin,
      ]);
      const snapshot = async () => ({
        payments: (
          await c.query(
            "select id, amount, status, coupon_id from public.payments where course_id = $1 order by id",
            [id],
          )
        ).rows,
        coupons: (
          await c.query(
            "select id, used_count from public.coupons where id = any($1) order by id",
            [[good.id, inactive.id, full.id]],
          )
        ).rows,
      });
      const before = await snapshot();
      const apply = (paymentId: number, user: string, code: string | null) =>
        call(c, "public.apply_payment_coupon($1, $2, $3)", [
          paymentId,
          user,
          code,
        ]);
      expect(await apply(order, IDS.learner, "NO-SUCH-CODE")).toEqual({
        error: "invalid_coupon",
      });
      expect(await apply(order, IDS.learner, null)).toEqual({
        error: "invalid_coupon",
      });
      expect(await apply(order, IDS.learner, inactive.code)).toEqual({
        error: "invalid_coupon",
      });
      expect(await apply(order, IDS.learner, full.code)).toEqual({
        error: "coupon_exhausted",
      });
      expect(await apply(other, IDS.learner, good.code)).toEqual({
        error: "invalid_payment",
      });
      expect(await apply(closed, IDS.admin, good.code)).toEqual({
        error: "invalid_payment",
      });
      expect(await apply(987654321, IDS.learner, good.code)).toEqual({
        error: "invalid_payment",
      });
      expect(await snapshot()).toEqual(before);
    });
  });

  it("[W13] AC3/SE-P12 a code without max_uses is unlimited, also when used_count is null", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const unlimited = await coupon(c, { max: null, used: null, percent: 20 });
      await asService(c);
      const first = await createOrder(c, IDS.learner, id);
      const second = await createOrder(c, IDS.student, id);
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          first,
          IDS.learner,
          unlimited.code,
        ]),
      ).toMatchObject({ amount: 80000 });
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          second,
          IDS.student,
          unlimited.code,
        ]),
      ).toMatchObject({ amount: 80000 });
      expect(await usedCount(c, unlimited.id)).toBe(2);
    });
  });

  it("[W14] AC3 the last use is reserved once and the limit is never exceeded", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const last = await coupon(c, { max: 2, used: 1 });
      await asService(c);
      const first = await createOrder(c, IDS.learner, id);
      const second = await createOrder(c, IDS.student, id);
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          first,
          IDS.learner,
          last.code,
        ]),
      ).toMatchObject({ discount_percent: 10 });
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          second,
          IDS.student,
          last.code,
        ]),
      ).toEqual({ error: "coupon_exhausted" });
      expect(await usedCount(c, last.id)).toBe(2);
      expect((await payment(c, second))?.coupon_id).toBeNull();
    });
  });
});

describe("payment functions: close_pending_payment", () => {
  it("[W15] AC4 the owner's cancel and the admin's reject set the order failed and release its use exactly once", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      for (const [user, closer] of [
        [IDS.learner, IDS.learner],
        [IDS.student, null],
      ] as const) {
        const order = await createOrder(c, user, id);
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          user,
          cp.code,
        ]);
        expect(await usedCount(c, cp.id)).toBe(1);
        expect(
          await call(c, "public.close_pending_payment($1, $2)", [
            order,
            closer,
          ]),
        ).toBe(true);
        expect(await payment(c, order)).toMatchObject({
          status: "failed",
          coupon_id: cp.id,
        });
        expect(await usedCount(c, cp.id)).toBe(0);
        expect(
          await call(c, "public.close_pending_payment($1, $2)", [
            order,
            closer,
          ]),
        ).toBe(false);
        expect(await usedCount(c, cp.id)).toBe(0);
      }
    });
  });

  it("[W16] AC4 another user's cancel, an unknown order and a processed order change nothing; an order without coupon closes without touching coupons", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        cp.code,
      ]);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [
          order,
          IDS.student,
        ]),
      ).toBe(false);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [
          987654321,
          null,
        ]),
      ).toBe(false);
      expect(await payment(c, order)).toMatchObject({ status: "pending" });
      expect(await usedCount(c, cp.id)).toBe(1);
      await call(c, "public.approve_payment($1)", [order]);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [order, null]),
      ).toBe(false);
      expect(await payment(c, order)).toMatchObject({ status: "success" });
      expect(await usedCount(c, cp.id)).toBe(1);
      const plain = await createOrder(c, IDS.student, id);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [
          plain,
          IDS.student,
        ]),
      ).toBe(true);
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });

  it("[W17] a release never takes used_count below zero", async () => {
    await inTx(async (c) => {
      const id = await course(c);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        cp.code,
      ]);
      await asOwner(c);
      await c.query("update public.coupons set used_count = 0 where id = $1", [
        cp.id,
      ]);
      await asService(c);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [order, null]),
      ).toBe(true);
      expect(await usedCount(c, cp.id)).toBe(0);
    });
  });
});

describe("payment functions: approve_payment", () => {
  it("[W18] AC5 approval sets success and creates the enrollment; the reserved use stays counted; a repeat does nothing", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        cp.code,
      ]);
      expect(await call(c, "public.approve_payment($1)", [order])).toEqual({
        approved: true,
        user_id: IDS.learner,
        course_id: Number(id),
      });
      expect(await payment(c, order)).toMatchObject({
        status: "success",
        amount: 90000,
      });
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.enrollments where user_id = $1 and course_id = $2",
            [IDS.learner, id],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(await usedCount(c, cp.id)).toBe(1);
      expect(await call(c, "public.approve_payment($1)", [order])).toEqual({
        approved: false,
      });
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });

  it("[W19] AC5 an existing enrollment is kept without a duplicate error", async () => {
    await inTx(async (c) => {
      const id = await course(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await asOwner(c);
      await c.query(
        "insert into public.enrollments (user_id, course_id) values ($1, $2)",
        [IDS.learner, id],
      );
      await asService(c);
      expect(
        await call(c, "public.approve_payment($1)", [order]),
      ).toMatchObject({ approved: true });
      await asOwner(c);
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.enrollments where user_id = $1 and course_id = $2",
            [IDS.learner, id],
          )
        ).rows[0].n,
      ).toBe(1);
    });
  });

  it("[W20] AC6 approving an unknown, failed or already approved order changes nothing", async () => {
    await inTx(async (c) => {
      const id = await course(c);
      await asService(c);
      const failed = await createOrder(c, IDS.learner, id);
      await call(c, "public.close_pending_payment($1, $2)", [failed, null]);
      expect(await call(c, "public.approve_payment($1)", [failed])).toEqual({
        approved: false,
      });
      expect(await call(c, "public.approve_payment($1)", [987654321])).toEqual({
        approved: false,
      });
      expect(await payment(c, failed)).toMatchObject({ status: "failed" });
      await asOwner(c);
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.enrollments where user_id = $1 and course_id = $2",
            [IDS.learner, id],
          )
        ).rows[0].n,
      ).toBe(0);
    });
  });

  it("[W21] AC5 a failed enrollment write rolls the approval back and leaves the order pending", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        cp.code,
      ]);
      await asOwner(c);
      await c.query(
        `create function public.w_fail_enrollment() returns trigger language plpgsql as $$ begin raise exception 'forced enrollment failure'; end $$`,
      );
      await c.query(
        "create trigger w_fail_enrollment before insert on public.enrollments for each row execute function public.w_fail_enrollment()",
      );
      await asService(c);
      const error = await attempt(c, "select public.approve_payment($1)", [
        order,
      ]);
      expect(error?.message).toContain("forced enrollment failure");
      expect(await payment(c, order)).toMatchObject({
        status: "pending",
        coupon_id: cp.id,
      });
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });
});

describe("payments_guard", () => {
  it("[W22] AC10 a direct insert is accepted only as a plain pending order at the course price without a coupon", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asServiceWithWrites(c);
      const insert = (
        user: string,
        amount: number,
        status: string,
        couponId: string | null,
      ) =>
        attempt(
          c,
          "insert into public.payments (user_id, course_id, amount, status, coupon_id) values ($1, $2, $3, $4, $5)",
          [user, id, amount, status, couponId],
        );
      expect(await insert(IDS.learner, 100000, "pending", null)).toBeNull();
      expect((await insert(IDS.student, 90000, "pending", null))?.code).toBe(
        "42501",
      );
      expect((await insert(IDS.student, 0, "pending", null))?.code).toBe(
        "42501",
      );
      expect((await insert(IDS.student, 100000, "success", null))?.code).toBe(
        "42501",
      );
      expect((await insert(IDS.student, 100000, "failed", null))?.code).toBe(
        "42501",
      );
      expect((await insert(IDS.student, 100000, "pending", cp.id))?.code).toBe(
        "42501",
      );
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.payments where course_id = $1",
            [id],
          )
        ).rows[0].n,
      ).toBe(1);
    });
  });

  it("[W23] AC10 old-style updates of a pending order without a coupon keep working", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      await asServiceWithWrites(c);
      const discounted = (
        await c.query(
          "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 100000, 'pending') returning id",
          [IDS.learner, id],
        )
      ).rows[0].id;
      const other = (
        await c.query(
          "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 100000, 'pending') returning id",
          [IDS.student, id],
        )
      ).rows[0].id;
      expect(
        await attempt(
          c,
          "update public.payments set amount = 90000, updated_at = now() where id = $1",
          [discounted],
        ),
      ).toBeNull();
      expect(
        await attempt(
          c,
          "update public.payments set status = 'failed', updated_at = now() where id = $1",
          [other],
        ),
      ).toBeNull();
      expect(await payment(c, discounted)).toMatchObject({
        amount: 90000,
        status: "pending",
      });
      expect(await payment(c, other)).toMatchObject({ status: "failed" });
    });
  });

  it("[W24] AC10 a processed order accepts no assignment to status, amount or coupon_id, not even the value it already has", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      await asService(c);
      const approved = await createOrder(c, IDS.learner, id);
      await call(c, "public.approve_payment($1)", [approved]);
      const closed = await createOrder(c, IDS.student, id);
      await call(c, "public.close_pending_payment($1, $2)", [closed, null]);
      await asServiceWithWrites(c);
      const before = await payment(c, approved);
      for (const sql of [
        "update public.payments set status = 'success' where id = $1",
        "update public.payments set status = 'failed' where id = $1",
        "update public.payments set amount = 1 where id = $1",
        "update public.payments set amount = amount where id = $1",
        "update public.payments set coupon_id = null where id = $1",
      ]) {
        expect((await attempt(c, sql, [approved]))?.code, sql).toBe("42501");
      }
      expect(
        (
          await attempt(
            c,
            "update public.payments set status = 'pending' where id = $1",
            [closed],
          )
        )?.code,
      ).toBe("42501");
      expect(await payment(c, approved)).toEqual(before);
      expect(await payment(c, closed)).toMatchObject({ status: "failed" });
      // Columns outside the contract stay writable on a processed order.
      expect(
        await attempt(
          c,
          "update public.payments set updated_at = now() where id = $1",
          [approved],
        ),
      ).toBeNull();
    });
  });

  it("[W25] AC10 an order that holds a coupon accepts no direct write at all, and a pending order accepts no coupon", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const other = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const held = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        held,
        IDS.learner,
        cp.code,
      ]);
      const plain = await createOrder(c, IDS.student, id);
      await asServiceWithWrites(c);
      const before = await payment(c, held);
      for (const sql of [
        "update public.payments set updated_at = now() where id = $1",
        "update public.payments set user_id = user_id where id = $1",
        "update public.payments set user_id = '" +
          IDS.admin +
          "' where id = $1",
        `update public.payments set course_id = ${other} where id = $1`,
        "update public.payments set status = 'success' where id = $1",
        "update public.payments set status = 'failed' where id = $1",
        "update public.payments set amount = 1 where id = $1",
        "update public.payments set coupon_id = null where id = $1",
      ]) {
        expect((await attempt(c, sql, [held]))?.code, sql).toBe("42501");
      }
      expect(await payment(c, held)).toEqual(before);
      expect(
        (
          await attempt(
            c,
            "update public.payments set coupon_id = $2 where id = $1",
            [plain, cp.id],
          )
        )?.code,
      ).toBe("42501");
      expect((await payment(c, plain))?.coupon_id).toBeNull();
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });

  it("[W26] the functions pass the guard as their owner, and the table owner (the seed) can still write a payment", async () => {
    expect(
      must(await fixtures.from("payments").select("status").eq("id", 1)),
    ).toEqual([{ status: "success" }]);
    await inTx(async (c) => {
      const free = await course(c, 0);
      // The owner is not held to the guard: the seed's success payment and a pending order for a free course load.
      await c.query(
        "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, 0, 'pending')",
        [IDS.learner, free],
      );
      await c.query(
        "insert into public.payments (user_id, course_id, amount, status) values ($1, 2, 1, 'success')",
        [IDS.learner],
      );
      const id = await course(c, 5000);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      expect(
        await call(c, "public.approve_payment($1)", [order]),
      ).toMatchObject({ approved: true });
    });
  });

  it("[W26a] G4 only the table owner postgres passes the guard: supabase_admin is held to the contract too", async () => {
    // SET ROLE is not allowed for postgres, so this connects as supabase_admin (same local password).
    const url = new URL(stack.dbUrl);
    url.username = "supabase_admin";
    const c = new pg.Client({ connectionString: url.toString() });
    await c.connect();
    try {
      await c.query("begin");
      expect((await c.query("select current_user as u")).rows[0].u).toBe(
        "supabase_admin",
      );
      const id = await course(c, 100000);
      const insert = (amount: number) =>
        attempt(
          c,
          "insert into public.payments (user_id, course_id, amount, status) values ($1, $2, $3, 'pending')",
          [IDS.learner, id, amount],
        );
      expect((await insert(1))?.code).toBe("42501");
      expect(await insert(100000)).toBeNull();
    } finally {
      await c.query("rollback").catch(() => undefined);
      await c.end();
    }
  });
});

describe("payments_release_on_delete", () => {
  it("[W27] AC11/D6 deleting a pending order releases its use; success and failed orders release nothing more", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const pending = await createOrder(c, IDS.learner, id);
      const success = await createOrder(c, IDS.student, id);
      const failed = await createOrder(c, IDS.admin, id);
      for (const [order, user] of [
        [pending, IDS.learner],
        [success, IDS.student],
        [failed, IDS.admin],
      ] as const) {
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          user,
          cp.code,
        ]);
      }
      await call(c, "public.approve_payment($1)", [success]);
      await call(c, "public.close_pending_payment($1, $2)", [failed, null]);
      expect(await usedCount(c, cp.id)).toBe(2);
      await asOwner(c);
      await c.query("delete from public.payments where id = $1", [failed]);
      expect(await usedCount(c, cp.id)).toBe(2);
      await c.query("delete from public.payments where id = $1", [pending]);
      expect(await usedCount(c, cp.id)).toBe(1);
      await c.query("delete from public.payments where id = $1", [success]);
      expect(await usedCount(c, cp.id)).toBe(1);
    });
  });

  it("[W28] AC11 deleting a course releases every pending order on it with exact counts per coupon", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const m = await coupon(c);
      const n = await coupon(c);
      await asService(c);
      for (const [user, cp] of [
        [IDS.learner, m],
        [IDS.student, m],
        [IDS.admin, n],
      ] as const) {
        const order = await createOrder(c, user, id);
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          user,
          cp.code,
        ]);
      }
      expect([await usedCount(c, m.id), await usedCount(c, n.id)]).toEqual([
        2, 1,
      ]);
      await asOwner(c);
      await c.query("delete from public.courses where id = $1", [id]);
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.payments where course_id = $1",
            [id],
          )
        ).rows[0].n,
      ).toBe(0);
      expect([await usedCount(c, m.id), await usedCount(c, n.id)]).toEqual([
        0, 0,
      ]);
    });
  });

  it("[W29] AC11 deleting a user releases their pending orders, keeps a success order's use and leaves other users' uses", async () => {
    await inTx(async (c) => {
      const pendingCourse = await course(c, 100000);
      const paidCourse = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const pending = await createOrder(c, IDS.learner, pendingCourse);
      const paid = await createOrder(c, IDS.learner, paidCourse);
      const others = await createOrder(c, IDS.student, pendingCourse);
      for (const [order, user] of [
        [pending, IDS.learner],
        [paid, IDS.learner],
        [others, IDS.student],
      ] as const) {
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          user,
          cp.code,
        ]);
      }
      await call(c, "public.approve_payment($1)", [paid]);
      expect(await usedCount(c, cp.id)).toBe(3);
      await asOwner(c);
      await c.query("delete from auth.users where id = $1", [IDS.learner]);
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.payments where user_id = $1",
            [IDS.learner],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(await usedCount(c, cp.id)).toBe(2);
    });
  });
});

describe("payment functions: concurrency", { timeout: 60000 }, () => {
  // Two independent connections: `first` runs and keeps its transaction open (its locks held), `second` starts on
  // another connection and must be seen waiting on a lock before `first` commits (plan G7), so the overlap is proved
  // and not assumed.
  async function overlap<A, B>(
    first: (c: pg.Client) => Promise<A>,
    second: (c: pg.Client) => Promise<B>,
  ): Promise<[A, B]> {
    const a = new pg.Client({ connectionString: stack.dbUrl });
    const b = new pg.Client({ connectionString: stack.dbUrl });
    // Monitor as the table owner: a service_role session cannot see other sessions' wait events.
    const m = new pg.Client({ connectionString: stack.dbUrl });
    await Promise.all([a.connect(), b.connect(), m.connect()]);
    try {
      await a.query("begin");
      await a.query("set local role service_role");
      const resultA = await first(a);
      await b.query("begin");
      await b.query("set local role service_role");
      await b.query("set local lock_timeout = '20s'");
      const pid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;
      const pending = second(b);
      let settled = false;
      pending.then(
        () => (settled = true),
        () => (settled = true),
      );
      const deadline = Date.now() + 15000;
      for (;;) {
        const waiting = (
          await m.query(
            "select wait_event_type from pg_stat_activity where pid = $1",
            [pid],
          )
        ).rows[0]?.wait_event_type;
        if (waiting === "Lock") break;
        if (settled)
          throw new Error(
            "the second request finished without waiting on the first one's lock",
          );
        if (Date.now() > deadline)
          throw new Error("the second request never waited on a lock");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await a.query("commit");
      const resultB = await pending;
      await b.query("commit");
      return [resultA, resultB];
    } finally {
      await a.query("rollback").catch(() => undefined);
      await b.query("rollback").catch(() => undefined);
      await Promise.all([a.end(), b.end(), m.end()]);
    }
  }

  type Settled<T> = { ok: true; value: T } | { ok: false; error: SqlError };
  type Tracked<T> = { settled: boolean; promise: Promise<T> };
  const track = <T>(promise: Promise<T>): Tracked<T> => {
    const tracked = { settled: false, promise };
    promise.then(
      () => (tracked.settled = true),
      () => (tracked.settled = true),
    );
    return tracked;
  };
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const settle = <T>(promise: Promise<T>): Promise<Settled<T>> =>
    promise.then(
      (value) => ({ ok: true as const, value }),
      (error: SqlError) => ({ ok: false as const, error }),
    );

  // Builds a real lock queue instead of hoping two calls interleave (plan G7). A holder connection locks the row of
  // coupon "held". "head" starts and is seen blocked by the holder; "second" starts and is seen blocked by "head"
  // (pg_blocking_pids). The coupon "free" must still be unlocked then, so the second contender waits holding
  // nothing the head needs next. Only when both take their coupons in one ascending order does releasing the
  // holder finish both; with opposite orders the second one holds "free" and the release closes a lock cycle.
  async function lockQueue<A, B>(
    held: number,
    free: number,
    head: (c: pg.Client) => Promise<A>,
    second: (c: pg.Client) => Promise<B>,
  ): Promise<[Settled<A>, Settled<B>]> {
    const clients = [0, 1, 2, 3].map(
      () => new pg.Client({ connectionString: stack.dbUrl }),
    );
    const [h, a, b, m] = clients;
    await Promise.all(clients.map((c) => c.connect()));
    const pidOf = async (c: pg.Client) =>
      (await c.query("select pg_backend_pid() as pid")).rows[0].pid as number;
    const blockedBy = async (
      who: string,
      pid: number,
      by: number,
      tracked: Tracked<unknown>,
    ) => {
      const deadline = Date.now() + 15000;
      for (;;) {
        const blockers = (
          await m.query("select pg_blocking_pids($1) as b", [pid])
        ).rows[0].b as number[];
        if (blockers.includes(by)) return;
        if (tracked.settled) throw new Error(`${who} finished without waiting`);
        if (Date.now() > deadline)
          throw new Error(
            `${who} never waited on the expected holder (blocked by ${blockers})`,
          );
        await sleep(25);
      }
    };
    const finish = async <T>(conn: pg.Client, tracked: Tracked<T>) => {
      const settled = await settle(tracked.promise);
      await conn
        .query(settled.ok ? "commit" : "rollback")
        .catch(() => undefined);
      return settled;
    };
    try {
      await h.query("begin");
      await h.query("select 1 from public.coupons where id = $1 for update", [
        held,
      ]);
      for (const c of [a, b]) {
        await c.query("begin");
        await c.query("set local role service_role");
        await c.query("set local lock_timeout = '20s'");
      }
      const [pidH, pidA, pidB] = [
        await pidOf(h),
        await pidOf(a),
        await pidOf(b),
      ];

      const first = track(head(a));
      await blockedBy("the first contender", pidA, pidH, first);
      const next = track(second(b));
      await blockedBy("the second contender", pidB, pidA, next);

      await m.query("begin");
      try {
        await m.query(
          "select 1 from public.coupons where id = $1 for update nowait",
          [free],
        );
      } catch {
        throw new Error(
          `the second contender holds coupon ${free} while it waits: the locks are not taken in ascending order`,
        );
      } finally {
        await m.query("rollback");
      }

      await h.query("commit");
      return await Promise.all([finish(a, first), finish(b, next)]);
    } finally {
      await Promise.all(
        [h, a, b].map((c) => c.query("rollback").catch(() => undefined)),
      );
      await Promise.all(clients.map((c) => c.end()));
    }
  }

  // Committed fixtures, recorded by exact selector before the write and removed by the scope.
  async function fixtureCourse(price = 100000): Promise<number> {
    const s = slug();
    await fixtureScope().reserve("courses", { slug: s });
    return must(
      await fixtures
        .from("courses")
        .insert({ name: s, slug: s, price })
        .select("id")
        .single(),
    ).id;
  }
  async function fixtureCoupon(o: {
    max: number | null;
    percent?: number;
  }): Promise<{ id: number; code: string }> {
    const code = fixtureScope().code(`w${counter++}`);
    await fixtureScope().reserve("coupons", { code });
    const row = must(
      await fixtures
        .from("coupons")
        .insert({
          code,
          discount_percent: o.percent ?? 10,
          max_uses: o.max,
          used_count: 0,
        })
        .select("id")
        .single(),
    );
    return { id: row.id, code };
  }
  async function fixtureOrder(user: string, courseId: number): Promise<number> {
    await fixtureScope().reserve("payments", {
      user_id: user,
      course_id: courseId,
    });
    const { data, error } = await fixtures.rpc("create_pending_payment", {
      p_user_id: user,
      p_course_id: courseId,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ result: "created" });
    return (data as { payment_id: number }).payment_id;
  }
  const used = async (id: number) =>
    must(
      await fixtures.from("coupons").select("used_count").eq("id", id).single(),
    ).used_count;
  const apply = (c: pg.Client, order: number, user: string, code: string) =>
    call(c, "public.apply_payment_coupon($1, $2, $3)", [order, user, code]);

  it("[W30] AC3 two orders applying the last use at the same moment: exactly one wins", async () => {
    const courseId = await fixtureCourse();
    const cp = await fixtureCoupon({ max: 1 });
    const a = await fixtureOrder(IDS.learner, courseId);
    const b = await fixtureOrder(IDS.student, courseId);
    const [ra, rb] = await overlap(
      (c) => apply(c, a, IDS.learner, cp.code),
      (c) => apply(c, b, IDS.student, cp.code),
    );
    expect(ra).toMatchObject({ discount_percent: 10 });
    expect(rb).toEqual({ error: "coupon_exhausted" });
    expect(await used(cp.id)).toBe(1);
    expect(
      must(
        await fixtures
          .from("payments")
          .select("id, coupon_id")
          .in("id", [a, b])
          .order("id"),
      ),
    ).toEqual([
      { id: a, coupon_id: cp.id },
      { id: b, coupon_id: null },
    ]);
  });

  it.each([
    ["approve first", true],
    ["close first", false],
  ] as const)(
    "[W31] AC6 approve and cancel of the same order race (%s): exactly one wins and the enrollment exists iff approved",
    async (_name, approveFirst) => {
      const courseId = await fixtureCourse();
      const cp = await fixtureCoupon({ max: 5 });
      const order = await fixtureOrder(IDS.learner, courseId);
      await fixtureScope().reserve("enrollments", {
        user_id: IDS.learner,
        course_id: courseId,
      });
      const setup = await fixtures.rpc("apply_payment_coupon", {
        p_payment_id: order,
        p_user_id: IDS.learner,
        p_code: cp.code,
      });
      expect(setup.error).toBeNull();
      const approve = (c: pg.Client) =>
        call(c, "public.approve_payment($1)", [order]);
      const close = (c: pg.Client) =>
        call(c, "public.close_pending_payment($1, $2)", [
          order,
          IDS.learner,
        ]).then((r) => r as unknown as boolean);
      const enrolled = async () =>
        must(
          await fixtures
            .from("enrollments")
            .select("id")
            .eq("user_id", IDS.learner)
            .eq("course_id", courseId),
        ).length;
      if (approveFirst) {
        const [ra, rb] = await overlap(approve, close);
        expect(ra).toMatchObject({ approved: true });
        expect(rb).toBe(false);
        expect(
          must(
            await fixtures
              .from("payments")
              .select("status")
              .eq("id", order)
              .single(),
          ).status,
        ).toBe("success");
        expect(await enrolled()).toBe(1);
        expect(await used(cp.id)).toBe(1);
      } else {
        const [ra, rb] = await overlap(close, approve);
        expect(ra).toBe(true);
        expect(rb).toEqual({ approved: false });
        expect(
          must(
            await fixtures
              .from("payments")
              .select("status")
              .eq("id", order)
              .single(),
          ).status,
        ).toBe("failed");
        expect(await enrolled()).toBe(0);
        expect(await used(cp.id)).toBe(0);
      }
    },
  );

  it("[W32] AC7 a create racing the approval of the learner's earlier order leaves no pending order once the enrollment exists", async () => {
    const courseId = await fixtureCourse();
    const order = await fixtureOrder(IDS.learner, courseId);
    await fixtureScope().reserve("enrollments", {
      user_id: IDS.learner,
      course_id: courseId,
    });
    const [approved, created] = await overlap(
      (c) => call(c, "public.approve_payment($1)", [order]),
      (c) =>
        call(c, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          courseId,
        ]),
    );
    expect(approved).toMatchObject({ approved: true });
    expect(created).toEqual({ result: "enrolled" });
    expect(
      must(
        await fixtures
          .from("payments")
          .select("status")
          .eq("user_id", IDS.learner)
          .eq("course_id", courseId),
      ),
    ).toEqual([{ status: "success" }]);
    expect(
      must(
        await fixtures
          .from("enrollments")
          .select("id")
          .eq("user_id", IDS.learner)
          .eq("course_id", courseId),
      ),
    ).toHaveLength(1);
  });

  it("[W33] AC8 two simultaneous creates produce one pending order", async () => {
    const courseId = await fixtureCourse();
    await fixtureScope().reserve("payments", {
      user_id: IDS.learner,
      course_id: courseId,
    });
    const create = (c: pg.Client) =>
      call(c, "public.create_pending_payment($1, $2)", [IDS.learner, courseId]);
    const [ra, rb] = await overlap(create, create);
    expect(ra.result).toBe("created");
    expect(rb).toMatchObject({ result: "resumed", payment_id: ra.payment_id });
    expect(
      must(
        await fixtures
          .from("payments")
          .select("id")
          .eq("user_id", IDS.learner)
          .eq("course_id", courseId),
      ),
    ).toHaveLength(1);
  });

  it("[W6a] AC8 a create whose conflicting pending order is closed before it reads the order still answers with a valid order", async () => {
    const courseId = await fixtureCourse();
    const earlier = await fixtureOrder(IDS.learner, courseId);
    // A statement trigger runs after the insert's conflict check and before the function reads the conflicting order,
    // which is the window; it waits on an advisory lock the test holds, and only for the connection that set the flag.
    const key = Number.parseInt(RUN.slice(0, 7), 16);
    const hook = `w_hook_${RUN}`;
    const clients = [0, 1, 2].map(
      () => new pg.Client({ connectionString: stack.dbUrl }),
    );
    const [h, a, m] = clients;
    // Only a client that connected is rolled back and ended: end() on one that never connected waits forever.
    const connected = new Set<pg.Client>();
    let failed = false;
    let original: unknown;
    try {
      // Function and trigger commit together or not at all, so a failed setup leaves neither behind.
      await withPg(async (c) => {
        await c.query("begin");
        try {
          await c.query(
            `create function public.${hook}() returns trigger language plpgsql as $$
             begin
               if current_setting('se_u1.hook', true) = '1' then perform pg_advisory_xact_lock(${key}); end if;
               return null;
             end $$`,
          );
          await c.query(
            `create trigger ${hook} after insert on public.payments for each statement execute function public.${hook}()`,
          );
          await c.query("commit");
        } catch (error) {
          await c.query("rollback").catch(() => undefined);
          throw error;
        }
      });
      const attempts = await Promise.allSettled(
        clients.map(async (c) => {
          await c.connect();
          connected.add(c);
        }),
      );
      const refused = attempts.find((r) => r.status === "rejected");
      if (refused) throw refused.reason;
      await h.query("begin");
      await h.query("select pg_advisory_xact_lock($1)", [key]);
      await a.query("begin");
      await a.query("set local role service_role");
      await a.query("set local se_u1.hook = '1'");
      await a.query("set local lock_timeout = '20s'");
      const pidH = (await h.query("select pg_backend_pid() as pid")).rows[0]
        .pid;
      const pidA = (await a.query("select pg_backend_pid() as pid")).rows[0]
        .pid;

      const pending = track(
        call(a, "public.create_pending_payment($1, $2)", [
          IDS.learner,
          courseId,
        ]),
      );
      const deadline = Date.now() + 15000;
      for (;;) {
        const blockers = (
          await m.query("select pg_blocking_pids($1) as b", [pidA])
        ).rows[0].b as number[];
        if (blockers.includes(pidH)) break;
        if (pending.settled)
          throw new Error("the create finished before it reached the window");
        if (Date.now() > deadline)
          throw new Error("the create never reached the window");
        await sleep(25);
      }

      // The create is past its conflict check; the order it conflicted with is closed and committed now.
      const closed = await fixtures.rpc("close_pending_payment", {
        p_payment_id: earlier,
        p_user_id: IDS.learner,
      });
      expect(closed.error).toBeNull();
      expect(closed.data).toBe(true);

      await h.query("commit");
      const result = await pending.promise;
      await a.query("commit");
      expect(result).toMatchObject({ result: "created", amount: 100000 });
      expect(result.payment_id).not.toBe(earlier);
      expect(typeof result.payment_id).toBe("number");
      expect(
        must(
          await fixtures
            .from("payments")
            .select("id, status")
            .eq("user_id", IDS.learner)
            .eq("course_id", courseId)
            .order("id"),
        ),
      ).toEqual([
        { id: earlier, status: "failed" },
        { id: result.payment_id, status: "pending" },
      ]);
    } catch (error) {
      failed = true;
      original = error;
    }

    // Every cleanup step runs whatever the others did; the original error and each cleanup error are all reported.
    const cleanupErrors: unknown[] = [];
    const step = async (run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        cleanupErrors.push(error);
      }
    };
    for (const c of [h, a])
      if (connected.has(c)) await step(() => c.query("rollback"));
    for (const c of connected) await step(() => c.end());
    // The scope's selector (user, course) must match one row at cleanup; the closed order goes first.
    await step(async () =>
      must(await fixtures.from("payments").delete().eq("id", earlier)),
    );
    await step(() =>
      withPg((c) =>
        c.query(`drop trigger if exists ${hook} on public.payments`),
      ),
    );
    await step(() =>
      withPg((c) => c.query(`drop function if exists public.${hook}()`)),
    );
    await step(async () => {
      const left = await withPg(
        async (c) =>
          (
            await c.query(
              `select (select count(*) from pg_proc where proname = $1)::int as fns,
                      (select count(*) from pg_trigger where tgname = $1)::int as triggers`,
              [hook],
            )
          ).rows[0],
      );
      if (left.fns !== 0 || left.triggers !== 0)
        throw new Error(
          `test hook ${hook} was not removed: ${left.fns} function(s), ${left.triggers} trigger(s) remain`,
        );
    });
    // A catalog object that outlives the test is not table residue, so the end-of-run audit cannot see it: mark the run
    // unclean here, and the next command resets the database.
    if (cleanupErrors.length)
      fixtureScope().run.mark(
        `test hook ${hook} cleanup failed: ${cleanupErrors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ")}`,
      );
    if (failed && cleanupErrors.length === 0) throw original;
    if (failed || cleanupErrors.length)
      throw new AggregateError(
        failed ? [original, ...cleanupErrors] : cleanupErrors,
        "W6a failed or its cleanup failed",
        failed ? { cause: original } : undefined,
      );
  });

  it.each([
    ["the order moving to the higher code starts first", "a"],
    ["the order moving to the lower code starts first", "b"],
  ] as const)(
    "[W34] AC2 two orders switching codes in opposite directions queue behind a held lower code without a deadlock and the counts are exact (%s)",
    async (_name, firstOrder) => {
      const courseId = await fixtureCourse();
      const m = await fixtureCoupon({ max: 10 });
      const n = await fixtureCoupon({ max: 10 });
      expect(m.id).toBeLessThan(n.id);
      const a = await fixtureOrder(IDS.learner, courseId);
      const b = await fixtureOrder(IDS.student, courseId);
      for (const [order, user, cp] of [
        [a, IDS.learner, m],
        [b, IDS.student, n],
      ] as const) {
        const { error } = await fixtures.rpc("apply_payment_coupon", {
          p_payment_id: order,
          p_user_id: user,
          p_code: cp.code,
        });
        expect(error).toBeNull();
      }
      expect([await used(m.id), await used(n.id)]).toEqual([1, 1]);

      // a moves M to N (takes the higher code last), b moves N to M. The holder keeps the lower code M locked.
      const switchA = (c: pg.Client) => apply(c, a, IDS.learner, n.code);
      const switchB = (c: pg.Client) => apply(c, b, IDS.student, m.code);
      const settled =
        firstOrder === "a"
          ? await lockQueue(m.id, n.id, switchA, switchB)
          : await lockQueue(m.id, n.id, switchB, switchA);
      const [ra, rb] = firstOrder === "a" ? settled : [settled[1], settled[0]];

      expect(ra).toMatchObject({ ok: true, value: { discount_percent: 10 } });
      expect(rb).toMatchObject({ ok: true, value: { discount_percent: 10 } });
      expect([await used(m.id), await used(n.id)]).toEqual([1, 1]);
      expect(
        must(
          await fixtures
            .from("payments")
            .select("id, coupon_id")
            .in("id", [a, b])
            .order("id"),
        ),
      ).toEqual([
        { id: a, coupon_id: n.id },
        { id: b, coupon_id: m.id },
      ]);
    },
  );

  it.each([
    ["user one first", 0],
    ["user two first", 1],
  ] as const)(
    "[W35] AC11 two user deletions holding pending orders on the same two coupons in opposite row order queue behind a held lower code, both finish and release every use (%s)",
    async (_name, firstUser) => {
      const [c1, c2, c3, c4] = [
        await fixtureCourse(),
        await fixtureCourse(),
        await fixtureCourse(),
        await fixtureCourse(),
      ];
      const m = await fixtureCoupon({ max: 10 });
      const n = await fixtureCoupon({ max: 10 });
      expect(m.id).toBeLessThan(n.id);
      const users: string[] = [];
      for (const label of ["a", "b"]) {
        const email = `w-${fixtureScope().tag}-${label}@devspace.test`;
        await fixtureScope().reserveAuth(email);
        const created = await fixtures.auth.admin.createUser({
          email,
          password: "payments-local-pass-1",
          email_confirm: true,
        });
        if (created.error || !created.data.user)
          throw new Error(created.error?.message ?? "missing user");
        users.push(created.data.user.id);
      }
      // User one holds M then N; user two holds N then M (their orders are created in that order).
      const plan: [string, number, { id: number; code: string }][] = [
        [users[0], c1, m],
        [users[0], c2, n],
        [users[1], c3, n],
        [users[1], c4, m],
      ];
      for (const [user, courseId, cp] of plan) {
        const order = await fixtureOrder(user, courseId);
        const { error } = await fixtures.rpc("apply_payment_coupon", {
          p_payment_id: order,
          p_user_id: user,
          p_code: cp.code,
        });
        expect(error).toBeNull();
      }
      expect([await used(m.id), await used(n.id)]).toEqual([2, 2]);

      const remove = (user: string) => async (c: pg.Client) => {
        await c.query("reset role");
        await c.query("delete from auth.users where id = $1", [user]);
      };
      const [one, two] = [remove(users[0]), remove(users[1])];
      const settled =
        firstUser === 0
          ? await lockQueue(m.id, n.id, one, two)
          : await lockQueue(m.id, n.id, two, one);

      expect(settled[0]).toMatchObject({ ok: true });
      expect(settled[1]).toMatchObject({ ok: true });
      expect([await used(m.id), await used(n.id)]).toEqual([0, 0]);
      expect(
        must(await fixtures.from("payments").select("id").in("user_id", users)),
      ).toEqual([]);
    },
  );
});

describe("rollback of the payment functions migration", () => {
  it("[W36] AC12 the rollback refuses while a pending order holds a coupon, restores the earlier catalog exactly and the migration reapplies", async () => {
    const name = "20261106211345_se_u1_payment_rpcs";
    const read = async (dir: string, file: string) =>
      (
        await readFile(
          new URL(`../../supabase/${dir}/${file}`, import.meta.url),
          "utf8",
        )
      )
        .replace(/^begin;$/m, "")
        .replace(/^commit;$/m, "");
    const up = await read("migrations", `${name}.sql`);
    const down = await read("rollbacks", `${name}.down.sql`);
    await inTx(async (c) => {
      const forward = await m1Catalog(c);
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        order,
        IDS.learner,
        cp.code,
      ]);
      await asOwner(c);
      const refused = await attempt(c, down);
      expect(refused?.message).toContain(
        "pending payments still hold a coupon",
      );
      expect(await m1Catalog(c)).toEqual(forward);

      await asService(c);
      await call(c, "public.close_pending_payment($1, $2)", [order, null]);
      await asOwner(c);
      await c.query(down);
      const previous = await m1Catalog(c);
      expect(previous.columns.map((r) => r.column_name)).toEqual([
        "id",
        "user_id",
        "course_id",
        "amount",
        "status",
        "created_at",
        "updated_at",
      ]);
      expect(previous.indexes.map((r) => r.indexname)).toEqual([
        "payments_pkey",
      ]);
      expect(previous.triggers).toEqual([]);
      expect(previous.functions).toEqual([]);

      await c.query(up);
      expect(await m1Catalog(c)).toEqual(forward);
    });
    await withPg(async (c) =>
      expect((await functionCatalog(c, FUNCTIONS)).length).toBe(4),
    );
  });
});

describe("payments write lock", () => {
  const ROLES = ["service_role", "anon", "authenticated"] as const;
  const privileges = async (c: pg.Client) =>
    (
      await c.query(
        `select r.rolname,
           has_table_privilege(r.rolname, 'public.payments', 'INSERT') as can_insert,
           has_table_privilege(r.rolname, 'public.payments', 'UPDATE') as can_update,
           has_table_privilege(r.rolname, 'public.payments', 'DELETE') as can_delete,
           has_table_privilege(r.rolname, 'public.payments', 'SELECT') as can_select
         from pg_roles r where r.rolname = any($1) order by r.rolname`,
        [[...ROLES]],
      )
    ).rows;

  it("[W37] AC10 no API role holds INSERT or UPDATE on payments; DELETE and SELECT stay", async () => {
    await withPg(async (c) => {
      expect(await privileges(c)).toEqual(
        ["anon", "authenticated", "service_role"].map((rolname) => ({
          rolname,
          can_insert: false,
          can_update: false,
          can_delete: true,
          can_select: true,
        })),
      );
    });
  });

  // The refusal rows write nothing if the privilege were missing, so a broken lock must find only rows this test owns:
  // an owned course and pending order to update, and the exact selector of the insert that must be refused, reserved
  // before the first request. The scope removes both, also when an assertion fails.
  async function ownedTarget() {
    const s = slug();
    await fixtureScope().reserve("courses", { slug: s });
    const courseId = must(
      await fixtures
        .from("courses")
        .insert({ name: s, slug: s, price: 100000 })
        .select("id")
        .single(),
    ).id;
    await fixtureScope().reserve("payments", {
      user_id: IDS.student,
      course_id: courseId,
    });
    const created = await fixtures.rpc("create_pending_payment", {
      p_user_id: IDS.student,
      p_course_id: courseId,
    });
    expect(created.error).toBeNull();
    // The refusal rows below are only meaningful against a real pending order that this test owns.
    expect(created.data).toMatchObject({ result: "created" });
    const orderId = (created.data as { payment_id: unknown }).payment_id;
    expect(typeof orderId).toBe("number");
    await fixtureScope().reserve("payments", {
      user_id: IDS.learner,
      course_id: courseId,
    });
    return { courseId, orderId: orderId as number };
  }
  const expectOwnedPending = (
    before: Record<string, unknown>[],
    orderId: number,
    courseId: number,
  ) =>
    expect(before).toContainEqual(
      expect.objectContaining({
        id: orderId,
        user_id: IDS.student,
        course_id: courseId,
        status: "pending",
      }),
    );
  const allPayments = async () =>
    must(await fixtures.from("payments").select("*").order("id"));

  it("[W38] AC10 the service role is refused with 42501 on a direct insert and update, and the rows are unchanged", async () => {
    const { courseId, orderId } = await ownedTarget();
    const before = await allPayments();
    expectOwnedPending(before, orderId, courseId);
    const insert = await fixtures.from("payments").insert({
      user_id: IDS.learner,
      course_id: courseId,
      amount: 100000,
      status: "pending",
    });
    expectDenied(insert.error);
    const update = await fixtures
      .from("payments")
      .update({ status: "success" })
      .eq("id", orderId);
    expectDenied(update.error);
    const touch = await fixtures
      .from("payments")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", orderId);
    expectDenied(touch.error);
    expect(await allPayments()).toEqual(before);
  });

  it.each([
    ["anon", anon],
    ["learner", learner],
    ["student", student],
    ["admin", admin],
  ] as const)(
    "[W39] AC10 %s is refused with 42501 on a direct insert and update",
    async (_actor, client) => {
      const { courseId, orderId } = await ownedTarget();
      const before = await allPayments();
      expectOwnedPending(before, orderId, courseId);
      const insert = await client.from("payments").insert({
        user_id: IDS.learner,
        course_id: courseId,
        amount: 100000,
        status: "pending",
      });
      expectDenied(insert.error);
      const update = await client
        .from("payments")
        .update({ status: "failed" })
        .eq("id", orderId);
      expectDenied(update.error);
      expect(await allPayments()).toEqual(before);
    },
  );

  it("[W40] the functions still write as the service role on the locked table, and a direct delete still releases a use", async () => {
    await inTx(async (c) => {
      const id = await course(c, 100000);
      const cp = await coupon(c);
      await asService(c);
      const order = await createOrder(c, IDS.learner, id);
      expect(
        await call(c, "public.apply_payment_coupon($1, $2, $3)", [
          order,
          IDS.learner,
          cp.code,
        ]),
      ).toMatchObject({ amount: 90000 });
      const other = await createOrder(c, IDS.student, id);
      expect(
        await call(c, "public.approve_payment($1)", [other]),
      ).toMatchObject({ approved: true });
      expect(await usedCount(c, cp.id)).toBe(1);
      expect(
        await call(c, "public.close_pending_payment($1, $2)", [order, null]),
      ).toBe(true);
      expect(await usedCount(c, cp.id)).toBe(0);

      const again = await createOrder(c, IDS.admin, id);
      await call(c, "public.apply_payment_coupon($1, $2, $3)", [
        again,
        IDS.admin,
        cp.code,
      ]);
      expect(await usedCount(c, cp.id)).toBe(1);
      expect(
        await attempt(c, "delete from public.payments where id = $1", [again]),
      ).toBeNull();
      expect(await payment(c, again)).toBeUndefined();
      expect(await usedCount(c, cp.id)).toBe(0);
    });
  });

  it("[W41] the service role deletes a committed pending order through the API", async () => {
    const s = slug();
    await fixtureScope().reserve("courses", { slug: s });
    const courseId = must(
      await fixtures
        .from("courses")
        .insert({ name: s, slug: s, price: 1000 })
        .select("id")
        .single(),
    ).id;
    await fixtureScope().reserve("payments", {
      user_id: IDS.learner,
      course_id: courseId,
    });
    const created = await fixtures.rpc("create_pending_payment", {
      p_user_id: IDS.learner,
      p_course_id: courseId,
    });
    expect(created.error).toBeNull();
    const orderId = (created.data as { payment_id: number }).payment_id;

    const removed = await fixtures.from("payments").delete().eq("id", orderId);

    expect(removed.error).toBeNull();
    expect(
      must(await fixtures.from("payments").select("id").eq("id", orderId)),
    ).toEqual([]);
  });

  it("[W42] AC12 the rollback restores the earlier table privileges exactly and the migration reapplies", async () => {
    const name = "20261106214043_se_u1_payment_write_lock";
    const read = async (dir: string, file: string) =>
      (
        await readFile(
          new URL(`../../supabase/${dir}/${file}`, import.meta.url),
          "utf8",
        )
      )
        .replace(/^begin;$/m, "")
        .replace(/^commit;$/m, "");
    const up = await read("migrations", `${name}.sql`);
    const down = await read("rollbacks", `${name}.down.sql`);
    const acl = async (c: pg.Client, table: string) =>
      (
        await c.query(
          "select relacl::text as acl from pg_class where oid = $1::regclass",
          [table],
        )
      ).rows[0].acl as string;
    await inTx(async (c) => {
      const locked = await privileges(c);
      const lockedAcl = await acl(c, "public.payments");
      await c.query(down);
      expect(await privileges(c)).toEqual(
        ["anon", "authenticated", "service_role"].map((rolname) => ({
          rolname,
          can_insert: true,
          can_update: true,
          can_delete: true,
          can_select: true,
        })),
      );
      // The earlier ACL is the one of a table that never had the lock: same roles, same privileges, same grantor.
      expect(await acl(c, "public.payments")).toBe(
        await acl(c, "public.coupons"),
      );
      expect(await acl(c, "public.payments")).not.toBe(lockedAcl);
      await c.query(up);
      expect(await privileges(c)).toEqual(locked);
      expect(await acl(c, "public.payments")).toBe(lockedAcl);
    });
  });
});
