'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  fetchDepositSettlementApi,
  settleDepositApi,
  type DepositSettlement,
  type Inspection,
} from '../lib/api';

interface DepositSettlementCardProps {
  bookingId: string;
  isOwner: boolean;
  isRenter: boolean;
  depositVnd: number;
  checkInInspection?: Inspection | null;
  checkOutInspection?: Inspection | null;
  onSettled?: (settlement: DepositSettlement) => void;
}

export function DepositSettlementCard({
  bookingId,
  isOwner,
  isRenter,
  depositVnd,
  checkInInspection,
  checkOutInspection,
  onSettled,
}: DepositSettlementCardProps) {
  const { csrfToken } = useAuth();

  const [settlement, setSettlement] = useState<DepositSettlement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs for owner settlement
  const [cleaningFeeVnd, setCleaningFeeVnd] = useState<number>(0);
  const [otherSurchargeVnd, setOtherSurchargeVnd] = useState<number>(0);
  const [damageNotes, setDamageNotes] = useState<string>('');

  const formatVnd = (val?: number) => {
    if (val === undefined || val === null) return '0 ₫';
    return `${new Intl.NumberFormat('vi-VN').format(val)} ₫`;
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const loadSettlement = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDepositSettlementApi(bookingId);
      setSettlement(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin quyết toán cọc.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadSettlement();
  }, [loadSettlement]);

  // Derived calculations for preview
  const inFuel = checkInInspection?.fuelPercent ?? 100;
  const outFuel = checkOutInspection?.fuelPercent ?? 100;
  const computedFuelShortfall = Math.max(0, inFuel - outFuel);
  const computedFuelSurcharge = computedFuelShortfall * 30000;
  const previewTotalSurcharges = computedFuelSurcharge + cleaningFeeVnd + otherSurchargeVnd;
  const previewRefundAmount = Math.max(0, depositVnd - previewTotalSurcharges);

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csrfToken) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await settleDepositApi(
        bookingId,
        {
          cleaningFeeVnd,
          otherSurchargeVnd,
          damageNotes: damageNotes.trim() || undefined,
        },
        csrfToken,
      );
      setSettlement(res);
      setSuccessMsg('Đã quyết toán cọc và tạo giao dịch hoàn tiền thành công!');
      if (onSettled) {
        onSettled(res);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể quyết toán cọc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
        <div className="h-10 bg-slate-100 rounded-xl mb-3" />
        <div className="h-20 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const isSettled = settlement?.status === 'SETTLED';

  return (
    <div
      id="deposit-settlement-card"
      className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Quyết toán tiền cọc thế chấp (Deposit Settlement)
            </h3>
            <span
              id="deposit-settlement-status-badge"
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isSettled
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-amber-100 text-amber-700 border border-amber-300'
              }`}
            >
              {isSettled ? '✓ Đã hoàn cọc' : '• Chờ quyết toán'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tiền cọc thế chấp ban đầu:{' '}
            <strong className="text-slate-800">{formatVnd(depositVnd)}</strong>
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 font-medium">
          {successMsg}
        </div>
      )}

      {isSettled && settlement ? (
        /* Settled View: Immutable Transparent Receipt */
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100 p-4 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Tiền cọc đã nhận:</span>
              <span className="font-semibold text-slate-800">
                {formatVnd(settlement.depositVnd)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Khấu trừ nhiên liệu ({settlement.breakdown.fuelShortfallPercent}%):</span>
              <span className="font-semibold text-rose-600">
                -{formatVnd(settlement.breakdown.fuelSurchargeVnd)}
              </span>
            </div>

            {settlement.breakdown.cleaningFeeVnd > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Phí vệ sinh:</span>
                <span className="font-semibold text-rose-600">
                  -{formatVnd(settlement.breakdown.cleaningFeeVnd)}
                </span>
              </div>
            )}

            {settlement.breakdown.otherSurchargeVnd > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Phụ phí khác:</span>
                <span className="font-semibold text-rose-600">
                  -{formatVnd(settlement.breakdown.otherSurchargeVnd)}
                </span>
              </div>
            )}

            <div className="border-t border-emerald-200/60 pt-2 flex justify-between text-slate-600">
              <span>Tổng khấu trừ:</span>
              <span className="font-semibold text-rose-700">
                -{formatVnd(settlement.breakdown.totalSurchargesVnd)}
              </span>
            </div>

            <div className="border-t border-emerald-300 pt-2.5 flex items-baseline justify-between">
              <span className="font-bold text-slate-900 text-sm">Số tiền hoàn cọc:</span>
              <span id="settled-refund-amount" className="text-lg font-black text-emerald-700">
                {formatVnd(settlement.refundAmountVnd)}
              </span>
            </div>
          </div>

          {/* Refund Transaction Info */}
          {Boolean(settlement.refundTransactionRef) && (
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Mã giao dịch hoàn tiền:</span>
                <span className="font-mono font-bold text-slate-700">
                  {String(settlement.refundTransactionRef)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian quyết toán:</span>
                <span className="font-medium text-slate-700">
                  {formatDate(
                    typeof settlement.settledAt === 'string' ? settlement.settledAt : null,
                  )}
                </span>
              </div>
            </div>
          )}

          {Boolean(settlement.breakdown.damageNotes) && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <strong className="text-slate-800 block mb-1">Ghi chú quyết toán:</strong>
              {String(settlement.breakdown.damageNotes)}
            </div>
          )}
        </div>
      ) : isOwner ? (
        /* Owner Action: Form to Settle Deposit */
        <form onSubmit={handleSettleSubmit} className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Tính toán khấu trừ phụ phí
            </h4>

            {/* Fuel Surcharge Preview */}
            <div className="flex justify-between items-center text-slate-600">
              <div>
                <span>Hao hụt nhiên liệu:</span>
                <span className="text-[10px] text-slate-400 block">
                  (Nhận: {inFuel}%, Trả: {outFuel}% → Hao hụt: {computedFuelShortfall}%)
                </span>
              </div>
              <span className="font-bold text-slate-800">{formatVnd(computedFuelSurcharge)}</span>
            </div>

            {/* Cleaning Fee Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Phí vệ sinh (nếu xe bẩn) [VND]
              </label>
              <input
                id="cleaning-fee-input"
                type="number"
                min={0}
                step={10000}
                value={cleaningFeeVnd}
                onChange={(e) => setCleaningFeeVnd(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Other Surcharges Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Phụ phí khác / Trừ hư hại [VND]
              </label>
              <input
                id="other-surcharge-input"
                type="number"
                min={0}
                step={10000}
                value={otherSurchargeVnd}
                onChange={(e) => setOtherSurchargeVnd(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Damage Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Ghi chú quyết toán & hư hại (nếu có)
              </label>
              <textarea
                id="settlement-notes-input"
                rows={2}
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Nhập chi tiết các khoản trừ cọc nếu có..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Preview Breakdown */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Tổng phụ phí khấu trừ:</span>
                <span className="font-bold text-rose-600">
                  -{formatVnd(previewTotalSurcharges)}
                </span>
              </div>
              <div className="flex justify-between items-baseline font-bold text-slate-900">
                <span>Số tiền hoàn cọc dự kiến:</span>
                <span className="text-base font-black text-emerald-600">
                  {formatVnd(previewRefundAmount)}
                </span>
              </div>
            </div>
          </div>

          <button
            id="btn-settle-deposit"
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Đang quyết toán...' : '💰 Xác nhận quyết toán & Hoàn cọc'}
          </button>
        </form>
      ) : isRenter || !isOwner ? (
        /* Renter View: Waiting for settlement */
        <div className="rounded-2xl bg-amber-50/70 border border-amber-200/70 p-4 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⏳</span>
            <h4 className="font-bold">Đang chờ chủ xe quyết toán tiền cọc</h4>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            Chủ xe đang đối chiếu biên bản trả xe và chỉ số xăng/pin để tính toán hoàn cọc. Tiền cọc{' '}
            <strong>{formatVnd(depositVnd)}</strong> (sau khi trừ hao hụt xăng nếu có) sẽ được hoàn
            trả trực tiếp vào tài khoản của bạn.
          </p>
        </div>
      ) : null}
    </div>
  );
}
