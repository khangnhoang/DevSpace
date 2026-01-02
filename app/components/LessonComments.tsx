"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Send, MessageSquare } from "lucide-react";
import CustomAvatar from "./CustomAvatar";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

const MOCK_COMMENTS = [
  {
    id: 1,
    content:
      "Admin cho mình hỏi phần CSS Grid này có áp dụng được cho IE cũ không nhỉ?",
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 phút trước
    user_id: "user-01",
    profiles: {
      full_name: "Nguyễn Văn A",
      avatar_url: null, // Test case: Không có avatar
      role: "user",
    },
  },
  {
    id: 2,
    content:
      "Chào bạn, hiện tại Grid hỗ trợ tốt trên các trình duyệt hiện đại. IE thì hạn chế lắm, nên dùng Flexbox nhé!",
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 phút trước
    user_id: "admin-01",
    profiles: {
      full_name: "Admin DevSpace",
      avatar_url: "https://github.com/shadcn.png", // Test case: Có avatar
      role: "admin", // Test case: Role Admin
    },
  },
  {
    id: 3,
    content: "Bài giảng hay quá, cảm ơn team!",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 ngày trước
    user_id: "user-02",
    profiles: {
      full_name: "Trần Thị B",
      avatar_url: null,
      role: "user",
    },
  },
];

interface Props {
  lessonId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function LessonComments({ lessonId, isOpen, onClose }: Props) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- 2. LOGIC FETCH DATA GIẢ ---
  useEffect(() => {
    const fetchComments = async () => {
      if (isOpen) {
        setLoading(true);
        // Giả lập độ trễ mạng 0.5 giây cho giống thật
        setTimeout(() => {
          setComments(MOCK_COMMENTS);
          setLoading(false);
        }, 500);
      }
    };
    fetchComments();
  }, [isOpen, lessonId]);

  return (
    <>
      {/* Overlay trong suốt (Click ra ngoài để đóng) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-transparent"
          onClick={onClose}
        />
      )}
      {/* Drawer Panel (Trượt từ phải sang) */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[400px] bg-white border-l border-gray-200 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-800">Thảo luận</h2>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {comments.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* LIST COMMENTS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">
                Đang tải bình luận...
              </span>
            </div>
          ) : (
            comments.map((cmt) => (
              <div
                key={cmt.id}
                className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                {/* Avatar */}
                <CustomAvatar
                  src={cmt.profiles?.avatar_url}
                  className="w-8 h-8 shrink-0 mt-1"
                  fallbackText={cmt.profiles?.full_name?.[0] || "U"}
                />

                {/* Nội dung Comment */}
                <div className="flex-1">
                  <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100 relative group hover:bg-gray-100 transition-colors">
                    {/* Tên + Badge Admin + Thời gian */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            cmt.profiles?.role === "admin"
                              ? "text-blue-600"
                              : "text-gray-900"
                          }`}
                        >
                          {cmt.profiles?.full_name || "Ẩn danh"}
                        </span>

                        {/* Logic hiển thị Badge Admin */}
                        {cmt.profiles?.role === "admin" && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {formatDistanceToNow(new Date(cmt.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {cmt.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* INPUT (Disabled chờ Backend) */}
        <div className="p-4 border-t bg-white">
          <div className="relative">
            <input
              type="text"
              placeholder="Tính năng bình luận đang bảo trì..."
              disabled
              className="w-full pl-4 pr-10 py-2.5 text-sm border border-gray-300 rounded-full bg-gray-100 text-gray-500 cursor-not-allowed select-none focus:outline-none"
            />
            <button
              disabled
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
