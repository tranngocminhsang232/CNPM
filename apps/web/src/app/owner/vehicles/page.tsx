'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { fetchOwnerVehicles, publishVehicle, OwnerVehicle } from '../../../lib/api';
import { UserNav } from '../../../components/UserNav';

export default function OwnerVehiclesPage() {
  const { csrfToken } = useAuth();
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOwnerVehicles();
      setVehicles(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách xe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handlePublish = async (vehicleId: string) => {
    setError(null);
    setActionMessage(null);
    try {
      await publishVehicle(vehicleId, csrfToken);
      setActionMessage('Xe đã được chuyển sang trạng thái ĐANG HOẠT ĐỘNG thành công!');
      await loadVehicles();
    } catch (err: any) {
      setError(err.message || 'Không thể publish xe');
    }
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold">
              <span className="text-blue-600">←</span> Trang chủ
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-600">Quản lý xe của tôi</span>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Danh sách xe cho thuê</h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý đội xe, cập nhật biểu giá và trạng thái phát hành xe trên nền tảng.
            </p>
          </div>

          <Link
            id="owner-add-vehicle-btn"
            href="/owner/vehicles/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <span>+</span> Đăng xe mới
          </Link>
        </div>

        {error && (
          <div
            id="owner-error-alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {actionMessage && (
          <div
            id="owner-success-alert"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {actionMessage}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-400">Đang tải danh sách xe...</div>
        ) : vehicles.length === 0 ? (
          /* Empty State */
          <div
            id="owner-empty-state"
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-2xl font-bold">
              🚗
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">Bạn chưa đăng chiếc xe nào</h3>
            <p className="mt-1 text-sm text-slate-500">
              Đăng ký xe cho thuê ngay hôm nay để bắt đầu tạo thu nhập thụ động cùng Car Sharing.
            </p>
            <div className="mt-6">
              <Link
                href="/owner/vehicles/new"
                className="inline-flex items-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
              >
                Đăng ký xe đầu tiên
              </Link>
            </div>
          </div>
        ) : (
          /* Vehicle Table / Cards */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                id={`owner-vehicle-card-${v.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      id={`vehicle-status-${v.id}`}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        v.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : v.status === 'DRAFT'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.status === 'PUBLISHED'
                        ? 'ĐANG HOẠT ĐỘNG'
                        : v.status === 'DRAFT'
                          ? 'BẢN NHÁP'
                          : 'LƯU TRỮ'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {v.plateNormalized}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    {v.brand} {v.model} ({v.year})
                  </h3>

                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{v.pickupAddress}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
                      {v.carType}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
                      {v.transmission}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
                      {v.seats} chỗ
                    </span>
                    {v.keylessSupported && (
                      <span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                        ⚡ Keyless
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Ảnh xe:{' '}
                    <span className="font-semibold text-slate-700">{v.photos.length} ảnh</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Giá thuê ngày</span>
                    <span className="text-base font-extrabold text-blue-600">
                      {formatVnd(v.pricePerDayVnd)}
                    </span>
                  </div>

                  {v.status === 'DRAFT' && (
                    <button
                      id={`publish-btn-${v.id}`}
                      type="button"
                      onClick={() => handlePublish(v.id)}
                      className="mt-3 w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      Đăng công khai (Publish)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
