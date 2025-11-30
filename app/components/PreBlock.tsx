"use client";

import { useState, useRef, ComponentProps } from "react";

export default function Pre({ children, ...props }: ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!preRef.current) return;

    const text = preRef.current.innerText;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } catch {
      console.error("copy fai");
    }
  };

  const handleTryIt = () => {
    if (!preRef.current) return;

    const text = preRef.current.innerText;
    const encodedCode = encodeURIComponent(text);
    window.open(`/try_it?code=${encodedCode}`, "_blank");
  };

  return (
    // Div này chỉ đóng vai trò container để định vị nút Copy (relative)
    // Không tô màu ở đây!
    <div className="relative group">
      {/* Nút Copy Logic */}
      <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Nút Thử Ngay (Màu Xanh W3Schools) */}
        <button
          onClick={handleTryIt}
          className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1 cursor-pointer"
          title="Chạy code này trong trình soạn thảo"
        >
          <span>🚀</span> Thử ngay
        </button>

        {/* Nút Copy (Màu Xám) */}
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
        >
          {isCopied ? "Đã copy" : "Copy"}
        </button>
      </div>

      <pre
        ref={preRef}
        {...props}
        // Thêm padding-top (pt-12) để chữ không bị các nút che mất
        className="overflow-x-auto p-4 pt-12 rounded-lg bg-[#1e1e1e] text-white font-mono text-sm border border-gray-700"
      >
        {children}
      </pre>
    </div>
  );
}
