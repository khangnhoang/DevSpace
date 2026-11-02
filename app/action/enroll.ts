"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth.server";
import { courseIdSchema } from "@/lib/schemas/enrollment";
import { parseFailure } from "@/lib/schemas/parse-failure";

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

export async function enrollCourse(courseId: number) {
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) return { error: parseFailure(parsed.error) };
  const validCourseId = parsed.data;

  try {
    const auth = await requireUser();
    if ("error" in auth) return { error: auth.error };
    const userId = auth.user.id;

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("price, slug")
      .eq("id", validCourseId)
      .single();

    if (!course) return { error: "Khóa học không tồn tại" };

    // Paid courses are enrolled only through approvePayment (admin).
    if (course.price !== 0) {
      return { error: "Khóa học có phí, vui lòng thanh toán để đăng ký" };
    }

    const { error } = await supabaseAdmin.from("enrollments").insert({
      user_id: userId,
      course_id: validCourseId,
    });

    if (error) {
      // 23505: enrollments_user_course_unique, the learner is already enrolled.
      if (error.code === "23505") return { error: "Bạn đã đăng ký khóa học này." };
      console.error("Lỗi đăng ký khóa học:", error.message);
      return { error: "Không thể đăng ký khóa học. Vui lòng thử lại." };
    }

    await sendAdminNotification(userId, validCourseId);

    revalidatePath(`/courses/${course.slug}`);

    return { success: true, slug: course.slug };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi hệ thống" };
  }
}
