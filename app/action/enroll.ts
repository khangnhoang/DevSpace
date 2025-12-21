"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    revalidatePath(`/courses/${course.slug}`);

    return { success: true, slug: course.slug };
  } catch (error) {
    console.error(error);
    return { error: "Lỗi hệ thống" };
  }
}
