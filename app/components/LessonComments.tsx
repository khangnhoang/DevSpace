"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Send,
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  XCircle,
} from "lucide-react";
import CustomAvatar from "./CustomAvatar";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  getCommentByLesson,
  addComment,
  deleteComment,
  editComment,
  supabase,
} from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  lessonId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface CommentItem {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  deleted_at?: string | null;
  profiles?: {
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
  } | null;
}

export default function LessonComments({ lessonId, isOpen, onClose }: Props) {
  // State dữ liệu
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // State UI
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // State Input
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // State Menu dropdown (ID của comment đang mở menu)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // 1. Lấy User hiện tại
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // 2. Fetch Comments
  useEffect(() => {
    if (isOpen) {
      const fetchComments = async () => {
        if (!lessonId) return;
        setLoading(true);
        const data = await getCommentByLesson(lessonId);
        setComments((data as unknown as CommentItem[]) || []);
        setLoading(false);
      };
      fetchComments();
    }
  }, [isOpen, lessonId, refreshKey]);

  const handleSend = async () => {
    const contentToSubmit = newComment.trim();
    if (!newComment.trim() || !currentUserId) return;

    // --- LOGIC CHỐNG SPAM ---
    // Chỉ kiểm tra các comment CỦA CHÍNH MÌNH (user_id === currentUserId)
    // Nếu tìm thấy nội dung y hệt -> Chặn luôn
    const isDuplicate = comments.some(
      (cmt) =>
        cmt.user_id === currentUserId &&
        cmt.content.trim().toLowerCase() === contentToSubmit.toLowerCase()
    );

    if (isDuplicate) {
      toast.warning("Bạn đã bình luận nội dung này rồi, vui lòng không spam!");
      return; // Dừng hình, không gọi API nữa
    }

    setSending(true);
    const result = await addComment(lessonId, currentUserId, contentToSubmit);

    // Kiểm tra kết quả trả về
    // Nếu có thuộc tính 'message' (Lỗi Spam do mình tự return)
    if (result && "message" in result) {
      toast.warning(result.message);
    }
    // Nếu có thuộc tính 'message' của Supabase Error (Lỗi hệ thống)
    else if (result) {
      toast.error("Gửi bình luận thất bại");
    }
    // Thành công (result là null hoặc undefined)
    else {
      setNewComment("");
      setRefreshKey((prev) => prev + 1);
    }
    setSending(false);
  };

  // 4. Xử lý Xóa Comment
  const handleDelete = async (commentId: number) => {
    if (!currentUserId) return;
    const confirm = window.confirm("Bạn có chắc muốn xóa bình luận này?");
    if (!confirm) return;

    const error = await deleteComment(commentId, currentUserId);
    if (error) {
      toast.error("Xóa thất bại");
    } else {
      setOpenMenuId(null); // Đóng menu
      setRefreshKey((prev) => prev + 1); // Reload list
    }
  };

  // 5. Xử lý Bắt đầu Sửa
  const startEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setOpenMenuId(null); // Đóng menu
  };

  // 6. Xử lý Lưu Sửa
  const handleUpdate = async () => {
    if (!editingId || !currentUserId || !editContent.trim()) return;

    const error = await editComment(editingId, currentUserId, editContent);
    if (error) {
      toast.error("Sửa thất bại");
    } else {
      setEditingId(null);
      setRefreshKey((prev) => prev + 1);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-60 bg-transparent" onClick={onClose} />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-full sm:w-[400px] bg-white border-l border-gray-200 shadow-2xl z-70 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
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
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm">
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </div>
          ) : (
            comments.map((cmt) => {
              const isOwner = currentUserId === cmt.user_id;
              const isEditing = editingId === cmt.id;

              // Kiểm tra xem comment đã xóa chưa
              const isDeleted = !!cmt.deleted_at;

              return (
                <div
                  key={cmt.id}
                  className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group ${
                    isDeleted ? "opacity-60" : ""
                  }`}
                >
                  <CustomAvatar
                    src={cmt.profiles?.avatar_url}
                    className="w-8 h-8 shrink-0 mt-1"
                    fallbackText={cmt.profiles?.full_name?.[0] || "U"}
                  />

                  <div className="flex-1 min-w-0">
                    <div
                      className={`p-3 rounded-2xl rounded-tl-none border relative ${
                        isDeleted
                          ? "bg-gray-100 border-gray-200"
                          : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      {/* Header Comment */}
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
                          {cmt.profiles?.role === "admin" && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">
                              Admin
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(cmt.created_at), {
                              addSuffix: true,
                              locale: vi,
                            })}
                          </span>

                          {/* MENU 3 CHẤM 
    - Chỉ hiện nếu là chủ comment 
    - Chỉ hiện khi chưa xóa (!isDeleted)
    - Không hiện khi đang sửa (!isEditing)
*/}
                          {isOwner && !isEditing && !isDeleted && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenMenuId(
                                    openMenuId === cmt.id ? null : cmt.id
                                  )
                                }
                                // 👇 FIX Ở ĐÂY:
                                // opacity-100: Mặc định hiện (cho Mobile/Tablet)
                                // lg:opacity-0: Lên màn hình lớn (Desktop) thì ẩn đi
                                // lg:group-hover:opacity-100: Di chuột vào dòng comment trên Desktop mới hiện lại
                                className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {/* Menu Dropdown nhỏ */}
                              {openMenuId === cmt.id && (
                                <div className="absolute right-0 top-6 bg-white shadow-lg border border-gray-100 rounded-md z-10 py-1 min-w-[100px] animate-in zoom-in-95">
                                  <button
                                    onClick={() => startEdit(cmt)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                                  >
                                    <Edit2 size={12} /> Sửa
                                  </button>
                                  <button
                                    onClick={() => handleDelete(cmt.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 size={12} /> Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* --- NỘI DUNG COMMENT --- */}
                      {isDeleted ? (
                        // 1. Trường hợp ĐÃ XÓA
                        <p className="text-sm text-gray-500 italic flex items-center gap-2 py-1 select-none">
                          <Trash2 size={14} />
                          <span>
                            Bình luận đã bị xóa{" "}
                            {cmt.deleted_at &&
                              formatDistanceToNow(new Date(cmt.deleted_at), {
                                addSuffix: true,
                                locale: vi,
                              })}
                          </span>
                        </p>
                      ) : isEditing ? (
                        // 2. Trường hợp ĐANG SỬA
                        <div className="mt-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-gray-900 w-full text-sm p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            rows={2}
                          />
                          <div className="flex gap-2 mt-2 justify-end">
                            <button
                              onClick={() => setEditingId(null)}
                              className="cursor-pointer p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Hủy"
                            >
                              <XCircle size={16} />
                            </button>
                            <button
                              onClick={handleUpdate}
                              className="cursor-pointer p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Lưu"
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 3. Trường hợp BÌNH THƯỜNG
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed wrap-break-word">
                          {cmt.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* INPUT FOOTER */}
        <div className="p-4 border-t bg-white shrink-0">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                currentUserId ? "Viết bình luận..." : "Đăng nhập để bình luận"
              }
              disabled={!currentUserId || sending}
              className="placeholder:text-gray-400 duration-300 text-gray-800 w-full pl-4 pr-10 py-2.5 text-sm border border-gray-300 rounded-full bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!newComment.trim() || sending || !currentUserId}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${
                newComment.trim() && !sending
                  ? "text-blue-600 hover:bg-blue-50 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed"
              }`}
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
