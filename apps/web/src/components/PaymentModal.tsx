'use client';

import React, { useState } from 'react';
import type { Payment } from '../lib/api';
import { simulatePaymentApi } from '../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onPaymentSuccess: (payment: Payment) => void;
}

export function PaymentModal({ isOpen, onClose, payment, onPaymentSuccess }: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !payment) return null;

  const formatVnd = (val: number) => {
    return `${new Intl.NumberFormat('vi-VN').format(val)} ₫`;
  };

  const handleSimulate = async (status: 'SUCCESS' | 'FAILED') => {
    setIsProcessing(true);
    setError(null);
    try {
      const updated = await simulatePaymentApi({
        transactionRef: payment.transactionRef,
        status,
      });

      if (status === 'SUCCESS') {
        onPaymentSuccess(updated);
      } else {
        setError('Giao dịch đã được ghi nhận thất bại trong môi trường Sandbox.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xử lý cổng thanh toán sandbox');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="payment-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="payment-modal-content"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl relative"
      >
        {/* Close Button */}
        <button
          id="close-payment-modal-btn"
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            VN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-base">Cổng Thanh Toán Giả Lập</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-500">Đối soát chữ ký số bảo mật HMAC-SHA512</p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="my-5 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span>Mã giao dịch</span>
            <span id="payment-txn-ref" className="font-mono font-semibold text-slate-800 text-xs">
              {payment.transactionRef}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500">
            <span>Khoản thanh toán</span>
            <span className="font-semibold text-slate-700">
              {payment.paymentType === 'DEPOSIT'
                ? 'Tiền cọc giữ xe (Escrow)'
                : payment.paymentType === 'FULL_PAYMENT'
                  ? 'Toàn bộ chuyến đi'
                  : 'Tiền thuê xe'}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200/80">
            <span className="font-bold text-slate-900">Số tiền thanh toán</span>
            <span id="payment-amount-display" className="text-xl font-black text-blue-600">
              {formatVnd(payment.amountVnd)}
            </span>
          </div>
        </div>

        {/* QR Simulation Box */}
        <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-center my-4">
          <div className="mx-auto w-32 h-32 rounded-xl bg-white border border-indigo-100 p-2 shadow-sm flex flex-col items-center justify-center gap-1">
            <div className="grid grid-cols-4 gap-1.5 w-full h-full p-1 opacity-80">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    i % 3 === 0 || i % 5 === 0 ? 'bg-slate-900' : 'bg-indigo-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-indigo-900">Mã QR VietQR / VNPay Sandbox</p>
          <p className="text-[11px] text-slate-500">
            Quét mã trên ứng dụng ngân hàng hoặc nhấn nút xác nhận bên dưới
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            id="payment-modal-error"
            className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium"
          >
            {error}
          </div>
        )}

        {/* Simulation Action Buttons */}
        <div className="space-y-2 mt-5">
          <button
            id="simulate-payment-success-btn"
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulate('SUCCESS')}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span>Đang xác thực giao dịch...</span>
            ) : (
              <>
                <span>✓</span>
                <span>Xác nhận thanh toán (Giả lập SUCCESS)</span>
              </>
            )}
          </button>

          <button
            id="simulate-payment-failed-btn"
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulate('FAILED')}
            className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
          >
            Giả lập hủy / giao dịch thất bại
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          Môi trường kiểm thử không thực hiện chuyển tiền thật. Tiền cọc được giải phóng hoặc hoàn
          trả theo chính sách của sàn.
        </p>
      </div>
    </div>
  );
}
