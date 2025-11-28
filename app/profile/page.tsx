import ProgressBar from "./PropressBar"
import { getUserDashboardData, supabase } from "@/lib/supabase"
import { redirect } from "next/navigation"

export default async function ProfilePage(){
    const {data: {session}} = await supabase.auth.getSession();
    // if (!session?.user) {
    //     redirect("/login");
    // }

    const user = session.user; 
    const firstLetter = user.email?.charAt(0).toUpperCase() || "U";
    const displayName = user.email?.split("@")[0];
    const myCourses = await getUserDashboardData(user.id); 

    return (
        <div className="bg-[#F9FAFB] h-screen w-screen flex">
            <div className="m-3 w-1/4 flex flex-col items-center gap-2 bg-[#6A7282] p-4 rounded-md">
                <div className="w-40 h-40 rounded-full">{firstLetter}</div>
                <p className="text-2xl font-bold">{displayName}</p>
                <p>{user.email}</p>
            </div>
            <div className="m-3 w-3/4 flex flex-col gap-2 p-4 text-black bg-gray-200 rounded-xl">
                {myCourses.length > 0 ? (
  myCourses.map((course: any) => (
    <div key={course.id} className="...">
      <div>
        <h1>{course.title}</h1>
      </div>

      <div>
        <h2>Tiến độ học tập</h2>
        <div>
          {/* ví dụ dùng component ProgressBar */}
          <ProgressBar percent={course.percent} />
        </div>
      </div>
    </div>
  ))
) : (<div> </div>)}
            </div>
        </div>
    )
}