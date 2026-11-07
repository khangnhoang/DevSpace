"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendSuccessEmail } from "@/lib/email.server";
import { requireAdmin, requireUser } from "@/lib/auth.server";
import { courseIdSchema } from "@/lib/schemas/enrollment";
import { parseFailure } from "@/lib/schemas/parse-failure";
import { couponCodeSchema, paymentIdSchema } from "@/lib/schemas/payment";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Every payment and coupon-usage write is one database function per transition (migration se_u1_payment_rpcs): the
// functions check the current state in the write itself, so a repeat or a race is harmless. The user id always
// comes from the session, never from the client.

export async function updatePaymentWithCoupon(
  paymentId: number,
  couponCode: string,
) {
  const id = paymentIdSchema.safeParse(paymentId);
  if (!id.success) return { error: parseFailure(id.error) };
  const code = couponCodeSchema.safeParse(couponCode);
  if (!code.success) return { error: parseFailure(code.error) };

  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };

    const { data, error } = await supabaseAdmin.rpc("apply_payment_coupon", {
      p_payment_id: id.data,
      p_user_id: auth.user.id,
      p_code: code.data,
    });
    if (error || !data) {
      console.error("apply_payment_coupon failed:", error?.code);
      return { error: "Lỗi cập nhật giá" };
    }

    const result = data as {
      error?: string;
      amount?: number;
      discount_percent?: number;
    };
    if (result.error === "invalid_payment")
      return { error: "Đơn hàng không hợp lệ" };
    if (result.error === "invalid_coupon")
      return { error: "Mã giảm giá không tồn tại hoặc đã hết hạn" };
    if (result.error === "coupon_exhausted")
      return { error: "Mã này đã hết lượt sử dụng" };
    if (
      typeof result.amount !== "number" ||
      typeof result.discount_percent !== "number"
    )
      return { error: "Lỗi cập nhật giá" };

    return {
      success: true,
      newAmount: result.amount,
      discountPercent: result.discount_percent,
    };
  } catch {
    return { error: "Lỗi hệ thống" };
  }
}

export async function createPendingPayment(courseId: number) {
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) return { error: parseFailure(parsed.error) };

  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };

    // The price comes from the course row inside the function; this action never discounts.
    const { data, error } = await supabaseAdmin.rpc("create_pending_payment", {
      p_user_id: auth.user.id,
      p_course_id: parsed.data,
    });
    if (error || !data) {
      console.error("create_pending_payment failed:", error?.code);
      return { error: "Lỗi tạo giao dịch" };
    }

    const result = data as {
      result?: string;
      payment_id?: number;
      amount?: number;
    };
    if (result.result === "invalid_course")
      return { error: "Khóa học không tồn tại" };
    if (result.result === "free_course")
      return { error: "Khóa học này miễn phí, hãy đăng ký trực tiếp" };
    if (result.result === "enrolled")
      return { error: "Bạn đã sở hữu khóa học này" };
    if (
      (result.result !== "created" && result.result !== "resumed") ||
      typeof result.payment_id !== "number"
    )
      return { error: "Lỗi tạo giao dịch" };

    if (result.result === "resumed")
      return {
        success: true,
        paymentId: result.payment_id,
        amount: result.amount,
        isResumed: true,
      };
    return {
      success: true,
      paymentId: result.payment_id,
      amount: result.amount,
    };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi tạo giao dịch" };
  }
}

export async function cancelPayment(paymentId: number | null) {
  const id = paymentIdSchema.safeParse(paymentId);
  if (!id.success) return { error: parseFailure(id.error) };

  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };

    const { data, error } = await supabaseAdmin.rpc("close_pending_payment", {
      p_payment_id: id.data,
      p_user_id: auth.user.id,
    });
    if (error) {
      console.error("close_pending_payment failed:", error.code);
      return { error: "Lỗi hủy giao dịch" };
    }
    if (data !== true) return { error: "Không thể hủy giao dịch này" };
    return { success: true };
  } catch {
    return { error: "Lỗi hủy giao dịch" };
  }
}

export async function getAllPayments() {
  if ("error" in (await requireAdmin())) return [];

  // BƯỚC 1: Lấy bảng Payments (Chỉ lấy user_id, không join users)
  const { data: payments, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select(
      `
      id, amount, status, created_at, user_id,
      courses:course_id ( name, price )
    `,
    )
    .order("created_at", { ascending: false });

  if (paymentError || !payments) return [];

  // BƯỚC 2: Gom tất cả user_id lại
  const userIds = payments.map((p) => p.user_id).filter(Boolean); // Lọc null

  // BƯỚC 3: Lấy thông tin User từ bảng 'profiles' (Vì profiles nằm ở public, lấy dễ hơn auth.users)
  // Lưu ý: Đảm bảo ông đã có bảng profiles sync với auth.users
  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);

  // BƯỚC 4: Manual Join (Gộp lại bằng cơm)
  const paymentsWithUser = payments.map((p) => {
    const user = users?.find((u) => u.id === p.user_id);
    return {
      ...p,
      users: user || {
        full_name: "Người dùng đã xóa",
        email: "N/A",
        avatar_url: null,
      }, // Fallback nếu không tìm thấy
    };
  });

  return paymentsWithUser;
}

// The approval is already committed when this runs, so nothing here may fail the action: a lookup error, a resolved
// `{ success: false }` and a thrown mail error are logged on the server only. Delivery is not guaranteed (no outbox).
async function sendApprovalMail(userId: string, courseId: number) {
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();
    if (profileError)
      console.error("Approval mail profile lookup failed:", profileError.code);
    if (!profile?.email) return;

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("name, slug")
      .eq("id", courseId)
      .single();
    if (courseError)
      console.error("Approval mail course lookup failed:", courseError.code);

    // Link to the first lesson: the first chapter, then its first lesson.
    let firstLessonSlug: string | null = null;
    const { data: firstChapter } = await supabaseAdmin
      .from("chapters")
      .select("id")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true })
      .limit(1)
      .single();
    if (firstChapter) {
      const { data: firstLesson } = await supabaseAdmin
        .from("lessons")
        .select("slug")
        .eq("chapter_id", firstChapter.id)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();
      firstLessonSlug = firstLesson?.slug ?? null;
    }

    const sent = await sendSuccessEmail(
      profile.email,
      profile.full_name || "Học viên",
      course?.name || "Khóa học",
      course?.slug || "",
      firstLessonSlug,
    );
    if (!sent.success) console.error("Approval mail was not sent");
  } catch {
    console.error("Approval mail failed");
  }
}

// Admin approves an order: status and enrollment commit together in the database function.
export async function approvePayment(paymentId: number) {
  const id = paymentIdSchema.safeParse(paymentId);
  if (!id.success) return { error: parseFailure(id.error) };

  try {
    const auth = await requireAdmin();
    if ("error" in auth) return { error: auth.error };

    const { data, error } = await supabaseAdmin.rpc("approve_payment", {
      p_payment_id: id.data,
    });
    if (error) {
      console.error("approve_payment failed:", error.code);
      return { error: "Lỗi hệ thống" };
    }

    // Only the request that won the transition mails the learner.
    const result = data as {
      approved?: boolean;
      user_id?: string;
      course_id?: number;
    } | null;
    if (
      result?.approved !== true ||
      typeof result.user_id !== "string" ||
      typeof result.course_id !== "number"
    )
      return { error: "Đơn đã được xử lý" };

    await sendApprovalMail(result.user_id, result.course_id);

    revalidatePath("/admin/transactions");
    return { success: true };
  } catch (error) {
    console.error("Approve Error:", error);
    return { error: "Lỗi hệ thống" };
  }
}

// Admin rejects an order and releases its reserved coupon use.
export async function rejectPayment(paymentId: number) {
  const id = paymentIdSchema.safeParse(paymentId);
  if (!id.success) return { error: parseFailure(id.error) };

  try {
    const auth = await requireAdmin();
    if ("error" in auth) return { error: auth.error };

    const { data, error } = await supabaseAdmin.rpc("close_pending_payment", {
      p_payment_id: id.data,
      p_user_id: null,
    });
    if (error) {
      console.error("close_pending_payment failed:", error.code);
      return { error: "Lỗi hủy đơn" };
    }
    if (data !== true) return { error: "Đơn đã được xử lý" };

    revalidatePath("/admin/transactions");
    return { success: true };
  } catch {
    return { error: "Lỗi hủy đơn" };
  }
}
