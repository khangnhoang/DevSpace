"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Shield,
  Calendar,
  SquarePen,
  Trash,
  X,
  Save,
  Upload,
} from "lucide-react";
import {
  type UserProfile,
  getAllUsersForUsersManager,
  editUser,
  uploadUserAvatar,
} from "@/lib/supabase";
import { createNewUser, deleteUserAccount } from "@/app/action/user";
import { toast } from "sonner";
import CustomAvatar from "@/app/components/CustomAvatar";
import ConfirmDialog from "@/app/components/ConfirmDialog";

// 1. ĐỊNH NGHĨA SỐ DÒNG TRÊN 1 TRANG
const ITEMS_PER_PAGE = 7;

export default function UsersManagerPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<UserProfile[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. THÊM STATE CHO TRANG HIỆN TẠI
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenForm = () => {
    setEditingUser(null);
    setEmail("");
    setName("");
    setPassword("");
    setRole("user");
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handleOpenEditForm = (u: UserProfile) => {
    setEditingUser(u);
    setEmail(u.email);
    setName(u.full_name || "");
    setRole(u.role);
    setPreviewUrl(u.avatar_url);
    setSelectedFile(null);
    setIsOpenForm(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteUserAccount(id);

    if (result.error) {
      toast.error("Xóa người dùng thất bại: " + result.error);
    } else {
      toast.success("Đã xóa vĩnh viễn người dùng khỏi hệ thống!");
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleSave = async () => {
    if (!email) {
      toast.warning("Vui lòng nhập email");
      return;
    }
    if (!editingUser && password.length < 8) {
      toast.warning("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }
    setIsLoading(true);

    let finalAvatarURL = previewUrl || "";
    if (selectedFile) {
      const uploadedURL = await uploadUserAvatar(selectedFile);
      if (uploadedURL) {
        finalAvatarURL = uploadedURL;
      } else {
        toast.error("Lỗi khi upload avatar user");
        setIsLoading(false);
        return;
      }
    }

    let result;

    if (editingUser) {
      result = await editUser(
        editingUser.id,
        {
          full_name: name,
          avatar_url: finalAvatarURL,
          role,
        },
        null
      );
    } else {
      result = await createNewUser({
        email: email,
        fullName: name,
        role: role,
        avatarUrl: finalAvatarURL,
        password: password,
      });
    }

    if (result.error) {
      toast.error("Lưu người dùng thất bại" + result.error);
    } else {
      toast.success(editingUser ? "Sửa thành công" : "Thêm thành công");
      setIsOpenForm(false);
      setRefreshKey((prev) => prev + 1);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const data = await getAllUsersForUsersManager();
      setUser(data);
    };
    fetchUsers();
  }, [refreshKey]);

  // Lọc user
  const filteredUsers = useMemo(() => {
    if (!user) return [];

    return user.filter((u) => {
      const searchLower = searchQuery.toLowerCase();
      const matchName =
        u.full_name?.toLowerCase().includes(searchLower) || false;
      const mathchEmail = u.email.toLowerCase().includes(searchLower) || false;
      const matchesSearch = matchName || mathchEmail;

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [user, searchQuery, roleFilter]);

  // 3. LOGIC PHÂN TRANG (Cắt mảng dựa trên trang hiện tại)
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = useMemo(() => {
    return {
      total: user?.length || 0,
      admin: user?.filter((u) => u.role === "admin").length || 0,
      user: user?.filter((u) => u.role === "user").length || 0,
    };
  }, [user]);

  const statCards = [
    {
      label: "Tổng người dùng",
      value: stats.total,
      icon: Users,
      valueColor: "text-white",
      iconColor: "text-[#3B81F4]",
    },
    {
      label: "Quản trị viên",
      value: stats.admin,
      icon: Shield,
      valueColor: "text-purple-400",
      iconColor: "text-purple-500",
    },
    {
      label: "Học viên",
      value: stats.user,
      icon: Calendar,
      valueColor: "text-green-400",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="lg:ml-6 md:ml-2">
      <div className="bg-[#0f1116] min-h-screen h-full p-3 md:p-3 flex flex-col gap-4 text-white font-sans rounded-md w-full">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Users
                size={30}
                className="text-[#3B81F4] md:w-[30px] md:h-[30px]"
              ></Users>
              <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
            </div>
            <p className="text-[#9CA3AF]">
              Theo dõi, phân quyền và quản lý trạng thái tài khoản thành viên.
            </p>
          </div>

          <button
            onClick={handleOpenForm}
            className="w-full md:w-auto bg-[#3B81F4] p-2 md:py-2 md:px-4 rounded-xl hover:bg-[#2563EB] cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            <Plus></Plus>Thêm thành viên
          </button>
        </div>

        {/* STATS */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4">
          {statCards.map((card, index) => (
            <div
              className="flex flex-col w-full md:w-1/3 p-3 bg-[#191c24] rounded-md shadow-sm border border-transparent hover:border-gray-700 transition-colors"
              key={index}
            >
              <h4 className="font-bold text-[#9CA3AF] text-sm md:text-base">
                {card.label}
              </h4>
              <div className="flex justify-between items-center mt-2">
                <span className={`${card.valueColor}`}>{card.value}</span>
                <div className="bg-[#2C3039] p-2 rounded-md">
                  <card.icon className={`${card.iconColor} `} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER & SEARCH */}
        <div className="flex flex-col md:flex-row bg-[#191c24] p-3 md:p-4 rounded-md gap-3 md:gap-4">
          <div className="flex flex-1 gap-2 items-center bg-[#2C3039] p-2 md:p-3 rounded-md border border-gray-700 focus-within:border-[#3B81F4] transition-colors">
            <Search size={20}></Search>
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="bg-transparent focus:outline-none w-full text-white placeholder-gray-500"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset về trang 1 khi tìm kiếm
              }}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            {[
              { id: "all", label: "tất cả" },
              { id: "admin", label: "Quản trị viên" },
              { id: "user", label: "Người dùng" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setRoleFilter(btn.id);
                  setCurrentPage(1); // Reset về trang 1 khi lọc
                }}
                className={`cursor-pointer py-2 px-3 md:px-4 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base ${
                  roleFilter === btn.id
                    ? "bg-[#3B81F4] text-white shadow-md"
                    : "bg-[#2C3039] text-gray-400 hover:text-white hover:bg-[#323642]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#191C24] rounded-xl overflow-hidden border border-gray-800/50 shadow-sm flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#222732] text-[#999C9E] text-xs md:text-sm uppercase tracking-wider border-b border-gray-800">
                  <th className="px-4 md:px-6 py-4 md:py-5 font-medium">
                    Thành viên
                  </th>
                  <th className="px-4 md:px-6 py-4 md:py-5 font-medium">
                    Vai trò
                  </th>
                  <th className="px-4 md:px-6 py-4 md:py-5 font-medium">
                    Ngày tham gia
                  </th>
                  <th className="px-4 md:px-6 py-4 md:py-5 font-medium text-right">
                    Hành động
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* 4. RENDER PAGINATED USERS THAY VÌ FILTERED USERS */}
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-800 hover:bg-[#2C3039] transition-colors group"
                    >
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex gap-3 items-center">
                          <CustomAvatar
                            src={u.avatar_url}
                            className="h-10 w-10 md:h-12 md:w-12"
                            fontSize="text-base md:text-lg"
                          />

                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-bold truncate">
                              {u.full_name ? u.full_name : "Chưa điền họ tên"}
                            </span>
                            <span className="text-[#6b7280]">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {u.role === "admin" ? (
                          <span className="inline-block border border-purple-500/30 bg-purple-500/10 px-2 py-1 rounded text-xs md:text-sm text-purple-400 font-medium">
                            {u.role}
                          </span>
                        ) : (
                          <span className="inline-block border border-blue-500/30 bg-blue-500/10 px-2 py-1 rounded text-xs md:text-sm text-blue-400 font-medium">
                            {u.role}
                          </span>
                        )}
                      </td>

                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className="text-[#9CA3AF] text-sm md:text-base">
                          {formatDate(u.created_at)}
                        </span>
                      </td>

                      <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="cursor-pointer hover:bg-blue-500/20 hover:text-blue-400 p-2 rounded-md text-[#979EAA] transition-colors">
                            <SquarePen
                              size={20}
                              onClick={() => handleOpenEditForm(u)}
                            />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            aria-label={`Xóa người dùng ${u.full_name || u.email}`}
                            className="cursor-pointer hover:bg-red-500/20 hover:text-red-400 p-2 rounded-md text-[#979EAA] transition-colors"
                          >
                            <Trash size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Search size={32} className="opacity-50" />
                        <p>Không tìm thấy kết quả nào.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 5. FOOTER PHÂN TRANG */}
          <div className="flex justify-between items-center px-4 md:px-6 py-4 bg-[#191C24] border-t border-gray-800">
            <span className="text-[#6b7280] text-sm">
              Trang <strong className="text-white">{currentPage}</strong> /{" "}
              {totalPages > 0 ? totalPages : 1}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="cursor-pointer p-1.5 md:p-2 bg-[#2C3039] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="cursor-pointer p-1.5 md:p-2 bg-[#2C3039] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* MODAL FORM (Giữ nguyên) */}
        {isOpenForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg md:w-[600px] flex flex-col bg-[#191C24] rounded-lg shadow-2xl border border-gray-800 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#222732] rounded-t-lg">
                <div className="text-lg md:text-xl flex items-center gap-2 font-semibold">
                  {editingUser ? (
                    <>
                      <SquarePen size={20} className="text-[#3B81F4]" />
                      <h1>Cập Nhật Thông Tin</h1>
                    </>
                  ) : (
                    <>
                      <Plus size={20} className="text-[#3B81F4]" />
                      <h1>Thêm Thành Viên Mới</h1>
                    </>
                  )}
                </div>
                <X
                  size={35}
                  onClick={() => setIsOpenForm(false)}
                  className="hover:bg-[#374151] cursor-pointer rounded-md p-1 transition-colors text-gray-400 hover:text-white"
                />
              </div>
              <div className="flex flex-col bg-[#191C24] w-full gap-2 p-3">
                <span>EMAIL</span>
                <input
                  type="text"
                  name=""
                  id=""
                  className={`p-2 bg-[#2C3039] rounded-md ${
                    editingUser ? "cursor-not-allowed opacity-35" : ""
                  }`}
                  placeholder="helo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editingUser}
                />
                {!editingUser && (
                  <>
                    <span>MẬT KHẨU</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="p-2 bg-[#2C3039] rounded-md"
                      placeholder="Tối thiểu 8 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </>
                )}
                <span>HỌ VÀ TÊN</span>
                <input
                  type="text"
                  name=""
                  id=""
                  className="p-2 bg-[#2C3039] rounded-md"
                  placeholder="Nguyen Van A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {/* PHẦN UPLOAD */}
                <div className="flex ">
                  <div
                    className="relative group w-28 h-28 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden hover:border-[#3B81F4] transition-all bg-[#2C3039]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL that next/image does not optimize, tracked in BL-003
                      <img
                        src={previewUrl}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 group-hover:text-[#3B81F4]">
                        <Upload size={32} />
                        <span className="text-xs mt-1">Upload</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <SquarePen className="text-white" size={24} />
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                <span>VAI TRÒ</span>
                <select
                  name=""
                  id=""
                  className="p-2 bg-[#2C3039] rounded-md"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option>Chọn vai trò</option>
                  {[
                    { id: 1, role: "user" },
                    { id: 2, role: "admin" },
                  ].map((o) => (
                    <option value={o.role} key={o.id}>
                      {o.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full bg-[#222732] flex justify-end items-center p-4 rounded-b-md gap-4">
                <button
                  onClick={() => setIsOpenForm(false)}
                  className="hover:bg-[#374151] cursor-pointer p-2 rounded-md text-sm"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="hover:bg-[#2563eb] cursor-pointer p-2 rounded-md text-sm bg-blue-400 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isLoading ? (
                    "Đang xử lý..."
                  ) : editingUser ? (
                    <>
                      <Save size={16} /> Lưu Thay Đổi
                    </>
                  ) : (
                    <>
                      <Plus size={16} /> Thêm Tài Khoản
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          tone="admin"
          destructive
          title="Xóa người dùng"
          description={`Bạn có chắc chắn muốn xóa người dùng ${deleteTarget.full_name || deleteTarget.email} không? Tài khoản cùng đăng ký học, đơn thanh toán, bình luận, ghi chú và tiến độ học sẽ bị xóa vĩnh viễn.`}
          confirmLabel="Xóa người dùng"
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}
