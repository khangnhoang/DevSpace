"use client";
import { useState, Suspense, useMemo } from "react";
import { Play, FileCode, FileJson, Cpu } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import MobileBlocker from "@/app/components/MobileBlocker";

// --- MẪU CODE GIỮ NGUYÊN ---
const DEFAULT_CPP = `#include <iostream>
using namespace std;

int main() {
    string name = "DevSpace";
    cout << "Hello " << name << " from C++!" << endl;
    cout << "Phep tinh: 10 + 20 = " << 10 + 20 << endl;
    return 0;
}`;

const DEFAULT_JS = `// Viết code Javascript (Logic)
const name = "DevSpace";
console.log("Xin chào " + name);
console.warn("Lưu ý: Code chạy trực tiếp trên trình duyệt");
`;

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 20px; }
    h1 { color: #e11d48; }
    button { padding: 10px 20px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Demo HTML Live</h1>
  <button onclick="alert('Đã click!')">Bấm vào đây</button>
</body>
</html>`;

type LanguageType = "javascript" | "html" | "cpp";

function TryItEditor() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [language, setLanguage] = useState<LanguageType>("html");
  const [code, setCode] = useState(
    codeFromUrl ? decodeURIComponent(codeFromUrl) : DEFAULT_HTML
  );
  const [srcDoc, setSrcDoc] = useState("");
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const switchLanguage = (lang: LanguageType) => {
    setLanguage(lang);
    if (lang === "html") setCode(DEFAULT_HTML);
    else if (lang === "javascript") setCode(DEFAULT_JS);
    else setCode(DEFAULT_CPP);

    setSrcDoc("");
    setConsoleOutput([]);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setConsoleOutput([]);

    // HTML
    if (language === "html") {
      setSrcDoc(code);
      setIsRunning(false);
      return;
    }

    // JS
    if (language === "javascript") {
      const htmlStructure = `
        <!DOCTYPE html>
        <html>
          <head>
              <style>
                  body { font-family: 'Consolas', monospace; padding: 20px; }
                  .log { border-bottom: 1px solid #eee; padding: 4px 0; }
                  .error { color: red; } .warn { color: orange; }
              </style>
          </head>
          <body>
              <h3>JS Console Output:</h3>
              <div id="out"></div>
              <script>
                  const out = document.getElementById('out');
                  const log = (msg, cl) => out.innerHTML += '<div class="log '+cl+'">> '+msg+'</div>';
                  console.log = (...args) => log(args.join(' '), '');
                  console.warn = (...args) => log(args.join(' '), 'warn');
                  console.error = (...args) => log(args.join(' '), 'error');
                  try { ${code} } catch(e) { console.error(e); }
              </script>
          </body>
        </html>
      `;
      setSrcDoc(htmlStructure);
      setIsRunning(false);
      return;
    }

    // C++
    if (language === "cpp") {
      try {
        const res = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "cpp",
            version: "10.2.0",
            files: [{ content: code }],
          }),
        });

        const data = await res.json();

        if (data.run) {
          const outputLines = data.run.output.split("\n");
          setConsoleOutput(outputLines);
          if (data.run.code !== 0)
            toast.error("Có lỗi biên dịch hoặc runtime!");
          else toast.success("Chạy thành công!");
        }
      } catch (error) {
        toast.error("Lỗi kết nối Server biên dịch!");
        setConsoleOutput(["Lỗi: Không thể kết nối đến server Piston API."]);
      } finally {
        setIsRunning(false);
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#E7E9EB]">
      {/* 👇 1. NHÚNG MOBILE BLOCKER VÀO ĐÂY (Nó sẽ đè lên tất cả nếu là mobile) */}
      <MobileBlocker />

      {/* HEADER */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
          <TabBtn
            active={language === "html"}
            onClick={() => switchLanguage("html")}
            icon={<FileCode size={16} />}
            label="HTML"
            color="text-blue-600"
          />
          <TabBtn
            active={language === "javascript"}
            onClick={() => switchLanguage("javascript")}
            icon={<FileJson size={16} />}
            label="JavaScript"
            color="text-yellow-600"
          />
          <TabBtn
            active={language === "cpp"}
            onClick={() => switchLanguage("cpp")}
            icon={<Cpu size={16} />}
            label="C++"
            color="text-purple-600"
          />
        </div>

        <button
          onClick={handleRunCode}
          disabled={isRunning}
          // 👇 2. ĐÃ THÊM CURSOR-POINTER CHUẨN CHỈ
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all select-none ${
            isRunning
              ? "bg-gray-400 cursor-wait"
              : "bg-green-600 hover:bg-green-700 shadow-md cursor-pointer active:scale-95"
          }`}
        >
          {isRunning ? "Running..." : "Chạy Code"}
          {!isRunning && <Play size={18} fill="currentColor" />}
        </button>
      </header>

      {/* EDITOR & PREVIEW */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="w-full md:w-1/2 h-full border-r relative">
          {/* Lớp phủ loading cho editor nếu cần */}
          <Editor
            height="100%"
            language={
              language === "javascript"
                ? "javascript"
                : language === "cpp"
                ? "cpp"
                : "html"
            }
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 20 },
            }}
          />
        </div>

        <div className="w-full md:w-1/2 h-full bg-[#1e1e1e] text-white overflow-auto flex flex-col">
          <div className="bg-[#2d2d2d] px-4 py-2 text-xs font-bold text-gray-400 border-b border-[#3e3e3e] uppercase shrink-0">
            {language === "html" ? "Preview Web" : "Terminal / Console"}
          </div>

          <div className="flex-1 relative h-full">
            {language === "html" || language === "javascript" ? (
              <iframe
                className="w-full h-full border-none bg-white block"
                srcDoc={srcDoc}
                title="output"
                sandbox="allow-scripts allow-modals"
              />
            ) : (
              <div className="p-4 font-mono text-sm">
                {consoleOutput.length === 0 && !isRunning && (
                  <span className="text-gray-500 italic">
                    {'Nhấn "Chạy Code" để xem kết quả...'}
                  </span>
                )}
                {consoleOutput.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap mb-1">
                    {line}
                  </div>
                ))}
                {isRunning && (
                  <div className="text-green-400 animate-pulse">
                    Compiling...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 👇 3. COMPONENT NÚT BẤM CÓ CURSOR-POINTER
const TabBtn = ({ active, onClick, icon, label, color }: any) => (
  <button
    onClick={onClick}
    // Đã thêm cursor-pointer
    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer select-none ${
      active
        ? `bg-white ${color} shadow-sm`
        : "text-gray-500 hover:text-gray-700"
    }`}
  >
    {icon} {label}
  </button>
);

export default function TryItPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center">Loading Editor...</div>}
    >
      <TryItEditor />
    </Suspense>
  );
}
