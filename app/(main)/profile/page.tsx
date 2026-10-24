"use client";

import { useEffect, useState, useMemo } from "react";
import ProgressBar from "./ProgressBar";
import {
  getUserDashboardData,
  supabase,
  getProfile,
  updateProfile,
} from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import type { DashboardCourse } from "@/lib/types";
import {
  Camera,
  X,
  Save,
  Loader2,
  Edit,
  History,
  CheckCircle,
  Clock,
  AlertCircle,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { GENDER_OPTIONS, PROVINCES } from "@/lib/constants";
import CustomAvatar from "@/app/components/CustomAvatar";
import { format } from "date-fns";
import { ProfileData } from "@/lib/types";
import { toast } from "sonner";

// --- SKELETON ---
const ProfileSkeleton = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen w-full flex flex-col md:flex-row p-4 gap-4">
      <div className="w-full md:w-1/4 flex flex-col items-center gap-4 bg-white border border-gray-200 p-6 rounded-xl h-fit shadow-sm animate-pulse">
        <div className="w-32 h-32 rounded-full bg-gray-200"></div>
        <div className="flex flex-col items-center gap-2 w-full mt-2">
          <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div className="w-full md:w-3/4 flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mx-auto md:mx-0"></div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EditProfileFormData extends ProfileData {
  file: File | null;
}

// --- MODAL CHỈNH SỬA PROFILE ---
interface EditProfileModalProps {
  userProfile: ProfileData | null;
  onClose: () => void;
  onSave: (formData: EditProfileFormData) => Promise<void>;
}

interface TransactionRow {
  id: number | string;
  course_id: number;
  amount: number;
  status: string;
  created_at: string;
  courses?: { name?: string | null } | null;
}

const EditProfileModal = ({
  userProfile,
  onClose,
  onSave,
}: EditProfileModalProps) => {
  const [formData, setFormData] = useState({
    full_name: userProfile?.full_name || "",
    gender: userProfile?.gender || "",
    dob: userProfile?.dob || "",
    province: userProfile?.province || "",
    avatar_url: userProfile?.avatar_url || "",
  });

  const [previewAvatar, setPreviewAvatar] = useState<string | null>(
    formData.avatar_url,
  );
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToUpload(file);
      setPreviewAvatar(URL.createObjectURL(file));
    }
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    await onSave({ ...formData, file: fileToUpload });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">Cập nhật hồ sơ</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <CustomAvatar
                src={previewAvatar}
                className="w-24 h-24 ring-4 ring-gray-100"
              />
              <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="text-white" size={24} />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <p className="text-xs text-gray-400">Nhấn vào ảnh để thay đổi</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Họ và tên
            </label>
            <input
              type="text"
              className="w-full p-2 border text-gray-500 placeholder:text-gray-500 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Giới tính
              </label>
              <select
                className="w-full p-2 text-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
              >
                <option value="">-- Chọn --</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Ngày sinh
              </label>
              <input
                type="date"
                className="w-full p-2 text-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Tỉnh / Thành phố
            </label>
            <select
              className="w-full p-2 text-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={formData.province}
              onChange={(e) =>
                setFormData({ ...formData, province: e.target.value })
              }
            >
              <option value="">-- Chọn tỉnh thành --</option>
              {PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className="cursor-pointer px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70"
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [myCourses, setMyCourses] = useState<DashboardCourse[]>([]);
  const [rawTransactions, setRawTransactions] = useState<TransactionRow[]>([]); // Data gốc

  // State cho bộ lọc & phân trang
  const [statusFilter, setStatusFilter] = useState<
    "all" | "success" | "pending" | "failed"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Bạn chưa đăng nhập!");
        router.push("/login");
        return;
      }
      setUser(session.user);

      // 1. Fetch Profile & Courses
      const dashboardData = await getUserDashboardData(session.user.id);
      setMyCourses(dashboardData);
      const profileData = await getProfile(session.user.id);
      setUserProfile(profileData || null);

      // 2. Fetch Payments (Lấy tất cả, sort mới nhất trước)
      const { data: payments } = await supabase
        .from("payments")
        .select("*, courses(name)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setRawTransactions(payments || []);
      setLoading(false);
    };
    fetchData();
  }, [router, refreshKey]);

  // --- LOGIC XỬ LÝ LỊCH SỬ GIAO DỊCH (LỌC TRÙNG & FILTER) ---
  const processedTransactions = useMemo(() => {
    // 1. Lọc trùng: Chỉ lấy đơn mới nhất của mỗi khóa học
    const uniqueMap = new Map();
    rawTransactions.forEach((t) => {
      // Vì đã sort created_at desc, nên cái đầu tiên gặp là cái mới nhất
      if (!uniqueMap.has(t.course_id)) {
        uniqueMap.set(t.course_id, t);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());

    // 2. Lọc theo trạng thái
    if (statusFilter === "all") return uniqueList;
    return uniqueList.filter((t) => t.status === statusFilter);
  }, [rawTransactions, statusFilter]);

  // 3. Phân trang
  const totalPages = Math.ceil(processedTransactions.length / ITEMS_PER_PAGE);
  const currentData = processedTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleUpdateProfile = async (formData: EditProfileFormData) => {
    if (!user) {
      toast.error("Không tìm thấy user");
      return;
    }
    const fileToUpload = formData.file;
    const profilePayload = {
      full_name: formData.full_name,
      gender: formData.gender,
      dob: formData.dob,
      province: formData.province,
      avatar_url: formData.avatar_url,
    };
    const result = await updateProfile(user.id, profilePayload, fileToUpload);

    if (result.error) {
      toast.error("Lỗi cập nhật: " + result.error.message);
    } else {
      toast.success("Cập nhật thành công");
      setRefreshKey((prev) => prev + 1);
    }
  };

  if (loading) return <ProfileSkeleton />;

  const displayName =
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0];
  const displayAvatar =
    userProfile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <div className="bg-[#F9FAFB] min-h-screen w-full flex flex-col md:flex-row p-4 gap-4">
      {/* CỘT TRÁI: THẺ THÔNG TIN */}
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col items-center relative sticky top-4">
          <div className="mb-4">
            <CustomAvatar
              src={displayAvatar}
              className="w-32 h-32 text-4xl"
              fontSize="text-4xl"
            />
          </div>

          <h2 className="text-xl font-bold text-gray-800 text-center wrap-break-word w-full">
            {displayName}
          </h2>
          <p className="text-gray-500 text-sm mb-4">{user?.email}</p>

          <div className="w-full text-sm text-gray-600 space-y-3 mb-6 border-t pt-4 border-gray-100">
            <div className="flex justify-between">
              <span>Giới tính:</span>
              <span className="font-medium text-gray-900">
                {GENDER_OPTIONS.find((g) => g.value === userProfile?.gender)
                  ?.label || "Trống"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ngày sinh:</span>
              <span className="font-medium text-gray-900">
                {userProfile?.dob
                  ? format(new Date(userProfile.dob), "dd/MM/yyyy")
                  : "Trống"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Nơi ở:</span>
              <span
                className="font-medium text-gray-900 truncate max-w-[120px]"
                title={userProfile?.province}
              >
                {userProfile?.province || "Trống"}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsEditOpen(true)}
            className="cursor-pointer w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            <Edit size={16} /> Chỉnh sửa hồ sơ
          </button>
        </div>
      </div>

      {/* CỘT PHẢI */}
      <div className="w-full md:w-3/4 flex flex-col gap-8">
        {/* --- PHẦN 1: KHÓA HỌC CỦA TÔI --- */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="text-blue-600" /> Khóa học của tôi
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {myCourses.length > 0 ? (
              myCourses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h1 className="text-lg font-bold text-gray-900">
                      {course.title}
                    </h1>
                    <span
                      className={`text-xs px-2 py-1 rounded font-bold ${
                        course.percent === 100
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {course.percent}%
                    </span>
                  </div>
                  <div>
                    <ProgressBar percent={course.percent} />
                    <div className="mt-2 text-right text-xs text-gray-400">
                      {course.completed}/{course.total} bài học
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
                Bạn chưa tham gia khóa học nào.
              </div>
            )}
          </div>
        </div>

        {/* --- PHẦN 2: LỊCH SỬ GIAO DỊCH (ĐÃ LỌC & PHÂN TRANG) --- */}
        <div>
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <History className="text-purple-600" /> Lịch sử giao dịch
            </h2>

            {/* Bộ lọc trạng thái */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
              <Filter size={16} className="text-gray-500 ml-2" />
              <select
                className="p-1 text-sm bg-transparent outline-none text-gray-700 font-medium cursor-pointer"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  setCurrentPage(1); // Reset về trang 1
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="success">✅ Thành công</option>
                <option value="pending">⏳ Chờ duyệt</option>
                <option value="failed">❌ Thất bại</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[300px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4 border-b">Khóa học</th>
                    <th className="p-4 border-b">Ngày tạo</th>
                    <th className="p-4 border-b">Số tiền</th>
                    <th className="p-4 border-b">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {currentData.length > 0 ? (
                    currentData.map((pay) => (
                      <tr
                        key={pay.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 font-medium text-gray-900">
                          {pay.courses?.name || "Không xác định"}
                        </td>
                        <td className="p-4 text-gray-500">
                          {new Date(pay.created_at).toLocaleDateString("vi-VN")}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(pay.created_at).toLocaleTimeString(
                              "vi-VN",
                            )}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800">
                          {pay.amount.toLocaleString()}đ
                        </td>
                        <td className="p-4">
                          {pay.status === "success" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                              <CheckCircle size={12} /> Thành công
                            </span>
                          )}
                          {pay.status === "pending" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-bold border border-yellow-100">
                              <Clock size={12} /> Chờ duyệt
                            </span>
                          )}
                          {pay.status === "failed" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                              <AlertCircle size={12} /> Thất bại
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-gray-400 italic"
                      >
                        Không tìm thấy giao dịch nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* THANH PHÂN TRANG */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>

                <span className="text-sm font-medium text-gray-600">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditOpen && (
        <EditProfileModal
          userProfile={userProfile}
          onClose={() => setIsEditOpen(false)}
          onSave={handleUpdateProfile}
        />
      )}
    </div>
  );
}
