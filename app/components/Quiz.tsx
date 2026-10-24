"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveUserProgress, supabase } from "@/lib/supabase";
import { Check, ArrowRight, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
};

type Props = {
  questions: QuizQuestion[];
  lessonId: number;
  userId: string | undefined;
  nextLessonPath: string | null;
};

export default function Quiz({
  questions,
  lessonId,
  userId,
  nextLessonPath,
}: Props) {
  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correct, setIsCorrect] = useState<boolean | null>(null);
  const [isCompleted] = useState(false);

  if (!questions || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // --- 1. LOGIC NÚT BẤM ---

  const handleTryAgain = () => {
    setIsCorrect(null); // Ẩn bảng kết quả
    setSelectedOption(null); // Reset lựa chọn để user chọn lại
  };

  const handleNextQuestion = async () => {
    if (isLastQuestion) {
      let currentUserId = userId;
      if(!currentUserId){
        const {data} = await supabase.auth.getUser();
        currentUserId = data.user?.id;
      }
      if (currentUserId && lessonId) {
        await saveUserProgress(currentUserId, lessonId);
      } else {
        console.log("Lỗi lưu tiến trình");
      }

      toast("Chúc mừng! Bạn đã hoàn thành tất cả bài tập 🎉");
      router.refresh();
      setTimeout(() => {
        router.push(nextLessonPath || "/"); 
      }, 1500);
      return;
    }

    // Chuyển sang câu tiếp theo
    setCurrentIndex((prev) => prev + 1);
    setIsCorrect(null); // Ẩn bảng kết quả
    setSelectedOption(null); // Reset lựa chọn
  };

  const handleSubmit = () => {
    if (selectedOption === null) {
      toast("Vui lòng chọn đáp án trước khi gửi!");
      return;
    }

    const currentCorrectAnswer = currentQuestion.correctAnswer;
    if (selectedOption === currentCorrectAnswer) {
      setIsCorrect(true);
      toast.success("Chính xác!");
    } else {
      setIsCorrect(false);
      toast.error("Sai rồi, thử lại nhé");
    }
  };

  if (isCompleted) {
    return (
      <div className="p-8 bg-green-50 border border-green-200 rounded-xl text-center animate-in fade-in zoom-in">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-4 rounded-full">
            <Check size={48} className="text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">Xuất sắc!</h2>
        <p className="text-green-700">
          Bạn đã hoàn thành bài tập của bài học này.
        </p>
        {nextLessonPath && (
          <p className="text-sm text-green-600 mt-2">
            Đang chuyển sang bài tiếp theo...
          </p>
        )}
      </div>
    );
  }

  if (questions.length === 0)
    return (
      <div className="text-white p-10 text-center">
        <p className="text-2xl mb-4">📭 Bài học này chưa có câu hỏi nào.</p>
        <button
          onClick={() => router.back()}
          className="text-blue-400 hover:underline"
        >
          Quay về bài học
        </button>
      </div>
    );

  // Bảo vệ: Nếu currentIndex vượt quá mảng (hiếm gặp)
  if (!currentQuestion) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Bài tập thực hành</h2>
        <span className="text-sm font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-600">
          Câu {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Câu hỏi */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <p className="text-lg font-medium text-gray-800 leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>

        {/* Các lựa chọn */}
        <div className="p-6 flex flex-col gap-3">
          {currentQuestion.options.map((opt, i) => {
            const value = ["a", "b", "c", "d"][i];
            const isSelected = selectedOption === value;

            // Logic màu sắc:
            // - Mặc định: xám/trắng
            // - Đang chọn: xanh dương
            // - Đã nộp + Đúng: xanh lá
            // - Đã nộp + Sai + Đang chọn: đỏ
            let containerClass =
              "border-gray-200 hover:bg-gray-50 hover:border-gray-300";
            if (isSelected)
              containerClass =
                "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500";

            if (correct === true && isSelected)
              containerClass =
                "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500";
            if (correct === false && isSelected)
              containerClass =
                "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500";

            return (
              <div
                key={i}
                onClick={() => correct === null && setSelectedOption(value)}
                className={`
                  relative flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200
                  ${containerClass}
                  ${correct !== null ? "cursor-default" : ""}
                `}
              >
                <div
                  className={`
                  w-6 h-6 rounded-full border flex items-center justify-center mr-4 text-xs font-bold
                  ${
                    isSelected
                      ? correct === true
                        ? "bg-green-500 border-green-500 text-white"
                        : correct === false
                        ? "bg-red-500 border-red-500 text-white"
                        : "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-300 text-gray-500 bg-white"
                  }
                `}
                >
                  {["A", "B", "C", "D"][i]}
                </div>
                <span className="flex-1 text-black">{opt}</span>

                {/* Icon kết quả */}
                {isSelected && correct === true && (
                  <Check size={20} className="text-green-600" />
                )}
                {isSelected && correct === false && (
                  <X size={20} className="text-red-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {correct === null ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                selectedOption
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${!selectedOption ? "" : "cursor-pointer"}`}
            >
              Kiểm tra
            </button>
          ) : (
            <>
              {!correct && (
                <button
                  onClick={handleTryAgain}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <RotateCcw size={18} />
                  Làm lại
                </button>
              )}

              {correct && (
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 shadow-md transition-all animate-in fade-in slide-in-from-right-2"
                >
                  {isLastQuestion ? "Hoàn thành bài học" : "Câu tiếp theo"}
                  <ArrowRight size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
