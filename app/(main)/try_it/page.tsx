"use client";
import { useState, Suspense, useMemo } from "react";
import { Play } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useSearchParams } from "next/navigation";

function TryItEditor() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const defaultCode = `<html>
    <head>
        <style>
         body { font-family: sans-serif; padding: 20px; }
        h1 { color: #2563eb; }
        </style>
    </head>
    <body>
        <h1>Xin chào!</h1>
        <p>Đây là trình soạn thảo mặc định.</p>
    </body>
    </html>`;

  const initialCode = codeFromUrl
    ? decodeURIComponent(codeFromUrl)
    : defaultCode;

  const [code, setCode] = useState(initialCode);
  const [runCode, setRunCode] = useState(initialCode);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleRunCode = () => {
    setRunCode(code);
  };

  // 👇 SỬA LẠI HÀM NÀY: ĐÂY LÀ CHÌA KHÓA ĐỂ FIX LỖI SPACE
  const handleEditorDidMount = (editor: any, monaco: any) => {
    // 1. Cưỡng chế tắt Accessibility
    editor.updateOptions({
      accessibilitySupport: "off",
      wordWrap: "on",
    });

    // 2. "BIỆN PHÁP MẠNH": Ghi đè hành vi phím Space
    // Bất cứ khi nào Space được nhấn, bắt buộc editor phải điền dấu cách " "
    editor.addCommand(monaco.KeyCode.Space, () => {
      editor.trigger('keyboard', 'type', { text: " " });
    });

    editor.focus();
  };

  // (Đã xóa cái useEffect chặn phím Space ở đây đi rồi, nó gây xung đột)

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      overviewRulerBorder: false,
      wordWrap: "on" as const,
      padding: { top: 16, bottom: 16 },
      accessibilitySupport: "off" as const,
    }),
    []
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#E7E9EB]">
      <header className="h-14 bg-[#E7E9EB] border-b border-gray-200 flex items-center justify-center shrink-0">
        <button
          onClick={handleRunCode}
          className="bg-blue-500 text-white rounded-sm px-4 py-2 flex flex-row items-center gap-2 cursor-pointer hover:bg-blue-600 transition-colors shadow-sm"
        >
          Run
          <Play size={16} fill="currentColor" />
        </button>
      </header>
      <div className="flex flex-col md:flex-row text-black flex-1 min-h-0 gap-4 p-2">
        <div className="bg-white w-full md:w-1/2 flex-1 flex flex-col h-full shadow-sm rounded-md overflow-hidden border border-gray-500">
          <Editor
            height="100%"
            defaultLanguage="html"
            theme="vs-dark"
            value={code} // Sửa defaultValue thành value
            onChange={handleEditorChange}
            onMount={handleEditorDidMount} // Gọi hàm fix lỗi
            options={editorOptions}
          />
        </div>
        <div className="bg-white w-1/2 flex flex-col h-full shadow-sm rounded-md overflow-hidden">
          <iframe
            className="h-full w-full border-none"
            srcDoc={runCode}
            title="result"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}

export default function TryItPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center">Đang tải trình soạn thảo...</div>
      }
    >
      <TryItEditor />
    </Suspense>
  );
}