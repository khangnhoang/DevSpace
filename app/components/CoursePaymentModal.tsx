"use client";
import React, { useState } from "react";
import { X, Loader2, Copy, Check, Tag } from "lucide-react";
import { toast } from "sonner";
import { cancelPayment, updatePaymentWithCoupon } from "@/app/action/payment";

interface Props {
  course: { name: string; slug: string; price: number };
  userId: string;
  paymentId: number | null;
  onClose: () => void;
  onSuccess: () => void;
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

  // --- STATE CHO COUPON ---
  const [discountCode, setDiscountCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [finalPrice, setFinalPrice] = useState(course.price); // Giá cuối cùng (mặc định là giá gốc)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    percent: number;
  } | null>(null);

  // Nội dung chuyển khoản cơ bản
  const transferContent =
    `HOCPHI ${userId.slice(0, 4)} PAY${paymentId} ${course.slug}`.toUpperCase();

  // Tạo link QR Code động theo giá tiền (finalPrice)
  // Lưu ý: addInfo chính là nội dung chuyển khoản
  // MB Bank (Mã là MB) - STK: 0985357081 - Tên: NGUYEN HOANG KHANG
  const qrUrl = `https://img.vietqr.io/image/MB-0985357081-compact2.png?amount=${finalPrice}&addInfo=${transferContent}&accountName=NGUYEN HOANG KHANG`;

  // --- LOGIC CHECK COUPON ---
  const handleCheckCoupon = async () => {
    if (!discountCode.trim()) return;
    setCheckingCode(true);

    try {
      // Pricing and coupon validation happen on the server only.
      const res = await updatePaymentWithCoupon(paymentId!, discountCode);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.success && res.newAmount !== undefined) {
        setFinalPrice(res.newAmount);
        setAppliedCoupon({
          code: discountCode.toUpperCase(),
          percent: res.discountPercent ?? 0,
        });
        toast.success(
          `Đã áp dụng mã! Giá mới: ${res.newAmount.toLocaleString()}đ`,
        );
      }
    } catch (err) {
      toast.error("Lỗi khi kiểm tra mã");
    } finally {
      setCheckingCode(false);
    }
  };

  const handleConfirmPayment = async () => {
    setIsLoading(true);
    try {
      // Giả lập delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // LOGIC: Nếu có mã giảm giá, ông có thể update vào bảng payments ở đây (optional)
      // Nhưng để đơn giản, Admin nhìn số tiền chuyển khoản khớp với giá sau giảm là duyệt.

      toast.success("Đã gửi xác nhận thanh toán!");
      toast.info("Vui lòng đợi Admin duyệt trong giây lát.", {
        duration: 5000,
      });
      onClose();
      onSuccess();
    } catch (error) {
      toast.error("Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    await cancelPayment(paymentId);
    toast.info("Đã hủy giao dịch");
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success("Đã sao chép!");
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
        <div className="p-6 flex flex-col items-center gap-5 overflow-y-auto">
          <div className="text-center w-full">
            <p className="text-gray-500 text-sm mb-1">
              Thanh toán cho khóa học
            </p>
            <h2 className="text-xl font-bold text-blue-700 truncate px-2 uppercase">
              {course.name}
            </h2>
          </div>

          {/* === COUPON INPUT === */}
          <div className="w-full flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
              <Tag size={12} /> Mã giảm giá
            </label>
            <div className="flex gap-2">
              <input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã (VD: SV2025)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                disabled={!!appliedCoupon}
              />
              <button
                onClick={handleCheckCoupon}
                disabled={checkingCode || !!appliedCoupon || !discountCode}
                className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50 min-w-20"
              >
                {checkingCode ? (
                  <Loader2 className="animate-spin mx-auto" size={16} />
                ) : appliedCoupon ? (
                  "Đã dùng"
                ) : (
                  "Áp dụng"
                )}
              </button>
            </div>
          </div>

          {/* QR Code & Info Box */}
          <div className="w-full bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col items-center gap-4">
            {/* Ảnh QR từ VietQR */}
            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
              <img
                src={qrUrl}
                alt="QR Payment"
                className="w-40 h-40 object-contain"
              />
            </div>

            <div className="w-full space-y-2 text-sm">
              {/* Dòng hiển thị giá tiền */}
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-gray-500">Số tiền:</span>
                <div className="flex flex-col items-end">
                  {/* Giá gốc bị gạch nếu có coupon */}
                  {appliedCoupon && (
                    <span className="text-xs text-gray-400 line-through">
                      {course.price.toLocaleString()}đ
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xl">
                    {finalPrice.toLocaleString()}đ
                    <Copy
                      size={14}
                      className="cursor-pointer text-blue-500"
                      onClick={() => copyToClipboard(finalPrice.toString())}
                    />
                  </div>
                </div>
              </div>

              {/* Nội dung CK */}
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">
                  Nội dung chuyển khoản (Bắt buộc):
                </span>
                <div
                  onClick={() => copyToClipboard(transferContent)}
                  className="bg-white border border-blue-300 rounded p-2 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition"
                >
                  <span className="font-mono font-bold text-blue-900 tracking-wide text-sm break-all">
                    {transferContent}
                  </span>
                  {hasCopied ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} className="text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex flex-col gap-3">
          <button
            onClick={handleConfirmPayment}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Tôi đã thanh toán"
            )}
          </button>
          <button
            onClick={handleCancelPayment}
            disabled={isLoading}
            className="w-full text-gray-500 hover:text-gray-800 text-sm font-medium"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}
