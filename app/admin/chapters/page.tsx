"use client";
import React, { useState, useEffect } from "react";
import { Layers, BookOpen, SquarePen, Trash, X, Plus } from "lucide-react";
import {
  getCourseChapterManager,
  getChapterForChapterManager,
  editChapter,
  addChapter,
  deleteChapter,
} from "@/lib/supabase";
import { toast } from "sonner";

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
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedEditCourseId, setSelectedEditCourseId] = useState<
    number | null
  >(null);
  const [title, setTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState<number | null>(null);

  const handleOpenAdd = () => {
    if (!selectedCourseId) {
      toast.warning("Vui lòng chọn khóa học trước khi thêm chương!");
      return;
    }
    setEditingChapterId(null);
    setSelectedEditCourseId(selectedCourseId);
    setTitle("");
    setOrderIndex(null);
    setIsOpenForm(true);
  };

  const handleOpenEdit = (chapter: Chapter) => {
    setEditingChapterId(chapter.id);
    setSelectedEditCourseId(chapter.course_id);
    setTitle(chapter.title);
    setOrderIndex(chapter.order_index);
    setIsOpenForm(true);
  };
  const filteredChapters = chapters
    .filter((chapter) => chapter.course_id === selectedCourseId)
    .sort((a, b) => a.order_index - b.order_index);

  const handleSave = async () => {
    if (!title || orderIndex === null || !selectedEditCourseId) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    const chapterData = {
      course_id: selectedEditCourseId,
      title: title,
      order_index: orderIndex,
    };

    let result;

    if (editingChapterId) {
      result = await editChapter(editingChapterId, chapterData);
    } else {
      result = await addChapter(chapterData);
    }

    if (result.error) {
      toast.error("Đã có lỗi xảy ra: " + result.error.message);
    } else {
      toast.success(
        editingChapterId
          ? "Cập nhật chương thành công!"
          : "Thêm chương thành công!"
      );
      setIsOpenForm(false);
      const data = await getChapterForChapterManager();
      setChapters(data);
      setSelectedCourseId(selectedEditCourseId);
    }
  };

  const handleDelete = async (chapter: Chapter) => {
    const confirmDelete = confirm(
      `Bạn có chắc chắn muốn xóa chương "${chapter.title}" không?`
    );
    if (!confirmDelete) return;

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
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
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
                <p className="text-xs text-gray-400 font-semibold tracking-wider mb-1">KHÓA HỌC HIỆN TẠI</p>
                <p className="text-md font-bold">HTML & CSS Cơ bản</p>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex flex-col gap-2">
              <p className="text-xs text-gray-400 font-semibold tracking-wider px-1">CHUYỂN KHÓA HỌC</p>
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
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  TÊN CHƯƠNG
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center">
                  THỨ TỰ
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  NGÀY TẠO
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">
                  HÀNH ĐỘNG
                </th>
              </tr>
            </thead>
            {
              <tbody className="divide-y divide-gray-800">
                {filteredChapters.map((chapter) => (
                  <tr key={chapter.id} className="hover:bg-[#2C3039] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-block px-3 py-1 text-xs font-mono text-gray-400 bg-[#222732] rounded border border-gray-700 group-hover:border-gray-500 transition-colors">
                        {chapter.id}
                      </div>
                    </td>
                    <td className="px-6 py-6">{chapter.title}</td>
                    <td className="px-6 py-6 flex justify-center">{chapter.order_index}</td>
                    <td className="px-6 py-6">{formatDate(chapter.created_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenEdit(chapter)}
                        className= "p-2 rounded-lg hover:bg-blue-300 text-[#3B81F4] transition-all duration-200 cursor-pointer mr-3"
                      >
                        <SquarePen size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(chapter)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg md:w-1/2 lg:w-1/3 bg-[#191C24] rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden transform transition-all scale-100">
            
            {/* Modal Header */}
            <div className="bg-[#222732] p-5 flex justify-between items-center border-b border-gray-700">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                {editingChapterId ? (
                  <SquarePen className="text-[#3B81F4]" size={20} />
                ) : (
                  <Plus className="text-green-500" size={20} />
                )}
                {editingChapterId ? "Chỉnh Sửa Chương" : "Thêm Chương Mới"}
              </h1>
              <button 
                onClick={() => setIsOpenForm(false)}
                className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Tên chương</label>
                 <input
                    type="text"
                    placeholder="Nhập tên chương..."
                    className="w-full p-3 bg-[#2C3039] text-white rounded-lg border border-gray-700 focus:border-[#3B81F4] focus:ring-1 focus:ring-[#3B81F4] outline-none transition-all placeholder-gray-500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                 />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Thứ tự hiển thị</label>
                <input
                    type="number"
                    placeholder="Ví dụ: 1"
                    className="w-full p-3 bg-[#2C3039] text-white rounded-lg border border-gray-700 focus:border-[#3B81F4] focus:ring-1 focus:ring-[#3B81F4] outline-none transition-all placeholder-gray-500"
                    value={orderIndex || ""}
                    onChange={(e) => setOrderIndex(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Thuộc khóa học</label>
                <div className="relative">
                    <select
                        className="w-full p-3 bg-[#2C3039] text-white rounded-lg uppercase border border-gray-700 focus:border-[#3B81F4] focus:ring-1 focus:ring-[#3B81F4] outline-none transition-all cursor-pointer appearance-none"
                        value={selectedEditCourseId || ""}
                        onChange={(e) => setSelectedEditCourseId(Number(e.target.value))}
                    >
                        <option value="">-- Chọn khóa học --</option>
                        {courses.map((course) => (
                        <option value={course.id} key={course.id} className="text-white bg-[#2C3039]">
                            {course.name}
                        </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                         <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#222732] p-5 flex justify-end gap-3 border-t border-gray-700">
              <button
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#374151] transition-colors"
                onClick={() => setIsOpenForm(false)}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#3B81F4] hover:bg-[#2563EB] shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {editingChapterId ? "Lưu Thay Đổi" : "Thêm Mới"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}