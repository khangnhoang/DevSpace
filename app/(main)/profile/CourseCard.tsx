import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardCourse } from "@/lib/types";
import { courseActionLabel, courseGroupOf } from "@/lib/profile-courses";
import ProgressBar from "./ProgressBar";

// The whole card is not a link: the title stays a heading and the action is one real link (middle-click, keyboard).
export default function CourseCard({ course }: { course: DashboardCourse }) {
  const done = courseGroupOf(course) === "completed";

  return (
    <article className="flex flex-col bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900 wrap-break-word min-w-0">
          {course.title}
        </h3>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded font-bold ${
            done ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-800"
          }`}
        >
          {course.percent}%
        </span>
      </div>
      <div>
        <ProgressBar percent={course.percent} showLabel={false} ariaLabel={`Tiến độ khóa ${course.title}`} />
        <div className="mt-2 text-right text-xs text-gray-500">
          {course.completed}/{course.total} bài học
        </div>
      </div>
      <Link
        href={course.href}
        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          done
            ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {courseActionLabel(course)}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}
