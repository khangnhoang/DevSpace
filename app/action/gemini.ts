// action/ai.ts
"use server";

import { GoogleGenAI } from "@google/genai";

export async function generateQuizFromContent(content: string, quantity: number = 1, previousQuestion: any[]) {
  // 1. Kiểm tra xem Key có nhận không
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ LỖI: Không tìm thấy GEMINI_API_KEY trong biến môi trường.");
    return { error: "Server chưa cấu hình API Key." };
  }

  let prevQuestion = '';
  if(previousQuestion.length > 0 && previousQuestion){
    prevQuestion = previousQuestion.map((pq) => `${pq.question}`).join('; ');
  }

  const ai = new GoogleGenAI({apiKey});

  try {
    if (!content || content.length < 50) {
      return { error: "Nội dung quá ngắn (cần > 50 ký tự)." };
    }

    const prompt = `
      Bạn là một API trả về JSON. Nhiệm vụ: Tạo ${quantity} câu hỏi trắc nghiệm khác với các câu hỏi trước đó (nếu có) ${prevQuestion} từ nội dung sau.
      
      Nội dung: """${content}""", 
      
      Yêu cầu Output: Chỉ trả về một mảng JSON (Array of Objects), không Markdown, không lời dẫn.
      Schema bắt buộc:
      [
        {
          "question": "Câu hỏi",
          "option_a": "...",
          "option_b": "...",
          "option_c": "...",
          "option_d": "...",
          "correct_answer": "a/b/c/d",
          "explanation": "..."
        }
      ]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {responseMimeType: 'application/json'}
    })

    const text = response.text;

    if(!text){
      return;
    }

    console.log("✅ AI Response Raw:", text.slice(0, 100) + "..."); // Log để debug

    if (!text) return { error: "AI trả về rỗng." };

    // Vệ sinh JSON (kỹ hơn)
    // Đôi khi AI trả về: "Here is JSON: ```json ... ```" -> Cần lọc kỹ
    let jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Tìm điểm bắt đầu [ và kết thúc ] để cắt chuỗi thừa nếu có
    const firstBracket = jsonString.indexOf("[");
    const lastBracket = jsonString.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1);
    }

    const data = JSON.parse(jsonString);
    return { data };

  } catch (error: any) {
    // Log lỗi chi tiết ra terminal của VS Code để bạn đọc
    console.error("❌ LỖI GOOGLE GEMINI:", error);
    
    // Check lỗi phổ biến
    if (error.message?.includes("API key not valid")) {
        return { error: "API Key không hợp lệ hoặc tài khoản bị khóa." };
    }
    return { error: `Lỗi xử lý: ${error.message}` };
  }
}