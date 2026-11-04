'use client';

import { useDialog } from '../lib/use-dialog';
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

  useDialog(
    isOpen && !!payment,
    () => {
      if (!isProcessing) onClose();
    },
    'payment-modal-content',
  );

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-fade-in"
    >
      <div
        id="payment-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán thử nghiệm"
        tabIndex={-1}
        className="dialog-surface w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 relative"
      >
        {/* Close Button */}
        <button
          aria-label="Đóng hộp thoại"
          id="close-payment-modal-btn"
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ×
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-semibold text-lg">
            VN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-base">Cổng Thanh Toán Giả Lập</h3>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-sm font-semibold text-brand-700 uppercase">
                Sandbox
              </span>
            </div>
            <p className="text-sm text-slate-500">Môi trường thử nghiệm · Không thu tiền thật</p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="my-5 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-sm space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span>Mã giao dịch</span>
            <span id="payment-txn-ref" className="font-mono font-semibold text-slate-800 text-sm">
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
            <span className="font-semibold text-slate-900">Số tiền thanh toán</span>
            <span id="payment-amount-display" className="text-xl font-semibold text-brand-600">
              {formatVnd(payment.amountVnd)}
            </span>
          </div>
        </div>

        {/* QR Simulation Box */}
        <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-4 text-center my-4">
          <div className="mx-auto w-32 h-32 rounded-lg bg-white border border-brand-100 p-2 flex flex-col items-center justify-center gap-1">
            <div className="grid grid-cols-4 gap-1.5 w-full h-full p-1 opacity-80">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    i % 3 === 0 || i % 5 === 0 ? 'bg-slate-900' : 'bg-brand-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-brand-900">Mã QR VietQR / VNPay Sandbox</p>
          <p className="text-sm text-slate-500">
            Quét mã trên ứng dụng ngân hàng hoặc nhấn nút xác nhận bên dưới
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            id="payment-modal-error"
            className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium"
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
            className="w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span>Đang xác thực giao dịch...</span>
            ) : (
              <>
                <span>OK</span>
                <span>Xác nhận thanh toán (Giả lập SUCCESS)</span>
              </>
            )}
          </button>

          <button
            id="simulate-payment-failed-btn"
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulate('FAILED')}
            className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Giả lập hủy / giao dịch thất bại
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-slate-400">
          Môi trường kiểm thử không thực hiện chuyển tiền thật. Tiền cọc được giải phóng hoặc hoàn
          trả theo chính sách của sàn.
        </p>
      </div>
    </div>
  );
}
