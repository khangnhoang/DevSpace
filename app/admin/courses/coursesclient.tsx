"use client";
import { useState } from "react";
import { SquarePen, X, Trash } from "lucide-react";
import Image from "next/image";
import {
  type AdminCourseData,
  updateCourse,
  addCourse,
  deleteCourse,
} from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CoursesClientProps {
  courses: AdminCourseData[];
}

export default function CoursesClientPage({ courses }: CoursesClientProps) {
  const router = useRouter();
  const [isOpenForm, setIsOpenForm] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleClose = () => {
    setIsOpenForm(false);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleOpenAdd = () => {
    setEditId(null);
    setName("");
    setSlug("");
    setDesc("");
    setCurrentImageUrl("");
    setPrice(0);
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handleOpenEdit = (course: any) => {
    setEditId(course.id);
    setName(course.name);
    setSlug(course.slug);
    setDesc(course.description || "");
    setCurrentImageUrl(course.image_url || "");
    setPrice(course.price);
    setPreviewUrl(course.image_url);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // 1. Nếu xóa hết thì về 0 (tránh lỗi NaN)
    if (value === "") {
      setPrice(0);
      return;
    }

    // 2. Chỉ lấy số (dùng parseFloat để an toàn hơn Number)
    const numValue = parseFloat(value);

    // 3. Nếu là số hợp lệ thì mới cập nhật state
    if (!isNaN(numValue)) {
      setPrice(numValue);
    }
  };

  // Hàm format tiền tệ (VND) cho đẹp mắt
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleDelete = async (id: number, courseName: string) => {
    const confirmDelete = confirm(
      `CẢNH BÁO: Bạn có chắc muốn xoá khoá học "${courseName}" không?\n (Tất cả bài học và chương sẽ bị xoá vĩnh viễn)`
    );
    if (confirmDelete) {
      const { error } = await deleteCourse(id);
      if (error) {
        toast.error("Lỗi khi xoá:" + error.message);
      } else {
        toast.success("Xoá thành công");
        router.refresh();
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    let result;

    if (editId) {
      result = await updateCourse(
        editId,
        { name, slug, description: desc, image_url: currentImageUrl, price },
        selectedFile
      );
    } else {
      result = await addCourse(
        { name, slug, description: desc, price },
        selectedFile
      );
    }

    setIsSaving(false);

    if (result?.error) {
      toast.error("Lỗi cập nhật: " + result.error.message);
    } else {
      toast.success(editId ? "Cập nhật thành công" : "Thêm khóa học thành công");
      setIsOpenForm(false);
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="font-bold text-2xl md:ml-10">
            Các khóa học hiện có:{" "}
          </h1>
          <button
            onClick={handleOpenAdd}
            className="text-md font-bold bg-[#191C24] p-2 rounded-md hover:opacity-80 cursor-pointer w-full sm:w-auto"
          >
            Thêm khóa học
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10 px-4 md:px-10">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-center items-center rounded-xl w-full overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <div className="relative w-full h-48 sm:h-56 lg:h-60">
                <Image
                  src={course.image_url}
                  alt={course.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="flex justify-between items-center w-full bg-[#222630]">
                <p className="text-white p-3 uppercase font-semibold  truncate px-4">
                  {course.name}
                </p>

                <p className="text-white p-3 font-semibold truncate px-4">
                  {formatCurrency(course.price)}
                </p>
              </div>
              <div className="flex justify-between items-center p-3 w-full border-t border-gray-600 bg-[#222630]">
                <p className="text-sm text-gray-300">
                  {course.lessonCount} bài học
                </p>
                <div className="flex items-center gap-3">
                  <Trash
                    size={20}
                    className="cursor-pointer hover:text-red-500 transition-colors"
                    onClick={() => handleDelete(course.id, course.name)}
                  />
                  <SquarePen
                    size={20}
                    className="cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={() => handleOpenEdit(course)}
                  />
                </div>
              </div>
            </div>
          ))}

          {isOpenForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#191C24] w-full sm:w-[80%] md:w-[60%] lg:w-[40%] rounded-xl p-5 shadow-2xl border border-gray-700 relative flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5 top-0 bg-[#191C24] z-10 pb-2 border-b border-gray-700">
                  <h1 className="text-xl font-bold text-white mb-4">
                    {editId ? "Chỉnh sửa khóa học" : "Thêm khóa học mới"}
                  </h1>
                  <div className="flex items-center gap-4">
                    <button
                      className="bg-[#4A5565] p-1 rounded-md cursor-pointer hover:opacity-80"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving
                        ? "Đang lưu..."
                        : editId
                        ? "Lưu thay đổi"
                        : "Thêm khóa học"}
                    </button>
                    <button
                      className=" text-gray-400 hover:text-white cursor-pointer"
                      onClick={handleClose}
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col p-2 gap-2">
                  <p>Tên khóa học: </p>
                  <input
                    type="text"
                    className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Đường dẫn: </p>
                  <input
                    type="text"
                    className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Giá: </p>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none"
                    value={price}
                    onChange={handlePriceChange}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  <p className="text-xs text-gray-400 italic">
                    Hiển thị: {formatCurrency(price)}
                  </p>
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Chú thích: </p>
                  <input
                    type="text"
                    className="border border-[#4A5565] rounded-md p-2 w-full focus:outline-none"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
                <div className="flex flex-col p-2 gap-2">
                  <p>Ảnh khóa học: </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="text-white border border-gray-500 rounded-md p-2 w-full cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                  />
                  {previewUrl && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1 uppercase">
                        Xem trước:
                      </p>
                      <div className="w-full h-48 relative rounded-lg overflow-hidden border border-gray-600">
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
