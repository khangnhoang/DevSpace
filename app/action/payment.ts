"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendSuccessEmail } from "@/lib/email.server";
import { requireAdmin, requireUser } from "@/lib/auth.server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function updatePaymentWithCoupon(
  paymentId: number,
  couponCode: string,
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };
    const user = auth.user;

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("course_id, user_id, status")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .single();
    if (!payment || payment.status !== "pending")
      return { error: "Đơn hàng không hợp lệ" };

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("price")
      .eq("id", payment.course_id)
      .single();
    if (!course) return { error: "Khóa học không tồn tại" };

    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("code", couponCode.toUpperCase())
      .eq("is_active", true)
      .single();
    if (!coupon) return { error: "Mã giảm giá không tồn tại hoặc đã hết hạn" };
    // max_uses null = unlimited
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return { error: "Mã này đã hết lượt sử dụng" };

    const discountAmount = (course.price * coupon.discount_percent) / 100;
    const finalAmount = Math.round(Math.max(0, course.price - discountAmount));

    const { data: updated, error } = await supabaseAdmin
      .from("payments")
      .update({ amount: finalAmount, updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id");
    if (error || !updated || updated.length === 0)
      return { error: "Lỗi cập nhật giá" };

    return {
      success: true,
      newAmount: finalAmount,
      discountPercent: coupon.discount_percent as number,
    };
  } catch {
    return { error: "Lỗi hệ thống" };
  }
}

export async function createPendingPayment(
  courseId: number,
  couponCode: string | null = null, // 👈 Thêm tham số này
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };
    const userId = auth.user.id;

    // 1. Check xem có đơn pending nào cũ không (logic cũ giữ nguyên)
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPayment) {
      // Nếu đơn cũ giá khác đơn mới (do mã giảm giá), có thể cân nhắc xóa đơn cũ tạo đơn mới
      // Nhưng để đơn giản, cứ return đơn cũ.
      return {
        success: true,
        paymentId: existingPayment.id,
        amount: existingPayment.amount,
        isResumed: true,
      };
    }

    // 2. Lấy giá gốc khóa học
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("price")
      .eq("id", courseId)
      .single();

    if (!course) return { error: "Khóa học không tồn tại" };

    let finalAmount = course.price;

    // 3. 👇 LOGIC MỚI: Xử lý mã giảm giá trên Server
    if (couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .single();

      // Check valid và còn lượt dùng
      if (coupon && coupon.used_count < coupon.max_uses) {
        const discount = (course.price * coupon.discount_percent) / 100;
        finalAmount = Math.max(0, course.price - discount);

        // (Optional) Update số lượng đã dùng +1 (Atomic update)
        await supabaseAdmin.rpc("increment_coupon_usage", {
          coupon_id: coupon.id,
        });
      }
    }

    // 4. Tạo Payment với giá finalAmount
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        course_id: courseId,
        status: "pending",
        amount: finalAmount, // 👈 LƯU GIÁ ĐÃ GIẢM
      })
      .select("id, amount")
      .single();

    if (error) return { error: error.message };

    return { success: true, paymentId: payment.id, amount: payment.amount };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi tạo giao dịch" };
  }
}

export async function cancelPayment(paymentId: number | null) {
  if (!paymentId) return { error: "Mã giao dịch không hợp lệ" };

  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };

    const { data: updated, error } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("user_id", auth.user.id)
      .eq("status", "pending")
      .select("id");
    if (error || !updated || updated.length === 0)
      return { error: "Không thể hủy giao dịch này" };
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

// 👇 HÀM MỚI: Admin duyệt đơn (Manual Approve)
export async function approvePayment(paymentId: number) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return { error: auth.error };

    // 1. Lấy thông tin Payment
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*, courses ( id, name, slug )") // Lấy ID khóa học để query bài học
      .eq("id", paymentId)
      .single();

    if (!payment) return { error: "Không tìm thấy giao dịch" };

    // 2. Lấy Profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", payment.user_id)
      .single();

    // 3. Update Status Payment
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (updateError) return { error: "Lỗi update payment" };

    // 4. Enroll (Logic giữ nguyên)
    const { data: existingEnroll } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", payment.user_id)
      .eq("course_id", payment.course_id)
      .single();

    if (!existingEnroll) {
      await supabaseAdmin.from("enrollments").insert({
        user_id: payment.user_id,
        course_id: payment.course_id,
      });
    }

    // 5. 👇 LOGIC MỚI: TÌM BÀI HỌC ĐẦU TIÊN
    // (Tìm Chapter đầu tiên -> Tìm Lesson đầu tiên của Chapter đó)
    let firstLessonSlug = null;

    // B1: Lấy chương đầu tiên
    const { data: firstChapter } = await supabaseAdmin
      .from("chapters")
      .select("id")
      .eq("course_id", payment.course_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .single();

    if (firstChapter) {
      // B2: Lấy bài học đầu tiên của chương đó
      const { data: firstLesson } = await supabaseAdmin
        .from("lessons")
        .select("slug")
        .eq("chapter_id", firstChapter.id)
        .order("order_index", { ascending: true }) // Hoặc order by id nếu không có order_index
        .limit(1)
        .single();

      if (firstLesson) {
        firstLessonSlug = firstLesson.slug;
      }
    }

    // 6. Gửi Email với link bài học chuẩn
    if (profile?.email) {
      await sendSuccessEmail(
        profile.email,
        profile.full_name || "Học viên",
        payment.courses?.name || "Khóa học",
        payment.courses?.slug || "",
        firstLessonSlug, // 👈 Truyền slug bài học vào đây
      );
    }

    revalidatePath("/admin/transactions");
    return { success: true };
  } catch (error) {
    console.error("Approve Error:", error);
    return { error: "Lỗi hệ thống" };
  }
}

// 👇 HÀM MỚI: Admin từ chối/Hủy đơn
export async function rejectPayment(paymentId: number) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return { error: auth.error };

    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (error) return { error: error.message };

    revalidatePath("/admin/transactions");
    return { success: true };
  } catch {
    return { error: "Lỗi hủy đơn" };
  }
}
