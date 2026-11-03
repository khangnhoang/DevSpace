import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import type { DashboardCourse } from "@/lib/types";
import { NO_COURSE_IMAGE } from "@/lib/constants";
import { courseActionLabel, courseGroupOf } from "@/lib/profile-courses";
import ProgressBar from "./ProgressBar";

// The title sits next to the image, so the image has an empty alt.
function CourseImage({ course, className, sizes }: { course: DashboardCourse; className: string; sizes: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-gray-100 ${className}`}>
      <Image
        src={course.imageUrl || NO_COURSE_IMAGE}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}

// The course the learner is on: image, title, progress and the way back in as the primary action.
export function FeaturedCourseCard({ course }: { course: DashboardCourse }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:flex-row">
      <CourseImage
        course={course}
        className="aspect-video w-full md:aspect-auto md:w-2/5"
        sizes="(min-width: 768px) 40vw, 100vw"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <h3 className="text-lg font-bold text-gray-900 wrap-break-word">{course.title}</h3>
        <div>
          <ProgressBar percent={course.percent} ariaLabel={`Tiến độ khóa ${course.title}`} />
          <div className="mt-2 text-right text-xs text-gray-500">
            {course.completed}/{course.total} bài học
          </div>
        </div>
        <Link
          href={course.href}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 max-md:w-full max-md:self-stretch"
        >
          {courseActionLabel(course)}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

// A compact row (about 64px at 375px): small image, title, a thin bar or a status, and the link.
export function CourseRow({ course }: { course: DashboardCourse }) {
  const group = courseGroupOf(course);

  return (
    <article className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
      <CourseImage course={course} className="h-12 w-12 rounded-lg" sizes="48px" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-gray-900" title={course.title}>
          {course.title}
        </h3>
        {course.total === 0 ? (
          <p className="text-xs text-gray-500">Chưa có bài học</p>
        ) : group === "completed" ? (
          <p className="flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle size={14} aria-hidden="true" /> Hoàn thành
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-16 shrink-0 sm:w-24">
              <ProgressBar
                percent={course.percent}
                showLabel={false}
                thin
                ariaLabel={`Tiến độ khóa ${course.title}`}
              />
            </div>
            <span className="whitespace-nowrap text-xs text-gray-500">
              {course.completed}/{course.total} bài học
            </span>
          </div>
        )}
      </div>
      <Link
        href={course.href}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          group === "completed" || course.total === 0
            ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
            : "border border-blue-600 text-blue-700 hover:bg-blue-50"
        }`}
      >
        {courseActionLabel(course)}
      </Link>
    </article>
  );
}
