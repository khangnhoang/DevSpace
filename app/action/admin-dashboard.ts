// actions/admin-dashboard.ts
"use server";

import { createClient } from "@supabase/supabase-js";

// Khởi tạo Admin Client ngay tại đây (kín đáo, không lộ ra ngoài)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function getAdminDashboardStats() {
  try {
    // Logic cũ của ông, dùng supabaseAdmin
    const [
      { count: studentsCount },
      { count: lessonsCount },
      { count: exercisesCount },
      { count: completedCount },
      { count: coursesCount },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "user"),
      supabaseAdmin.from("lessons").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("exercises")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("user_progress")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
    ]);

    return {
      students: studentsCount || 0,
      lessons: lessonsCount || 0,
      exercises: exercisesCount || 0,
      completed: completedCount || 0,
      courses: coursesCount || 0,
    };
  } catch (error) {
    console.error("Lỗi stats:", error);
    return null;
  }
}

export async function getTopStudents() {
  try {
    // BƯỚC 1: Lấy dữ liệu user_progress
    const { data: progressData, error } = await supabaseAdmin
      .from("user_progress")
      .select("user_id");

    if (error || !progressData) return [];

    // BƯỚC 2: Tính toán thủ công
    const leaderboard: Record<string, number> = {};

    progressData.forEach((row: any) => {
      const uid = row.user_id;
      if (uid) {
        leaderboard[uid] = (leaderboard[uid] || 0) + 1;
      }
    });

    // BƯỚC 3: Sắp xếp giảm dần và lấy Top 5
    const topUserIds = Object.keys(leaderboard)
      .sort((a, b) => leaderboard[b] - leaderboard[a])
      .slice(0, 5);

    if (topUserIds.length === 0) return [];

    // BƯỚC 4: Lấy thông tin chi tiết từ profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", topUserIds);

    // BƯỚC 5: Ghép dữ liệu & Xử lý tên hiển thị
    const result = topUserIds.map((id) => {
      const userProfile = profiles?.find((p) => p.id === id);

      // --- LOGIC XỬ LÝ TÊN (MỚI) ---
      let displayName = "Unknown User";

      // 1. Ưu tiên dùng Full Name nếu có
      if (userProfile?.full_name && userProfile.full_name.trim() !== "") {
        displayName = userProfile.full_name;
      }
      // 2. Nếu không, dùng prefix của Email (trước @)
      else if (userProfile?.email) {
        displayName = userProfile.email.split("@")[0];
      }
      // -----------------------------

      return {
        id: id,
        full_name: displayName, // Trả về tên đã xử lý đẹp đẽ
        email: userProfile?.email || "",
        avatar_url: userProfile?.avatar_url || null,
        progress_count: leaderboard[id],
      };
    });

    // Lọc bỏ những user rác (không có email/profile)
    return result.filter((item) => item.email !== "");
  } catch (error) {
    console.error("Lỗi getTopStudents:", error);
    return [];
  }
}

export async function getRecentActivities() {
  try {
    // 1. Lấy hoạt động HOÀN THÀNH BÀI HỌC (từ user_progress)
    const { data: progressData } = await supabaseAdmin
      .from("user_progress")
      .select(
        `
        user_id,
        created_at: completed_at, 
        lessons (
          title,
          courses (name)
        )
      `
      )
      .not("completed_at", "is", null) // Chỉ lấy bài đã xong thực sự
      .order("completed_at", { ascending: false })
      .limit(5);

    // 2. Lấy hoạt động ĐĂNG KÝ KHÓA HỌC (từ enrollments)
    const { data: enrollmentData } = await supabaseAdmin
      .from("enrollments")
      .select(
        `
        user_id,
        created_at,
        courses (name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(5);

    // 3. Chuẩn hóa dữ liệu
    const formattedProgress = (progressData || []).map((item: any) => ({
      type: "completion",
      user_id: item.user_id,
      timestamp: new Date(item.created_at).getTime(),
      date_string: item.created_at,
      main_content: item.lessons?.title,
      sub_content: item.lessons?.courses?.name,
    }));

    const formattedEnrollment = (enrollmentData || []).map((item: any) => ({
      type: "enrollment",
      user_id: item.user_id,
      timestamp: new Date(item.created_at).getTime(),
      date_string: item.created_at,
      main_content: item.courses?.name,
      sub_content: null,
    }));

    // 4. Gộp và Sort -> Lấy Top 5
    const combinedActivities = [...formattedProgress, ...formattedEnrollment]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    if (combinedActivities.length === 0) return [];

    // 5. Lấy thông tin User (Profile)
    const userIds = [...new Set(combinedActivities.map((a) => a.user_id))];

    // 👇 THAY ĐỔI Ở ĐÂY: Thêm field 'email' vào select
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", userIds);

    // 6. Ghép thông tin User vào Activity
    const result = combinedActivities.map((act) => {
      const userProfile = profiles?.find((p) => p.id === act.user_id);

      // 👇 LOGIC XỬ LÝ TÊN HIỂN THỊ MỚI
      let displayName = "User";

      if (userProfile?.full_name && userProfile.full_name.trim() !== "") {
        // Có tên đầy đủ thì dùng
        displayName = userProfile.full_name;
      } else if (userProfile?.email) {
        // Không có tên -> Lấy email, cắt bỏ phần @gmail.com
        displayName = userProfile.email.split("@")[0];
      }

      return {
        ...act,
        user_name: displayName, // Trả về cái tên đã xử lý
        user_avatar: userProfile?.avatar_url || null,
      };
    });

    return result;
  } catch (error) {
    console.error("Lỗi getRecentActivities:", error);
    return [];
  }
}

const CHART_COLORS = ["#00d25b", "#ffab00", "#0090e7", "#fc424a", "#8f5fe8"];

export async function getAdminCourseChartData() {
  // Query bảng courses và đếm số lượng trong bảng enrollments
  const { data: courses, error } = await supabaseAdmin
    .from("courses")
    .select("name, enrollments(count)");

  if (error) {
    console.error("Error fetching chart data:", error.message);
    return [];
  }

  // Transform data
  const rawData =
    courses?.map((course: any) => ({
      name: course.name,
      // enrollments trả về mảng object [{count: n}] do dùng select count
      value: course.enrollments?.[0]?.count || 0,
    })) || [];

  const totalEnrollments = rawData.reduce((sum, item) => sum + item.value, 0);

  // Nếu chưa có ai đăng ký gì cả, trả về mảng rỗng để Chart không lỗi
  if (totalEnrollments === 0) return [];

  // Sort giảm dần
  rawData.sort((a, b) => b.value - a.value);

  // Lấy Top 3
  const top3 = rawData.slice(0, 3);
  const others = rawData.slice(3);

  // Gom nhóm "Khác"
  const finalData = [...top3];
  if (others.length > 0) {
    const othersCount = others.reduce((sum, item) => sum + item.value, 0);
    finalData.push({ name: "Các khóa khác", value: othersCount });
  }

  // Thêm màu và %
  return finalData.map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
    percentage: ((item.value / totalEnrollments) * 100).toFixed(1),
  }));
}
