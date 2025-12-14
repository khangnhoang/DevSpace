"use client";
import { useState, useEffect, useMemo } from "react";
import {
  SquarePen,
  Trash,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  getCoursesForSelect,
  getChaptersByCourseId,
  getLessons,
  addLesson,
  deleteLesson,
  editLesson,
} from "@/lib/supabase";
import MdxEditor from "@/app/components/MdxEditor";

const ITEMS_PER_PAGE = 10;

export default function LessonsManagerPage() {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editLessonId, setEditLessonId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(
    null
  );
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; title: string }[]>([]);
  const [content, setContent] = useState<string>(
    "**Viết nội dung bài học ở đây...**"
  );
  const [lessons, setLessons] = useState<Array<any>>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState<number | 0>(0);
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenAddForm = () => {
    setEditLessonId(null);
    setTitle("");
    setSlug("");
    setVideoUrl("");
    setSelectedCourseId(null);
    setSelectedChapterId(null);
    setContent("**Viết nội dung bài học ở đây...**");
    setIsOpenForm(true);
  };

  const handOpenEditForm = (lesson: any) => {
    setEditLessonId(lesson.id);
    setTitle(lesson.title);
    setSlug(lesson.slug);
    setVideoUrl(lesson.video_url || "");
    setSelectedCourseId(lesson.course_id);
    setSelectedChapterId(lesson.chapter_id);
    setContent(lesson.content || "");
    setIsOpenForm(true);
  };

  const handleSave = async () => {
    if (!title || !slug || !selectedCourseId || !selectedChapterId) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    const lessonPayload = {
      title,
      slug,
      content: content || "",
      course_id: selectedCourseId!,
      chapter_id: selectedChapterId!,
      video_url: videoUrl,
    };

    let result;

    if (editLessonId) {
      result = await editLesson(editLessonId, lessonPayload);
    } else {
      result = await addLesson(lessonPayload);
    }

    if (result.error) {
      alert("Lưu bài học thất bại: " + result.error.message);
    } else {
      alert(editLessonId ? "Cập nhật thành công" : "Lưu bài học thành công!");
      setIsOpenForm(false);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleDelete = async (id: number, lessonTitle: string) => {
    if (!confirm(`Bạn có chắc muốn xóa bài ${lessonTitle} không?`)) return;

    const { error } = await deleteLesson(id);

    if (error) {
      alert("Xoá bài học thất bại: " + error.message);
    } else {
      alert("Xoá bài học thành công!");
      setRefreshKey((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      const data = await getCoursesForSelect();
      setCourses(data);
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchChapters = async () => {
      if (!selectedCourseId) {
        setChapters([]);
        return;
      }

      const data = await getChaptersByCourseId(selectedCourseId!);
      setChapters(data);
    };
    fetchChapters();
  }, [selectedCourseId]);

  useEffect(() => {
    const fetchLessonsData = async () => {
      const data = await getLessons();
      setLessons(data);
    };
    fetchLessonsData();
  }, [refreshKey]);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const matchesSearch = lesson.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCourse =
        filterCourse === 0 || lesson.course_id === filterCourse;
      return matchesSearch && matchesCourse;
    });
  }, [lessons, searchTerm, filterCourse]);

  const totalPages = Math.ceil(filteredLessons.length / ITEMS_PER_PAGE);
  const paginatedLessons = filteredLessons.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-6 text-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="font-bold text-2xl">Quản lí bài học</h1>
        <button
          className="cursor-pointer bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
          onClick={handleOpenAddForm}
        >
          <span>+</span> Thêm bài học
        </button>
      </div>

      {/* --- THANH CÔNG CỤ: TÌM KIẾM & BỘ LỌC --- */}
      <div className="bg-[#191C24] p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 border border-gray-700 shadow-lg">
        {/* Ô Tìm kiếm */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Tìm kiếm bài học..."
            className="w-full bg-[#2C3039] border border-gray-600 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-colors"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset về trang 1 khi tìm
            }}
          />
        </div>

        {/* Dropdown Lọc Khóa học */}
        <div className="relative w-full md:w-64">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <select
            className="w-full bg-[#2C3039] border border-gray-600 rounded-lg py-2 pl-10 pr-4 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
            value={filterCourse}
            onChange={(e) => {
              setFilterCourse(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={0}>Tất cả khóa học</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- BẢNG DỮ LIỆU --- */}
      <div className="bg-[#191C24] rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          {/* Thêm class 'table-fixed' vào đây để khóa chiều rộng */}
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-[#222732] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                {/* 1. CỘT TÊN BÀI (Quan trọng nhất - 40%) */}
                <th className="py-4 px-6 w-[40%]">Tên bài học</th>

                {/* 2. CỘT KHÓA HỌC (25%) - Ẩn trên mobile */}
                <th className="py-4 px-6 w-[25%] hidden md:table-cell">
                  Khóa học
                </th>

                {/* 3. CỘT CHƯƠNG (20%) - Ẩn trên tablet */}
                <th className="py-4 px-6 w-[20%] hidden lg:table-cell">
                  Chương
                </th>

                {/* 4. CỘT HÀNH ĐỘNG (15%) - Cố định nhỏ gọn */}
                <th className="py-4 px-6 w-[15%] text-center">Hành động</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700">
              {paginatedLessons.length > 0 ? (
                paginatedLessons.map((lesson) => (
                  <tr
                    key={lesson.id}
                    className="hover:bg-[#2C3039] transition-colors group"
                  >
                    {/* CỘT TÊN BÀI */}
                    <td className="py-3 px-6 align-middle">
                      <div className="flex flex-col max-w-full">
                        {" "}
                        {/* max-w-full để ép truncate hoạt động */}
                        {/* Thêm title={...} để hover vào vẫn xem được tên đầy đủ */}
                        <span
                          className="font-medium truncate text-white"
                          title={lesson.title}
                        >
                          {lesson.title}
                        </span>
                        <span className="text-xs text-gray-500 font-mono truncate">
                          {lesson.slug}
                        </span>
                      </div>
                    </td>

                    {/* CỘT KHÓA HỌC */}
                    <td className="py-3 px-6 hidden md:table-cell align-middle">
                      <div
                        className="truncate max-w-full"
                        title={lesson.courses?.name}
                      >
                        <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs font-semibold border border-blue-900/50">
                          {lesson.courses?.name || "N/A"}
                        </span>
                      </div>
                    </td>

                    {/* CỘT CHƯƠNG */}
                    <td className="py-3 px-6 hidden lg:table-cell align-middle text-gray-400 text-sm">
                      <div
                        className="truncate max-w-full"
                        title={lesson.chapters?.title}
                      >
                        {lesson.chapters?.title || "N/A"}
                      </div>
                    </td>

                    {/* CỘT HÀNH ĐỘNG */}
                    <td className="py-3 px-6 align-middle">
                      <div className="flex justify-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handOpenEditForm(lesson)}
                          className="cursor-pointer p-2 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-colors"
                        >
                          <SquarePen size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(lesson.id, lesson.title)}
                          className="cursor-pointer p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-gray-500 italic"
                  >
                    Không tìm thấy bài học nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- THANH PHÂN TRANG --- */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-gray-700 bg-[#222732]">
            <span className="text-sm text-gray-400">
              Trang <strong className="text-white">{currentPage}</strong> /{" "}
              {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="cursor-pointer p-2 bg-[#2C3039] rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="cursor-pointer p-2 bg-[#2C3039] rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isOpenForm && (
        <div className="flex fixed inset-0 z-50 items-center justify-center p-2 ">
          <div className="w-4/5 flex h-[85vh]">
            <div className="w-1/3 bg-[#364153] p-2 rounded-l-md flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <label className="font-bold">Tên bài</label>
                <input
                  type="text"
                  name=""
                  id=""
                  className="bg-[#2C3039] border border-[#4B5563] rounded-md p-2 focus:outline-none"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="" className="font-bold">
                  Khóa học
                </label>
                <select
                  name=""
                  id=""
                  className="bg-[#2C3039] text-white p-2 rounded border border-[#4B5563] focus:outline-none focus:border-blue-500"
                  value={selectedCourseId || ""}
                  onChange={(e) => {
                    setSelectedCourseId(Number(e.target.value));
                    setSelectedChapterId(null);
                  }}
                >
                  <option value="">Chọn khóa học</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col  gap-2">
                <label htmlFor="" className="font-bold">
                  Chương
                </label>
                <select
                  name=""
                  id=""
                  className="bg-[#2C3039] border border-[#4B5563] text-white p-2 rounded focus:outline-none focus:border-blue-500"
                  value={selectedChapterId || ""}
                  onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                >
                  <option value="">Chọn chương</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="" className="font-bold">
                  Đường dẫn
                </label>
                <input
                  type="text"
                  name=""
                  id=""
                  className="bg-[#2C3039] border border-[#4B5563] rounded-md p-2 focus:outline-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="" className="font-bold">
                  Đường dẫn video
                </label>
                <input
                  type="text"
                  name=""
                  id=""
                  className="bg-[#2C3039] border border-[#4B5563] rounded-md p-2 focus:outline-none"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="w-2/3 bg-[#364153] p-2 rounded-r-md flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p className="font-bold">Viết Content MDX </p>
                <div className="flex items-center gap-2 ">
                  <button
                    onClick={handleSave}
                    className="py-2 px-4 bg-[#222732] rounded-md hover:opacity-80 cursor-pointer"
                  >
                    {editLessonId ? "Lưu thay đổi" : "Thêm bài học"}
                  </button>
                  <X
                    className="cursor-pointer"
                    scale={20}
                    onClick={() => setIsOpenForm(false)}
                  />
                </div>
              </div>

              <div className="flex-1 p-0 overflow-hidden">
                <MdxEditor
                  value={content}
                  onChange={(val) => setContent(val || "")}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
