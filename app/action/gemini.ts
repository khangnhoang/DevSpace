// action/ai.ts
"use server";

/* * LƯU Ý: Dùng thư viện @google/generative-ai (Bản ổn định)
 * Thay vì @google/genai (Bản beta hay lỗi)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateQuizFromContent(content: string, quantity: number = 1) {
  try {
    if (!content || content.length < 50) {
      return { error: "Nội dung quá ngắn (cần > 50 ký tự)." };
    }

    // Sử dụng model 1.5 Flash - Bản quốc dân, miễn phí và ổn định nhất hiện nay
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Bạn là trợ lý AI tạo câu hỏi trắc nghiệm.
      Dựa vào nội dung:
      ---
      ${content}
      ---
      Hãy tạo đúng ${quantity} câu hỏi trắc nghiệm tiếng Việt.
      
      YÊU CẦU QUAN TRỌNG:
      1. Trả về format JSON thuần (Raw JSON string).
      2. KHÔNG được bọc trong markdown (không dùng \`\`\`json).
      3. Cấu trúc mảng JSON bắt buộc:
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) return { error: "AI không trả về kết quả" };

    // Vệ sinh chuỗi JSON (đề phòng AI vẫn quen thói thêm markdown)
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return { data: JSON.parse(cleanedText) };

  } catch (error: any) {
    console.error("Lỗi AI:", error);
    return { error: `Lỗi: ${error.message}` };
  }
}