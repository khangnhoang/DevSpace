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
        <div className="h-screen w-screen flex flex-col">
            <header className="h-14 bg-gray-400 border-b border-gray-200 flex items-center justify-center">
                <button onClick={handleRunCode} className="border bg-blue-500 text-2xl rounded-sm px-4 flex flex-row items-center cursor-pointer">Run<Play size={16} fill="currentColor" /></button>
            </header>
            <div className="flex flex-row text-black relative h-full">
                <div className="bg-gray-200 w-1/2 border-r flex flex-col">
                    <Editor value = {code} onChange= {handleEditorChange} className="bg-transparent w-full h-full resize-none focus:ring-0 border-none outline-none focus:border-transparent"/>
                </div>
                <div className="bg-gray-200 w-1/2 flex flex-col">
                    <iframe srcDoc={runCode} title="result"/>
                </div>
            </div>
        </div>
    )
}