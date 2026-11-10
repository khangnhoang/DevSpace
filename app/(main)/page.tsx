import { Suspense } from "react";
import { getHomeCourses } from "@/lib/courses.server";
import HomeCourseBrowser from "./_components/HomeCourseBrowser";
import HomeSkeleton from "./_components/HomeSkeleton";

// The course list is read on the server through the API, and the skeleton streams first (AC8). The boundary sits in the
// page and not in a `loading.tsx` of this group, which would also wrap the course, learn and profile pages.
async function HomeCourses() {
  const courses = await getHomeCourses();
  return <HomeCourseBrowser courses={courses} />;
}

export default function Home() {
  return (
    <div className="bg-white min-h-screen w-full text-black flex flex-col overflow-x-hidden pb-20">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeCourses />
      </Suspense>
    </div>
  );
}
