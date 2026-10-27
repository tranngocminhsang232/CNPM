'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchVehicles, VehicleSummary, PaginationMeta } from '../lib/api';
import { VehicleCard } from '../components/VehicleCard';
import { FilterBar } from '../components/FilterBar';
import { UserNav } from '../components/UserNav';

export default function HomePage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
  });

  const [city, setCity] = useState<string>('ALL');
  const [carType, setCarType] = useState<string>('ALL');
  const [keylessOnly, setKeylessOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load vehicles from backend API through same-origin rewrite
  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchVehicles({
        city: city !== 'ALL' ? city : undefined,
        carType: carType !== 'ALL' ? carType : undefined,
        keylessOnly: keylessOnly ? true : undefined,
        page,
        pageSize: 6,
      });

      setVehicles(response.data);
      setMeta(response.meta);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [city, carType, keylessOnly, page]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleResetFilters = () => {
    setCity('ALL');
    setCarType('ALL');
    setKeylessOnly(false);
    setPage(1);
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    setPage(1);
  };

  const handleCarTypeChange = (newCarType: string) => {
    setCarType(newCarType);
    setPage(1);
  };

  const handleKeylessChange = (newKeyless: boolean) => {
    setKeylessOnly(newKeyless);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                CAR<span className="text-blue-600">SHARE</span>
              </span>
              <span className="ml-2 hidden rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 sm:inline-block">
                MVP Baseline
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Hệ thống trực tuyến</span>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-8 text-white shadow-xl sm:p-10">
          <div className="max-w-2xl">
            <span className="mb-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-md">
              Dịch vụ thuê xe tự lái công nghệ
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Thuê xe tự lái an toàn, giao nhận tự động với Keyless
            </h1>
            <p className="mt-4 text-base text-blue-100 sm:text-lg">
              Trải nghiệm các dòng xe hiện đại được kiểm định kỹ lưỡng. Mở khóa xe tức thì bằng ứng
              dụng không cần gặp trực tiếp chủ xe.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          city={city}
          carType={carType}
          keylessOnly={keylessOnly}
          onCityChange={handleCityChange}
          onCarTypeChange={handleCarTypeChange}
          onKeylessChange={handleKeylessChange}
          onReset={handleResetFilters}
          totalResults={meta.total}
        />

        {/* Content States */}
        {error ? (
          /* Error State */
          <div
            data-testid="error-state"
            className="rounded-2xl border border-rose-200 bg-rose-50/80 p-8 text-center text-rose-800 shadow-sm"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold">Không thể tải danh sách xe</h3>
            <p className="mt-1 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              data-testid="retry-btn"
              onClick={loadVehicles}
              className="mt-4 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 active:scale-95 cursor-pointer"
            >
              Thử lại kết nối
            </button>
          </div>
        ) : loading ? (
          /* Loading Skeleton State */
          <div
            data-testid="loading-state"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"
              >
                <div className="h-44 w-full rounded-xl bg-slate-200" />
                <div className="mt-4 h-5 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                <div className="mt-4 h-8 w-full rounded bg-slate-100" />
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="h-6 w-24 rounded bg-slate-200" />
                  <div className="h-8 w-20 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          /* Empty State */
          <div
            data-testid="empty-state"
            className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy xe phù hợp</h3>
            <p className="mt-1 text-sm text-slate-500">
              Vui lòng thử chọn lại thành phố hoặc dòng xe khác để xem thêm kết quả.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              Đặt lại tất cả bộ lọc
            </button>
          </div>
        ) : (
          /* Vehicles Grid */
          <div>
            <div
              data-testid="vehicles-grid"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>

            {/* Pagination Controls */}
            {meta.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  data-testid="prev-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Trang trước
                </button>
                <span className="text-xs font-medium text-slate-600">
                  Trang <strong className="text-slate-900">{meta.page}</strong> / {meta.totalPages}
                </span>
                <button
                  type="button"
                  data-testid="next-page-btn"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Trang sau
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-medium text-slate-700">
            Nền tảng chia sẻ xe tự lái (Car Sharing MVP) — Topic 18, Nhóm 7
          </p>
          <p className="mt-1 text-slate-400">
            Dữ liệu xe và lịch trình được đồng bộ trực tiếp từ PostgreSQL và dịch vụ backend NestJS
            qua kết nối cùng origin.
          </p>
        </div>
      </footer>
    </div>
  );
}
