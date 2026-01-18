"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendSuccessEmail } from "./email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function sendAdminNotification(userId: string, courseId: number) {
  try {
    const [adminRes, userRes, courseRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").eq("role", "admin"),
      supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("courses")
        .select("name")
        .eq("id", courseId)
        .maybeSingle(),
    ]);

    const admins = adminRes.data;
    const user = userRes.data;
    const course = courseRes.data;

    if (!admins || !admins.length || !user || !course) {
      console.error("Không tìm thấy admin, người dùng hoặc khóa học");
      return;
    }

    const userName = user.full_name || "Một học viên";
    const message = `${userName} đã đăng ký khóa học ${course.name}`;

    const nofitications = admins.map((admin) => ({
      receiver_id: admin.id,
      actor_id: userId,
      title: "Đăng ký khóa học mới",
      message,
      link: `/admin`,
      type: "enrollment",
      is_read: false,
    }));

    await supabaseAdmin.from("notifications").insert(nofitications);
  } catch (error) {
    console.error("Lỗi gửi thông báo đến admin:", error);
  }
}

export async function updatePaymentWithCoupon(
  paymentId: number,
  couponCode: string,
) {
  try {
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("course_id, user_id, status")
      .eq("id", paymentId)
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
    if (!coupon || coupon.used_count >= coupon.max_uses)
      return { error: "Mã giảm giá không hợp lệ" };

    const discountAmount = (course.price * coupon.discount_percent) / 100;
    const finalAmount = Math.max(0, course.price - discountAmount);

    const { error } = await supabaseAdmin
      .from("payments")
      .update({ amount: finalAmount, updated_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) return { error: "Lỗi cập nhật giá" };

    return { success: true, newAmount: finalAmount };
  } catch (e) {
    return { error: "Lỗi hệ thống" };
  }
}

export async function createPendingPayment(
  courseId: number,
  userId: string,
  couponCode: string | null = null, // 👈 Thêm tham số này
) {
  try {
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
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentId);
    return { success: true };
  } catch (error) {
    return { error: "Lỗi hủy giao dịch" };
  }
}

export async function confirmPaymentAndEnroll(
  paymentId: number | null,
  courseId: number,
  userId: string,
) {
  if (!paymentId) return { error: "Thiếu mã giao dịch" };

  try {
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .select()
      .single();

    if (updateError)
      return { error: "Không thể cập nhật trạng thái thanh toán" };

    const { data: checkPayment } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .single();

    if (!checkPayment || checkPayment.status !== "success")
      return { error: "Thanh toán chưa hoàn tất, không thể đăng ký" };

    const { data: existingEnroll } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    if (existingEnroll) return { success: true };

    const { error: enrollError } = await supabaseAdmin
      .from("enrollments")
      .insert({
        user_id: userId,
        course_id: courseId,
      });

    if (enrollError)
      return { error: "Lỗi đăng ký khóa học" + enrollError.message };

    await sendAdminNotification(userId, courseId);

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi hệ thống trong quá trình xử lý" };
  }
}

export async function getAllPayments() {
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
      sendSuccessEmail(
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
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (error) return { error: error.message };

    revalidatePath("/admin/transactions");
    return { success: true };
  } catch (error) {
    return { error: "Lỗi hủy đơn" };
  }
}
