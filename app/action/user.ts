"use server";

import { createClient } from "@supabase/supabase-js";

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