'use client';

import { Icon } from '../../components/Icon';
import React, { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import {
  fetchVehicleDetailApi,
  calculateQuoteApi,
  createBookingApi,
  createPaymentIntentApi,
} from '../../lib/api';
import type { VehicleDetail, Quote, Payment } from '../../lib/api';
import { PaymentModal } from '../../components/PaymentModal';
import { AuthModal } from '../../components/AuthModal';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, csrfToken, isLoading: isAuthLoading } = useAuth();

  const vehicleId = searchParams.get('vehicleId');
  const startAt = searchParams.get('startAt');
  const endAt = searchParams.get('endAt');
  const insurancePackage =
    (searchParams.get('insurance') as 'BASIC' | 'STANDARD' | 'PREMIUM') || 'BASIC';
  const voucherCode = searchParams.get('voucher') || undefined;

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const formatVnd = (val?: number) => {
    if (val === undefined || val === null) return '0 ₫';
    return `${new Intl.NumberFormat('vi-VN').format(val)} ₫`;
  };

  const formatDate = (isoStr?: string) => {
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

  const loadData = useCallback(async () => {
    if (!vehicleId || !startAt || !endAt) {
      setError('Thiếu thông số đặt xe. Vui lòng quay lại chọn thời gian.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [vData, qData] = await Promise.all([
        fetchVehicleDetailApi(vehicleId),
        calculateQuoteApi({
          vehicleId,
          startAt,
          endAt,
          insurancePackage,
          voucherCode,
        }),
      ]);

      setVehicle(vData);
      setQuote(qData);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin đặt xe. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, startAt, endAt, insurancePackage, voucherCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmBooking = async () => {
    if (!user) {
      setError('Vui lòng đăng nhập trước khi tiến hành đặt xe.');
      return;
    }

    if (user.kycStatus !== 'VERIFIED') {
      router.push('/profile/kyc');
      return;
    }

    if (!vehicle || !quote || !startAt || !endAt || !csrfToken) {
      setError('Dữ liệu chuyến đi chưa hoàn tất.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();

      // 1. Create booking
      const newBooking = await createBookingApi(
        {
          vehicleId: vehicle.id,
          startAt,
          endAt,
          insurancePackage,
          voucherCode,
          expectedTotalVnd: quote.totalVnd,
          pricingVersion: 'daily-v1',
        },
        idempotencyKey,
        csrfToken,
      );

      setCreatedBookingId(newBooking.id);

      // 2. Create Payment Intent for DEPOSIT
      try {
        const intent = await createPaymentIntentApi(
          {
            bookingId: newBooking.id,
            paymentType: 'DEPOSIT',
          },
          csrfToken,
        );
        setPaymentIntent(intent);
        setIsPaymentModalOpen(true);
      } catch (payErr: any) {
        // If payment intent creation fails, still redirect to booking detail
        router.push(`/bookings/${newBooking.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tạo đơn đặt xe. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = (_payment: Payment) => {
    setIsPaymentModalOpen(false);
    if (createdBookingId) {
      router.push(`/bookings/${createdBookingId}?paid=true`);
    } else {
      router.push('/bookings');
    }
  };

  const handlePaymentModalClose = () => {
    setIsPaymentModalOpen(false);
    if (createdBookingId) {
      router.push(`/bookings/${createdBookingId}`);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold">Đang tổng hợp thông tin chuyến đi...</p>
        </div>
      </main>
    );
  }

  if (!vehicle || !quote) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-800">
          <div className="text-3xl mb-2">
            <Icon name="alert" />
          </div>
          <h2 className="text-lg font-semibold">Không thể tiếp tục thanh toán</h2>
          <p className="mt-2 text-sm text-rose-700">{error || 'Xe không khả dụng.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            {vehicleId && startAt && endAt && (
              <button type="button" className="button button-primary" onClick={loadData}>
                Thử lại
              </button>
            )}
            <Link
              href={vehicleId ? `/vehicles/${vehicleId}` : '/'}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
            >
              ← Quay lại trang xe
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <Link
          className="inline-flex min-h-11 items-center text-sm text-brand-700 mb-3"
          href={`/vehicles/${vehicle.id}`}
        >
          ← Quay lại chọn thời gian thuê
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight mb-8">
          Xác nhận thông tin & Ký quỹ đặt xe
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Trip Details & Policies */}
          <div className="lg:col-span-7 space-y-6">
            {/* Vehicle Summary Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 flex flex-col sm:flex-row gap-5 items-center">
              {vehicle.photoUrls && vehicle.photoUrls.length > 0 ? (
                <img
                  src={vehicle.photoUrls[0]}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  className="w-full sm:w-44 h-32 rounded-2xl object-cover bg-slate-100"
                />
              ) : (
                <div className="w-full sm:w-44 h-32 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
                  Không có ảnh
                </div>
              )}

              <div className="flex-1 w-full">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-700 uppercase">
                    {vehicle.carType}
                  </span>
                  {vehicle.keylessSupported && (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
                      <Icon name="key" /> Khóa ảo Keyless
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  {vehicle.brand} {vehicle.model} ({vehicle.year})
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Chủ xe:{' '}
                  <span className="font-semibold text-slate-700">{vehicle.owner?.name}</span>
                </p>
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <span>
                    <Icon name="settings" />{' '}
                    {vehicle.transmission === 'AUTO' ? 'Tự động' : 'Số sàn'}
                  </span>
                  <span>•</span>
                  <span>
                    <Icon name="seats" /> {vehicle.seats} chỗ ngồi
                  </span>
                </div>
              </div>
            </div>

            {/* Rental Duration Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 text-sm text-slate-400">
                Lịch trình nhận & trả xe
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <span className="text-sm font-semibold uppercase text-brand-600">
                    Thời gian nhận xe
                  </span>
                  <p id="checkout-start-at" className="font-semibold text-slate-900 text-sm mt-1">
                    {formatDate(startAt || undefined)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <span className="text-sm font-semibold uppercase text-slate-500">
                    Thời gian trả xe
                  </span>
                  <p id="checkout-end-at" className="font-semibold text-slate-900 text-sm mt-1">
                    {formatDate(endAt || undefined)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-brand-50/50 p-3.5 border border-brand-100 text-sm text-brand-900 flex items-start gap-2.5">
                <span className="text-base">
                  <Icon name="pin" />
                </span>
                <div>
                  <p className="font-semibold">Khu vực nhận xe: {vehicle.city}</p>
                  <p className="text-sm text-brand-700/80 mt-0.5">
                    Địa chỉ số nhà và biển số xe sẽ tự động hiển thị ngay sau khi chủ xe bấm duyệt
                    đơn.
                  </p>
                </div>
              </div>
            </div>

            {/* Insurance Package Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 text-sm text-slate-400">
                Gói bảo hiểm đã chọn
              </h3>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div>
                  <span className="font-semibold text-slate-900 text-sm">
                    Gói{' '}
                    {insurancePackage === 'BASIC'
                      ? 'Cơ bản (BASIC)'
                      : insurancePackage === 'STANDARD'
                        ? 'Tiêu chuẩn (STANDARD)'
                        : 'Toàn diện (PREMIUM)'}
                  </span>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {insurancePackage === 'BASIC'
                      ? 'Bảo hiểm trách nhiệm dân sự bắt buộc tiêu chuẩn'
                      : insurancePackage === 'STANDARD'
                        ? 'Giảm 50% mức khấu trừ rủi ro va chạm thân vỏ'
                        : 'Bảo vệ toàn diện, miễn thường rủi ro va quẹt & thủy kích'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {insurancePackage === 'BASIC'
                    ? 'Đã gồm'
                    : formatVnd(quote.breakdown.insuranceFeeVnd)}
                </span>
              </div>
            </div>

            {/* Escrow Deposit Policy */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 text-sm text-slate-400">
                Chính sách cọc & Ký quỹ an toàn
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Nhằm đảm bảo an toàn cho cả hai bên, tiền cọc thế chấp (
                {formatVnd(quote.breakdown.depositVnd)}) được phong tỏa trong tài khoản ký quỹ
                (Escrow) của sàn Car Sharing. Tiền cọc sẽ được hoàn trả tự động về tài khoản của bạn
                ngay sau khi hoàn tất thủ tục trả xe và đối soát không phát sinh vi phạm.
              </p>
            </div>
          </div>

          {/* Right Column: Pricing Breakdown & Checkout Action */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-4">
                Chi tiết biểu phí thanh toán
              </h3>

              <div className="my-5 space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Đơn giá thuê ({quote.rentalDays} ngày)</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(quote.breakdown.baseRentVnd)}
                  </span>
                </div>

                {quote.breakdown.peakSurchargeVnd > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Phụ phí cao điểm cuối tuần (+10%)</span>
                    <span className="font-semibold text-slate-800">
                      +{formatVnd(quote.breakdown.peakSurchargeVnd)}
                    </span>
                  </div>
                )}

                {quote.breakdown.insuranceFeeVnd > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Phí bảo hiểm nâng cao</span>
                    <span className="font-semibold text-slate-800">
                      +{formatVnd(quote.breakdown.insuranceFeeVnd)}
                    </span>
                  </div>
                )}

                {quote.breakdown.discountVnd > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>Mã ưu đãi voucher {voucherCode ? `(${voucherCode})` : ''}</span>
                    <span>-{formatVnd(quote.breakdown.discountVnd)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 pt-2 border-t border-dashed border-slate-200">
                  <span>Tổng phụ cước xe</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(quote.breakdown.subtotalVnd)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Phí dịch vụ nền tảng (10%)</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(quote.breakdown.serviceFeeVnd)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Tiền cọc thế chấp (hoàn lại)</span>
                  <span id="checkout-deposit-amount" className="font-semibold text-slate-800">
                    {formatVnd(quote.breakdown.depositVnd)}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-4 flex items-baseline justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Tổng thanh toán dự kiến
                    </div>
                    <div className="text-sm text-slate-400">Đã bao gồm tiền cọc & thuế phí</div>
                  </div>
                  <div id="checkout-total-price" className="text-2xl font-semibold text-brand-600">
                    {formatVnd(quote.totalVnd)}
                  </div>
                </div>
              </div>

              {error && (
                <div
                  id="checkout-error-alert"
                  role="alert"
                  className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium"
                >
                  {error}
                </div>
              )}

              {!quote.available && (
                <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                  {quote.unavailableReason ||
                    'Xe không còn trống trong thời gian đã chọn. Quay lại trang xe để chọn thời gian khác.'}
                </p>
              )}
              {!user ? (
                <div className="mb-4 rounded-lg bg-brand-50 p-4">
                  <p className="text-sm text-brand-900">Đăng nhập để xác nhận chuyến đi này.</p>
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className="button button-primary mt-3"
                  >
                    Đăng nhập để tiếp tục
                  </button>
                </div>
              ) : user.kycStatus !== 'VERIFIED' ? (
                <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                  <p>Bạn cần xác thực bằng lái trước khi đặt xe.</p>
                  <Link href="/profile/kyc" className="button button-secondary mt-3">
                    Xác thực bằng lái
                  </Link>
                </div>
              ) : null}

              <button
                id="confirm-booking-btn"
                type="button"
                disabled={
                  isSubmitting || !user || user.kycStatus !== 'VERIFIED' || !quote.available
                }
                aria-busy={isSubmitting}
                onClick={handleConfirmBooking}
                className="w-full rounded-2xl bg-brand-600 py-4 text-sm font-semibold text-white active:scale-98 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Đang khởi tạo chuyến đi...</span>
                ) : (
                  <>
                    <span>Xác nhận & Đặt xe</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-sm text-slate-400 leading-normal">
                Bằng việc bấm xác nhận, bạn đồng ý với Điều khoản dịch vụ và Chính sách ký quỹ của
                Car Sharing.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Gateway Sandbox Modal */}
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={handlePaymentModalClose}
          payment={paymentIntent}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-12 text-center text-slate-500 text-sm"
        >
          Đang tải trang đặt xe...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
