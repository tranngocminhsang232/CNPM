'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { AuthModal } from './AuthModal';
import { calculateQuoteApi, validatePromotionApi } from '../lib/api';
import type { Quote, ValidatedPromotion } from '../lib/api';

interface PricingCalculatorProps {
  vehicleId: string;
  defaultPricePerDayVnd: number;
}

export function PricingCalculator({ vehicleId, defaultPricePerDayVnd }: PricingCalculatorProps) {
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Compute default dates (tomorrow 08:00 UTC to 2 days after 08:00 UTC)
  const getDefaultDates = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(8, 0, 0, 0);

    const dayAfter = new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000);
    dayAfter.setHours(8, 0, 0, 0);

    const toLocalIso = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return {
      start: toLocalIso(tomorrow),
      end: toLocalIso(dayAfter),
    };
  };

  const initialDates = getDefaultDates();
  const [startDateStr, setStartDateStr] = useState(initialDates.start);
  const [endDateStr, setEndDateStr] = useState(initialDates.end);
  const [insurancePackage, setInsurancePackage] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>(
    'BASIC',
  );
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<ValidatedPromotion | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const quoteRequest = useRef(0);
  const datesValid =
    Number.isFinite(Date.parse(startDateStr)) &&
    Number.isFinite(Date.parse(endDateStr)) &&
    Date.parse(endDateStr) > Date.parse(startDateStr);
  const dateError =
    !startDateStr || !endDateStr
      ? 'Chọn đầy đủ thời gian nhận và trả xe.'
      : !datesValid
        ? 'Thời gian trả xe phải sau thời gian nhận xe.'
        : null;

  const formatVnd = (val?: number) => {
    if (val === undefined || val === null) return '0 ₫';
    return `${new Intl.NumberFormat('vi-VN').format(val)} ₫`;
  };

  const loadQuote = useCallback(async () => {
    const current = ++quoteRequest.current;
    setIsLoading(true);
    setErrorMessage(null);
    if (!datesValid) {
      setQuote(null);
      setIsLoading(false);
      return;
    }
    try {
      const startAtUtc = new Date(startDateStr).toISOString();
      const endAtUtc = new Date(endDateStr).toISOString();

      const quoteData = await calculateQuoteApi({
        vehicleId,
        startAt: startAtUtc,
        endAt: endAtUtc,
        insurancePackage,
        voucherCode: appliedVoucher?.code || undefined,
      });

      if (quoteRequest.current === current) setQuote(quoteData);
    } catch (err: any) {
      if (quoteRequest.current === current) {
        setQuote(null);
        setErrorMessage(
          err.message || 'Không thể tính toán báo giá. Vui lòng kiểm tra lại ngày thuê.',
        );
      }
    } finally {
      if (quoteRequest.current === current) setIsLoading(false);
    }
  }, [vehicleId, startDateStr, endDateStr, insurancePackage, appliedVoucher, datesValid]);

  useEffect(() => {
    loadQuote();
    return () => {
      quoteRequest.current++;
    };
  }, [loadQuote]);

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) {
      setAppliedVoucher(null);
      setVoucherError(null);
      return;
    }

    setIsApplyingVoucher(true);
    setVoucherError(null);
    try {
      const subtotalBefore = quote
        ? quote.breakdown.baseRentVnd +
          quote.breakdown.peakSurchargeVnd +
          quote.breakdown.insuranceFeeVnd
        : defaultPricePerDayVnd * 2;
      const res = await validatePromotionApi({
        code: voucherCodeInput.trim().toUpperCase(),
        subtotalVnd: subtotalBefore,
        vehicleId,
      });
      setAppliedVoucher(res);
      setVoucherError(null);
    } catch (err: any) {
      setAppliedVoucher(null);
      setVoucherError(err.message || 'Mã khuyến mãi không hợp lệ');
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherError(null);
  };

  const handleProceedBooking = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    // Check KYC
    if (user.kycStatus !== 'VERIFIED') {
      window.location.href = '/profile/kyc';
      return;
    }
    const startAtUtc = new Date(startDateStr).toISOString();
    const endAtUtc = new Date(endDateStr).toISOString();
    const query = new URLSearchParams({
      vehicleId,
      startAt: startAtUtc,
      endAt: endAtUtc,
      insurance: insurancePackage,
      ...(appliedVoucher?.code ? { voucher: appliedVoucher.code } : {}),
    });
    window.location.href = `/checkout?${query.toString()}`;
  };

  return (
    <div
      id="pricing-calculator-widget"
      className="sticky top-24 rounded-2xl border border-slate-200/90 bg-white p-6"
    >
      {/* Price Header */}
      <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="text-sm font-semibold text-slate-400">Đơn giá thuê</span>
          <div className="text-2xl font-semibold text-brand-600" id="calculator-daily-rate">
            {formatVnd(quote?.pricePerDayVnd || defaultPricePerDayVnd)}{' '}
            <span className="text-sm font-normal text-slate-500">/ngày</span>
          </div>
        </div>

        {quote?.available ? (
          <span
            id="quote-available-badge"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 border border-emerald-200"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Xe sẵn sàng
          </span>
        ) : quote?.available === false ? (
          <span
            id="quote-unavailable-badge"
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 border border-amber-200"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Xe bận lịch
          </span>
        ) : null}
      </div>

      {/* Date Pickers */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="start-date-input"
            className="block text-sm font-semibold text-slate-700 mb-1"
          >
            Nhận xe
          </label>
          <input
            id="start-date-input"
            type="datetime-local"
            aria-invalid={!!dateError}
            aria-describedby={dateError ? 'rental-date-error' : undefined}
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-800 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <label
            htmlFor="end-date-input"
            className="block text-sm font-semibold text-slate-700 mb-1"
          >
            Trả xe
          </label>
          <input
            id="end-date-input"
            type="datetime-local"
            min={startDateStr}
            aria-invalid={!!dateError}
            aria-describedby={dateError ? 'rental-date-error' : undefined}
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-800 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      {dateError && (
        <p id="rental-date-error" role="alert" className="mt-2 text-sm text-red-700">
          {dateError}
        </p>
      )}

      {/* Insurance Package Tier */}
      <div className="mt-5">
        <div id="insurance-group-label" className="block text-sm font-semibold text-slate-700 mb-2">
          Gói bảo hiểm chuyến đi
        </div>
        <div
          role="group"
          aria-labelledby="insurance-group-label"
          className="grid grid-cols-3 gap-2"
        >
          {[
            { id: 'BASIC', label: 'Cơ bản', sub: '0 ₫/ngày', desc: 'Trách nhiệm dân sự' },
            { id: 'STANDARD', label: 'Nâng cao', sub: '+100k/ngày', desc: 'Giảm 50% khấu trừ' },
            { id: 'PREMIUM', label: 'Toàn diện', sub: '+200k/ngày', desc: '0đ khấu trừ' },
          ].map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              id={`insurance-${pkg.id.toLowerCase()}-btn`}
              aria-pressed={insurancePackage === pkg.id}
              onClick={() => setInsurancePackage(pkg.id as any)}
              className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-center transition-colors cursor-pointer border ${
                insurancePackage === pkg.id
                  ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/60'
              }`}
            >
              <span
                className={`text-sm font-semibold ${insurancePackage === pkg.id ? 'text-brand-700' : 'text-slate-700'}`}
              >
                {pkg.label}
              </span>
              <span className="text-sm font-semibold text-brand-600 mt-0.5">{pkg.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Voucher Code Input */}
      <div className="mt-5">
        <label
          htmlFor="voucher-code-input"
          className="block text-sm font-semibold text-slate-700 mb-1.5"
        >
          Mã khuyến mãi (Voucher)
        </label>
        <div className="flex gap-2">
          <input
            id="voucher-code-input"
            aria-invalid={!!voucherError}
            aria-describedby={voucherError ? 'voucher-error-msg' : undefined}
            type="text"
            placeholder="Nhập mã e.g. WELCOME2026"
            value={voucherCodeInput}
            onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
            disabled={!!appliedVoucher}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-semibold text-slate-800 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
          />
          {appliedVoucher ? (
            <button
              id="remove-voucher-btn"
              type="button"
              onClick={handleRemoveVoucher}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
            >
              Gỡ
            </button>
          ) : (
            <button
              id="apply-voucher-btn"
              type="button"
              onClick={handleApplyVoucher}
              disabled={
                isApplyingVoucher || isLoading || !quote || !!dateError || !voucherCodeInput.trim()
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {isApplyingVoucher ? 'Đang kiểm tra...' : 'Áp dụng'}
            </button>
          )}
        </div>

        {/* Voucher Success Message */}
        {appliedVoucher && (
          <div
            id="voucher-success-msg"
            className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/80 px-3 py-2 text-sm font-medium text-emerald-800"
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                Áp dụng mã <strong>{appliedVoucher.code}</strong>
              </span>
            </span>
            <span className="font-semibold text-emerald-700">
              -{formatVnd(appliedVoucher.discountVnd)}
            </span>
          </div>
        )}

        {/* Voucher Error Message */}
        {voucherError && (
          <p
            id="voucher-error-msg"
            role="alert"
            className="mt-1.5 text-sm font-medium text-red-500"
          >
            {voucherError}
          </p>
        )}
      </div>

      {/* Unavailable Alert */}
      {quote?.available === false && (
        <div
          id="quote-unavailable-alert"
          className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-800"
        >
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <svg
              className="h-4 w-4 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Không thể đặt xe trong thời gian này
          </div>
          <p>
            {quote.unavailableReason || 'Xe đã có người đặt trước hoặc chủ xe đang bận bảo dưỡng.'}
          </p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700 font-medium"
        >
          {errorMessage}
          <button type="button" onClick={loadQuote} className="button button-secondary mt-3">
            Thử tính giá lại
          </button>
        </div>
      )}

      {/* Price Breakdown */}
      {quote && (
        <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>
              Tiền thuê ({quote.breakdown.rentalDays} ngày × {formatVnd(quote.pricePerDayVnd)})
            </span>
            <span id="quote-base-rent" className="font-semibold text-slate-800">
              {formatVnd(quote.breakdown.baseRentVnd)}
            </span>
          </div>

          {quote.breakdown.peakSurchargeVnd > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Phụ phí cuối tuần (T7/CN)</span>
              <span id="quote-peak-surcharge" className="font-semibold text-amber-600">
                +{formatVnd(quote.breakdown.peakSurchargeVnd)}
              </span>
            </div>
          )}

          {quote.breakdown.insuranceFeeVnd > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Bảo hiểm chuyến đi</span>
              <span id="quote-insurance-fee" className="font-semibold text-slate-800">
                +{formatVnd(quote.breakdown.insuranceFeeVnd)}
              </span>
            </div>
          )}

          {quote.breakdown.discountVnd > 0 && (
            <div className="flex justify-between font-medium text-emerald-600">
              <span>Ưu đãi giảm giá voucher</span>
              <span id="quote-discount" className="font-semibold">
                -{formatVnd(quote.breakdown.discountVnd)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-600 border-t border-dashed border-slate-200 pt-2">
            <span>Tổng phụ thuê xe</span>
            <span id="quote-subtotal" className="font-semibold text-slate-800">
              {formatVnd(quote.breakdown.subtotalVnd)}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Phí dịch vụ sàn (10%)</span>
            <span id="quote-service-fee" className="font-semibold text-slate-800">
              {formatVnd(quote.breakdown.serviceFeeVnd)}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Tiền cọc thế chấp (hoàn lại)</span>
            <span id="quote-deposit" className="font-semibold text-slate-800">
              {formatVnd(quote.breakdown.depositVnd)}
            </span>
          </div>

          <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Tổng thanh toán dự kiến</div>
              <div className="text-sm text-slate-400">Đã bao gồm tiền cọc & thuế phí</div>
            </div>
            <div id="quote-total-price" className="text-xl font-semibold text-brand-600">
              {formatVnd(quote.totalVnd)}
            </div>
          </div>
        </div>
      )}

      {/* KYC Warning if user logged in but not verified */}
      {user && user.kycStatus !== 'VERIFIED' && (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">Chưa hoàn tất xác thực GPLX</p>
          <p className="text-sm mb-2">
            Bạn cần xác minh bằng lái xe trước khi được nhận chìa khóa.
          </p>
          <Link
            href="/profile/kyc"
            className="inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Xác thực ngay
          </Link>
        </div>
      )}

      {/* CTA Button */}
      <button
        id="proceed-to-book-btn"
        type="button"
        disabled={!datesValid || isLoading || !!errorMessage || !quote || quote.available === false}
        onClick={handleProceedBooking}
        className="mt-6 w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-colors active:scale-98 disabled:opacity-50 cursor-pointer"
      >
        {isLoading
          ? 'Đang tính biểu phí...'
          : quote?.available === false
            ? 'Xe tạm thời không khả dụng'
            : dateError
              ? 'Kiểm tra lại thời gian thuê'
              : errorMessage
                ? 'Chưa thể tính giá'
                : user && user.kycStatus !== 'VERIFIED'
                  ? 'Xác thực bằng lái để tiếp tục'
                  : 'Tiến hành đặt xe ngay'}
      </button>

      <p className="mt-3 text-center text-sm text-slate-400">
        Bạn chưa bị trừ tiền cho đến khi chủ xe xác nhận chuyến đi.
      </p>

      {/* Auth Modal Trigger */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
