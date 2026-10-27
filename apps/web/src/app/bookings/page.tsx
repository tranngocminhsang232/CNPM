'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { fetchBookingsApi, cancelBookingApi } from '../../lib/api';
import type { Booking } from '../../lib/api';
import { BookingStatusBadge } from '../../components/BookingStatusBadge';
import { UserNav } from '../../components/UserNav';

export default function RenterBookingsPage() {
  const { user, csrfToken, isLoading: isAuthLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Cancel Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
        perspective: 'renter',
        status: activeTab !== 'ALL' ? activeTab : undefined,
      });
      setBookings(res.data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn đặt xe.');
    } finally {
      setIsLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalBooking || !csrfToken) return;

    if (!cancelReason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy chuyến đi.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelBookingApi(cancelModalBooking.id, cancelReason.trim(), csrfToken);
      setCancelModalBooking(null);
      setCancelReason('');
      await loadBookings();
    } catch (err: any) {
      setCancelError(err.message || 'Không thể hủy đơn đặt xe.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isAuthLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-center text-slate-500 text-sm">
        Đang xác thực thông tin...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-slate-900">Yêu cầu đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-500">
            Vui lòng đăng nhập để xem danh sách chuyến đi và lịch sử thuê xe của bạn.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </main>
    );
  }

  const tabs = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'REQUESTED', label: 'Chờ duyệt' },
    { key: 'APPROVED', label: 'Đã duyệt' },
    { key: 'IN_PROGRESS', label: 'Đang diễn ra' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELLED', label: 'Đã hủy' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold">
              <span className="text-blue-600 font-black">CARSHARE</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600">Chuyến đi của tôi</span>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Chuyến đi của tôi
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý hành trình, trạng thái duyệt xe và giao dịch thanh toán
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            + Tìm thuê xe mới
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200/80">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key.toLowerCase()}`}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-xs font-medium">Đang tải danh sách chuyến đi...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 text-xs">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <div className="text-3xl mb-2">🚗</div>
            <h3 className="text-sm font-bold text-slate-800">Chưa có chuyến đi nào</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'ALL'
                ? 'Bạn chưa tạo đơn thuê xe nào. Khám phá hàng trăm xe tự lái tiện nghi ngay!'
                : `Không có chuyến đi nào trong mục ${tabs.find((t) => t.key === activeTab)?.label.toLowerCase()}.`}
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Tìm kiếm xe ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-4" data-testid="renter-bookings-list">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                data-testid={`booking-card-${booking.id}`}
                className="rounded-3xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                {/* Left Details */}
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
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        Không có ảnh
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookingStatusBadge status={booking.status} />
                      {typeof booking.vehicle?.plateNormalized === 'string' &&
                      booking.vehicle.plateNormalized ? (
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                          {booking.vehicle.plateNormalized}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Biển số: ***-*** (Ẩn chờ duyệt)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900">
                      {booking.vehicle?.brand} {booking.vehicle?.model}
                    </h3>

                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        📅 Nhận:{' '}
                        <strong className="text-slate-700">{formatDate(booking.startAt)}</strong>
                      </span>
                      <span>→</span>
                      <span>
                        Trả: <strong className="text-slate-700">{formatDate(booking.endAt)}</strong>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Mã đơn: <span className="font-mono">{booking.id.slice(0, 8)}...</span> • Chủ
                      xe: {booking.owner?.name}
                    </p>
                  </div>
                </div>

                {/* Right Price & Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 gap-3">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Tổng tiền
                    </span>
                    <span className="text-lg font-black text-blue-600">
                      {formatVnd(booking.pricingSnapshot?.totalVnd)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/bookings/${booking.id}`}
                      data-testid={`view-detail-btn-${booking.id}`}
                      className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Xem chi tiết
                    </Link>

                    {(booking.status === 'REQUESTED' || booking.status === 'APPROVED') && (
                      <button
                        type="button"
                        data-testid={`cancel-booking-btn-${booking.id}`}
                        onClick={() => setCancelModalBooking(booking)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cancel Modal */}
        {cancelModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="font-black text-slate-900 text-lg mb-2">Hủy đơn đặt xe</h3>
              <p className="text-xs text-slate-500 mb-4">
                Bạn có chắc chắn muốn hủy chuyến xe{' '}
                <strong className="text-slate-800">
                  {cancelModalBooking.vehicle?.brand} {cancelModalBooking.vehicle?.model}
                </strong>
                ? Lịch xe sẽ được giải phóng ngay lập tức.
              </p>

              {cancelError && (
                <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                  {cancelError}
                </div>
              )}

              <form onSubmit={handleCancelSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lý do hủy đơn *
                  </label>
                  <textarea
                    id="cancel-reason-input"
                    required
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ví dụ: Thay đổi lịch trình công tác cá nhân..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => {
                      setCancelModalBooking(null);
                      setCancelReason('');
                    }}
                    className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    id="submit-cancel-btn"
                    type="submit"
                    disabled={isCancelling}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                  >
                    {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy đơn'}
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
