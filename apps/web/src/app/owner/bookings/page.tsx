'use client';

import { Icon } from '../../../components/Icon';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { fetchBookingsApi, approveBookingApi, rejectBookingApi } from '../../../lib/api';
import type { Booking } from '../../../lib/api';
import { BookingStatusBadge } from '../../../components/BookingStatusBadge';
import { useDialog } from '../../../lib/use-dialog';

export default function OwnerBookingsPage() {
  const { user, csrfToken, isLoading: isAuthLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'REQUESTED' | 'ALL'>('REQUESTED');

  // Reject Modal State
  const [rejectModalBooking, setRejectModalBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  useDialog(
    !!rejectModalBooking,
    () => {
      if (!isRejecting) {
        setRejectModalBooking(null);
        setRejectReason('');
      }
    },
    'reject-booking-dialog',
  );

  // Approve State
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const loadBookings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchBookingsApi({
        perspective: 'owner',
        status: activeTab === 'REQUESTED' ? 'REQUESTED' : undefined,
      });
      setBookings(res.data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách yêu cầu thuê xe.');
    } finally {
      setIsLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleApprove = async (booking: Booking) => {
    if (!csrfToken) return;
    setProcessingId(booking.id);
    try {
      await approveBookingApi(booking.id, csrfToken);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Không thể phê duyệt yêu cầu.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalBooking || !csrfToken) return;

    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối.');
      return;
    }

    setIsRejecting(true);
    setRejectError(null);

    try {
      await rejectBookingApi(rejectModalBooking.id, rejectReason.trim(), csrfToken);
      setRejectModalBooking(null);
      setRejectReason('');
      await loadBookings();
    } catch (err: any) {
      setRejectError(err.message || 'Không thể từ chối yêu cầu.');
    } finally {
      setIsRejecting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-12 text-center text-slate-500 text-sm"
      >
        Đang xác thực thông tin...
      </main>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-10">
            <div className="text-4xl mb-3">
              <Icon name="lock" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Yêu cầu đăng nhập</h1>
            <p className="mt-2 text-sm text-slate-500">
              Vui lòng đăng nhập bằng tài khoản chủ xe để quản lý yêu cầu thuê xe.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Quay lại trang chủ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
              Hộp thư yêu cầu thuê xe
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Phê duyệt hoặc từ chối yêu cầu thuê xe của khách trong vòng 15 phút
            </p>
          </div>

          <Link
            href="/owner/vehicles"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Danh sách xe của tôi
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200/80">
          <button
            type="button"
            data-testid="tab-owner-requested"
            onClick={() => setActiveTab('REQUESTED')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'REQUESTED'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Chờ duyệt (Mới)
          </button>

          <button
            type="button"
            data-testid="tab-owner-all"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Tất cả yêu cầu
          </button>
        </div>

        {/* Content State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Đang tải danh sách yêu cầu...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 text-sm">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <div className="text-3xl mb-2">
              <Icon name="inbox" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Không có yêu cầu thuê xe nào</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {activeTab === 'REQUESTED'
                ? 'Hiện tại không có yêu cầu nào đang chờ xử lý. Các yêu cầu mới sẽ xuất hiện tại đây.'
                : 'Bạn chưa có yêu cầu thuê xe nào.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="owner-bookings-list">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                data-testid={`owner-booking-card-${booking.id}`}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 transition-shadow flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                {/* Left Vehicle & Renter Details */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
                  <div className="w-full sm:w-36 h-24 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {typeof booking.vehicle?.coverImageUrl === 'string' &&
                    booking.vehicle.coverImageUrl ? (
                      <img
                        src={booking.vehicle.coverImageUrl}
                        alt={`${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        Không có ảnh
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookingStatusBadge status={booking.status} />
                      {typeof booking.vehicle?.plateNormalized === 'string' &&
                        booking.vehicle.plateNormalized && (
                          <span className="font-mono text-sm font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                            {booking.vehicle.plateNormalized}
                          </span>
                        )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {booking.vehicle?.brand} {booking.vehicle?.model}
                    </h3>

                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        <Icon name="calendar" /> Nhận:{' '}
                        <strong className="text-slate-700">{formatDate(booking.startAt)}</strong>
                      </span>
                      <span>→</span>
                      <span>
                        Trả: <strong className="text-slate-700">{formatDate(booking.endAt)}</strong>
                      </span>
                    </div>

                    <p className="text-sm text-slate-500">
                      Khách thuê: <strong className="text-slate-800">{booking.renter?.name}</strong>{' '}
                      ({booking.renter?.phone})
                    </p>
                  </div>
                </div>

                {/* Right Price & Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 gap-3">
                  <div className="text-left md:text-right">
                    <span className="text-sm uppercase font-semibold text-slate-400 block">
                      Doanh thu dự kiến
                    </span>
                    <span className="text-lg font-semibold text-brand-600">
                      {formatVnd(booking.pricingSnapshot?.totalVnd)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {booking.status === 'REQUESTED' ? (
                      <>
                        <button
                          type="button"
                          data-testid={`approve-booking-btn-${booking.id}`}
                          disabled={processingId === booking.id}
                          onClick={() => handleApprove(booking)}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {processingId === booking.id ? 'Đang duyệt...' : 'Phê duyệt'}
                        </button>

                        <button
                          type="button"
                          data-testid={`reject-booking-btn-${booking.id}`}
                          onClick={() => setRejectModalBooking(booking)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Từ chối
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Xem chi tiết
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        {rejectModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-fade-in">
            <div
              id="reject-booking-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Từ chối yêu cầu thuê xe"
              tabIndex={-1}
              className="dialog-surface w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-semibold text-slate-900 text-lg mb-2">Từ chối yêu cầu thuê xe</h3>
              <p className="text-sm text-slate-500 mb-4">
                Bạn có chắc chắn muốn từ chối yêu cầu từ khách thuê{' '}
                <strong className="text-slate-800">{rejectModalBooking.renter?.name}</strong>? Lịch
                xe sẽ được tự động mở lại cho khách khác.
              </p>

              {rejectError && (
                <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-sm text-rose-700 font-medium">
                  {rejectError}
                </div>
              )}

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Lý do từ chối *
                  </label>
                  <textarea
                    id="owner-reject-reason-input"
                    required
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ví dụ: Xe đang bảo dưỡng đột xuất định kỳ..."
                    className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isRejecting}
                    onClick={() => {
                      setRejectModalBooking(null);
                      setRejectReason('');
                    }}
                    className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    id="submit-reject-btn"
                    type="submit"
                    disabled={isRejecting}
                    className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                  >
                    {isRejecting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
