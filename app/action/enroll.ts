"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 👇 1. Thêm hàm gửi thông báo (Copy từ payment.ts qua)
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

    const notifications = admins.map((admin) => ({
      receiver_id: admin.id,
      actor_id: userId,
      title: "Đăng ký khóa học mới",
      message,
      link: `/admin`,
      type: "enrollment",
      is_read: false,
    }));

    await supabaseAdmin.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Lỗi gửi thông báo đến admin:", error);
  }
}

export async function enrollCourse(
  courseId: number,
  userId: string,
  price: number
) {
  try {
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("price, slug")
      .eq("id", courseId)
      .single();

    if (!course) return { error: "Khóa học không tồn tại" };

    if (course.price === 0) {
      // Khóa học miễn phí -> OK
    } else {
      if (price !== course.price) {
        return { error: "Giá tiền không hợp lệ" };
      }
    }

    const { error } = await supabaseAdmin.from("enrollments").insert({
      user_id: userId,
      course_id: courseId,
    });

    if (error) {
      return { error: error.message };
    }

    // 👇 2. GỌI HÀM BẮN THÔNG BÁO Ở ĐÂY
    await sendAdminNotification(userId, courseId);

    revalidatePath(`/courses/${course.slug}`);

    return { success: true, slug: course.slug };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi hệ thống" };
  }
}
