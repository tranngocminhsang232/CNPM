'use client';

import { Icon } from '../../../components/Icon';
import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import {
  fetchBookingDetailApi,
  cancelBookingApi,
  createPaymentIntentApi,
  fetchInspectionsApi,
  fetchBookingReviewsApi,
  type Booking,
  type Payment,
  type Inspection,
  type Review,
} from '../../../lib/api';
import { BookingStatusBadge } from '../../../components/BookingStatusBadge';
import { PaymentModal } from '../../../components/PaymentModal';
import { InspectionChecklistModal } from '../../../components/InspectionChecklistModal';
import { ReturnChecklistModal } from '../../../components/ReturnChecklistModal';
import { DepositSettlementCard } from '../../../components/DepositSettlementCard';
import { ReviewModal } from '../../../components/ReviewModal';
import { KeylessRemoteWidget } from '../../../components/KeylessRemoteWidget';
import { useDialog } from '../../../lib/use-dialog';

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  const resolvedParams = use(params);
  const bookingId = resolvedParams.id;
  const { user, csrfToken, isLoading: isAuthLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  useDialog(
    isCancelModalOpen,
    () => {
      if (!isCancelling) {
        setIsCancelModalOpen(false);
        setCancelReason('');
      }
    },
    'cancel-booking-detail-dialog',
  );

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

  const loadBooking = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const [data, inspList, revList] = await Promise.all([
          fetchBookingDetailApi(bookingId),
          fetchInspectionsApi(bookingId).catch(() => []),
          fetchBookingReviewsApi(bookingId).catch(() => []),
        ]);
        setBooking(data);
        setInspections(inspList);
        setReviews(revList);
      } catch (err: any) {
        setError(err.message || 'Không thể tải thông tin chi tiết đơn đặt xe.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [bookingId],
  );

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
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500 text-sm"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent mx-auto mb-3" />
        Đang tải thông tin chuyến đi...
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-800">
          <div className="text-3xl mb-2">
            <Icon name="alert" />
          </div>
          <h2 className="text-lg font-semibold">Không tìm thấy chuyến đi</h2>
          <p className="mt-2 text-sm text-rose-700">
            {error || 'Đơn đặt xe không tồn tại hoặc bạn không có quyền truy cập.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/bookings"
              className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
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
  const checkInInspection = inspections.find((i) => i.type === 'CHECK_IN');
  const checkOutInspection = inspections.find((i) => i.type === 'CHECK_OUT');
  const isInspectionFinalized = Boolean(
    checkInInspection?.acknowledged && checkInInspection?.finalizedAt,
  );
  const isCheckOutFinalized = Boolean(
    checkOutInspection?.acknowledged && checkOutInspection?.finalizedAt,
  );
  const hasReviewed = reviews.some((r) => r.authorId === user?.id);
  const isKeylessSupported = Boolean(booking.vehicle?.keylessSupported);
  const showKeylessWidget =
    isKeylessSupported && (booking.status === 'APPROVED' || booking.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Header Banner */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                Chi tiết chuyến đi #{booking.id.slice(0, 8)}
              </h1>
              <BookingStatusBadge status={booking.status} size="lg" />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Ngày khởi tạo: {formatDate(booking.createdAt)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {(booking.status === 'REQUESTED' || booking.status === 'APPROVED') && (
              <button
                id="cancel-booking-action-btn"
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
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
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
              >
                {isInitiatingPayment ? 'Đang tạo giao dịch...' : 'Thanh toán cọc (Sandbox)'}
              </button>
            )}

            {booking.status === 'IN_PROGRESS' && isRenter && (
              <button
                id="btn-open-return-modal"
                type="button"
                onClick={() => setIsReturnModalOpen(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
              >
                <Icon name="check" /> Trả xe & Hoàn tất chuyến
              </button>
            )}

            {booking.status === 'COMPLETED' && !hasReviewed && (
              <button
                id="btn-open-review-modal"
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
              >
                <Icon name="star" /> Viết đánh giá
              </button>
            )}
          </div>
        </div>

        {/* Status Notice if REQUESTED */}
        {booking.status === 'REQUESTED' && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-3">
            <span className="text-lg">
              <Icon name="clock" />
            </span>
            <div>
              <h4 className="font-semibold text-amber-900">Đang chờ chủ xe phê duyệt yêu cầu</h4>
              <p className="mt-0.5 text-amber-700">
                Chủ xe có tối đa 15 phút để phản hồi. Khi được duyệt, biển số và địa chỉ đón xe sẽ
                tự động hiển thị.
              </p>
            </div>
          </div>
        )}

        {/* Status Notice if APPROVED */}
        {booking.status === 'APPROVED' && (
          <div className="mb-6 rounded-2xl bg-brand-50 border border-brand-200 p-4 text-sm text-brand-800 flex items-start gap-3">
            <span className="text-lg">
              <Icon name="check" />
            </span>
            <div>
              <h4 className="font-semibold text-brand-900">Yêu cầu thuê xe đã được phê duyệt!</h4>
              <p className="mt-0.5 text-brand-700">
                Xe đã sẵn sàng cho chuyến đi. Vui lòng đến đúng địa chỉ và giờ hẹn để nhận xe.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Vehicle & Parties Details */}
          <div className="md:col-span-7 space-y-6">
            {/* Vehicle Info */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">Thông tin phương tiện</h3>

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
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      Ảnh xe
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {booking.vehicle?.brand} {booking.vehicle?.model}
                  </h2>
                  <div className="mt-1 flex items-center gap-2">
                    {typeof booking.vehicle?.plateNormalized === 'string' &&
                    booking.vehicle.plateNormalized ? (
                      <span
                        id="booking-detail-plate"
                        className="font-mono text-sm font-semibold bg-slate-900 text-white px-2.5 py-1 rounded-lg tracking-wider"
                      >
                        {booking.vehicle.plateNormalized}
                      </span>
                    ) : (
                      <span
                        id="booking-detail-plate-hidden"
                        className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                      >
                        Biển số: ***-*** (Ẩn chờ phê duyệt)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address & Location */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-sm">
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
                      className="font-semibold text-slate-900 text-right"
                    >
                      <Icon name="pin" /> {booking.vehicle.pickupAddress}
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
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">Lịch trình chuyến đi</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-sm uppercase font-semibold text-brand-600 block">
                    Thời gian nhận xe
                  </span>
                  <strong className="text-slate-900 text-sm mt-1 block">
                    {formatDate(booking.startAt)}
                  </strong>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-sm uppercase font-semibold text-slate-500 block">
                    Thời gian trả xe
                  </span>
                  <strong className="text-slate-900 text-sm mt-1 block">
                    {formatDate(booking.endAt)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 text-sm">
              <h3 className="font-semibold text-slate-400 mb-3">Thông tin liên hệ</h3>

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

            {/* Handover & Inspection Checklist Card */}
            {(booking.status === 'APPROVED' ||
              booking.status === 'IN_PROGRESS' ||
              booking.status === 'COMPLETED') && (
              <div
                id="booking-inspection-card"
                className="rounded-2xl border border-slate-200/90 bg-white p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-400">
                        Biên bản bàn giao xe (Checklist 4 góc nhận)
                      </h3>
                      <span
                        id="inspection-status-pill"
                        className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                          isInspectionFinalized
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                        }`}
                      >
                        {isInspectionFinalized ? 'Đã chốt biên bản' : '• Chưa hoàn tất'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {isInspectionFinalized
                        ? `Biên bản bàn giao nhận xe đã được chốt (Odo: ${checkInInspection?.odometerKm} km, Xăng/Pin: ${checkInInspection?.fuelPercent}%).`
                        : 'Vui lòng chụp ảnh 4 góc xe và ghi nhận số km trước khi nhận xe.'}
                    </p>
                  </div>

                  <button
                    id="btn-open-inspection-modal"
                    type="button"
                    onClick={() => setIsInspectionModalOpen(true)}
                    className={`flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold  transition active:scale-95 ${
                      isInspectionFinalized
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                        : 'bg-brand-600 text-white hover:bg-brand-700 '
                    }`}
                  >
                    {isInspectionFinalized ? 'Xem biên bản đã ký' : 'Bắt đầu kiểm tra xe'}
                  </button>
                </div>
              </div>
            )}

            {/* Return Inspection Checklist Card */}
            {(booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED') && (
              <div
                id="booking-return-inspection-card"
                className="rounded-2xl border border-slate-200/90 bg-white p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-400">
                        Biên bản trả xe sau chuyến (Check-out)
                      </h3>
                      <span
                        id="return-inspection-status-pill"
                        className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                          isCheckOutFinalized
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                        }`}
                      >
                        {isCheckOutFinalized ? 'Đã chốt trả xe' : '• Chưa hoàn tất'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {isCheckOutFinalized
                        ? `Biên bản trả xe đã được chốt (Odo: ${checkOutInspection?.odometerKm} km, Xăng/Pin: ${checkOutInspection?.fuelPercent}%).`
                        : 'Chụp 4 góc xe và ghi nhận ODO/nhiên liệu khi hoàn trả xe cho chủ xe.'}
                    </p>
                  </div>

                  <button
                    id="btn-open-return-checklist"
                    type="button"
                    onClick={() => setIsReturnModalOpen(true)}
                    className={`flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold  transition active:scale-95 ${
                      isCheckOutFinalized
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 '
                    }`}
                  >
                    {isCheckOutFinalized ? 'Xem biên bản trả xe' : 'Bắt đầu trả xe'}
                  </button>
                </div>
              </div>
            )}

            {/* Deposit Settlement Card */}
            {booking.status === 'COMPLETED' && (
              <DepositSettlementCard
                bookingId={bookingId}
                isOwner={isOwner}
                isRenter={isRenter}
                depositVnd={booking.pricingSnapshot?.depositVnd || 0}
                checkInInspection={checkInInspection}
                checkOutInspection={checkOutInspection}
                onSettled={async () => {
                  await loadBooking(true);
                }}
              />
            )}

            {/* Two-Way Reviews Section */}
            {booking.status === 'COMPLETED' && (
              <div
                id="booking-reviews-section"
                className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                      Đánh giá chuyến đi (Two-Way Reviews)
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Đánh giá minh bạch giữa khách thuê và chủ xe.
                    </p>
                  </div>
                  {!hasReviewed && (
                    <button
                      id="btn-open-review-modal-section"
                      type="button"
                      onClick={() => setIsReviewModalOpen(true)}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
                    >
                      <Icon name="star" /> Viết đánh giá
                    </button>
                  )}
                </div>

                {reviews.length === 0 ? (
                  <div className="text-center py-6 text-sm text-slate-400">
                    Chưa có đánh giá nào cho chuyến đi này.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => {
                      const isRenterRev = rev.authorId === booking.renterId;
                      return (
                        <div
                          key={rev.id}
                          id={`review-card-${rev.id}`}
                          className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center text-sm">
                                {rev.author?.name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <strong className="text-slate-900">
                                  {rev.author?.name || 'Người dùng'}
                                </strong>
                                <span className="ml-2 text-sm px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700">
                                  {isRenterRev ? 'Khách thuê' : 'Chủ xe'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-amber-700 font-semibold">
                              <span>
                                {Array.from({ length: rev.score }, (_, index) => (
                                  <Icon key={index} name="star" />
                                ))}
                              </span>
                              <span className="text-sm text-slate-600 ml-1 font-semibold">
                                {rev.score}/5
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-700 leading-relaxed text-sm">{rev.comment}</p>
                          <div className="text-sm text-slate-400 text-right">
                            {formatDate(rev.createdAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Keyless & Pricing Snapshot */}
          <div className="md:col-span-5 space-y-6">
            {/* Keyless Smart Key Fob Widget */}
            {showKeylessWidget && (
              <KeylessRemoteWidget
                booking={booking}
                inspectionFinalized={isInspectionFinalized}
                onOpenInspection={() => setIsInspectionModalOpen(true)}
                onKeylessSuccess={async (newStatus) => {
                  setBooking((prev) => (prev ? { ...prev, status: newStatus as any } : prev));
                  await loadBooking(true);
                }}
              />
            )}

            <div
              id="booking-pricing-snapshot"
              className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Biểu phí snapshot bất biến
              </h3>

              <div className="space-y-2.5 text-sm">
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
                  <span className="font-semibold text-slate-900 text-sm">Tổng chuyến đi</span>
                  <span
                    id="booking-detail-total-price"
                    className="text-xl font-semibold text-brand-600"
                  >
                    {formatVnd(booking.pricingSnapshot?.totalVnd)}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-sm text-slate-400">
                * Biểu phí được chốt cố định theo hợp đồng điện tử tại thời điểm khởi tạo đơn.
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-fade-in">
            <div
              id="cancel-booking-detail-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Hủy chuyến đi"
              tabIndex={-1}
              className="dialog-surface w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-semibold text-slate-900 text-lg mb-2">Hủy chuyến đi</h3>
              <p className="text-sm text-slate-500 mb-4">
                Bạn có chắc chắn muốn hủy chuyến xe này? Lịch xe sẽ được mở lại cho người dùng khác.
              </p>

              {cancelError && (
                <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-sm text-rose-700 font-medium">
                  {cancelError}
                </div>
              )}

              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Lý do hủy chuyến *
                  </label>
                  <textarea
                    id="detail-cancel-reason-input"
                    required
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy chuyến..."
                    className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:border-brand-500"
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
                    className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    id="detail-submit-cancel-btn"
                    type="submit"
                    disabled={isCancelling}
                    className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
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

        {/* Inspection Checklist Modal (Check-in) */}
        <InspectionChecklistModal
          isOpen={isInspectionModalOpen}
          onClose={() => setIsInspectionModalOpen(false)}
          bookingId={bookingId}
          initialInspection={checkInInspection}
          onFinalized={async () => {
            setIsInspectionModalOpen(false);
            await loadBooking(true);
          }}
          readOnly={isOwner}
        />

        {/* Return Checklist Modal (Check-out) */}
        <ReturnChecklistModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          bookingId={bookingId}
          checkInInspection={checkInInspection}
          initialInspection={checkOutInspection}
          onFinalized={async () => {
            await loadBooking(true);
          }}
          onCompletedTrip={async (updated) => {
            setBooking(updated);
            await loadBooking(true);
          }}
          readOnly={isOwner}
        />

        {/* Review Modal */}
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          bookingId={bookingId}
          targetRole={isRenter ? 'chủ xe' : 'khách thuê'}
          onReviewSubmitted={async () => {
            await loadBooking(true);
          }}
        />
      </main>
    </div>
  );
}
