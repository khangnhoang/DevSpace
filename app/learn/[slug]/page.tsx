interface Props {
  params: {
    slug: string; // Tên biến 'slug' phải khớp với tên thư mục [slug]
  };
}

export default async function LearnPage({ params }: Props) {
  // Destructuring để lấy slug ra cho gọn
  const { slug } = await params;

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold text-blue-600 mb-4">
        Trang chi tiết bài học
      </h1>
      
      <p className="text-gray-700 mb-4">
        Bạn đang truy cập vào đường dẫn có slug là:
      </p>
      
      {/* Hiển thị slug ra màn hình để test */}
      <div className="bg-gray-100 p-4 rounded border border-gray-300 font-mono text-lg">
        {slug}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        (Sau này nội dung bài học lấy từ Database sẽ nhét vào đây)
      </p>
    </div>
  );
}

