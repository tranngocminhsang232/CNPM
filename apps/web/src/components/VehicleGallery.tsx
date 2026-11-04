'use client';

import React, { useState } from 'react';

interface VehicleGalleryProps {
  photos?: string[];
  brand: string;
  model: string;
  year: number;
  carType: string;
  keylessSupported?: boolean;
}

export function VehicleGallery({
  photos = [],
  brand,
  model,
  year,
  carType,
  keylessSupported,
}: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const carTypeLabels: Record<string, string> = {
    SUV: 'SUV Gầm cao',
    SEDAN: 'Sedan sang trọng',
    MPV: 'MPV 7 chỗ gia đình',
    CROSSOVER: 'Crossover đa dụng',
    HATCHBACK: 'Hatchback đô thị',
  };

  const hasPhotos = photos && photos.length > 0;
  const currentPhoto = hasPhotos ? photos[activeIndex] : null;
  const [photoError, setPhotoError] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Main Large Hero Image */}
      <div className="relative h-64 sm:h-80 md:h-[420px] w-full overflow-hidden rounded-2xl bg-slate-100">
        {currentPhoto && !photoError ? (
          <img
            src={currentPhoto}
            alt={`${brand} ${model} - Ảnh ${activeIndex + 1}`}
            className="h-full w-full object-cover transition-colors duration-200 hover:scale-[1.02]"
            id="main-vehicle-photo"
            onError={() => setPhotoError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-slate-400">
            <svg
              className="h-28 w-28 opacity-40 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.2}
                d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4m-9-7h10l1.5 5H4.5L6 10zm-1.5 5h13m-13 0l-1.5 3h16l-1.5-3"
              />
            </svg>
            <p className="text-sm font-medium text-slate-300">
              {brand} {model} ({year})
            </p>
            <p className="text-sm text-slate-500 mt-1">Hình ảnh thực tế chuẩn bị cập nhật</p>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-900/85 px-3 py-1 text-sm font-semibold text-white">
            {carTypeLabels[carType] || carType}
          </span>
          {keylessSupported && (
            <span
              id="gallery-keyless-badge"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-sm font-semibold text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Photo Counter */}
        {hasPhotos && (
          <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
            {activeIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {hasPhotos && photos.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1" id="vehicle-thumbnails">
          {photos.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActiveIndex(idx);
                setPhotoError(false);
              }}
              aria-label={`Xem ảnh ${idx + 1} của ${brand} ${model}`}
              aria-pressed={activeIndex === idx}
              className={`relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors cursor-pointer ${
                activeIndex === idx
                  ? 'border-brand-600 ring-2 ring-brand-500/30 scale-95'
                  : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400'
              }`}
            >
              <img src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
