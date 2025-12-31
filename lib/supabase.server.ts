import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 1. Phải thêm từ khóa 'async' vào hàm export
export async function createSupabaseServerClient() {
  // 2. Phải 'await' cookies() vì trong Next.js mới nó là Promise
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 3. Sửa 'get' thành 'getAll' theo chuẩn mới của Supabase
        getAll() {
          return cookieStore.getAll();
        },
        // Thêm setAll để tránh lỗi type (dù server component không set được cookie)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component không thể set cookie, bỏ qua lỗi này là an toàn
          }
        },
      },
    }
  );
}