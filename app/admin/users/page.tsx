"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Mail,
  Shield,
  Calendar,
  Loader2,
  Edit,
  MoreVertical,
  SquarePen,
  Trash,
} from "lucide-react";
import { type UserProfile, getAllUsersForUsersManager } from "@/lib/supabase";

export default function UsersManagerPage() {
  const [user, setUser] = useState<UserProfile[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const data = await getAllUsersForUsersManager();
      setUser(data);
    };
    fetchUsers();
  }, []);

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
      valueColor: "text-white", // Màu chữ số lượng
      iconColor: "text-[#3B81F4]", // Màu icon
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
    <div className="bg-[#0f1116] h-full p-4 flex flex-col gap-4">
      <div className="flex justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Users size={30} className="text-[#3B81F4]"></Users>
            <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          </div>
          <p className="text-[#9CA3AF]">
            Theo dõi, phân quyền và quản lý trạng thái tài khoản thành viên.
          </p>
        </div>

        <button className="bg-[#3B81F4] p-2 rounded-xl hover:bg-[#2563EB] cursor-pointer flex items-center">
          <Plus></Plus>Thêm thành viên
        </button>
      </div>

      <div className="flex gap-2">
        {statCards.map((card, index) => (
          <div
            className="flex flex-col w-1/3 p-3 bg-[#191c24] rounded-md"
            key={index}
          >
            <h4 className="font-bold text-[#9CA3AF]">{card.label}</h4>
            <div className="flex justify-between items-center">
              <span className={`${card.valueColor}`}>{card.value}</span>
              <div className="bg-[#2C3039] p-2 rounded-md">
                <card.icon className={`${card.iconColor} `} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex bg-[#191c24] p-4 rounded-md gap-4">
        <div className="flex gap-2 items-center bg-[#2C3039] p-3 rounded-md">
          <Search size={20}></Search>
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {[
            { id: "all", label: "tất cả" },
            { id: "admin", label: "Quản trị viên" },
            { id: "user", label: "Người dùng" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setRoleFilter(btn.id)}
              className={`cursor-pointer py-2 px-4 rounded-lg font-medium transition-colors whitespace-nowrap ${
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

      <div className="bg-[#191C24] rounded-xl overflow-hidden border border-gray-800/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#222732] text-[#999C9E] text-sm uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-5 font-medium">Thành viên</th>
                <th className="px-6 py-5 font-medium">Vai trò</th>
                <th className="px-6 py-5 font-medium">Ngày tham gia</th>
                <th className="px-6 py-5 font-medium text-right">Hành động</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers?.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-800 hover:bg-[#2C3039] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt="Avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-white select-none bg-[#3B81F4] rounded-full py-1 px-3 flex items-center">
                            {u.email?.charAt(0).toUpperCase()}
                          </span>
                        )}

                        <div className="flex flex-col">
                          <span className="text-white font-bold">
                            {u.full_name ? u.full_name : "Chưa điền họ tên"}
                          </span>
                          <span className="text-[#6b7280]">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {u.role === "admin" ? (
                        <span className="border-purple-400 border p-2 rounded-md text-purple-500 ">
                          {u.role}
                        </span>
                      ) : (
                        <span className="border-blue-400 border p-2 rounded-md text-blue-500">
                          {u.role}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-[#9CA3AF]">
                        {formatDate(u.created_at)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex">
                        <button className="cursor-pointer hover:bg-blue-500 hover:text-white p-2 rounded-md text-[#979EAA]">
                          <SquarePen size={20} />
                        </button>
                        <button className="cursor-pointer hover:bg-red-500 hover:text-white p-2 rounded-md text-[#979EAA]">
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

        <div className="flex justify-between items-center px-6 py-4 bg-[#191C24] border-t border-gray-800">
          <span className="text-[#6b7280]">
            Đã hiển thị {filteredUsers.length} kết quả
          </span>
          <div className="flex gap-2">
            <button
              disabled
              className="p-2 bg-[#2C3039] rounded-lg disabled:opacity-50 cursor-not-allowed text-gray-400"
            >
              <ChevronLeft size={20} className="text-[#6b7280]"></ChevronLeft>
            </button>
            <button
              disabled
              className="p-2 bg-[#2C3039] rounded-lg disabled:opacity-50 cursor-not-allowed text-gray-400"
            >
              <ChevronRight size={20} className="text-[#6b7280]"></ChevronRight>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
