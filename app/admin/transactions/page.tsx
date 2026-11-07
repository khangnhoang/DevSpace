"use client";
import React, { useEffect, useState } from "react";
import {
  getAllPayments,
  approvePayment,
  rejectPayment,
} from "@/app/action/payment"; // Import từ file trên
import { toast } from "sonner";
import { Check, X, DollarSign, Loader2 } from "lucide-react";
import CustomAvatar from "@/app/components/CustomAvatar"; // Nhớ check đường dẫn component này
import ConfirmDialog from "@/app/components/ConfirmDialog";

interface PaymentRow {
  id: number;
  status: string;
  amount?: number;
  created_at: string;
  // getAllPayments joins the learner by hand and returns it as `users`.
  users?: {
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
  courses?: { name?: string } | null;
}

// The learner label is the one the table row shows.
const orderSummary = (p: PaymentRow, consequence: string) =>
  `Học viên: ${p.users?.full_name || "Ẩn danh"}. Khóa học: ${p.courses?.name || "Khóa học đã xóa"}. Số tiền: ${p.amount?.toLocaleString("vi-VN")} đ. ${consequence}`;

export default function TransactionsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState("all"); // all, pending, success, failed
  const [approveTarget, setApproveTarget] = useState<PaymentRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentRow | null>(null);

  // A rejected load must clear the loader and show a retry, never leave "Đang tải dữ liệu..." or an unhandled rejection.
  const loadPayments = async () => {
    try {
      const data = await getAllPayments();
      setPayments((data as unknown as PaymentRow[]) || []);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch dữ liệu
  const fetchPayments = () => {
    setIsLoading(true);
    setLoadError(false);
    return loadPayments();
  };

  useEffect(() => {
    // isLoading already starts true, so the mount fetch skips the
    // setIsLoading(true) that fetchPayments does for the later refetches.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPayments sets state only after its awaited call
    loadPayments();
  }, []);

  // Xử lý Duyệt
  const handleApprove = async (id: number) => {
    // unwrap() hands the dialog the settled promise, so it stays pending until the action ends.
    await toast
      .promise(approvePayment(id), {
        loading: "Đang xử lý...",
        success: (res) => {
          if (res.error) throw new Error(res.error);
          fetchPayments(); // Reload lại bảng
          return "Duyệt đơn thành công!";
        },
        error: (err) => err.message || "Có lỗi xảy ra",
      })
      .unwrap();
  };

  // Xử lý Hủy
  const handleReject = async (id: number) => {
    // ConfirmDialog swallows a rejection, so a failure in transit is reported here.
    let res;
    try {
      res = await rejectPayment(id);
    } catch {
      toast.error(
        "Không nhận được kết quả từ máy chủ. Hãy tải lại trang để kiểm tra trạng thái đơn.",
      );
      return;
    }
    if (res.error) toast.error(res.error);
    else {
      toast.success("Đã hủy đơn hàng");
      fetchPayments();
    }
  };

  // Logic lọc client-side
  const filteredPayments = payments.filter((p) =>
    filter === "all" ? true : p.status === filter,
  );

  return (
    <div className="lg:ml-6 p-4 md:p-6">
      <div className="bg-[#0f1116] min-h-screen text-gray-200 rounded-xl border border-gray-800 p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <DollarSign className="text-green-500" /> Quản lý Giao dịch
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Kiểm soát dòng tiền và duyệt đơn thủ công.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-[#191C24] p-1 rounded-lg border border-gray-700">
            {["all", "pending", "success", "failed"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-1.5 rounded-md text-sm capitalize transition-all font-medium ${
                  filter === status
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {status === "all"
                  ? "Tất cả"
                  : status === "pending"
                    ? "Chờ duyệt"
                    : status === "success"
                      ? "Thành công"
                      : "Đã hủy"}
              </button>
            ))}
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-[#191C24] rounded-xl overflow-hidden border border-gray-800 shadow-sm">
          {loadError && !isLoading ? (
            // Outside the table: its scroll area is wider than a phone, which would clip a centered message.
            <div className="p-12 text-center">
              <p role="alert" className="text-red-400 mb-4">
                Không tải được danh sách giao dịch. Hãy kiểm tra kết nối rồi thử
                lại.
              </p>
              <button
                onClick={fetchPayments}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white text-sm font-medium transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#222732] text-gray-400 text-xs uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Học viên</th>
                    <th className="px-6 py-4">Khóa học</th>
                    <th className="px-6 py-4">Số tiền</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-12 text-center text-gray-500"
                      >
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-12 text-center text-gray-500 italic"
                      >
                        Không tìm thấy giao dịch nào
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-[#2C3039] transition-colors group"
                      >
                        {/* Cột User */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <CustomAvatar
                              src={p.users?.avatar_url}
                              className="w-9 h-9 border border-gray-700"
                            />
                            <div>
                              <p className="font-semibold text-white text-sm">
                                {p.users?.full_name || "Ẩn danh"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {p.users?.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Cột Course */}
                        <td className="px-6 py-4">
                          <span className="text-blue-400 font-medium text-sm">
                            {p.courses?.name || "Khóa học đã xóa"}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {new Date(p.created_at).toLocaleString("vi-VN")}
                          </p>
                        </td>

                        {/* Cột Tiền */}
                        <td className="px-6 py-4 font-mono font-bold text-green-400">
                          {p.amount?.toLocaleString("vi-VN")} đ
                        </td>

                        {/* Cột Status */}
                        <td className="px-6 py-4">
                          {p.status === "pending" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-medium border border-yellow-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                              Chờ duyệt
                            </span>
                          )}
                          {p.status === "success" && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium border border-green-500/20">
                              Thành công
                            </span>
                          )}
                          {p.status === "failed" && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-medium border border-red-500/20">
                              Đã hủy
                            </span>
                          )}
                        </td>

                        {/* Cột Action */}
                        <td className="px-6 py-4 text-right">
                          {p.status === "pending" ? (
                            <div className="flex justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setApproveTarget(p)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-md text-white flex items-center gap-1.5 text-xs font-medium transition-colors shadow-sm"
                                title="Xác nhận tiền về & Kích hoạt khóa học"
                              >
                                <Check size={14} /> Duyệt
                              </button>
                              <button
                                onClick={() => setRejectTarget(p)}
                                className="px-2 py-1.5 bg-gray-700 hover:bg-red-500/20 hover:text-red-500 text-gray-300 rounded-md flex items-center justify-center transition-colors border border-gray-600 hover:border-red-500/30"
                                title="Hủy đơn này"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs select-none">
                              --
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {approveTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setApproveTarget(null)}
          tone="admin"
          title="Duyệt đơn thanh toán"
          description={orderSummary(
            approveTarget,
            "Xác nhận đã nhận tiền? Hành động này sẽ kích hoạt khóa học cho học viên.",
          )}
          confirmLabel="Duyệt đơn"
          onConfirm={() => handleApprove(approveTarget.id)}
        />
      )}
      {rejectTarget && (
        <ConfirmDialog
          open
          onOpenChange={() => setRejectTarget(null)}
          tone="admin"
          destructive
          title="Hủy đơn hàng"
          description={orderSummary(
            rejectTarget,
            "Hủy bỏ giao dịch này? Học viên sẽ không được kích hoạt khóa học.",
          )}
          confirmLabel="Hủy đơn hàng"
          cancelLabel="Giữ đơn hàng"
          onConfirm={() => handleReject(rejectTarget.id)}
        />
      )}
    </div>
  );
}
