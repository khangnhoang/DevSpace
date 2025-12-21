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
      toast("Vui lòng chọn khóa học trước khi thêm chương!");
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
      toast("Vui lòng điền đầy đủ thông tin!");
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
      toast("Đã có lỗi xảy ra: " + result.error.message);
    } else {
      toast(
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
      toast("Đã có lỗi xảy ra: " + result.error.message);
    } else {
      toast("Xóa chương thành công!");
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

  return (
    <div className="bg-[#0F1116] w-full h-full">
      <div className="p-4 flex flex-col gap-6">
        <div className="flex justify-between">
          <div>
            <h1 className="text-3xl flex items-center gap-2">
              <Layers className="text-[#3B81F4]" size={30} />
              Quản lý chương học
            </h1>
            <p className="text-sm text-gray-400">
              Sắp xếp và tổ chức nội dung bài học theo cấu trúc.
            </p>
          </div>
          <div className="flex items-center">
            <button
              className="bg-[#3B81F4] p-4 rounded-md hover:bg-[#2563EB] cursor-pointer flex items-center"
              onClick={handleOpenAdd}
            >
              <Plus size={20} />
              Thêm chương mới
            </button>
          </div>
        </div>
        <div className="bg-[#0F1116]">
          <div className="bg-[#191C24] flex p-4 gap-2 items-center rounded-xl">
            <div className="flex items-center gap-2 w-1/2 bg-[#2C3039] h-1/2 p-4 rounded-xl">
              <BookOpen className="text-[#3B81F4]" size={20} />
              <div className="flex flex-col">
                <p className="text-sm text-gray-400">KHÓA HỌC HIỆN TẠI</p>
                <p className="text-md font-bold">HTML & CSS Cơ bản</p>
              </div>
            </div>
            <div className="w-1/2 flex flex-col gap-3">
              <p className="text-sm text-gray-400">CHUYỂN KHÓA HỌC</p>
              <select
                name=""
                id=""
                className="bg-[#2C3039] text-md p-3 rounded-md w-full uppercase"
                value={selectedCourseId || ""}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              >
                <option className="uppercase" value="">
                  Chọn khóa học
                </option>
                {courses.map((course) => (
                  <option
                    className="uppercase"
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
      <div>
        <div className="w-full p-4">
          <table className="w-full rounded-xl border border-gray-700 overflow-hidden">
            <thead className="text-left w-full">
              <tr className="bg-[#222732] text-[#999C9E]">
                <th scope="col" className="px-6 py-6 text-md">
                  ID
                </th>
                <th scope="col" className="px-6 py-6 text-md">
                  TÊN CHƯƠNG
                </th>
                <th scope="col" className="px-6 py-6 text-md">
                  THỨ TỰ
                </th>
                <th scope="col" className="px-6 py-6 text-md">
                  NGÀY TẠO
                </th>
                <th scope="col" className="px-6 py-6 text-md">
                  HÀNH ĐỘNG
                </th>
              </tr>
            </thead>
            {
              <tbody className="bg-[#191C24]">
                {filteredChapters.map((chapter) => (
                  <tr key={chapter.id} className="border border-gray-700">
                    <td className="px-6 py-6">
                      <div className="border flex justify-center rounded-md border-gray-700 bg-[#2C3039]">
                        {chapter.id}
                      </div>
                    </td>
                    <td className="px-6 py-6">{chapter.title}</td>
                    <td className="px-6 py-6">{chapter.order_index}</td>
                    <td className="px-6 py-6">{chapter.created_at}</td>
                    <td className="px-6 py-6 flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(chapter)}
                        className="cursor-pointer hover:bg-blue-500 hover:text-white p-2 rounded-md text-[#979EAA]"
                      >
                        <SquarePen size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(chapter)}
                        className="cursor-pointer hover:bg-red-500 hover:text-white p-2 rounded-md text-[#979EAA]"
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
      {isOpenForm && (
        <div className="flex flex-col justify-center items-center fixed inset-0 z-50">
          <div className="w-1/2 bg-[#222732] flex justify-between items-center p-4 rounded-t-md">
            <h1 className="text-xl flex items-center gap-2">
              {editingChapterId ? (
                <SquarePen className="" size={20} />
              ) : (
                <Plus className="text-green-400" size={20} />
              )}
              {editingChapterId ? "Chỉnh Sửa Chương" : "Thêm Chương Mới"}
            </h1>
            <button onClick={() => setIsOpenForm(false)}>
              <X
                size={30}
                className="hover:bg-[#374151] cursor-pointer rounded-md p-1"
              />
            </button>
          </div>
          <div className="w-1/2 bg-[#191C24] flex flex-col gap-2 p-4 text-[#747985]">
            <p className="text-sm">TÊN CHƯƠNG</p>
            <input
              type="text"
              placeholder="Nhập tên chương..."
              className="p-2 bg-[#2C3039] rounded-md"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-sm">THỨ TỰ HIỂN THỊ</p>
            <input
              type="number"
              name=""
              id=""
              className="p-2 bg-[#2C3039] rounded-md"
              value={orderIndex || ""}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
            />
            <p className="text-sm">THUỘC KHÓA HỌC</p>
            <select
              className="p-2 bg-[#2C3039] rounded-md uppercase"
              name=""
              id=""
              value={selectedEditCourseId || ""}
              onChange={(e) => setSelectedEditCourseId(Number(e.target.value))}
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((course) => (
                <option value={course.id} key={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-1/2 bg-[#222732] flex justify-end gap-2 p-3 rounded-b-md">
            <button
              className="hover:bg-[#374151] cursor-pointer p-2 rounded-md text-sm"
              onClick={() => setIsOpenForm(false)}
            >
              HỦY
            </button>
            <button
              onClick={handleSave}
              className="hover:bg-[#2563eb] cursor-pointer p-2 rounded-md text-sm bg-blue-400"
            >
              {editingChapterId ? "Cập nhật" : "Thêm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
