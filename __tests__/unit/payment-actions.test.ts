// Test plan
// Goal: the payment actions parse before any read or write, take the user id from the session, map each database
//   function result to the fixed Vietnamese message, and never let the approval mail change an approval.
// Layer: unit. The database functions, the auth helpers, the mail and the cache are mocked; the actions and their
//   schemas run for real. The functions' own guarantees are in __tests__/rls/payments.test.ts.
// Subject: app/action/payment.ts (createPendingPayment, updatePaymentWithCoupon, cancelPayment, approvePayment,
//   rejectPayment).
// Allowed paths: a valid call reaches exactly one function with the session's user id; the winning approval mails once.
// Denied paths: a malformed argument touches no client and no auth helper; a refused transition sends no mail.
// Known bugs: none.
// Invariants: reads only mocks.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Chain = {
  select: () => Chain;
  eq: () => Chain;
  order: () => Chain;
  limit: () => Chain;
  single: () => Promise<{ data: unknown; error: { code: string } | null }>;
};
const chain = (data: unknown, error: { code: string } | null = null): Chain => {
  const q: Chain = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: () => q,
    single: async () => ({ data, error }),
  };
  return q;
};

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  sendSuccessEmail: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/auth.server", () => ({
  requireUser: mocks.requireUser,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/email.server", () => ({
  sendSuccessEmail: mocks.sendSuccessEmail,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  approvePayment,
  cancelPayment,
  createPendingPayment,
  rejectPayment,
  updatePaymentWithCoupon,
} from "@/app/action/payment";

const GENERIC = { error: "Dữ liệu không hợp lệ." };
const USER = "11111111-1111-4111-8111-111111111111";

function expectNothingTouched() {
  expect(mocks.requireUser).not.toHaveBeenCalled();
  expect(mocks.requireAdmin).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.sendSuccessEmail).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.requireUser.mockResolvedValue({ user: { id: USER } });
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-id" } });
  mocks.from.mockImplementation((table: string) =>
    chain(
      {
        profiles: { full_name: "Học Viên", email: "learner@devspace.test" },
        courses: { name: "JavaScript căn bản", slug: "javascript-can-ban" },
        chapters: { id: 5 },
        lessons: { slug: "bai-1" },
      }[table],
    ),
  );
});

describe("a malformed argument", () => {
  it.each([["2"], [-1], [1.5], [null], [undefined]])(
    "createPendingPayment(%j) is refused before auth and the database",
    async (courseId) => {
      expect(await createPendingPayment(courseId as number)).toEqual(GENERIC);
      expectNothingTouched();
    },
  );

  it.each([["1"], [0], [1.5], [null]])(
    "cancel, approve and reject of %j are refused before auth and the database",
    async (id) => {
      expect(await cancelPayment(id as number)).toEqual(GENERIC);
      expect(await approvePayment(id as number)).toEqual(GENERIC);
      expect(await rejectPayment(id as number)).toEqual(GENERIC);
      expectNothingTouched();
    },
  );

  it.each([
    [0, "LOCAL10"],
    ["1", "LOCAL10"],
    [1, ""],
    [1, "   "],
    [1, 5],
    [1, "X".repeat(65)],
  ])(
    "updatePaymentWithCoupon(%j, %j) is refused before auth and the database",
    async (id, code) => {
      expect(
        await updatePaymentWithCoupon(id as number, code as string),
      ).toEqual(GENERIC);
      expectNothingTouched();
    },
  );
});

describe("createPendingPayment", () => {
  it("passes the session's user id and the parsed course id, and ignores any further argument", async () => {
    mocks.rpc.mockResolvedValue({
      data: { result: "created", payment_id: 9, amount: 199000 },
      error: null,
    });

    const result = await (
      createPendingPayment as (...args: unknown[]) => Promise<unknown>
    )(2, "LOCAL10");

    expect(result).toEqual({ success: true, paymentId: 9, amount: 199000 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("create_pending_payment", {
      p_user_id: USER,
      p_course_id: 2,
    });
  });

  it("marks an existing pending order as resumed", async () => {
    mocks.rpc.mockResolvedValue({
      data: { result: "resumed", payment_id: 9, amount: 199000 },
      error: null,
    });
    expect(await createPendingPayment(2)).toEqual({
      success: true,
      paymentId: 9,
      amount: 199000,
      isResumed: true,
    });
  });

  it.each([
    ["invalid_course", "Khóa học không tồn tại"],
    ["free_course", "Khóa học này miễn phí, hãy đăng ký trực tiếp"],
    ["enrolled", "Bạn đã sở hữu khóa học này"],
  ])("answers %s with its message", async (result, error) => {
    mocks.rpc.mockResolvedValue({ data: { result }, error: null });
    expect(await createPendingPayment(2)).toEqual({ error });
  });

  it("answers a database error with a fixed message and no detail", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });
    expect(await createPendingPayment(2)).toEqual({
      error: "Lỗi tạo giao dịch",
    });
  });

  it("answers an unsigned caller without reaching the database", async () => {
    mocks.requireUser.mockResolvedValue({ error: "Bạn chưa đăng nhập" });
    expect(await createPendingPayment(2)).toEqual({
      error: "Bạn chưa đăng nhập",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("updatePaymentWithCoupon", () => {
  it("sends the parsed, upper-cased code with the session's user id and returns the amount", async () => {
    mocks.rpc.mockResolvedValue({
      data: { amount: 179100, discount_percent: 10 },
      error: null,
    });

    expect(await updatePaymentWithCoupon(7, " local10 ")).toEqual({
      success: true,
      newAmount: 179100,
      discountPercent: 10,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_coupon", {
      p_payment_id: 7,
      p_user_id: USER,
      p_code: "LOCAL10",
    });
  });

  it.each([
    ["invalid_payment", "Đơn hàng không hợp lệ"],
    ["invalid_coupon", "Mã giảm giá không tồn tại hoặc đã hết hạn"],
    ["coupon_exhausted", "Mã này đã hết lượt sử dụng"],
  ])("answers %s with its message", async (code, error) => {
    mocks.rpc.mockResolvedValue({ data: { error: code }, error: null });
    expect(await updatePaymentWithCoupon(7, "LOCAL10")).toEqual({ error });
  });

  it("does not report success for an answer without an amount", async () => {
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
    expect(await updatePaymentWithCoupon(7, "LOCAL10")).toEqual({
      error: "Lỗi cập nhật giá",
    });
  });
});

describe("cancelPayment and rejectPayment", () => {
  it("cancel passes the session's user id and reports success only when an order changed", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await cancelPayment(7)).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("close_pending_payment", {
      p_payment_id: 7,
      p_user_id: USER,
    });

    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await cancelPayment(7)).toEqual({
      error: "Không thể hủy giao dịch này",
    });
  });

  it("reject passes a null user, reports an order that is not pending and revalidates only on success", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await rejectPayment(7)).toEqual({ error: "Đơn đã được xử lý" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await rejectPayment(7)).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenLastCalledWith("close_pending_payment", {
      p_payment_id: 7,
      p_user_id: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/transactions");
  });

  it("a non-admin reject and approve stop at the auth check", async () => {
    mocks.requireAdmin.mockResolvedValue({ error: "Không có quyền truy cập" });
    expect(await rejectPayment(7)).toEqual({
      error: "Không có quyền truy cập",
    });
    expect(await approvePayment(7)).toEqual({
      error: "Không có quyền truy cập",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("approvePayment", () => {
  const won = {
    data: { approved: true, user_id: USER, course_id: 2 },
    error: null,
  };

  it("mails once for the winning approval, using the ids the function returned", async () => {
    mocks.rpc.mockResolvedValue(won);
    mocks.sendSuccessEmail.mockResolvedValue({ success: true });

    expect(await approvePayment(7)).toEqual({ success: true });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("approve_payment", {
      p_payment_id: 7,
    });
    expect(mocks.sendSuccessEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendSuccessEmail).toHaveBeenCalledWith(
      "learner@devspace.test",
      "Học Viên",
      "JavaScript căn bản",
      "javascript-can-ban",
      "bai-1",
    );
  });

  it.each([
    [
      "a resolved failure",
      () =>
        mocks.sendSuccessEmail.mockResolvedValue({
          success: false,
          error: new Error("smtp"),
        }),
    ],
    [
      "a thrown error",
      () => mocks.sendSuccessEmail.mockRejectedValue(new Error("smtp")),
    ],
  ])(
    "still reports the approval, with one function call, when the mail fails by %s",
    async (_label, arrange) => {
      mocks.rpc.mockResolvedValue(won);
      arrange();

      expect(await approvePayment(7)).toEqual({ success: true });

      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.sendSuccessEmail).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    },
  );

  it("still reports the approval when the lookup for the mail fails", async () => {
    mocks.rpc.mockResolvedValue(won);
    mocks.from.mockImplementation(() => {
      throw new Error("lookup failed");
    });

    expect(await approvePayment(7)).toEqual({ success: true });
    expect(mocks.sendSuccessEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["profiles", false],
    ["courses", true],
  ])(
    "logs only the code when the %s lookup for the mail fails, and still reports the approval",
    async (failing, mailed) => {
      mocks.rpc.mockResolvedValue(won);
      mocks.sendSuccessEmail.mockResolvedValue({ success: true });
      const rows: Record<string, unknown> = {
        profiles: { full_name: "Học Viên", email: "learner@devspace.test" },
        courses: { name: "JavaScript căn bản", slug: "javascript-can-ban" },
        chapters: { id: 5 },
        lessons: { slug: "bai-1" },
      };
      mocks.from.mockImplementation((table: string) =>
        table === failing
          ? chain(null, { code: "PGRST116" })
          : chain(rows[table]),
      );

      expect(await approvePayment(7)).toEqual({ success: true });

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        "PGRST116",
      );
      expect(mocks.sendSuccessEmail).toHaveBeenCalledTimes(mailed ? 1 : 0);
    },
  );

  it.each([
    ["not approved", { approved: false }],
    ["an empty answer", null],
  ])(
    "sends no mail and reports a processed order when the function answers %s",
    async (_label, data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });

      expect(await approvePayment(7)).toEqual({ error: "Đơn đã được xử lý" });

      expect(mocks.sendSuccessEmail).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("reports a fixed error and sends no mail when the function fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });

    expect(await approvePayment(7)).toEqual({ error: "Lỗi hệ thống" });

    expect(mocks.sendSuccessEmail).not.toHaveBeenCalled();
  });
});
