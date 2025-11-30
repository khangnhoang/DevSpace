'use client';
import Link from "next/link"
import { useState } from 'react';
import { Play} from 'lucide-react';
import Editor from "@monaco-editor/react";





export default function TryItPage(){
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

    const [code, setCode] = useState(defaultCode)
    const [runCode, setRunCode] = useState(defaultCode);

    const handleEditorChange = (value: string | undefined) => {
        if(value!==undefined){
            setCode(value);
        }
    };

    const handleRunCode = () => {
        setRunCode(code);
    };

    

    return(
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#E7E9EB]">
            <header className="h-14 bg-[#E7E9EB] border-b border-gray-200 flex items-center justify-center">
                <button onClick={handleRunCode} className="bg-blue-500 text-2xl rounded-sm px-4 py-2 flex flex-row items-center cursor-pointer hover:opacity-20">Run<Play size={16} fill="currentColor" /></button>
            </header>
            <div className="flex flex-row text-black flex-1 min-h-0 gap-4 p-2">
                <div className="bg-white w-1/2 flex flex-col h-full">
                    <Editor value = {code} onChange= {handleEditorChange} options={{
                            minimap: { enabled: false }, 
                            fontSize: 14,
                            scrollBeyondLastLine: false, // Ngăn cuộn quá dòng cuối cùng
                            automaticLayout: true, // Tự động chỉnh lại kích thước khi layout thay đổi
                            overviewRulerBorder: false,
                        }}/>
                </div>
                <div className="bg-white w-1/2 flex flex-col h-full">
                    <iframe className="h-full" srcDoc={runCode} title="result"/>
                </div>
            </div>
        </div>
    )
}