"use client";

import { useState, useRef, ComponentProps } from "react";

export default function Pre({children, ...props}: ComponentProps<"pre">){
    const preRef = useRef<HTMLPreElement>(null);

    const [isCopied,setIsCopied] = useState(false);


    const handleCopy = async() => {
        if (!preRef.current) return

        const text = preRef.current.innerText

        try{
            await navigator.clipboard.writeText(text)
        }
        catch {
            console.error("copy fail")
        }
    }

    return (
    // Div này chỉ đóng vai trò container để định vị nút Copy (relative)
    // Không tô màu ở đây!
    <div className="relative group">
      
      {/* Nút Copy Logic */}
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded bg-gray-700/50 hover:bg-gray-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        {isCopied ? "Đã copy" : "Copy"}
      </button>

      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  );
}; 

