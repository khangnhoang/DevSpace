"use client";
import React, { useState, useEffect } from "react";
import { Layers, BookOpen, SquarePen, Trash, Plus } from "lucide-react";
import {
  getCourseChapterManager,
  getChapterForChapterManager,
  deleteChapter,
} from "@/lib/supabase";
import { toast } from "sonner";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import ChapterFormDialog from "./_components/ChapterFormDialog";

interface Course {
  id: number;
  name: string;
  slug: string;
}

interface Chapter {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  created_at: string;
}

export default function ChaptersManagerPage() {
  const [isOpenForm, setIsOpenForm] = useState(false);
  // null = the add form; a chapter = the edit form of that chapter
  const [formChapter, setFormChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const handleOpenAdd = () => {
    if (!selectedCourseId) {
      toast.warning("Vui lòng chọn khóa học trước khi thêm chương!");
      return;
    }
    setFormChapter(null);
    setIsOpenForm(true);
  };

  const handleOpenEdit = (chapter: Chapter) => {
    setFormChapter(chapter);
    setIsOpenForm(true);
  };
  const filteredChapters = chapters
    .filter((chapter) => chapter.course_id === selectedCourseId)
    .sort((a, b) => a.order_index - b.order_index);

  const handleSaved = async (courseId: number) => {
    const data = await getChapterForChapterManager();
    setChapters(data);
    setSelectedCourseId(courseId);
  };

  const handleDelete = async (chapter: Chapter) => {
    const result = await deleteChapter(chapter.id);

    if (result.error) {
      toast.error("Đã có lỗi xảy ra: " + result.error.message);
    } else {
      toast.success("Xóa chương thành công!");
      const data = await getChapterForChapterManager();
      setChapters(data);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      const data = await getCourseChapterManager();
      setCourses(data);
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchChapters = async () => {
      const data = await getChapterForChapterManager();
      setChapters(data);
    };
    fetchChapters();
  }, []);

  // Chuyển đổi chuỗi ngày ISO sang định dạng dd/mm/yyyy dễ đọc cho người Việt
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="lg:px-3 bg-[#0F1116] w-full min-h-screen h-full font-sans text-slate-200">
      <div className="p-4 md:p-6 flex flex-col gap-6 w-full mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-0 w-full">
          <div>
            <h1 className="text-2xl md:text-3xl flex items-center gap-3 text-white font-bold tracking-tight">
              <Layers className="text-[#3B81F4]" size={30} />
              Quản lý chương học
            </h1>
            <p className="text-sm text-gray-400 mt-2 ml-1">
              Sắp xếp và tổ chức nội dung bài học theo cấu trúc.
            </p>
          </div>
          <div className="flex items-center">
            <button
              className="w-full md:w-auto bg-[#3B81F4] p-3 md:p-4 rounded-lg hover:bg-[#2563EB] cursor-pointer flex items-center justify-center gap-2 text-white transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              onClick={handleOpenAdd}
            >
              <Plus size={20} />
              Thêm chương mới
            </button>
          </div>
        </div>

        <div className="bg-[#0F1116]">
          <div className="bg-[#191C24] flex flex-col md:flex-row p-4 gap-4 items-center rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 bg-[#2C3039] h-1/2 p-4 rounded-xl w-full">
              <BookOpen className="text-[#3B81F4]" size={20} />
              <div className="flex flex-col overflow-hidden">
                <p className="text-xs text-gray-400 font-semibold tracking-wider mb-1">
                  KHÓA HỌC HIỆN TẠI
                </p>
                <p className="text-md font-bold">HTML & CSS Cơ bản</p>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex flex-col gap-2">
              <p className="text-xs text-gray-400 font-semibold tracking-wider px-1">
                CHUYỂN KHÓA HỌC
              </p>
              <div className="relative">
                <select
                  name=""
                  id=""
                  className="appearance-none bg-[#2C3039] text-white text-md p-3 pr-8 rounded-lg w-full uppercase border border-gray-700 focus:border-[#3B81F4] outline-none transition-all cursor-pointer hover:bg-[#353a45]"
                  value={selectedCourseId || ""}
                  onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                >
                  <option className="uppercase text-gray-400" value="">
                    Chọn khóa học
                  </option>
                  {courses.map((course) => (
                    <option
                      className="uppercase text-white bg-[#2C3039] py-2"
                      value={course.id}
                      key={course.id}
                    >
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="w-full rounded-xl border border-gray-800 overflow-hidden bg-[#191C24] shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-white min-w-[800px]">
              <thead className="text-left w-full bg-[#222732] border-b border-gray-700">
                <tr className="bg-[#222732] text-[#999C9E]">
                  <th
                    scope="col"
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                  >
                    TÊN CHƯƠNG
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center"
                  >
                    THỨ TỰ
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                  >
                    NGÀY TẠO
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right"
                  >
                    HÀNH ĐỘNG
                  </th>
                </tr>
              </thead>
              {
                <tbody className="divide-y divide-gray-800">
                  {filteredChapters.map((chapter) => (
                    <tr
                      key={chapter.id}
                      className="hover:bg-[#2C3039] transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-block px-3 py-1 text-xs font-mono text-gray-400 bg-[#222732] rounded border border-gray-700 group-hover:border-gray-500 transition-colors">
                          {chapter.id}
                        </div>
                      </td>
                      <td className="px-6 py-6">{chapter.title}</td>
                      <td className="px-6 py-6 flex justify-center">
                        {chapter.order_index}
                      </td>
                      <td className="px-6 py-6">
                        {formatDate(chapter.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleOpenEdit(chapter)}
                          className="p-2 rounded-lg hover:bg-blue-300 text-[#3B81F4] transition-all duration-200 cursor-pointer mr-3"
                        >
                          <SquarePen size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(chapter)}
                          aria-label={`Xóa chương ${chapter.title}`}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-300  transition-all duration-200 cursor-pointer"
                        >
                          <Trash size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              }
            </table>
          </div>
        </div>
      </div>
      {isOpenForm && (
        <ChapterFormDialog
          chapter={formChapter}
          defaultCourseId={selectedCourseId}
          courses={courses}
          onClose={() => setIsOpenForm(false)}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          tone="admin"
          destructive
          title="Xóa chương"
          description={`Bạn có chắc chắn muốn xóa chương "${deleteTarget.title}" không? Các bài học trong chương sẽ không còn thuộc chương nào. Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa chương"
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
