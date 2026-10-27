'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth-context';
import {
  createUploadIntent,
  createVehicle,
  uploadToPresignedUrl,
  verifyMedia,
} from '../../../../lib/api';
import { UserNav } from '../../../../components/UserNav';

const AMENITY_OPTIONS = [
  { code: 'GPS', name: 'Định vị GPS' },
  { code: 'BLUETOOTH', name: 'Kết nối Bluetooth' },
  { code: 'BACKUP_CAMERA', name: 'Camera lùi' },
  { code: 'SUNROOF', name: 'Cửa sổ trời' },
  { code: 'DASH_CAM', name: 'Camera hành trình' },
  { code: 'ETC', name: 'Thu phí tự động ETC' },
];

export default function NewVehiclePage() {
  const router = useRouter();
  const { csrfToken } = useAuth();

  const [brand, setBrand] = useState('VinFast');
  const [model, setModel] = useState('VF8 Eco');
  const [year, setYear] = useState<number>(2024);
  const [licensePlate, setLicensePlate] = useState('');
  const [city, setCity] = useState('TP. Hồ Chí Minh');
  const [pickupAddress, setPickupAddress] = useState('123 Nguyễn Huệ, Phường Bến Nghé, Quận 1');
  const [carType, setCarType] = useState('SUV');
  const [transmission, setTransmission] = useState('AUTO');
  const [seats, setSeats] = useState<number>(5);
  const [pricePerDayVnd, setPricePerDayVnd] = useState<number>(1400000);
  const [description, setDescription] = useState(
    'Xe điện hiện đại, trang bị đầy đủ tính năng an toàn ADAS, camera 360 và nội thất da cao cấp.',
  );
  const [keylessSupported, setKeylessSupported] = useState(true);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'GPS',
    'BLUETOOTH',
    'BACKUP_CAMERA',
    'ETC',
  ]);

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAmenityToggle = (code: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const photoMediaIds: string[] = [];

      if (selectedFiles && selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          if (!file) continue;
          setUploadStatus(`Đang tải ảnh ${i + 1}/${selectedFiles.length} lên MinIO...`);

          const intent = await createUploadIntent(
            {
              purpose: 'VEHICLE_PHOTO',
              mimeType: file.type as 'image/jpeg' | 'image/png',
              sizeBytes: file.size,
            },
            csrfToken,
          );

          await uploadToPresignedUrl(intent.uploadUrl, file, file.type);
          await verifyMedia(intent.mediaId, csrfToken);
          photoMediaIds.push(intent.mediaId);
        }
      }

      setUploadStatus('Đang lưu thông tin xe...');
      await createVehicle(
        {
          brand,
          model,
          year,
          licensePlate,
          city: city as 'TP. Hồ Chí Minh' | 'Hà Nội' | 'Đà Nẵng',
          pickupAddress,
          carType: carType as any,
          transmission: transmission as any,
          seats,
          pricePerDayVnd,
          description,
          keylessSupported,
          amenities: selectedAmenities,
          photoMediaIds: photoMediaIds.length > 0 ? photoMediaIds : undefined,
        },
        csrfToken,
      );

      router.push('/owner/vehicles');
    } catch (err: any) {
      setError(err.message || 'Không thể tạo xe mới');
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/owner/vehicles" className="flex items-center gap-2 text-slate-900 font-bold">
            <span className="text-blue-600">←</span> Quay lại danh sách xe
          </Link>
          <UserNav />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Đăng ký xe cho thuê mới</h1>
          <p className="mt-1 text-sm text-slate-500">
            Điền đầy đủ thông tin kỹ thuật, biểu giá và tải ảnh xe để khởi tạo bản ghi xe.
          </p>
        </div>

        {error && (
          <div
            id="new-vehicle-error-alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="vehicle-brand"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Hãng xe
                </label>
                <input
                  id="vehicle-brand"
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Toyota, VinFast..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-model"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Dòng xe / Model
                </label>
                <input
                  id="vehicle-model"
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="VF8, Vios..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-year"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Năm sản xuất
                </label>
                <input
                  id="vehicle-year"
                  type="number"
                  required
                  min={2000}
                  max={2027}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="vehicle-plate"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Biển số xe
                </label>
                <input
                  id="vehicle-plate"
                  type="text"
                  required
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="51K-123.45"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-city"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Thành phố hoạt động
                </label>
                <select
                  id="vehicle-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="vehicle-address"
                className="block text-sm font-semibold text-slate-700"
              >
                Địa chỉ giao nhận xe chính xác
              </label>
              <input
                id="vehicle-address"
                type="text"
                required
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="vehicle-cartype"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Loại xe
                </label>
                <select
                  id="vehicle-cartype"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="SEDAN">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="HATCHBACK">Hatchback</option>
                  <option value="MPV">MPV</option>
                  <option value="CROSSOVER">Crossover</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-trans"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Hộp số
                </label>
                <select
                  id="vehicle-trans"
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="AUTO">Tự động</option>
                  <option value="MANUAL">Số sàn</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-seats"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Số chỗ ngồi
                </label>
                <input
                  id="vehicle-seats"
                  type="number"
                  required
                  min={2}
                  max={16}
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-price"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Giá thuê ngày (VND)
                </label>
                <input
                  id="vehicle-price"
                  type="number"
                  required
                  step={50000}
                  min={100000}
                  max={100000000}
                  value={pricePerDayVnd}
                  onChange={(e) => setPricePerDayVnd(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-blue-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vehicle-desc" className="block text-sm font-semibold text-slate-700">
                Mô tả chi tiết về xe
              </label>
              <textarea
                id="vehicle-desc"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Keyless checkbox */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                id="vehicle-keyless"
                type="checkbox"
                checked={keylessSupported}
                onChange={(e) => setKeylessSupported(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="vehicle-keyless"
                className="text-sm font-medium text-slate-700 cursor-pointer"
              >
                <strong>Hỗ trợ nhận xe tự động không chìa (Keyless)</strong> — Khách thuê có thể mở
                khóa xe trực tiếp qua ứng dụng điện thoại.
              </label>
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tiện nghi trên xe
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {AMENITY_OPTIONS.map((am) => (
                  <label
                    key={am.code}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(am.code)}
                      onChange={() => handleAmenityToggle(am.code)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>{am.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div>
              <label
                htmlFor="vehicle-photos-input"
                className="block text-sm font-semibold text-slate-700"
              >
                Hình ảnh thực tế của xe (Tối đa 10 ảnh JPEG/PNG, mỗi ảnh &lt;= 5MB)
              </label>
              <input
                id="vehicle-photos-input"
                type="file"
                multiple
                accept="image/jpeg,image/png"
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="mt-1.5 w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                Cần tối thiểu 1 ảnh ngoại thất để xe đủ điều kiện chuyển sang trạng thái Đăng công
                khai.
              </p>
            </div>

            {uploadStatus && (
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 font-medium">
                {uploadStatus}
              </div>
            )}

            <button
              id="new-vehicle-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Đang khởi tạo xe...' : 'Đăng ký xe vào hệ thống'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
