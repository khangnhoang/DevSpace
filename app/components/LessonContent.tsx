// components/LessonContent.tsx
import { MDXRemote } from 'next-mdx-remote/rsc';

interface Props {
  content: string; // Nhận vào chuỗi nội dung bài học
}

export default function LessonContent({ content }: Props) {
  return (
    // Class 'prose': Kích hoạt plugin typography vừa cài ở Bước 2
    // lg:prose-xl: Chữ to rõ ràng trên màn hình lớn
    // max-w-none: Để nội dung tràn hết chiều ngang container
    // prose-pre:bg-gray-900: Cái khung code màu đen cho ngầu
    <article className="prose lg:prose-xl max-w-none prose-headings:text-blue-700 prose-pre:bg-gray-900 prose-pre:text-white">

      {/* Đây là hàm dịch Markdown -> HTML */}
      <MDXRemote source={content} />

    </article>
  );
}