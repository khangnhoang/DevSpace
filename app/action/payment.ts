"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

export async function createPendingPayment(courseId: number, userId: string) {
  try {
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPayment) {
      return {
        success: true,
        paymentId: existingPayment.id,
        amount: existingPayment.amount,
        isResumed: true,
      };
    }

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("price")
      .eq("id", courseId)
      .single();

    if (!course) return { error: "Khóa học không tồn tại" };

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: userId,
        course_id: courseId,
        status: "pending",
        amount: course.price,
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
  userId: string
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
    `
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
    // 1. Lấy thông tin đơn hàng hiện tại
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (!payment) return { error: "Không tìm thấy giao dịch" };

    // 2. Cập nhật trạng thái thành success
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (updateError) return { error: "Lỗi cập nhật trạng thái payment" };

    // 3. Tự động thêm vào bảng Enrollments (Để user vào học được)
    // Check xem đã enroll chưa để tránh lỗi duplicate
    const { data: existingEnroll } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", payment.user_id)
      .eq("course_id", payment.course_id)
      .single();

    if (!existingEnroll) {
      const { error: enrollError } = await supabaseAdmin
        .from("enrollments")
        .insert({
          user_id: payment.user_id,
          course_id: payment.course_id,
        });

      if (enrollError)
        return { error: "Lỗi kích hoạt khóa học: " + enrollError.message };
    }

    // 4. (Optional) Gửi thông báo cho User: "Admin đã duyệt đơn của bạn"
    // Ông có thể tái sử dụng bảng notifications ở đây nếu muốn

    revalidatePath("/admin/transactions"); // Refresh dữ liệu trang admin
    return { success: true };
  } catch (error) {
    console.error(error);
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
