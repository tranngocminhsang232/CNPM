'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { fetchBookingDetailApi, cancelBookingApi, createPaymentIntentApi } from '../../../lib/api';
import type { Booking, Payment } from '../../../lib/api';
import { BookingStatusBadge } from '../../../components/BookingStatusBadge';
import { PaymentModal } from '../../../components/PaymentModal';
import { UserNav } from '../../../components/UserNav';

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  const resolvedParams = use(params);
  const bookingId = resolvedParams.id;
  const { user, csrfToken, isLoading: isAuthLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Payment Modal State
  const [paymentIntent, setPaymentIntent] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

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

  const loadBooking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBookingDetailApi(bookingId);
      setBooking(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin chi tiết đơn đặt xe.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csrfToken) return;

    if (!cancelReason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy chuyến.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelBookingApi(bookingId, cancelReason.trim(), csrfToken);
      setIsCancelModalOpen(false);
      setCancelReason('');
      await loadBooking();
    } catch (err: any) {
      setCancelError(err.message || 'Không thể hủy đơn đặt xe.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenPayment = async () => {
    if (!csrfToken) return;
    setIsInitiatingPayment(true);
    try {
      const intent = await createPaymentIntentApi(
        {
          bookingId,
          paymentType: 'DEPOSIT',
        },
        csrfToken,
      );
      setPaymentIntent(intent);
      setIsPaymentModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo phiên thanh toán.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    loadBooking();
  };

  if (isAuthLoading || isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500 text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mx-auto mb-3" />
        Đang tải thông tin chuyến đi...
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-800 shadow-sm">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-lg font-bold">Không tìm thấy chuyến đi</h2>
          <p className="mt-2 text-xs text-rose-700">
            {error || 'Đơn đặt xe không tồn tại hoặc bạn không có quyền truy cập.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/bookings"
              className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm"
            >
              ← Quay lại danh sách chuyến đi
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isRenter = user?.id === booking.renterId;
  const isOwner = user?.id === booking.ownerId;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold">
              <span className="text-blue-600 font-black">CARSHARE</span>
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href={isOwner ? '/owner/bookings' : '/bookings'}
              className="text-xs font-semibold text-slate-600 hover:text-blue-600"
            >
              {isOwner ? 'Quản lý yêu cầu thuê' : 'Chuyến đi của tôi'}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-400">
              Đơn #{booking.id.slice(0, 8)}
            </span>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Header Banner */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Chi tiết chuyến đi #{booking.id.slice(0, 8)}
              </h1>
              <BookingStatusBadge status={booking.status} size="lg" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ngày khởi tạo: {formatDate(booking.createdAt)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {(booking.status === 'REQUESTED' || booking.status === 'APPROVED') && (
              <button
                id="cancel-booking-action-btn"
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                Hủy chuyến
              </button>
            )}

            {booking.status === 'REQUESTED' && isRenter && (
              <button
                id="pay-deposit-btn"
                type="button"
                disabled={isInitiatingPayment}
                onClick={handleOpenPayment}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 cursor-pointer"
              >
                {isInitiatingPayment ? 'Đang tạo giao dịch...' : 'Thanh toán cọc (Sandbox)'}
              </button>
            )}
          </div>
        </div>

        {/* Status Notice if REQUESTED */}
        {booking.status === 'REQUESTED' && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-start gap-3 shadow-sm">
            <span className="text-lg">⏳</span>
            <div>
              <h4 className="font-bold text-amber-900">Đang chờ chủ xe phê duyệt yêu cầu</h4>
              <p className="mt-0.5 text-amber-700">
                Chủ xe có tối đa 15 phút để phản hồi. Khi được duyệt, biển số và địa chỉ đón xe sẽ
                tự động hiển thị.
              </p>
            </div>
          </div>
        )}

        {/* Status Notice if APPROVED */}
        {booking.status === 'APPROVED' && (
          <div className="mb-6 rounded-2xl bg-sky-50 border border-sky-200 p-4 text-xs text-sky-800 flex items-start gap-3 shadow-sm">
            <span className="text-lg">🎉</span>
            <div>
              <h4 className="font-bold text-sky-900">Yêu cầu thuê xe đã được phê duyệt!</h4>
              <p className="mt-0.5 text-sky-700">
                Xe đã sẵn sàng cho chuyến đi. Vui lòng đến đúng địa chỉ và giờ hẹn để nhận xe.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Vehicle & Parties Details */}
          <div className="md:col-span-7 space-y-6">
            {/* Vehicle Info */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Thông tin phương tiện
              </h3>

              <div className="flex gap-4 items-center mb-5">
                <div className="w-28 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                  {typeof booking.vehicle?.coverImageUrl === 'string' &&
                  booking.vehicle.coverImageUrl ? (
                    <img
                      src={booking.vehicle.coverImageUrl}
                      alt={`${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                      Ảnh xe
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {booking.vehicle?.brand} {booking.vehicle?.model}
                  </h2>
                  <div className="mt-1 flex items-center gap-2">
                    {typeof booking.vehicle?.plateNormalized === 'string' &&
                    booking.vehicle.plateNormalized ? (
                      <span
                        id="booking-detail-plate"
                        className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg tracking-wider"
                      >
                        {booking.vehicle.plateNormalized}
                      </span>
                    ) : (
                      <span
                        id="booking-detail-plate-hidden"
                        className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                      >
                        Biển số: ***-*** (Ẩn chờ phê duyệt)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address & Location */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500">Khu vực / Thành phố:</span>
                  <span className="font-semibold text-slate-800">{booking.vehicle?.city}</span>
                </div>

                <div className="flex justify-between items-start pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Địa chỉ nhận xe:</span>
                  {typeof booking.vehicle?.pickupAddress === 'string' &&
                  booking.vehicle.pickupAddress ? (
                    <span
                      id="booking-detail-pickup-address"
                      className="font-bold text-slate-900 text-right"
                    >
                      📍 {booking.vehicle.pickupAddress}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">
                      Chỉ hiển thị sau khi chủ xe phê duyệt
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Lịch trình chuyến đi
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-blue-600 block">
                    Thời gian nhận xe
                  </span>
                  <strong className="text-slate-900 text-sm mt-1 block">
                    {formatDate(booking.startAt)}
                  </strong>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Thời gian trả xe
                  </span>
                  <strong className="text-slate-900 text-sm mt-1 block">
                    {formatDate(booking.endAt)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm text-xs">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 mb-3">
                Thông tin liên hệ
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chủ xe:</span>
                  <span className="font-semibold text-slate-800">
                    {booking.owner?.name} ({booking.owner?.phone})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách thuê:</span>
                  <span className="font-semibold text-slate-800">
                    {booking.renter?.name} ({booking.renter?.phone})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing Snapshot */}
          <div className="md:col-span-5">
            <div
              id="booking-pricing-snapshot"
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-4"
            >
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">
                Biểu phí snapshot bất biến
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Đơn giá theo ngày</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(booking.pricingSnapshot?.pricePerDayVnd)} / ngày
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Số ngày thuê</span>
                  <span className="font-semibold text-slate-800">
                    {booking.pricingSnapshot?.rentalDays} ngày
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 pt-2 border-t border-dashed border-slate-200">
                  <span>Tổng phụ cước xe</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(booking.pricingSnapshot?.subtotalVnd)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Phí dịch vụ sàn (10%)</span>
                  <span className="font-semibold text-slate-800">
                    {formatVnd(booking.pricingSnapshot?.serviceFeeVnd)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Tiền cọc thế chấp (hoàn lại)</span>
                  <span id="snapshot-deposit-amount" className="font-semibold text-slate-800">
                    {formatVnd(booking.pricingSnapshot?.depositVnd)}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
                  <span className="font-bold text-slate-900 text-sm">Tổng chuyến đi</span>
                  <span
                    id="booking-detail-total-price"
                    className="text-xl font-black text-blue-600"
                  >
                    {formatVnd(booking.pricingSnapshot?.totalVnd)}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400">
                * Biểu phí được chốt cố định theo hợp đồng điện tử tại thời điểm khởi tạo đơn.
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="font-black text-slate-900 text-lg mb-2">Hủy chuyến đi</h3>
              <p className="text-xs text-slate-500 mb-4">
                Bạn có chắc chắn muốn hủy chuyến xe này? Lịch xe sẽ được mở lại cho người dùng khác.
              </p>

              {cancelError && (
                <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                  {cancelError}
                </div>
              )}

              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lý do hủy chuyến *
                  </label>
                  <textarea
                    id="detail-cancel-reason-input"
                    required
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy chuyến..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setCancelReason('');
                    }}
                    className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    id="detail-submit-cancel-btn"
                    type="submit"
                    disabled={isCancelling}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                  >
                    {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          payment={paymentIntent}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </main>
    </div>
  );
}
