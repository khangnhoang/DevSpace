"use client";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type AdminCourseData, addCourse, updateCourse } from "@/lib/supabase";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  courseSchema,
  type CourseFormInput,
  type CourseFormValues,
} from "@/lib/schemas/admin-content-forms";
import { formatCurrency } from "../_lib/format-currency";

export interface InstructorData {
  id: number;
  profiles: {
    full_name: string | null;
  } | null;
}

// Result of the two writes: updateCourse and a failed upload carry `error`, addCourse also the failed insert.
interface SaveResult {
  error?: { message?: string } | null;
  insertError?: { message?: string } | null;
}

// The shadcn controls are restyled here to keep the look this form always had on the always-dark admin surface; the
// generated files stay generic and their tokens would follow the OS colour scheme.
const COURSE_CONTROL =
  "h-auto rounded-lg border-gray-600 bg-[#2A303C] p-2.5 text-base text-white shadow-none placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-0 aria-invalid:border-red-500 aria-invalid:ring-0 md:text-base";
const COURSE_LABEL = "block text-sm leading-5 font-normal text-gray-300";
const COURSE_FIELD = "gap-2 [&_[data-slot=native-select-wrapper]]:w-full";
const COURSE_ERROR = "text-red-400";

// Mounted only while the dialog is open, so `defaultValues` always come from the record being edited (or a blank
// course) and the file and preview start empty each time.
export default function CourseFormDialog({
  course,
  instructors,
  onClose,
}: {
  course: AdminCourseData | null;
  instructors: InstructorData[];
  onClose: () => void;
}) {
  const router = useRouter();
  const editId = course?.id ?? null;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CourseFormInput, unknown, CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: course?.name ?? "",
      slug: course?.slug ?? "",
      description: course?.description || "",
      price: course?.price == null ? "" : String(course.price),
      instructor_id: course?.instructor_id ? String(course.instructor_id) : "",
    },
  });
  const priceText = useWatch({ control, name: "price" });
  const amount = Number(priceText);

  // The chosen file is not a text field, so it stays out of the schema.
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    course?.image_url || null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting, so a second
  // Enter can pass a state-only check and insert the course twice.
  const savingRef = useRef(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSave = async (values: CourseFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const payload = {
        ...values,
        image_url: course?.image_url || "", // Dùng cho update
      };
      // Đối với add, image_url do hàm add tự xử lý
      const result: SaveResult | undefined = editId
        ? await updateCourse(editId, payload, selectedFile)
        : await addCourse(payload, selectedFile);

      const failure = result?.error || result?.insertError;
      if (failure) {
        toast.error("Lỗi cập nhật: " + failure.message);
        return;
      }
      toast.success(
        editId ? "Cập nhật thành công" : "Thêm khóa học thành công",
      );
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        "Lỗi cập nhật: " +
          (error instanceof Error ? error.message : "Không xác định"),
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form
        onSubmit={(e) => handleSubmit(handleSave)(e)}
        noValidate
        className="bg-[#191C24] w-full sm:w-[90%] md:w-[70%] lg:w-[50%] rounded-xl p-6 shadow-2xl border border-gray-700 relative flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-4 sticky top-0 bg-[#191C24] z-10">
          <h1 className="text-xl font-bold text-white">
            {editId ? "Chỉnh sửa khóa học" : "Thêm khóa học mới"}
          </h1>
          <button
            type="button"
            className="text-gray-400 hover:text-white cursor-pointer hover:bg-white/10 p-1 rounded-full transition"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cột 1 */}
          <div className="flex flex-col gap-4">
            <Field className={COURSE_FIELD} data-invalid={!!errors.name}>
              <FieldLabel htmlFor="course-name" className={COURSE_LABEL}>
                Tên khóa học <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id="course-name"
                type="text"
                placeholder="VD: Lập trình ReactJS..."
                className={COURSE_CONTROL}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError className={COURSE_ERROR} errors={[errors.name]} />
            </Field>

            <Field className={COURSE_FIELD} data-invalid={!!errors.slug}>
              <FieldLabel htmlFor="course-slug" className={COURSE_LABEL}>
                Slug (URL) <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id="course-slug"
                type="text"
                placeholder="VD: lap-trinh-reactjs"
                className={COURSE_CONTROL}
                aria-invalid={!!errors.slug}
                {...register("slug")}
              />
              <FieldError className={COURSE_ERROR} errors={[errors.slug]} />
            </Field>

            <Field className={COURSE_FIELD} data-invalid={!!errors.price}>
              <FieldLabel htmlFor="course-price" className={COURSE_LABEL}>
                Giá khóa học (VND)
              </FieldLabel>
              <Input
                id="course-price"
                type="number"
                min="0"
                step="1000"
                className={COURSE_CONTROL}
                aria-invalid={!!errors.price}
                onWheel={(e) => e.currentTarget.blur()}
                {...register("price")}
              />
              <FieldError className={COURSE_ERROR} errors={[errors.price]} />
              <p className="text-xs text-blue-400 text-right">
                {formatCurrency(Number.isFinite(amount) ? amount : 0)}
              </p>
            </Field>
          </div>

          {/* Cột 2 */}
          <div className="flex flex-col gap-4">
            {/* 👇 SELECT GIẢNG VIÊN */}
            <Field
              className={COURSE_FIELD}
              data-invalid={!!errors.instructor_id}
            >
              <FieldLabel htmlFor="course-instructor" className={COURSE_LABEL}>
                Giảng viên phụ trách
              </FieldLabel>
              {/* The instructors load after the page mounts; a new key lets the select take its stored value once its options exist. */}
              <NativeSelect
                key={instructors.length}
                id="course-instructor"
                className={cn(COURSE_CONTROL, "pr-9")}
                aria-invalid={!!errors.instructor_id}
                {...register("instructor_id")}
              >
                <option value="">-- Chọn giảng viên --</option>
                {instructors.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.profiles?.full_name || `Giảng viên #${ins.id}`}
                  </option>
                ))}
              </NativeSelect>
              <FieldError
                className={COURSE_ERROR}
                errors={[errors.instructor_id]}
              />
            </Field>

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
          <Field
            className={cn(COURSE_FIELD, "md:col-span-2")}
            data-invalid={!!errors.description}
          >
            <FieldLabel htmlFor="course-description" className={COURSE_LABEL}>
              Mô tả ngắn
            </FieldLabel>
            <Textarea
              id="course-description"
              rows={3}
              className={cn(COURSE_CONTROL, "min-h-0 resize-none")}
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError
              className={COURSE_ERROR}
              errors={[errors.description]}
            />
          </Field>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
          <button
            type="button"
            className="cursor-pointer px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition"
            onClick={onClose}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="animate-spin" size={18} />}
            {editId ? "Lưu thay đổi" : "Thêm mới"}
          </button>
        </div>
      </form>
    </div>
  );
}
