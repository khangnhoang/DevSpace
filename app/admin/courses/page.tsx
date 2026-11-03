import { getAdminCourseData } from "@/lib/supabase";
import CoursesClientPage from "@/app/admin/courses/_components/CoursesClient";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await getAdminCourseData();

  return <CoursesClientPage courses={courses || []} />;
}
