"use client";
import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { enrollCourse } from "@/app/action/enroll"; // Import server action cũ của bạn
import { cancelPayment, confirmPaymentAndEnroll } from "../action/payment";

interface Props {
  course: any;
  userId: string;
  paymentId: number | null;
  onClose: () => void;
  onSuccess: () => void; // Callback để báo cho trang cha biết là xong rồi
}

export default function CoursePaymentModal({
  course,
  userId,
  paymentId,
  onClose,
  onSuccess,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const transferContent =
    `HOCPHI ${userId.slice(0, 4)} PAY${paymentId} ${course.slug}`.toUpperCase();

  const handleConfirmPayment = async () => {
    setIsLoading(true);
    try {
      // 1. Giả lập delay cho user thấy có xử lý
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 2. LOGIC MỚI: Không gọi server action enroll nữa
      // Chỉ thông báo cho user biết là phải đợi
      toast.success("Đã gửi xác nhận thanh toán!");
      toast.info("Vui lòng đợi Admin duyệt trong giây lát để vào học.", {
        duration: 5000, // Hiện lâu chút cho đọc
      });

      // 3. Đóng form
      onClose();

      // LƯU Ý QUAN TRỌNG:
      // KHÔNG gọi onSuccess() ở đây nữa.
      // Vì onSuccess() ở trang cha sẽ redirect vào trang học (mà chưa được duyệt thì vào làm gì).

      onSuccess();
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    // Gọi action hủy payment
    await cancelPayment(paymentId);
    toast.info("Đã hủy giao dịch");
    onClose();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transferContent);
    setHasCopied(true);
    toast.success("Đã sao chép nội dung chuyển khoản");
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h3 className="font-bold text-lg">Thanh toán khóa học</h3>
          <button
            onClick={handleCancelPayment}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto">
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-1">
              Thanh toán cho khóa học
            </p>
            <h2 className="text-xl font-bold text-blue-700">{course.name}</h2>
            <p className="text-2xl font-bold mt-2 text-red-600">
              {course.price_text}
            </p>
          </div>

          {/* QR Code */}
          <div className="border-2 border-blue-500 rounded-xl p-3 bg-white shadow-inner">
            <QRCodeSVG
              value={transferContent}
              size={180}
              level={"H"}
              includeMargin={true}
            />
          </div>

          {/* Transfer Content Info */}
          <div className="w-full bg-blue-50 border border-blue-100 p-4 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold mb-1 uppercase text-center">
              Nội dung chuyển khoản (Bắt buộc)
            </p>
            <div
              onClick={copyToClipboard}
              className="flex items-center justify-between bg-white border border-blue-200 rounded p-3 cursor-pointer hover:border-blue-400 transition-colors group"
            >
              <span className="font-mono font-bold text-lg text-gray-800 tracking-wider">
                {transferContent}
              </span>
              <div className="text-gray-400 group-hover:text-blue-600">
                {hasCopied ? (
                  <Check size={18} className="text-green-500" />
                ) : (
                  <Copy size={18} />
                )}
              </div>
            </div>
            <p className="text-[10px] text-center text-gray-500 mt-2">
              *Hệ thống sẽ tự động kích hoạt sau khi bạn bấm xác nhận
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex flex-col gap-3">
          <button
            onClick={handleConfirmPayment}
            disabled={isLoading}
            className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" /> Đang xác thực giao dịch...
              </>
            ) : (
              "Tôi đã thanh toán"
            )}
          </button>

          <button
            onClick={handleCancelPayment}
            disabled={isLoading}
            className="cursor-pointer w-full text-gray-500 hover:text-gray-800 text-sm font-medium py-2"
          >
            Để sau, tôi sẽ thanh toán lại
          </button>
        </div>
      </div>
    </div>
  );
}
