"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import ConfirmDialog from "./ConfirmDialog";
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
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  commentSchema,
  type CommentFormInput,
  type CommentFormValues,
} from "@/lib/schemas/learner-forms";

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

// The edit box of one comment. It is its own form, so each edited comment keeps its own text, error and pending state.
function CommentEditForm({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string;
  onSave: (content: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CommentFormInput, unknown, CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: initialContent },
  });
  const [saving, setSaving] = useState(false);
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting.
  const savingRef = useRef(false);

  const save = async (values: CommentFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(values.content);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(save)(e)} noValidate className="mt-2">
      <Field className="gap-1" data-invalid={!!errors.content}>
        <Textarea
          rows={2}
          aria-label="Sửa bình luận"
          aria-invalid={!!errors.content}
          className="field-sizing-fixed min-h-0 w-full rounded-md border-blue-300 bg-white p-2 text-sm text-gray-900 shadow-none focus-visible:border-blue-300 focus-visible:ring-1 focus-visible:ring-blue-500 aria-invalid:border-red-300 aria-invalid:ring-red-200 md:text-sm"
          {...register("content")}
        />
        <FieldError className="text-xs" errors={[errors.content]} />
      </Field>
      <div className="flex gap-2 mt-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
          title="Hủy"
        >
          <XCircle size={16} />
        </button>
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
          title="Lưu"
        >
          <Check size={16} />
        </button>
      </div>
    </form>
  );
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
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CommentFormInput, unknown, CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });
  const draft = useWatch({ control, name: "content" });
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting, so a second
  // Enter can pass a state-only check.
  const sendingRef = useRef(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // State Menu dropdown (ID của comment đang mở menu)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);

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

  const handleSend = async ({
    content: contentToSubmit,
  }: CommentFormValues) => {
    if (sendingRef.current || !currentUserId) return;

    // --- LOGIC CHỐNG SPAM ---
    // Chỉ kiểm tra các comment CỦA CHÍNH MÌNH (user_id === currentUserId)
    // Nếu tìm thấy nội dung y hệt -> Chặn luôn
    const isDuplicate = comments.some(
      (cmt) =>
        cmt.user_id === currentUserId &&
        cmt.content.trim().toLowerCase() === contentToSubmit.toLowerCase(),
    );

    if (isDuplicate) {
      toast.warning("Bạn đã bình luận nội dung này rồi, vui lòng không spam!");
      return; // Dừng hình, không gọi API nữa
    }

    sendingRef.current = true;
    setSending(true);
    try {
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
        reset({ content: "" });
        setRefreshKey((prev) => prev + 1);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const handleSendSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(handleSend)(e);

  // 4. Xử lý Xóa Comment
  const handleDelete = async (commentId: number) => {
    if (!currentUserId) return;

    const error = await deleteComment(commentId);
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
    setOpenMenuId(null); // Đóng menu
  };

  // 6. Xử lý Lưu Sửa
  const handleUpdate = async (content: string): Promise<boolean> => {
    if (!editingId || !currentUserId) return false;

    const error = await editComment(editingId, currentUserId, content);
    if (error) {
      toast.error("Sửa thất bại");
      return false;
    }
    setEditingId(null);
    setRefreshKey((prev) => prev + 1);
    return true;
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

              return (
                <div
                  key={cmt.id}
                  className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group"
                >
                  <CustomAvatar
                    src={cmt.profiles?.avatar_url}
                    className="w-8 h-8 shrink-0 mt-1"
                    fallbackText={cmt.profiles?.full_name?.[0] || "U"}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="p-3 rounded-2xl rounded-tl-none border relative bg-gray-50 border-gray-100">
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
    - Không hiện khi đang sửa (!isEditing)
*/}
                          {isOwner && !isEditing && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenMenuId(
                                    openMenuId === cmt.id ? null : cmt.id,
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
                                    onClick={() => {
                                      if (currentUserId) setDeleteTarget(cmt);
                                    }}
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
                      {isEditing ? (
                        // 1. Trường hợp ĐANG SỬA
                        <CommentEditForm
                          initialContent={cmt.content}
                          onSave={handleUpdate}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        // 2. Trường hợp BÌNH THƯỜNG
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
        <form
          onSubmit={handleSendSubmit}
          noValidate
          className="p-4 border-t bg-white shrink-0"
        >
          <Field className="gap-2" data-invalid={!!errors.content}>
            <div className="relative flex items-center gap-2">
              <Input
                type="text"
                placeholder={
                  currentUserId ? "Viết bình luận..." : "Đăng nhập để bình luận"
                }
                disabled={!currentUserId || sending}
                aria-invalid={!!errors.content}
                className="h-auto placeholder:text-gray-400 duration-300 text-gray-800 w-full pl-4 pr-10 py-2.5 text-sm border-gray-300 rounded-full bg-gray-50 shadow-none focus-visible:bg-white focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-100 transition-all disabled:pointer-events-auto disabled:opacity-60 disabled:cursor-not-allowed md:text-sm"
                {...register("content")}
              />
              <button
                type="submit"
                aria-label="Gửi bình luận"
                disabled={!draft?.trim() || sending || !currentUserId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${
                  draft?.trim() && !sending
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
            <FieldError className="pl-4 text-xs" errors={[errors.content]} />
          </Field>
        </form>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          tone="learner"
          destructive
          title="Xóa bình luận"
          description={`Bạn có chắc muốn xóa bình luận "${
            deleteTarget.content.length > 80
              ? deleteTarget.content.slice(0, 80) + "…"
              : deleteTarget.content
          }" không? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa bình luận"
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </>
  );
}
