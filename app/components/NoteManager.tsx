"use client";

import { useState, useEffect, useRef } from "react";
import { 
  NotebookPen, 
  X, 
  PlusCircle, 
  Trash2, 
  PlayCircle, 
  Loader2, 
  Clock 
} from "lucide-react";
import { toast } from "sonner";
import { YouTubePlayer } from "react-youtube";
import { createNote, deleteNote, getLessonNotes } from "@/lib/supabase";

// Hàm format thời gian
const formatTime = (seconds: number) => {
  if (!seconds) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
};

interface Props {
  userId: string;
  lessonId: number;
  player: YouTubePlayer | null; // Nhận player để lấy thời gian
}

export default function NoteManager({ userId, lessonId, player }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Mở modal -> Load danh sách note & Pause video
  const handleOpen = async () => {
    setIsOpen(true);
    player?.pauseVideo(); // Tự động pause video để user ghi chú
    
    setIsLoadingNotes(true);
    const data = await getLessonNotes(userId, lessonId);
    setNotes(data || []);
    setIsLoadingNotes(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    player?.playVideo(); // Tự động chạy lại video
  };

  const handleAddNote = async () => {
    if (!content.trim()) return;
    setIsSaving(true);

    const timestamp = player ? player.getCurrentTime() : 0;
    const result = await createNote(userId, lessonId, content, timestamp);

    if (result.error) {
      toast.error("Lỗi lưu note");
    } else {
      toast.success("Đã lưu ghi chú");
      setNotes((prev) => [...prev, result.data].sort((a, b) => a.timestamp - b.timestamp));
      setContent("");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await deleteNote(id);
    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Đã xóa");
    }
  };

  const handleJump = (seconds: number) => {
    if (player) {
      player.seekTo(seconds, true);
      player.playVideo();
      setIsOpen(false); // Đóng modal để xem luôn
    }
  };

  return (
    <>
      {/* 1. NÚT KÍCH HOẠT (Đặt cạnh Title) */}
      <button
        onClick={handleOpen}
        className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 rounded-lg transition-colors border border-gray-200"
        title="Mở ghi chú"
      >
        <NotebookPen size={20} />
        <span className="text-sm font-medium hidden sm:inline">Ghi chú</span>
        {notes.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {notes.length}
            </span>
        )}
      </button>

      {/* 2. MODAL GIAO DIỆN */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <NotebookPen size={18} className="text-blue-600"/>
                Ghi chú bài học
              </h3>
              <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                <X size={20} />
              </button>
            </div>

            {/* List Notes (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 min-h-[200px]">
              {isLoadingNotes ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
              ) : notes.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">
                  Chưa có ghi chú nào cho bài này.<br/>Hãy ghi lại những ý quan trọng!
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex justify-between items-start mb-2">
                      <button 
                        onClick={() => handleJump(note.timestamp)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        <PlayCircle size={12}/> {formatTime(note.timestamp)}
                      </button>
                      <button onClick={() => handleDelete(note.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Footer Form */}
            <div className="p-4 border-t bg-white">
               <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                  <Clock size={12}/>
                  Thời điểm hiện tại: <span className="font-bold text-blue-600">{player ? formatTime(player.getCurrentTime()) : "00:00"}</span>
               </div>
               <div className="flex gap-2">
                  <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    placeholder="Nhập ghi chú mới..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                  <button 
                    onClick={handleAddNote}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors flex items-center justify-center min-w-[50px]"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin"/> : <PlusCircle size={20}/>}
                  </button>
               </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}