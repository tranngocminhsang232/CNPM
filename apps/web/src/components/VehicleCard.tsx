'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import type { VehicleSummary } from '@carsharing/contracts';

export function VehicleCard({ vehicle }: { vehicle: VehicleSummary }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = vehicle.coverImageUrl || `/images/vehicles/${vehicle.id}/cover.jpg`;
  return (
    <article className="vehicle-card" data-testid="vehicle-card" id={`vehicle-card-${vehicle.id}`}>
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="vehicle-card-photo block"
        aria-label={`Xem chi tiết ${vehicle.brand} ${vehicle.model}`}
      >
        <img
          src={imgFailed ? '/images/vehicles/default-car.jpg' : cover}
          alt={`${vehicle.brand} ${vehicle.model}`}
          onError={() => setImgFailed(true)}
          loading="lazy"
          width="640"
          height="420"
        />
        {vehicle.keylessSupported && (
          <span className="keyless-badge" data-testid="keyless-badge">
            Keyless
          </span>
        )}
        <span className="vehicle-year">{vehicle.year}</span>
      </Link>
      <div className="vehicle-card-content">
        <div className="vehicle-card-heading">
          <h3>
            <Link href={`/vehicles/${vehicle.id}`} className="hover:text-brand-700">
              {vehicle.brand} {vehicle.model}
            </Link>
          </h3>
          <span className="vehicle-type">{vehicle.carType}</span>
        </div>
        <p className="vehicle-location">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {vehicle.city}
        </p>
        <div className="vehicle-specs">
          <span>{vehicle.transmission === 'AUTO' ? 'Số tự động' : 'Số sàn'}</span>
          <span>{vehicle.seats} chỗ</span>
          <span>
            {vehicle.reviewCount > 0 ? (
              <>
                <Icon name="star" className="size-3 text-amber-700" />{' '}
                {vehicle.ratingAverage.toFixed(1)} ({vehicle.reviewCount})
              </>
            ) : (
              'Chưa có đánh giá'
            )}
          </span>
        </div>
        <div className="vehicle-card-bottom">
          <p>
            <strong>{new Intl.NumberFormat('vi-VN').format(vehicle.pricePerDayVnd)} ₫</strong>
            <span>/ngày</span>
          </p>
          <Link
            id={`view-vehicle-btn-${vehicle.id}`}
            href={`/vehicles/${vehicle.id}`}
            className="vehicle-detail-link"
          >
            Xem chi tiết <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
