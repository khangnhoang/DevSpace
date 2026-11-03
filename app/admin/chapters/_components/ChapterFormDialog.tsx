"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SquarePen, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { addChapter, editChapter } from "@/lib/supabase";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  chapterSchema,
  type ChapterFormInput,
  type ChapterFormValues,
} from "@/lib/schemas/admin-content-forms";

interface ChapterToEdit {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
}

// The shadcn controls are restyled here to keep the look this form always had on the always-dark admin surface; the
// generated files stay generic and their tokens would follow the OS colour scheme.
const CHAPTER_CONTROL =
  "h-auto rounded-lg border-gray-700 bg-[#2C3039] p-3 text-base text-white shadow-none placeholder:text-gray-500 focus-visible:border-[#3B81F4] focus-visible:ring-1 focus-visible:ring-[#3B81F4] aria-invalid:border-red-500 md:text-base";
const CHAPTER_LABEL =
  "ml-1 block text-xs leading-4 font-bold tracking-wider text-gray-400 uppercase";
const CHAPTER_FIELD =
  "gap-2 [&_[data-slot=native-select-wrapper]]:w-full [&_[data-slot=native-select-icon]]:text-white [&_[data-slot=native-select-icon]]:opacity-100";
const CHAPTER_ERROR = "ml-1 text-red-400";

// Mounted only while the dialog is open, so `defaultValues` always come from the record being edited (or the course
// chosen on the page for a new chapter).
export default function ChapterFormDialog({
  chapter,
  defaultCourseId,
  courses,
  onClose,
  onSaved,
}: {
  chapter: ChapterToEdit | null;
  defaultCourseId: number | null;
  courses: { id: number; name: string }[];
  onClose: () => void;
  // Reloads the list after a successful save; `courseId` is the course the chapter was saved under.
  onSaved: (courseId: number) => Promise<void>;
}) {
  const editingChapterId = chapter?.id ?? null;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChapterFormInput, unknown, ChapterFormValues>({
    resolver: zodResolver(chapterSchema),
    defaultValues: {
      title: chapter?.title ?? "",
      order_index: chapter ? String(chapter.order_index) : "",
      course_id: String(chapter?.course_id ?? defaultCourseId ?? ""),
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting, so a second
  // Enter can pass a state-only check and insert the chapter twice.
  const savingRef = useRef(false);

  const handleSave = async (values: ChapterFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const result = editingChapterId
        ? await editChapter(editingChapterId, values)
        : await addChapter(values);

      if (result.error) {
        toast.error("Đã có lỗi xảy ra: " + result.error.message);
        return;
      }
      toast.success(
        editingChapterId
          ? "Cập nhật chương thành công!"
          : "Thêm chương thành công!",
      );
      onClose();
      await onSaved(values.course_id);
    } catch (error) {
      toast.error(
        "Đã có lỗi xảy ra: " +
          (error instanceof Error ? error.message : "Không xác định"),
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <form
        onSubmit={(e) => handleSubmit(handleSave)(e)}
        noValidate
        className="w-full max-w-lg md:w-1/2 lg:w-1/3 bg-[#191C24] rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden transform transition-all scale-100"
      >
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
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex size-10 shrink-0 items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5">
          <Field className={CHAPTER_FIELD} data-invalid={!!errors.title}>
            <FieldLabel htmlFor="chapter-title" className={CHAPTER_LABEL}>
              Tên chương
            </FieldLabel>
            <Input
              id="chapter-title"
              type="text"
              placeholder="Nhập tên chương..."
              className={CHAPTER_CONTROL}
              aria-invalid={!!errors.title}
              autoFocus
              {...register("title")}
            />
            <FieldError className={CHAPTER_ERROR} errors={[errors.title]} />
          </Field>

          <Field className={CHAPTER_FIELD} data-invalid={!!errors.order_index}>
            <FieldLabel htmlFor="chapter-order" className={CHAPTER_LABEL}>
              Thứ tự hiển thị
            </FieldLabel>
            <Input
              id="chapter-order"
              type="number"
              placeholder="Ví dụ: 1"
              className={CHAPTER_CONTROL}
              aria-invalid={!!errors.order_index}
              {...register("order_index")}
            />
            <FieldError
              className={CHAPTER_ERROR}
              errors={[errors.order_index]}
            />
          </Field>

          <Field className={CHAPTER_FIELD} data-invalid={!!errors.course_id}>
            <FieldLabel htmlFor="chapter-course" className={CHAPTER_LABEL}>
              Thuộc khóa học
            </FieldLabel>
            {/* The courses load after the page mounts; a new key lets the select take its stored value once its options exist. */}
            <NativeSelect
              key={courses.length}
              id="chapter-course"
              className={cn(CHAPTER_CONTROL, "cursor-pointer pr-9 uppercase")}
              aria-invalid={!!errors.course_id}
              {...register("course_id")}
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((course) => (
                <option
                  value={course.id}
                  key={course.id}
                  className="text-white bg-[#2C3039]"
                >
                  {course.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError className={CHAPTER_ERROR} errors={[errors.course_id]} />
          </Field>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#222732] p-5 flex justify-end gap-3 border-t border-gray-700">
          <button
            type="button"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#374151] transition-colors"
            onClick={onClose}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#3B81F4] hover:bg-[#2563EB] shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingChapterId ? "Lưu Thay Đổi" : "Thêm Mới"}
          </button>
        </div>
      </form>
    </div>
  );
}
