"use client";
import { useState, useEffect } from "react";
import { SquarePen, Trash } from "lucide-react";
import Image from "next/image";
import {
  type AdminCourseData,
  deleteCourse,
  getInstructors, // 👈 Nhớ import hàm mới này
} from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { NO_COURSE_IMAGE } from "@/lib/constants";
import CourseFormDialog, { type InstructorData } from "./CourseFormDialog";
import { formatCurrency } from "../_lib/format-currency";

interface CoursesClientProps {
  courses: AdminCourseData[];
}

export default function CoursesClientPage({ courses }: CoursesClientProps) {
  const router = useRouter();
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCourseData | null>(
    null,
  );

  // null = the add form; a course = the edit form of that course
  const [formCourse, setFormCourse] = useState<AdminCourseData | null>(null);

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

  const handleDelete = async (id: number) => {
    const { error } = await deleteCourse(id);
    if (error) {
      toast.error("Lỗi khi xoá:" + error.message);
    } else {
      toast.success("Xoá thành công");
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="font-bold text-2xl md:ml-10">Các khóa học hiện có:</h1>
          <button
            onClick={() => {
              setFormCourse(null);
              setIsOpenForm(true);
            }}
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
                  <button
                    type="button"
                    aria-label={`Xoá khoá học ${course.name}`}
                    className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => setDeleteTarget(course)}
                  >
                    <Trash size={20} />
                  </button>
                  <SquarePen
                    size={20}
                    className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors"
                    onClick={() => {
                      setFormCourse(course);
                      setIsOpenForm(true);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {isOpenForm && (
            <CourseFormDialog
              course={formCourse}
              instructors={instructors}
              onClose={() => setIsOpenForm(false)}
            />
          )}
        </div>
      </div>
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          tone="admin"
          destructive
          title="Xoá khoá học"
          description={`CẢNH BÁO: Bạn có chắc muốn xoá khoá học "${deleteTarget.name}" không? Toàn bộ chương, bài học, lượt đăng ký, đơn thanh toán và đánh giá của khoá học sẽ bị xoá vĩnh viễn.`}
          confirmLabel="Xoá khoá học"
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}
