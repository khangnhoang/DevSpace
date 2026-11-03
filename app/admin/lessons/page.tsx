"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SquarePen,
  Trash,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  Sparkles,
  Bolt,
  Loader2,
} from "lucide-react";
import {
  getCoursesForSelect,
  getChaptersByCourseId,
  addLesson,
  deleteLesson,
  editLesson,
  getExerciseByLessonId,
  addExercise,
  deleteExercise,
  editExercise,
} from "@/lib/supabase";
import MdxEditor from "@/app/components/MdxEditor";
import { generateQuizFromContent } from "@/app/action/gemini";
import type { DBExercise } from "@/lib/types";
import { getLessonsForAdmin } from "@/app/action/lessons";
import { toast } from "sonner";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { useRouter } from "next/navigation";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  exerciseSchema,
  lessonSchema,
  type ExerciseFormInput,
  type ExerciseFormValues,
  type LessonFormInput,
  type LessonFormValues,
} from "@/lib/schemas/admin-content-forms";
import {
  AI_INVALID_MESSAGE,
  bulkCreateAiExercises,
  describeAiBulk,
  firstAiExerciseToForm,
} from "./_lib/ai-exercises";

const ITEMS_PER_PAGE = 10;

const LESSON_CONTENT_PLACEHOLDER = "**Viết nội dung bài học ở đây...**";
const BLANK_LESSON: LessonFormInput = {
  title: "",
  slug: "",
  course_id: "",
  chapter_id: "",
  video_url: "",
  order_index: "",
  content: LESSON_CONTENT_PLACEHOLDER,
};
const BLANK_EXERCISE: ExerciseFormInput = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "",
  explanation: "",
};

// The shadcn controls are restyled here to keep the look these forms always had on the always-dark admin surface; the
// generated files stay generic and their tokens would follow the OS colour scheme.
const LESSON_CONTROL =
  "h-auto rounded-md border-[#4B5563] bg-[#2C3039] p-2 text-base text-white shadow-none focus-visible:border-[#4B5563] focus-visible:ring-0 aria-invalid:border-red-500 md:text-base";
const LESSON_LABEL = "block text-base leading-6 font-bold text-white";
const LESSON_FIELD =
  "gap-2 [&_[data-slot=native-select-wrapper]]:w-full [&_[data-slot=native-select-icon]]:text-white [&_[data-slot=native-select-icon]]:opacity-100";
const EXERCISE_CONTROL =
  "h-auto rounded-md border-gray-400 bg-[#222732] p-2 text-base text-white shadow-none focus-visible:border-gray-400 focus-visible:ring-0 aria-invalid:border-red-500 md:text-base";
const EXERCISE_FIELD =
  "gap-1 [&_[data-slot=native-select-wrapper]]:w-full [&_[data-slot=native-select-icon]]:text-white [&_[data-slot=native-select-icon]]:opacity-100";
const FORM_ERROR = "text-red-400";
const EXERCISE_OPTIONS = ["a", "b", "c", "d"] as const;

const isRowId = (value: string) => /^[1-9]\d*$/.test(value);

// Runtime shape of getLessonsForAdmin rows: the client types a joined relation
// as an array, but each lesson has one course and one chapter.
interface LessonAdminRow {
  id: number;
  title: string;
  slug: string;
  content?: string | null;
  course_id: number;
  chapter_id: number | null;
  video_url?: string | null;
  order_index?: number | null;
  courses?: { name?: string } | null;
  chapters?: { title?: string } | null;
}

export default function LessonsManagerPage() {
  const router = useRouter();
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [deleteLessonTarget, setDeleteLessonTarget] =
    useState<LessonAdminRow | null>(null);
  const [deleteExerciseTarget, setDeleteExerciseTarget] =
    useState<DBExercise | null>(null);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editLessonId, setEditLessonId] = useState<number | null>(null);
  const [editExerciseId, setEditExerciseId] = useState<number | null>(null);
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; title: string }[]>([]);
  const [lessons, setLessons] = useState<LessonAdminRow[]>([]);
  const [exercise, setExercise] = useState<DBExercise[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState<number | 0>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"infor" | "exercise">("infor");

  const [showAiMenu, setShowAiMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshExerciseKey, setRefreshExerciseKey] = useState(0);

  // Both forms live on the page, like the state they replace, so the lesson values survive a switch of tab while the
  // panel stays open. Every open and every close of the panel starts the exercise form blank in add mode: a question
  // being edited belongs to the lesson it was opened from, and its id must not outlive that lesson.
  const {
    register: registerLesson,
    handleSubmit: handleLessonSubmit,
    reset: resetLesson,
    setValue: setLessonValue,
    getValues: getLessonValues,
    control: lessonControl,
    formState: { errors: lessonErrors },
  } = useForm<LessonFormInput, unknown, LessonFormValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: BLANK_LESSON,
  });
  const {
    register: registerExercise,
    handleSubmit: handleExerciseSubmit,
    reset: resetExercise,
    formState: { errors: exerciseErrors },
  } = useForm<ExerciseFormInput, unknown, ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: BLANK_EXERCISE,
  });
  const watchedCourse = useWatch({ control: lessonControl, name: "course_id" });
  const selectedCourseId = isRowId(watchedCourse)
    ? Number(watchedCourse)
    : null;
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isSavingExercise, setIsSavingExercise] = useState(false);
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting, so a second Enter can
  // pass a state-only check and insert the row twice.
  const savingLessonRef = useRef(false);
  const savingExerciseRef = useRef(false);

  const resetExerciseEditing = () => {
    setEditExerciseId(null);
    resetExercise(BLANK_EXERCISE);
  };

  const closePanel = () => {
    setIsOpenForm(false);
    resetExerciseEditing();
  };

  const handleOpenAddForm = () => {
    setEditLessonId(null);
    resetLesson(BLANK_LESSON);
    resetExerciseEditing();
    setActiveTab("infor");
    setIsOpenForm(true);
  };

  const handOpenEditForm = (lesson: LessonAdminRow) => {
    resetExerciseEditing();
    setActiveTab("infor");
    setEditLessonId(lesson.id);
    resetLesson({
      title: lesson.title,
      slug: lesson.slug,
      course_id: String(lesson.course_id),
      chapter_id: lesson.chapter_id ? String(lesson.chapter_id) : "",
      video_url: lesson.video_url || "",
      order_index: lesson.order_index == null ? "" : String(lesson.order_index),
      content: lesson.content || "",
    });
    setIsOpenForm(true);
  };

  const handleOpenEditExerciseForm = (exercise: DBExercise) => {
    setEditExerciseId(exercise.id);
    resetExercise({
      question: exercise.question,
      option_a: exercise.option_a,
      option_b: exercise.option_b,
      option_c: exercise.option_c,
      option_d: exercise.option_d,
      correct_answer: exercise.correct_answer,
      explanation: exercise.explanation ?? "",
    });
  };

  const handleInActiveEditExerciseForm = () => {
    setEditExerciseId(null);
    resetExercise(BLANK_EXERCISE);
  };

  const saveLesson = async (values: LessonFormValues) => {
    if (savingLessonRef.current) return;
    savingLessonRef.current = true;
    setIsSavingLesson(true);

    try {
      const result = editLessonId
        ? await editLesson(editLessonId, values)
        : await addLesson(values);

      if (result.error) {
        toast.error("Lưu bài học thất bại: " + result.error.message);
        return;
      }
      toast.success(
        editLessonId ? "Cập nhật thành công" : "Lưu bài học thành công!",
      );
      closePanel();
      router.refresh();
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(
        "Lưu bài học thất bại: " +
          (error instanceof Error ? error.message : "Không xác định"),
      );
    } finally {
      savingLessonRef.current = false;
      setIsSavingLesson(false);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await deleteLesson(id);

    if (error) {
      toast.error("Xoá bài học thất bại: " + error.message);
    } else {
      toast.success("Xoá bài học thành công!");
      router.refresh();
      setRefreshKey((prev) => prev + 1);
    }
  };

  const saveExercise = async (values: ExerciseFormValues) => {
    if (savingExerciseRef.current) return;
    savingExerciseRef.current = true;
    setIsSavingExercise(true);

    try {
      const result = editExerciseId
        ? await editExercise(editExerciseId, values)
        : await addExercise(editLessonId, values);

      if (result.error) {
        toast.error("Đã có lỗi xảy ra: " + result.error.message);
        return;
      }
      toast.success(editExerciseId ? "Cập nhật thành công" : "Thêm thành công");
      setRefreshExerciseKey((prev) => prev + 1);
    } catch (error) {
      toast.error(
        "Đã có lỗi xảy ra: " +
          (error instanceof Error ? error.message : "Không xác định"),
      );
    } finally {
      savingExerciseRef.current = false;
      setIsSavingExercise(false);
    }
  };

  const handleDeleteExercise = async (exercise: DBExercise) => {
    const result = await deleteExercise(exercise.id);

    if (result.error) {
      toast.error("Đã có lỗi xảy ra: " + result.error.message);
    } else {
      toast.success("Xóa câu hỏi thành công!");
      router.refresh();
      setRefreshExerciseKey((prev) => prev + 1);
    }
  };

  const handleAiFillForm = async () => {
    const content = getLessonValues("content");
    if (!content) return toast.warning("Chưa có nội dung bài học");
    setIsGenerating(true);
    setShowAiMenu(false);

    try {
      const res = await generateQuizFromContent(content, 1, exercise);

      if (!res) {
        toast.error("Lỗi lấy câu trả lời từ AI");
        return;
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }

      const filled = firstAiExerciseToForm(res.data);
      if (!filled) {
        toast.error(AI_INVALID_MESSAGE);
        return;
      }
      resetExercise(filled);
    } catch {
      toast.error("Lỗi lấy câu trả lời từ AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiBulkCreate = async () => {
    if (!editLessonId) return toast.error("Chưa lưu bài học");
    if (!getLessonValues("content")) return toast.error("Nội dung trống");

    setIsBulkConfirmOpen(true);
  };

  const runAiBulkCreate = async () => {
    if (!editLessonId) return;

    setIsGenerating(true);
    setShowAiMenu(false);

    try {
      const res = await generateQuizFromContent(
        getLessonValues("content"),
        3,
        exercise,
      );
      if (!res) {
        toast.error("Lỗi lấy câu trả lời từ AI");
        return;
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }

      const outcome = await bulkCreateAiExercises(
        editLessonId,
        res.data,
        addExercise,
      );
      const { ok, message } = describeAiBulk(outcome);
      if (ok) toast.success(message);
      else toast.error(message);
      // Some of the questions may be saved even when others failed, so the list reloads unless nothing was tried.
      if (outcome.kind !== "invalid") setRefreshExerciseKey((prev) => prev + 1);
    } catch {
      toast.error("Lỗi lấy câu trả lời từ AI");
    } finally {
      setIsGenerating(false);
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
      const data = await getLessonsForAdmin();
      setLessons(data as unknown as LessonAdminRow[]);
    };
    fetchLessonsData();
  }, [refreshKey]);

  useEffect(() => {
    const fetchExerciseByLessonId = async () => {
      const data = await getExerciseByLessonId(editLessonId);
      setExercise(data);
    };
    fetchExerciseByLessonId();
  }, [editLessonId, refreshExerciseKey]);

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
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="lg:ml-6 p-6 text-white min-h-screen">
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

                <th className="py-4 px-6 w-[20%] hidden lg:table-cell">
                  Số thứ tự
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

                    {/* CỘT SỐ THỨ TỰ */}
                    <td className="py-3 px-6 hidden lg:table-cell align-middle text-gray-400 text-sm">
                      <div
                        className="truncate max-w-full"
                        title={lesson.order_index as unknown as string}
                      >
                        {lesson.order_index || "N/A"}
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
                          onClick={() => setDeleteLessonTarget(lesson)}
                          aria-label={`Xóa bài học ${lesson.title}`}
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
          <div className="flex bg-[#364153] p-3 rounded-l-md h-[85vh] overflow-y-hidden flex-col w-full gap-3">
            <div className="flex items-center gap-2 justify-between w-full">
              <div className="flex text-md gap-3 items-center">
                <p className="text-xl">{editLessonId ? "Chỉnh sửa" : "Thêm"}</p>
                <button
                  onClick={() => setActiveTab("infor")}
                  className={`cursor-pointer hover:opacity-80 rounded-md p-2 ${
                    activeTab === "infor" ? "bg-blue-500" : "bg-[#222732]"
                  }`}
                >
                  Thông tin
                </button>
                <button
                  onClick={() => setActiveTab("exercise")}
                  className={`cursor-pointer hover:opacity-80 rounded-md p-2 ${
                    activeTab === "exercise" ? "bg-blue-500" : "bg-[#222732]"
                  }`}
                >
                  Trắc nghiệm
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  form="lesson-form"
                  disabled={activeTab === "exercise" || isSavingLesson}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === "exercise"
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-500 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {isSavingLesson && (
                    <Loader2 className="animate-spin" size={18} />
                  )}
                  {editLessonId ? "Lưu thay đổi" : "Thêm bài học"}
                </button>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={closePanel}
                  className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            {activeTab === "infor" && (
              <form
                id="lesson-form"
                onSubmit={(e) => handleLessonSubmit(saveLesson)(e)}
                noValidate
                className="w-full flex h-[85vh]"
              >
                <div className="flex w-full">
                  <div className="w-1/3 flex flex-col gap-3 overflow-y-auto">
                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.title}
                    >
                      <FieldLabel
                        htmlFor="lesson-title"
                        className={LESSON_LABEL}
                      >
                        Tên bài
                      </FieldLabel>
                      <Input
                        id="lesson-title"
                        type="text"
                        className={LESSON_CONTROL}
                        aria-invalid={!!lessonErrors.title}
                        {...registerLesson("title")}
                      />
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.title]}
                      />
                    </Field>
                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.course_id}
                    >
                      <FieldLabel
                        htmlFor="lesson-course"
                        className={LESSON_LABEL}
                      >
                        Khóa học
                      </FieldLabel>
                      <NativeSelect
                        id="lesson-course"
                        className={cn(LESSON_CONTROL, "pr-9")}
                        aria-invalid={!!lessonErrors.course_id}
                        {...registerLesson("course_id", {
                          onChange: () => setLessonValue("chapter_id", ""),
                        })}
                      >
                        <option value="">Chọn khóa học</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </NativeSelect>
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.course_id]}
                      />
                    </Field>
                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.chapter_id}
                    >
                      <FieldLabel
                        htmlFor="lesson-chapter"
                        className={LESSON_LABEL}
                      >
                        Chương
                      </FieldLabel>
                      {/* The chapters load after the course is chosen; a new key lets the select take its stored value once its options exist. */}
                      <NativeSelect
                        key={chapters.map((chapter) => chapter.id).join(",")}
                        id="lesson-chapter"
                        className={cn(LESSON_CONTROL, "pr-9")}
                        aria-invalid={!!lessonErrors.chapter_id}
                        {...registerLesson("chapter_id")}
                      >
                        <option value="">Chọn chương</option>
                        {chapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </option>
                        ))}
                      </NativeSelect>
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.chapter_id]}
                      />
                    </Field>
                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.slug}
                    >
                      <FieldLabel
                        htmlFor="lesson-slug"
                        className={LESSON_LABEL}
                      >
                        Đường dẫn
                      </FieldLabel>
                      <Input
                        id="lesson-slug"
                        type="text"
                        className={LESSON_CONTROL}
                        aria-invalid={!!lessonErrors.slug}
                        {...registerLesson("slug")}
                      />
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.slug]}
                      />
                    </Field>
                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.video_url}
                    >
                      <FieldLabel
                        htmlFor="lesson-video"
                        className={LESSON_LABEL}
                      >
                        Đường dẫn video
                      </FieldLabel>
                      <Input
                        id="lesson-video"
                        type="text"
                        className={LESSON_CONTROL}
                        aria-invalid={!!lessonErrors.video_url}
                        {...registerLesson("video_url")}
                      />
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.video_url]}
                      />
                    </Field>

                    <Field
                      className={LESSON_FIELD}
                      data-invalid={!!lessonErrors.order_index}
                    >
                      <FieldLabel
                        htmlFor="lesson-order"
                        className={LESSON_LABEL}
                      >
                        Số thứ tự
                      </FieldLabel>
                      <Input
                        id="lesson-order"
                        type="number"
                        className={LESSON_CONTROL}
                        aria-invalid={!!lessonErrors.order_index}
                        {...registerLesson("order_index")}
                      />
                      <FieldError
                        className={FORM_ERROR}
                        errors={[lessonErrors.order_index]}
                      />
                    </Field>
                  </div>
                  <div className="w-2/3 bg-[#364153] p-2 rounded-r-md flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <p className="font-bold">Viết Content MDX </p>
                    </div>

                    <div className="flex-1 p-0 overflow-hidden">
                      <Controller
                        control={lessonControl}
                        name="content"
                        render={({ field }) => (
                          <MdxEditor
                            value={field.value}
                            onChange={(val) => field.onChange(val || "")}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}
            {activeTab === "exercise" && (
              <div className="w-full bg-[#191C24] flex flex-col items-center gap-3 p-4 rounded-xl overflow-auto">
                <form
                  onSubmit={(e) => handleExerciseSubmit(saveExercise)(e)}
                  noValidate
                  className="contents"
                >
                  <div className="flex justify-between w-1/2 items-center">
                    <p className="font-bold">
                      {editExerciseId ? "Cập nhật câu hỏi" : "Thêm câu hỏi mới"}
                    </p>

                    <button
                      type="button"
                      onClick={handleInActiveEditExerciseForm}
                      className={`${
                        editExerciseId ? "display" : "hidden"
                      } bg-blue-500 p-2 rounded-md cursor-pointer hover:bg-blue-700`}
                    >
                      Thêm bài tập
                    </button>
                  </div>
                  <Field
                    className={cn(EXERCISE_FIELD, "w-1/2")}
                    data-invalid={!!exerciseErrors.question}
                  >
                    <Input
                      className={EXERCISE_CONTROL}
                      type="text"
                      placeholder="Nhập nội dung câu hỏi?"
                      aria-label="Nội dung câu hỏi"
                      aria-invalid={!!exerciseErrors.question}
                      {...registerExercise("question")}
                    />
                    <FieldError
                      className={FORM_ERROR}
                      errors={[exerciseErrors.question]}
                    />
                  </Field>
                  <div className="grid grid-cols-2 w-1/2 gap-3">
                    {EXERCISE_OPTIONS.map((letter) => (
                      <Field
                        key={letter}
                        className={cn(EXERCISE_FIELD, "gap-2")}
                        data-invalid={!!exerciseErrors[`option_${letter}`]}
                      >
                        <span className="text-white text-md uppercase font-bold">
                          {letter}
                        </span>
                        <Input
                          type="text"
                          placeholder={`Đáp Án ${letter.toUpperCase()}`}
                          aria-label={`Đáp án ${letter.toUpperCase()}`}
                          className={EXERCISE_CONTROL}
                          aria-invalid={!!exerciseErrors[`option_${letter}`]}
                          {...registerExercise(`option_${letter}`)}
                        />
                        <FieldError
                          className={FORM_ERROR}
                          errors={[exerciseErrors[`option_${letter}`]]}
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="flex gap-2 item-center w-1/2">
                    <Field
                      className={cn(EXERCISE_FIELD, "w-1/3")}
                      data-invalid={!!exerciseErrors.correct_answer}
                    >
                      <NativeSelect
                        aria-label="Đáp án đúng"
                        className={cn(EXERCISE_CONTROL, "pr-9")}
                        aria-invalid={!!exerciseErrors.correct_answer}
                        {...registerExercise("correct_answer")}
                      >
                        <option value="">Chọn đáp án đúng</option>
                        {EXERCISE_OPTIONS.map((letter) => (
                          <option value={letter} key={letter}>
                            {letter}
                          </option>
                        ))}
                      </NativeSelect>
                      <FieldError
                        className={FORM_ERROR}
                        errors={[exerciseErrors.correct_answer]}
                      />
                    </Field>
                    <Field
                      className={cn(EXERCISE_FIELD, "w-2/3")}
                      data-invalid={!!exerciseErrors.explanation}
                    >
                      <Input
                        type="text"
                        placeholder="Giải thích tại sao đúng?"
                        aria-label="Giải thích"
                        className={EXERCISE_CONTROL}
                        aria-invalid={!!exerciseErrors.explanation}
                        {...registerExercise("explanation")}
                      />
                      <FieldError
                        className={FORM_ERROR}
                        errors={[exerciseErrors.explanation]}
                      />
                    </Field>
                  </div>
                  <div className="w-1/2 flex items-center justify-center">
                    <button
                      type="submit"
                      disabled={isSavingExercise}
                      className="bg-blue-500 p-2 font-bold w-full rounded-md cursor-pointer hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingExercise && (
                        <Loader2 className="animate-spin" size={18} />
                      )}
                      {editExerciseId ? "Cập nhật câu hỏi" : "Thêm câu hỏi"}
                    </button>
                  </div>
                </form>
                <div className="border w-1/2 border-gray-500"></div>
                <div className="w-1/2 flex flex-col gap-2">
                  <h1 className="font-bold text-md">
                    Đã tải được {exercise.length} câu hỏi:{" "}
                  </h1>
                  {exercise.map((e, index) => (
                    <div
                      className="bg-[#2C3039] w-full p-2 rounded-md overflow-hidden"
                      key={e.id}
                    >
                      <div className="flex flex-col gap-2 p-2 w-full">
                        <h1 className="font-bold flex justify-between">
                          Câu hỏi số {index + 1}: {e.question}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEditExerciseForm(e)}
                              className="text-blue-500 cursor-pointer hover:bg-blue-300 p-1 rounded-md"
                            >
                              <SquarePen size={17}></SquarePen>
                            </button>
                            <button
                              onClick={() => setDeleteExerciseTarget(e)}
                              aria-label={`Xóa câu hỏi ${e.question}`}
                              className="text-red-500 cursor-pointer hover:bg-red-200 p-1 rounded-md"
                            >
                              <Trash size={17} />
                            </button>
                          </div>
                        </h1>
                        <div className="flex w-full justify-between">
                          <div className="grid grid-cols-2 text-sm gap-1 text-gray-400 w-full">
                            <p
                              className={`${
                                e.correct_answer === "a" ? "text-blue-400" : ""
                              }`}
                            >
                              {e.option_a}
                            </p>
                            <p
                              className={`${
                                e.correct_answer === "b" ? "text-blue-400" : ""
                              }`}
                            >
                              {e.option_b}
                            </p>
                            <p
                              className={`${
                                e.correct_answer === "c" ? "text-blue-400" : ""
                              }`}
                            >
                              {e.option_c}
                            </p>
                            <p
                              className={`${
                                e.correct_answer === "d" ? "text-blue-400" : ""
                              }`}
                            >
                              {e.option_d}
                            </p>
                          </div>
                        </div>
                        <div className="border border-gray-500"></div>
                        <div>
                          <p className="text-[12px] text-gray-500">
                            {e.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-row-reverse relative">
                    <button
                      onClick={() => setShowAiMenu(!showAiMenu)}
                      disabled={isGenerating}
                      className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/30"
                    >
                      {isGenerating ? (
                        <span className="animate-pulse">Đang AI...</span>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          AI Magic
                          <ChevronDown size={16} />
                        </>
                      )}
                    </button>

                    {showAiMenu && !isGenerating && (
                      <div className="absolute bottom-full left-auto w-56 bg-[#2C3039] border border-gray-600 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col items-center">
                        <button
                          onClick={handleAiFillForm}
                          className="w-full text-left px-4 py-3 hover:bg-[#364153] flex items-center gap-2 border-b border-gray-700 transition-colors text-sm cursor-pointer"
                        >
                          <Sparkles size={16} className="text-yellow-400" />
                          <div>
                            <p className="font-semibold text-white">
                              Điền vào form
                            </p>
                            <p className="text-xs text-gray-400">
                              Tạo 1 câu để chỉnh sửa
                            </p>
                          </div>
                        </button>

                        <button
                          onClick={handleAiBulkCreate}
                          className="w-full text-left px-4 py-3 hover:bg-[#364153] flex items-center gap-2 transition-colors text-sm group cursor-pointer"
                        >
                          <Bolt
                            size={16}
                            className="text-blue-400 group-hover:animate-pulse"
                          />
                          <div>
                            <p className="font-semibold text-white">
                              Tự động thêm 3 câu
                            </p>
                            <p className="text-xs text-gray-400">
                              Lưu thẳng vào danh sách
                            </p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {deleteLessonTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteLessonTarget(null)}
          tone="admin"
          destructive
          title="Xóa bài học"
          description={`Bạn có chắc muốn xóa bài "${deleteLessonTarget.title}" không? Câu hỏi, bình luận, ghi chú và tiến độ học của bài này cũng sẽ bị xóa vĩnh viễn.`}
          confirmLabel="Xóa bài học"
          onConfirm={() => handleDelete(deleteLessonTarget.id)}
        />
      )}
      {deleteExerciseTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteExerciseTarget(null)}
          tone="admin"
          destructive
          title="Xóa câu hỏi"
          description={`Bạn có chắc chắn muốn xóa câu hỏi "${deleteExerciseTarget.question}" không? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa câu hỏi"
          onConfirm={() => handleDeleteExercise(deleteExerciseTarget)}
        />
      )}
      {isBulkConfirmOpen && (
        <ConfirmDialog
          open
          onOpenChange={() => setIsBulkConfirmOpen(false)}
          tone="admin"
          title="Tạo câu hỏi bằng AI"
          description="AI sẽ tự động lưu 3 câu hỏi vào bài này."
          confirmLabel="Tạo 3 câu hỏi"
          onConfirm={runAiBulkCreate}
        />
      )}
    </div>
  );
}
