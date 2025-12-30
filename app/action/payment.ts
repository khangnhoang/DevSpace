"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi hệ thống trong quá trình xử lý" };
  }
}
