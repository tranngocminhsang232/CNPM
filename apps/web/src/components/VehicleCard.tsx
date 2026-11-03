'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { VehicleSummary } from '@carsharing/contracts';

interface VehicleCardProps {
  vehicle: VehicleSummary;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const formattedPrice = new Intl.NumberFormat('vi-VN').format(vehicle.pricePerDayVnd);

  const coverUrl =
    !imgFailed &&
    (typeof vehicle.coverImageUrl === 'string' && vehicle.coverImageUrl
      ? vehicle.coverImageUrl
      : `/images/vehicles/${vehicle.id}/cover.jpg`);

  const getCarTypeLabel = (type: string) => {
    switch (type) {
      case 'SUV':
        return 'SUV Gầm cao';
      case 'SEDAN':
        return 'Sedan';
      case 'MPV':
        return 'MPV 7 chỗ';
      case 'CROSSOVER':
        return 'Crossover';
      case 'HATCHBACK':
        return 'Hatchback';
      default:
        return type;
    }
  };

  const getAmenityLabel = (code: string) => {
    switch (code) {
      case 'GPS':
        return 'GPS';
      case 'BLUETOOTH':
        return 'Bluetooth';
      case 'BACKUP_CAMERA':
        return 'Cam lùi';
      case 'SUNROOF':
        return 'Cửa sổ trời';
      case 'DASH_CAM':
        return 'Cam hành trình';
      case 'ETC':
        return 'ETC';
      default:
        return code;
    }
  };

  return (
    <div
      data-testid="vehicle-card"
      id={`vehicle-card-${vehicle.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-400/50"
    >
      {/* Vehicle Image / Cover */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${vehicle.brand} ${vehicle.model}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : null}

        {(!coverUrl || imgFailed) && (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <svg
              className="h-20 w-20 opacity-40 transition-transform duration-300 group-hover:scale-105"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4m-9-7h10l1.5 5H4.5L6 10zm-1.5 5h13m-13 0l-1.5 3h16l-1.5-3"
              />
            </svg>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-md">
            {getCarTypeLabel(vehicle.carType)}
          </span>
          {vehicle.keylessSupported && (
            <span
              data-testid="keyless-badge"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-md shadow-sm"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Tự mở khóa Keyless
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-md">
          {vehicle.year}
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Title & Location */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-blue-600">
              {vehicle.brand} {vehicle.model}
            </h3>
            {/* Rating */}
            <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{vehicle.ratingAverage.toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-normal">({vehicle.reviewCount})</span>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <svg
              className="h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{vehicle.city}</span>
          </div>
        </div>

        {/* Specifications */}
        <div className="mb-4 grid grid-cols-2 gap-2 border-y border-slate-100 py-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">
              {vehicle.transmission === 'AUTO' ? 'Tự động' : 'Số sàn'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">{vehicle.seats} chỗ ngồi</span>
          </div>
        </div>

        {/* Amenities tags */}
        <div className="mb-5 flex flex-wrap gap-1">
          {vehicle.amenities.slice(0, 4).map((amenity) => (
            <span
              key={amenity}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {getAmenityLabel(amenity)}
            </span>
          ))}
          {vehicle.amenities.length > 4 && (
            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
              +{vehicle.amenities.length - 4}
            </span>
          )}
        </div>

        {/* Pricing & Action */}
        <div className="mt-auto flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-400">Đơn giá thuê</div>
            <div className="text-lg font-extrabold text-blue-600">
              {formattedPrice} <span className="text-xs font-medium text-slate-500">₫/ngày</span>
            </div>
          </div>
          <Link
            id={`view-vehicle-btn-${vehicle.id}`}
            href={`/vehicles/${vehicle.id}`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 cursor-pointer text-center inline-block"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
}
