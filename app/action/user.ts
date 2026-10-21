"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth.server";

// Khởi tạo Supabase Admin Client (Chỉ dùng ở Server Action)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function createNewUser(formData: {
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string;
  password?: string;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!formData.password || formData.password.length < 8) {
    return { error: "Mật khẩu phải có ít nhất 8 ký tự" };
  }
  if (formData.role !== "user" && formData.role !== "admin") {
    return { error: "Vai trò không hợp lệ" };
  }

  // The role is deliberately not sent as metadata: the DB trigger always
  // creates profiles with role 'user'; admins are promoted below.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      full_name: formData.fullName,
      avatar_url: formData.avatarUrl,
    },
  });

  if (error) {
    console.error("Lỗi tạo user: ", error.message);
    return { error: error.message };
  }

  if (formData.role === "admin") {
    const { error: roleError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.user.id);

    if (roleError) {
      console.error("Lỗi gán quyền admin: ", roleError.message);
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      return { error: "Không thể gán quyền admin cho người dùng mới" };
    }
  }

  return { success: true, userId: data.user.id };
}

export async function deleteUserAccount(userId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  try {
    // 1. Xóa trong auth.users (Gốc rễ)
    // Khi xóa cái này, bảng profiles sẽ tự bay màu theo (nếu profile có FK trỏ về auth.users với ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Lỗi xóa user:", error);
    return { error: "Lỗi hệ thống khi xóa user" };
  }
}