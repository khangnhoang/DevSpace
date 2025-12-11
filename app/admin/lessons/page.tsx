"use client";
import { useState, useEffect } from "react";
import { SquarePen, Trash, X } from "lucide-react";
import {
  getCoursesForSelect,
  getChaptersByCourseId,
  getLessons,
  addLesson,
  deleteLesson,
} from "@/lib/supabase";
import MdxEditor from "@/app/components/MdxEditor";
import { useRouter } from "next/navigation";

export default function LessonsManagerPage() {
  const router = useRouter();
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
  const handleOpenForm = () => {
    setTitle("");
    setSlug("");
    setVideoUrl("");
    setSelectedCourseId(null);
    setSelectedChapterId(null);
    setContent("**Viết nội dung bài học ở đây...**");
    setIsOpenForm(true);
  };

  const handleSave = async () => {
    const result = await addLesson({
      title,
      slug,
      content: content || "",
      course_id: selectedCourseId!,
      chapter_id: selectedChapterId!,
      video_url: videoUrl,
    });

    if (result.error) {
      alert("Lưu bài học thất bại: " + result.error.message);
    } else {
      alert("Lưu bài học thành công!");
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
      setSelectedChapterId(null);
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

  return (
    <div className="p-4">
      <div className="flex justify-between p-2">
        <h1>Quản lí bài học</h1>
        <button
          className="bg-green-500 rounded-md p-2 hover:opacity-80 cursor-pointer"
          onClick={handleOpenForm}
        >
          Thêm bài học mới
        </button>
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
                  onChange={(e) => setSelectedCourseId(Number(e.target.value))}
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
                    Thêm
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
      <table className="w-3/4">
        <thead className="bg-gray-700">
          <tr>
            <th scope="col" className=" py-3">
              Tên bài học
            </th>
            <th scope="col" className=" py-3">
              Tên khóa học
            </th>
            <th scope="col" className=" py-3">
              Chương bài học
            </th>
            <th scope="col" className=" py-3">
              Hành động: Sửa/Xóa
            </th>
          </tr>
        </thead>
        <tbody className="">
          {lessons.map((lesson) => (
            <tr
              key={lesson.id}
              className="bg-[#191C24] border-b border-gray-700 hover:bg-gray-800 transition-colors"
            >
              <td scope="row" className="px-2">
                {lesson.title}
              </td>
              <td className="px-2 uppercase">
                {lesson.courses.name || "Chưa có khóa học"}
              </td>
              <td className="px-2">
                {lesson.chapters.title || "Chưa có chương"}
              </td>
              <td className="flex py-4 w-full justify-center gap-2">
                <button className="cursor-pointer">
                  <SquarePen size={20} />
                </button>
                <button
                  onClick={() => handleDelete(lesson.id, lesson.title)}
                  className="cursor-pointer"
                >
                  <Trash size={20} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
