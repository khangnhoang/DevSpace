"use client";
import { useState } from "react";
import { SquarePen, X, Trash } from "lucide-react";
import Image from "next/image";
import { type AdminCourseData, updateCourse } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

  const handleOpenEdit = (course: any) => {
    setEditId(course.id);
    setName(course.name);
    setSlug(course.slug);
    setDesc(course.description || "");
    setCurrentImageUrl(course.image_url || "");
    setPreviewUrl(course.image_url);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handleSave = async () => {
    if (!editId) return;
    setIsSaving(true);

    const { error } = await updateCourse(
      editId,
      { name, slug, description: desc, image_url: currentImageUrl },
      selectedFile
    );

    setIsSaving(false);

    if (error) {
      alert("Lỗi cập nhật: " + error.message);
    } else {
      alert("Cập nhật thành công");
      setIsOpenForm(false);
      router.refresh();
    }
  };

  return (
    <div>
      <div className="w-full p-4">
        <h1 className="font-bold text-2xl">Các khóa học hiện có: </h1>
        <div className="flex gap-4 py-4 px-2">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-center items-center bg-[#191C24] text-white rounded-xl w-1/4"
            >
              <div className="relative w-full h-60">
                <Image
                  src={course.image_url}
                  alt={course.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <p className="bg-[#191C24] text-white w-full flex justify-center rounded-b-xl p-2 uppercase">
                {course.name}
              </p>
              <div className="flex justify-between p-3 w-full border-t border-gray-400">
                <p className="">{course.lessonCount} bài học</p>
                <div className="flex items-center gap-3">
                  <Trash
                    size={20}
                    className="cursor-pointer hover:opacity-80"
                  />
                  <SquarePen
                    size={20}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => handleOpenEdit(course)}
                  />
                </div>
              </div>
            </div>
          ))}

          {isOpenForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-[#191C24] w-1/2 rounded-xl p-4 shadow-lg border-gray-700 relative flex flex-col">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-white mb-4">
                    Chỉnh sửa khóa học
                  </h1>
                  <div className="flex items-center gap-4">
                    <button
                      className="bg-[#4A5565] p-1 rounded-md cursor-pointer hover:opacity-80"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
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
                      <p className="text-sm text-gray-400 mb-1">Xem trước:</p>
                      <div className="w-full h-40 relative">
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
