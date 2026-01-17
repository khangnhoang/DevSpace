"use client"; // 👈 Bắt buộc phải có để dùng usePathname

import {
  ChartPie,
  SquareChartGantt,
  Users,
  BookOpenText,
  TableOfContents,
  BadgeDollarSign,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation"; // 👈 Hook lấy đường dẫn

interface SidebarAdminProps {
  isOpen?: boolean;
}

export default function SidebarAdmin({ isOpen = true }: SidebarAdminProps) {
  const pathname = usePathname(); // Lấy đường dẫn hiện tại (VD: /admin/users)

  // Danh sách menu để render cho gọn
  const menuItems = [
    {
      href: "/admin",
      label: "Thống Kê",
      icon: ChartPie,
      iconColor: "text-purple-500",
    },
    {
      href: "/admin/courses",
      label: "Quản lý khóa học",
      icon: BookOpenText,
      iconColor: "text-green-500",
    },
    {
      href: "/admin/lessons",
      label: "Quản lí bài học",
      icon: SquareChartGantt,
      iconColor: "text-orange-500",
    },
    {
      href: "/admin/users",
      label: "Quản lý người dùng",
      icon: Users,
      iconColor: "text-red-500",
    },
    {
      href: "/admin/chapters",
      label: "Quản lí chương",
      icon: TableOfContents,
      iconColor: "text-yellow-500",
    },
    {
      href: "/admin/transactions",
      label: "Quản lí giao dịch",
      icon: BadgeDollarSign,
      iconColor: "text-blue-500",
    },
  ];

  return (
    <div
      className={`
        fixed left-0 top-16 bottom-0 bg-[#191C24] overflow-y-auto transition-all duration-300 ease-in-out z-40 border-t border-gray-700 shadow-2xl
        ${
          isOpen
            ? "w-64 translate-x-0 opacity-100" // Mobile mở
            : "w-0 -translate-x-full opacity-0 md:w-64 md:translate-x-0 md:opacity-100" // PC luôn hiện, Mobile đóng
        }
      `}
    >
      <div className="flex flex-col py-4 w-64 gap-4">
        {menuItems.map((item) => {
          // Logic kiểm tra Active:
          // 1. Nếu là trang chủ Dashboard (/admin) thì phải trùng khớp hoàn toàn
          // 2. Các trang con (VD: /admin/users) thì chỉ cần bắt đầu bằng href (để khi vào trang con edit/create nó vẫn sáng)
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex gap-2 items-center py-3 px-4 rounded-r-full transition-all duration-200
                ${
                  isActive
                    ? "border-l-4 border-blue-500 bg-[#2A2D3E]" // 🔥 Active: Có border trái + nền sáng hơn
                    : "border-l-4 border-transparent hover:bg-[#222530]" // Bình thường: Border trong suốt (để không bị nhảy layout)
                }
              `}
            >
              <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
                <item.icon size={15} className={item.iconColor} />
              </div>
              <span
                className={`font-medium ${
                  isActive ? "text-white" : "text-gray-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}