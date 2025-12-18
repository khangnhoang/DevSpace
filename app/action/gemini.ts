"use server";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateQuizFromContent(
  content: string,
  quantity: number = 1
) {
  try {
    if (!content || content.length < 50) {
      return { error: "Nội dung quá ngắn" };
    }

    const promt = `
        Bạn là trợ lý AI tạo câu hỏi trắc nghiệm.
      Dựa vào nội dung:
      ---
      ${content}
      ---
      Hãy tạo đúng ${quantity} câu hỏi trắc nghiệm tiếng Việt.
      
      YÊU CẦU:
      1. Trả về JSON thuần.
      2. Cấu trúc mảng JSON:
      [
        {
          "question": "Câu hỏi?",
          "option_a": "A",
          "option_b": "B",
          "option_c": "C",
          "option_d": "D",
          "correct_answer": "a", 
          "explanation": "Giải thích ngắn gọn"
        }
      ]
        `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: promt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text;
    if (!text) return { error: "Lỗi AI" };

    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return { data: JSON.parse(cleanedText) };
  } catch (error: any) {
    console.error("Lỗi ", error);
    return { error: error.message };
  }
}
