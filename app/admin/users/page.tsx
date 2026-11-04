"use client";
import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { type UserProfile, getAllUsersForUsersManager } from "@/lib/supabase";
import { deleteUserAccount } from "@/app/action/user";
import { toast } from "sonner";
import CustomAvatar from "@/app/components/CustomAvatar";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import UserFormDialog from "./_components/UserFormDialog";

// 1. ĐỊNH NGHĨA SỐ DÒNG TRÊN 1 TRANG
const ITEMS_PER_PAGE = 7;

export default function UsersManagerPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<UserProfile[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  // 2. THÊM STATE CHO TRANG HIỆN TẠI
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenForm = () => {
    setEditingUser(null);
    setIsOpenForm(true);
  };

  const handleOpenEditForm = (u: UserProfile) => {
    setEditingUser(u);
    setIsOpenForm(true);
  };

  const handleDelete = async (id: string) => {
    // ConfirmDialog swallows a rejection, so a failure in transit is reported here.
    let result;
    try {
      result = await deleteUserAccount(id);
    } catch {
      toast.error(
        "Không nhận được kết quả từ máy chủ. Hãy tải lại trang để kiểm tra người dùng.",
      );
      return;
    }

    if (result.error) {
      toast.error("Xóa người dùng thất bại: " + result.error);
    } else {
      toast.success("Đã xóa vĩnh viễn người dùng khỏi hệ thống!");
      setRefreshKey((prev) => prev + 1);
    }
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
    currentPage * ITEMS_PER_PAGE,
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
                          <button
                            onClick={() => handleOpenEditForm(u)}
                            aria-label={`Sửa người dùng ${u.full_name || u.email}`}
                            className="cursor-pointer hover:bg-blue-500/20 hover:text-blue-400 p-2 rounded-md text-[#979EAA] transition-colors"
                          >
                            <SquarePen size={20} />
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

        {isOpenForm && (
          <UserFormDialog
            user={editingUser}
            onClose={() => setIsOpenForm(false)}
            onSaved={() => setRefreshKey((prev) => prev + 1)}
          />
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
