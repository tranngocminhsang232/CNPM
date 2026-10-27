'use client';

import React from 'react';

interface FilterBarProps {
  city: string;
  carType: string;
  keylessOnly: boolean;
  onCityChange: (city: string) => void;
  onCarTypeChange: (carType: string) => void;
  onKeylessChange: (keylessOnly: boolean) => void;
  onReset: () => void;
  totalResults: number;
}

export function FilterBar({
  city,
  carType,
  keylessOnly,
  onCityChange,
  onCarTypeChange,
  onKeylessChange,
  onReset,
  totalResults,
}: FilterBarProps) {
  const isFiltered = city !== 'ALL' || carType !== 'ALL' || keylessOnly;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-md md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Filters Grid */}
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {/* City Filter */}
          <div>
            <label
              htmlFor="city-select"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Khu vực / Thành phố
            </label>
            <select
              id="city-select"
              data-testid="city-select"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả địa điểm</option>
              <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="Đà Nẵng">Đà Nẵng</option>
            </select>
          </div>

          {/* Car Type Filter */}
          <div>
            <label
              htmlFor="cartype-select"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Dòng xe
            </label>
            <select
              id="cartype-select"
              data-testid="cartype-select"
              value={carType}
              onChange={(e) => onCarTypeChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả dòng xe</option>
              <option value="SUV">SUV Gầm cao</option>
              <option value="SEDAN">Sedan</option>
              <option value="MPV">MPV 7 chỗ</option>
              <option value="CROSSOVER">Crossover</option>
            </select>
          </div>

          {/* Keyless Toggle */}
          <div className="flex items-end">
            <label
              htmlFor="keyless-checkbox"
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer select-none ${
                keylessOnly
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className={`h-4 w-4 ${keylessOnly ? 'text-emerald-600' : 'text-slate-400'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                Tự nhận xe Keyless
              </span>
              <input
                type="checkbox"
                id="keyless-checkbox"
                data-testid="keyless-checkbox"
                checked={keylessOnly}
                onChange={(e) => onKeylessChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Action & Results counter */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 md:border-t-0 md:pt-0 md:flex-col md:items-end">
          <div className="text-xs text-slate-500">
            Tìm thấy{' '}
            <span className="font-bold text-slate-900" data-testid="total-count">
              {totalResults}
            </span>{' '}
            xe sẵn sàng
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              data-testid="reset-filter-btn"
              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
