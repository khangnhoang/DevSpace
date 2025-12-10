"use client";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
}

export default function MdxEditor({ value, onChange }: EditorProps) {
  return (
    <div data-color-mode="dark" className="h-full flex flex-col">
      <MDEditor
        value={value}
        onChange={onChange}
        height="100%" // Full chiều cao thẻ cha
        className="flex-1 border border-gray-700 shadow-none !bg-[#222732]"
        preview="live" // Chế độ vừa viết vừa xem (live) hoặc 'edit' (chỉ viết)
        style={{
             backgroundColor: "#222732", // Màu nền khớp với theme của bạn
             color: "#fff",
             borderColor: "#374151"
        }}
        visibleDragbar={false} // Tắt thanh kéo thừa thãi
      />
    </div>
  );
}