"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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
}){
    const {data, error} = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password || '123123',
        email_confirm: true,
        user_metadata: {
            full_name: formData.fullName,
            avatar_url: formData.avatarUrl,
            role: formData.role,
        },
    });

    if (error){
        console.error('Lỗi tạo user: ', error.message)
        return { error: error.message}
    }

    return { success: true, userId: data.user.id};
}

export async function deleteUserAccount(userId: string) {
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