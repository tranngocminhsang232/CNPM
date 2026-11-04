'use client';

import { Icon } from '../../../components/Icon';
import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { fetchVehicleById, fetchVehicleReviewsApi } from '../../../lib/api';
import type { VehicleDetail, VehicleReviewsSummary } from '../../../lib/api';
import { VehicleGallery } from '../../../components/VehicleGallery';
import { PricingCalculator } from '../../../components/PricingCalculator';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VehicleDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [reviewsSummary, setReviewsSummary] = useState<VehicleReviewsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [data, revs] = await Promise.all([
          fetchVehicleById(id),
          fetchVehicleReviewsApi(id).catch(() => null),
        ]);
        setVehicle(data);
        setReviewsSummary(revs);
      } catch (err: any) {
        setError(err.message || 'Không thể tải thông tin xe');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const amenityMap: Record<string, { label: string; icon: string }> = {
    GPS: { label: 'Định vị GPS', icon: 'pin' },
    BLUETOOTH: { label: 'Kết nối Bluetooth', icon: 'signal' },
    BACKUP_CAMERA: { label: 'Camera lùi', icon: 'camera' },
    DASH_CAM: { label: 'Camera hành trình', icon: 'camera' },
    SUNROOF: { label: 'Cửa sổ trời', icon: 'sun' },
    ETC: { label: 'Thu phí tự động ETC', icon: 'money' },
    APPLE_CARPLAY: { label: 'Apple CarPlay / Android Auto', icon: 'phone' },
    USB: { label: 'Cổng sạc USB', icon: 'settings' },
    MAPS: { label: 'Bản đồ dẫn đường', icon: 'pin' },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="animate-pulse grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="h-80 w-full rounded-2xl bg-slate-200" />
              <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
              <div className="h-4 w-1/3 rounded-lg bg-slate-200" />
              <div className="h-32 w-full rounded-2xl bg-slate-200" />
            </div>
            <div className="lg:col-span-5">
              <div className="h-96 w-full rounded-2xl bg-slate-200" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <div className="text-4xl mb-4">
              <Icon name="car" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Chưa thể tải thông tin xe</h1>
            <p className="text-sm text-slate-600 mb-6">
              {error || 'Xe bạn đang tìm không tồn tại hoặc chưa được công khai trên hệ thống.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              ← Quay lại trang tìm kiếm
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}

      {/* Main Container */}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-700">
            Trang chủ
          </Link>
          <span>/</span>
          <Link href="/" className="hover:text-slate-700">
            Xe tự lái
          </Link>
          <span>/</span>
          <span className="text-slate-700 font-semibold">
            {vehicle.brand} {vehicle.model}
          </span>
        </nav>

        <div className="vehicle-detail-layout grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Visual Gallery & Specs */}
          <div className="vehicle-detail-info lg:col-span-7 space-y-8">
            {/* Gallery */}
            <VehicleGallery
              photos={vehicle.photoUrls}
              brand={vehicle.brand}
              model={vehicle.model}
              year={vehicle.year}
              carType={vehicle.carType}
              keylessSupported={vehicle.keylessSupported}
            />

            {/* Vehicle Title & Metrics */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h1
                  className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight"
                  id="vehicle-detail-title"
                >
                  {vehicle.brand} {vehicle.model}
                </h1>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  Đời {vehicle.year}
                </span>
              </div>

              {/* Badges & Rating */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1 font-semibold text-amber-700">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>
                    {vehicle.reviewCount > 0
                      ? vehicle.ratingAverage.toFixed(1)
                      : 'Chưa có đánh giá'}
                  </span>
                  <span className="text-slate-400 font-normal">
                    {vehicle.reviewCount > 0 ? `(${vehicle.reviewCount} đánh giá)` : ''}
                  </span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>{vehicle.totalTrips} chuyến thành công</span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <svg
                    className="h-4 w-4 text-brand-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{vehicle.city}</span>
                </div>
              </div>
            </div>

            {/* Specifications Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center">
                <span className="text-xl mb-1 block">
                  <Icon name="settings" />
                </span>
                <span className="text-sm font-semibold uppercase text-slate-400 block">Hộp số</span>
                <span className="text-sm font-semibold text-slate-800">
                  {vehicle.transmission === 'AUTO' ? 'Tự động' : 'Số sàn'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center">
                <span className="text-xl mb-1 block">
                  <Icon name="seats" />
                </span>
                <span className="text-sm font-semibold uppercase text-slate-400 block">
                  Số chỗ ngồi
                </span>
                <span className="text-sm font-semibold text-slate-800">{vehicle.seats} chỗ</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center">
                <span className="text-xl mb-1 block">
                  <Icon name="car" />
                </span>
                <span className="text-sm font-semibold uppercase text-slate-400 block">
                  Kiểu dáng
                </span>
                <span className="text-sm font-semibold text-slate-800">{vehicle.carType}</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center">
                <span className="text-xl mb-1 block">
                  <Icon name="key" />
                </span>
                <span className="text-sm font-semibold uppercase text-slate-400 block">
                  Công nghệ
                </span>
                <span className="text-sm font-semibold text-emerald-600">
                  {vehicle.keylessSupported ? 'Keyless tự mở' : 'Chìa khóa cơ'}
                </span>
              </div>
            </div>

            {/* Amenities Section */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span>Tiện nghi trang bị trên xe</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" id="vehicle-amenities-list">
                {vehicle.amenities.map((item) => {
                  const meta = amenityMap[item] || { label: item, icon: 'check' };
                  return (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm font-medium text-slate-700"
                    >
                      <span className="text-base">
                        <Icon name={meta.icon} />
                      </span>
                      <span>{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description Section */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Mô tả của chủ xe</h2>
              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                {vehicle.description || 'Chủ xe chưa thêm mô tả chi tiết.'}
              </div>
            </div>

            {/* Host / Owner Info */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold text-lg">
                  {vehicle.owner.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900" id="vehicle-owner-name">
                      {vehicle.owner.name}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Tham gia từ {new Date(vehicle.owner.joinedAt).getFullYear()}
                  </p>
                </div>
              </div>
            </div>

            {/* Terms & Guidelines */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Điều khoản & Giấy tờ thuê xe</h2>
              <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                <li>Bắt buộc có giấy phép lái xe ô tô (B1/B2) còn hạn tối thiểu 30 ngày.</li>
                <li>Không hút thuốc, không vận chuyển chất cấm, chất cháy nổ trong khoang lái.</li>
                <li>Giao nhận xe đúng vạch xăng/pin; giữ gìn vệ sinh chung sạch sẽ.</li>
                <li>Tiền cọc được quyết toán sau khi hoàn tất chuyến đi.</li>
              </ul>
            </div>

            {/* Vehicle Reviews Section (BR-12) */}
            <div
              id="vehicle-reviews-container"
              className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-slate-900">Đánh giá từ khách thuê</h2>
                  {reviewsSummary && reviewsSummary.totalReviews > 0 && (
                    <span
                      id="vehicle-rating-badge"
                      className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-sm font-semibold text-amber-800 flex items-center gap-1"
                    >
                      <span>
                        <Icon name="star" />
                      </span>{' '}
                      {reviewsSummary.averageScore} ({reviewsSummary.totalReviews} đánh giá)
                    </span>
                  )}
                </div>
              </div>

              {!reviewsSummary || reviewsSummary.totalReviews === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  <span className="text-2xl block mb-1">
                    <Icon name="star" />
                  </span>
                  Xe chưa có lượt đánh giá nào. Hãy là người đầu tiên trải nghiệm chuyến đi!
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewsSummary.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center text-sm">
                            {rev.author?.name?.charAt(0) || 'K'}
                          </div>
                          <div>
                            <strong className="text-slate-900">
                              {rev.author?.name || 'Khách thuê'}
                            </strong>
                            <span className="ml-2 text-sm px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                              Đã thuê xe
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
                        {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Pricing Calculator Widget */}
          <div className="vehicle-detail-quote lg:col-span-5">
            <PricingCalculator
              vehicleId={vehicle.id}
              defaultPricePerDayVnd={vehicle.pricePerDayVnd}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
