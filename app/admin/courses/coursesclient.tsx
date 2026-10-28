"use client";
import { useState, useEffect } from "react";
import { SquarePen, X, Trash, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  type AdminCourseData,
  updateCourse,
  addCourse,
  deleteCourse,
  getInstructors, // 👈 Nhớ import hàm mới này
} from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NO_COURSE_IMAGE } from "@/lib/constants";

interface CoursesClientProps {
  courses: AdminCourseData[];
}

// Result of addCourse, which may also carry the failed instructor insert.
interface WithInsertError {
  insertError?: { message?: string };
}

// Type cho giảng viên
interface InstructorData {
  id: number;
  profiles: {
    full_name: string | null;
  } | null;
}

export default function CoursesClientPage({ courses }: CoursesClientProps) {
  const router = useRouter();
  const [isOpenForm, setIsOpenForm] = useState(false);

  // State Form
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [instructorId, setInstructorId] = useState<number | null>(null); // 👈 State Giảng viên

  // State UI/File
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State Data Dropdown
  const [instructors, setInstructors] = useState<InstructorData[]>([]);

  // 1. Fetch danh sách giảng viên khi mở trang
  useEffect(() => {
    const fetchIns = async () => {
      const { data } = await getInstructors();
      if (data) setInstructors(data as unknown as InstructorData[]);
    };
    fetchIns();
  }, []);

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
    setInstructorId(null); // Reset
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handleOpenEdit = (course: AdminCourseData) => {
    setEditId(course.id);
    setName(course.name);
    setSlug(course.slug);
    setDesc(course.description || "");
    setCurrentImageUrl(course.image_url || "");
    setPrice(course.price);
    setInstructorId(course.instructor_id || null); // Load giảng viên cũ
    setPreviewUrl(course.image_url);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setPrice(0);
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setPrice(numValue);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "Miễn phí";

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleDelete = async (id: number, courseName: string) => {
    const confirmDelete = confirm(
      `CẢNH BÁO: Bạn có chắc muốn xoá khoá học "${courseName}" không?\n (Tất cả bài học và chương sẽ bị xoá vĩnh viễn)`,
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

    const payload = {
      name,
      slug,
      description: desc,
      price,
      instructor_id: instructorId, // Gửi kèm instructor_id
      image_url: currentImageUrl, // Dùng cho update
    };

    if (editId) {
      result = await updateCourse(editId, payload, selectedFile);
    } else {
      // Đối với add, bỏ image_url khỏi payload truyền vào vì hàm add tự xử lý
      // Nhưng để code gọn ta truyền object tương tự
      result = await addCourse(payload, selectedFile);
    }

    setIsSaving(false);

    if (result?.error || (result as WithInsertError | undefined)?.insertError) {
      toast.error(
        "Lỗi cập nhật: " +
          (result?.error?.message || (result as WithInsertError | undefined)?.insertError?.message),
      );
    } else {
      toast.success(
        editId ? "Cập nhật thành công" : "Thêm khóa học thành công",
      );
      setIsOpenForm(false);
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="font-bold text-2xl md:ml-10">Các khóa học hiện có:</h1>
          <button
            onClick={handleOpenAdd}
            className="text-md font-bold bg-[#191C24] p-2 rounded-md hover:opacity-80 cursor-pointer w-full sm:w-auto text-white"
          >
            Thêm khóa học
          </button>
        </div>

        {/* LIST COURSES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10 px-4 md:px-10">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-center items-center rounded-xl w-full overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-[#222630]"
            >
              <div className="relative w-full h-48 sm:h-56 lg:h-60">
                <Image
                  src={course.image_url || NO_COURSE_IMAGE}
                  alt={course.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="flex justify-between items-center w-full bg-[#222630]">
                <p className="text-white p-3 uppercase font-semibold truncate px-4 flex-1">
                  {course.name}
                </p>
                <p className="text-white p-3 font-semibold truncate px-4 bg-black/20">
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
                    className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => handleDelete(course.id, course.name)}
                  />
                  <SquarePen
                    size={20}
                    className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors"
                    onClick={() => handleOpenEdit(course)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* MODAL FORM */}
          {isOpenForm && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#191C24] w-full sm:w-[90%] md:w-[70%] lg:w-[50%] rounded-xl p-6 shadow-2xl border border-gray-700 relative flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header Modal */}
                <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-4 sticky top-0 bg-[#191C24] z-10">
                  <h1 className="text-xl font-bold text-white">
                    {editId ? "Chỉnh sửa khóa học" : "Thêm khóa học mới"}
                  </h1>
                  <button
                    className="text-gray-400 hover:text-white cursor-pointer hover:bg-white/10 p-1 rounded-full transition"
                    onClick={handleClose}
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Form Layout Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cột 1 */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <p className="text-gray-300 text-sm">
                        Tên khóa học <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="text"
                        placeholder="VD: Lập trình ReactJS..."
                        className="bg-[#2A303C] border border-gray-600 text-white rounded-lg p-2.5 w-full focus:outline-none focus:border-blue-500 transition"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-gray-300 text-sm">
                        Slug (URL) <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="text"
                        placeholder="VD: lap-trinh-reactjs"
                        className="bg-[#2A303C] border border-gray-600 text-white rounded-lg p-2.5 w-full focus:outline-none focus:border-blue-500 transition"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-gray-300 text-sm">
                        Giá khóa học (VND)
                      </p>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className="bg-[#2A303C] border border-gray-600 text-white rounded-lg p-2.5 w-full focus:outline-none focus:border-blue-500 transition"
                        value={price}
                        onChange={handlePriceChange}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                      <p className="text-xs text-blue-400 text-right">
                        {formatCurrency(price)}
                      </p>
                    </div>
                  </div>

                  {/* Cột 2 */}
                  <div className="flex flex-col gap-4">
                    {/* 👇 SELECT GIẢNG VIÊN */}
                    <div className="flex flex-col gap-2">
                      <p className="text-gray-300 text-sm">
                        Giảng viên phụ trách
                      </p>
                      <select
                        className="bg-[#2A303C] border border-gray-600 text-white rounded-lg p-2.5 w-full focus:outline-none focus:border-blue-500 transition appearance-none"
                        value={instructorId || ""}
                        onChange={(e) =>
                          setInstructorId(Number(e.target.value) || null)
                        }
                      >
                        <option value="">-- Chọn giảng viên --</option>
                        {instructors.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.profiles?.full_name || `Giảng viên #${ins.id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Upload ảnh (Thu gọn lại) */}
                    <div className="flex flex-col gap-2">
                      <p className="text-gray-300 text-sm">Ảnh đại diện</p>
                      <div className="cursor-pointer border border-dashed border-gray-600 rounded-lg p-4 bg-[#2A303C]/50 text-center relative hover:bg-[#2A303C] transition">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="z-10 absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {previewUrl ? (
                          <div className="w-full aspect-video relative rounded-lg overflow-hidden border border-gray-600 bg-black/40">
                            <Image
                              src={previewUrl}
                              alt="Preview"
                              fill
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-gray-400 py-4 text-sm">
                            Kéo thả hoặc click để chọn ảnh
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mô tả (Full width) */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <p className="text-gray-300 text-sm">Mô tả ngắn</p>
                    <textarea
                      rows={3}
                      className="bg-[#2A303C] border border-gray-600 text-white rounded-lg p-2.5 w-full focus:outline-none focus:border-blue-500 transition resize-none"
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    className="cursor-pointer px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition"
                    onClick={handleClose}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="animate-spin" size={18} />}
                    {editId ? "Lưu thay đổi" : "Thêm mới"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
