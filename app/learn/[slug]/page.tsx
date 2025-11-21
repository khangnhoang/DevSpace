// app/learn/[slug]/page.tsx
import { supabase } from "@/lib/supabase";
import LessonContent from "@/app/components/LessonContent";
import { notFound } from "next/navigation"; // Hàm dùng để chuyển hướng sang trang 404

interface Props {
  params: Promise<{ slug: string }>;
}

// Nhớ thêm 'async'
export default async function LearnPage({ params }: Props) {
  const { slug } = await params;

  // --- GỌI DATABASE (REAL DATA) ---
  const { data: lesson, error } = await supabase
    .from('lessons')         // Tên bảng trong ảnh bạn gửi
    .select('*')             // Lấy hết cột
    .eq('slug', slug)        // WHERE slug = ...
    .single();               // LIMIT 1

  // --- XỬ LÝ LỖI ---
  if (error || !lesson) {
    console.error("Lỗi tìm bài học:", error);
    // Cách 1: Hiện thông báo lỗi đơn giản
    return (
      <div className="p-10 text-center text-red-500">
        <h1 className="text-2xl font-bold">404 - Không tìm thấy bài học</h1>
        <p>Slug {slug} không tồn tại trong Database.</p>
      </div>
    );
    
    // Cách 2 (Nâng cao): Chuyển thẳng sang trang Not Found mặc định của Next.js
    // return notFound(); 
  }

  return (
    <div className="w-full p-8 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn / <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      {/* Khung nội dung */}
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200">
        
        {/* Tiêu đề bài học lấy từ DB */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-4 border-b">
            {lesson.title}
        </h1>

        {/* Nội dung Markdown render qua MDX */}
        <LessonContent content={lesson.content} />
        
      </div>
    </div>
  );
}