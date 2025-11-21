// app/learn/[slug]/page.tsx
import LessonContent from "@/app/components/LessonContent";

interface Props {
  params: {
    slug: string;
  };
}

export default async function LearnPage({ params }: Props) {
  // 1. Lấy slug từ URL (Ví dụ: html-basic)
  const { slug } = await params;

  // 2. Tạo dữ liệu giả (Mock Data) bằng Markdown để test
  // (Lưu ý dùng dấu huyền ` để bao chuỗi)
  const mockContent = `
# Bài học: ${slug}

Chào mừng đến với **W3Schools Clone**.
Đây là nội dung được viết bằng **Markdown** và render bằng **Next.js**.

## 1. Thẻ tiêu đề (Heading)
Ở trên là H1, đây là H2. Cấu trúc rất rõ ràng.

## 2. Danh sách (List)
* Dễ học
* Dễ làm
* Code sạch

## 3. Code Snippet (Quan trọng nhất)
Thử xem đoạn code dưới đây có nền đen chữ trắng không nhé:

\`\`\`javascript
function testCode() {
  console.log("Hello World!");
  return "Success";
}
\`\`\`

> Ghi chú: Nếu bạn thấy cái hộp này màu xám và chữ đẹp, nghĩa là thành công!
  `;

  return (
    <div className="w-full p-8 min-h-screen bg-gray-50">
      {/* Breadcrumb nhỏ xinh */}
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn / <span className="font-bold text-blue-600">{slug}</span>
      </div>

      {/* Khung chứa bài học màu trắng */}
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200">
        <LessonContent content={mockContent} />
      </div>
    </div>
  );
}