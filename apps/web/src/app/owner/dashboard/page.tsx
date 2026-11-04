'use client';

import { Icon } from '../../../components/Icon';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import {
  fetchBookingsApi,
  fetchOwnerVehicles,
  type Booking,
  type OwnerVehicle,
} from '../../../lib/api';
import { BookingStatusBadge } from '../../../components/BookingStatusBadge';

export default function HostDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const [bookingsRes, vehiclesRes] = await Promise.all([
        fetchBookingsApi({ perspective: 'owner' }),
        fetchOwnerVehicles(),
      ]);
      setBookings(bookingsRes.data);
      setVehicles(vehiclesRes);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived Business Metrics (BR-13)
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const inProgressBookings = bookings.filter((b) => b.status === 'IN_PROGRESS');
  const approvedBookings = bookings.filter((b) => b.status === 'APPROVED');
  const requestedBookings = bookings.filter((b) => b.status === 'REQUESTED');
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  // Doanh thu thực nhận từ các đơn COMPLETED
  const totalCompletedRevenue = completedBookings.reduce(
    (sum, b) => sum + (b.pricingSnapshot?.subtotalVnd || 0),
    0,
  );

  // Doanh thu dự kiến từ các đơn đang chạy & đã duyệt
  const pendingRevenue = [...inProgressBookings, ...approvedBookings].reduce(
    (sum, b) => sum + (b.pricingSnapshot?.subtotalVnd || 0),
    0,
  );

  // Tỷ lệ phê duyệt đơn
  const totalDecided =
    completedBookings.length + inProgressBookings.length + approvedBookings.length;
  const totalFinishedOrRejected =
    totalDecided + bookings.filter((b) => (b.status as string) === 'REJECTED').length;
  const approvalRate =
    totalFinishedOrRejected > 0 ? Math.round((totalDecided / totalFinishedOrRejected) * 100) : null;

  const publishedVehicles = vehicles.filter((v) => v.status === 'PUBLISHED');

  if (!isAuthLoading && !user) {
    return (
      <main id="main-content" tabIndex={-1} className="site-container py-12">
        <div className="result-state">
          <h1 className="text-2xl font-semibold">Quản lý việc cho thuê xe</h1>
          <p>Đăng nhập để theo dõi yêu cầu thuê, chuyến đi và xe của bạn.</p>
          <Link href="/" className="button button-secondary">
            Khám phá xe cho thuê
          </Link>
        </div>
      </main>
    );
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-500 text-sm"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent mx-auto mb-3" />
          Đang tải bảng điều khiển chủ xe...
        </main>
      </div>
    );
  }

  if (error)
    return (
      <main id="main-content" tabIndex={-1} className="site-container py-12">
        <div className="result-state" role="alert">
          <h1 className="text-2xl font-semibold">Chưa thể tải tổng quan</h1>
          <p>{error}</p>
          <button type="button" className="button button-primary" onClick={loadDashboardData}>
            Thử lại
          </button>
        </div>
      </main>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-8 md:py-12 space-y-8"
      >
        {/* Top Header Banner */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1
                id="host-dashboard-title"
                className="text-2xl font-semibold text-slate-900 tracking-tight"
              >
                Tổng quan cho thuê
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi các yêu cầu mới, chuyến đang chạy và đội xe của bạn.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              id="host-view-requests-btn"
              href="/owner/bookings"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Yêu cầu thuê xe {requestedBookings.length > 0 && `(${requestedBookings.length})`}
            </Link>
            <Link
              id="host-add-vehicle-btn"
              href="/owner/vehicles/new"
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              + Đăng thêm xe
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section
          className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4"
          aria-labelledby="owner-next-step"
        >
          <div>
            <h2 id="owner-next-step" className="text-lg font-semibold">
              {requestedBookings.length > 0
                ? `${requestedBookings.length} yêu cầu đang chờ bạn`
                : 'Bạn đã xem hết yêu cầu mới'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {requestedBookings.length > 0
                ? 'Xem lịch thuê và phản hồi để khách sớm lên kế hoạch.'
                : 'Các yêu cầu thuê mới sẽ xuất hiện trong phần quản lý.'}
            </p>
          </div>
          <Link href="/owner/bookings" className="button button-secondary">
            Xem yêu cầu thuê →
          </Link>
        </section>

        {/* Financial & Operational KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Completed Revenue */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 transition-shadow">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-semibold">Doanh thu hoàn tất</span>
              <span className="text-xl">
                <Icon name="money" />
              </span>
            </div>
            <div
              id="host-total-revenue"
              className="text-2xl font-semibold text-slate-900 tracking-tight"
            >
              {formatVnd(totalCompletedRevenue)}
            </div>
            <p className="text-sm text-emerald-600 font-semibold mt-1">
              Từ {completedBookings.length} chuyến hoàn thành
            </p>
          </div>

          {/* Pending Revenue */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 transition-shadow">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-semibold">Doanh thu đang chạy</span>
              <span className="text-xl">
                <Icon name="clock" />
              </span>
            </div>
            <div
              id="host-pending-revenue"
              className="text-2xl font-semibold text-brand-600 tracking-tight"
            >
              {formatVnd(pendingRevenue)}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Từ {inProgressBookings.length + approvedBookings.length} chuyến đang diễn ra / đã
              duyệt
            </p>
          </div>

          {/* Approval Rate */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 transition-shadow">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-semibold">Tỷ lệ duyệt đơn</span>
              <span className="text-xl">
                <Icon name="chart" />
              </span>
            </div>
            <div
              id="host-approval-rate"
              className="text-2xl font-semibold text-slate-900 tracking-tight"
            >
              {approvalRate === null ? '—' : `${approvalRate}%`}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {approvalRate === null ? 'Chưa có yêu cầu đã xử lý' : 'Trên các yêu cầu đã xử lý'}
            </p>
          </div>

          {/* Fleet Count */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 transition-shadow">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-semibold">Đội xe cho thuê</span>
              <span className="text-xl">
                <Icon name="car" />
              </span>
            </div>
            <div
              id="host-fleet-count"
              className="text-2xl font-semibold text-slate-900 tracking-tight"
            >
              {vehicles.length} xe
            </div>
            <p className="text-sm text-emerald-600 font-semibold mt-1">
              {publishedVehicles.length} xe đang mở cho thuê công khai
            </p>
          </div>
        </div>

        {/* Booking Counts by Status Grid */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">
            Thống kê đơn thuê xe theo trạng thái
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5">
              <div className="text-sm font-semibold text-amber-800">Chờ duyệt</div>
              <div id="stat-count-requested" className="text-xl font-semibold text-amber-900 mt-1">
                {requestedBookings.length}
              </div>
            </div>

            <div className="rounded-2xl bg-brand-50 border border-brand-200 p-3.5">
              <div className="text-sm font-semibold text-brand-800">Đã duyệt</div>
              <div id="stat-count-approved" className="text-xl font-semibold text-brand-900 mt-1">
                {approvedBookings.length}
              </div>
            </div>

            <div className="rounded-2xl bg-brand-50 border border-brand-200 p-3.5">
              <div className="text-sm font-semibold text-brand-800">Đang thuê</div>
              <div
                id="stat-count-in-progress"
                className="text-xl font-semibold text-brand-900 mt-1"
              >
                {inProgressBookings.length}
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5">
              <div className="text-sm font-semibold text-emerald-800">Hoàn tất</div>
              <div
                id="stat-count-completed"
                className="text-xl font-semibold text-emerald-900 mt-1"
              >
                {completedBookings.length}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
              <div className="text-sm font-semibold text-slate-600">Đã hủy</div>
              <div id="stat-count-cancelled" className="text-xl font-semibold text-slate-700 mt-1">
                {cancelledBookings.length}
              </div>
            </div>
          </div>
        </div>

        {/* Two Columns: Recent Bookings & Fleet Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Recent Bookings Table */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Danh sách chuyến đi gần nhất
                </h2>
                <Link
                  href="/owner/bookings"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Xem tất cả →
                </Link>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400">
                  Chưa có chuyến đi nào được đặt cho đội xe của bạn.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    id="host-recent-bookings-table"
                    className="w-full text-left text-sm border-collapse"
                  >
                    <thead>
                      <tr className="border-b border-slate-200 text-sm font-semibold uppercase text-slate-400">
                        <th className="py-2.5 px-3">Mã đơn</th>
                        <th className="py-2.5 px-3">Xe</th>
                        <th className="py-2.5 px-3">Khách thuê</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3">Cước xe</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.slice(0, 8).map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                            #{b.id.slice(0, 6)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-900 block">
                              {b.vehicle?.brand} {b.vehicle?.model}
                            </span>
                            {typeof b.vehicle?.plateNormalized === 'string' && (
                              <span className="text-sm font-mono text-slate-500">
                                {b.vehicle.plateNormalized}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {b.renter?.name || 'Khách hàng'}
                          </td>
                          <td className="py-3 px-3 text-sm text-slate-500">
                            {formatDate(b.startAt)}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {formatVnd(b.pricingSnapshot?.subtotalVnd)}
                          </td>
                          <td className="py-3 px-3">
                            <BookingStatusBadge status={b.status} size="sm" />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Link
                              href={`/bookings/${b.id}`}
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                            >
                              Xem
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Fleet Management Quick Links */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Đội xe cá nhân
                </h2>
                <Link
                  href="/owner/vehicles"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Quản lý →
                </Link>
              </div>

              {vehicles.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  Bạn chưa đăng xe nào lên hệ thống.
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.slice(0, 5).map((veh) => (
                    <div
                      key={veh.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between text-sm"
                    >
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {veh.brand} {veh.model}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-sm text-slate-600">
                            {veh.plateNormalized}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.2 text-xs font-semibold ${
                              veh.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {veh.status === 'PUBLISHED' ? 'Đang mở' : 'Bản nháp'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-semibold text-brand-600 block">
                          {formatVnd(veh.pricePerDayVnd)}/ngày
                        </span>
                        <Link
                          href={`/vehicles/${veh.id}`}
                          className="text-sm font-semibold text-slate-500 hover:text-brand-600"
                        >
                          Trang công khai
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/owner/vehicles/new"
                className="block text-center rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-500 hover:text-brand-600 transition-colors"
              >
                + Đăng ký thêm xe mới
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
