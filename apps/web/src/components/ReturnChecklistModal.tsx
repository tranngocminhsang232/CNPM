'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  createUploadIntent,
  uploadToPresignedUrl,
  verifyMedia,
  saveInspectionApi,
  finalizeInspectionApi,
  completeBookingApi,
  type Inspection,
  type InspectionPhoto,
  type Booking,
} from '../lib/api';

interface ReturnChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  checkInInspection?: Inspection | null;
  initialInspection?: Inspection | null;
  onFinalized: (inspection: Inspection) => void;
  onCompletedTrip?: (booking: Booking) => void;
  readOnly?: boolean;
}

type AngleType = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';

interface AngleConfig {
  angle: AngleType;
  label: string;
  sub: string;
  icon: string;
}

const ANGLES: AngleConfig[] = [
  {
    angle: 'FRONT',
    label: '1. Đầu xe trả',
    sub: 'Chụp chính diện góc trước khi hoàn trả',
    icon: '🚗',
  },
  {
    angle: 'REAR',
    label: '2. Đuôi xe trả',
    sub: 'Chụp chính diện đuôi & cản sau xe',
    icon: '🚙',
  },
  {
    angle: 'LEFT',
    label: '3. Sườn trái trả',
    sub: 'Chụp toàn bộ hông và bánh xe bên lái',
    icon: '🚘',
  },
  {
    angle: 'RIGHT',
    label: '4. Sườn phải trả',
    sub: 'Chụp toàn bộ hông và bánh xe bên phụ',
    icon: '🚖',
  },
];

export function ReturnChecklistModal({
  isOpen,
  onClose,
  bookingId,
  checkInInspection,
  initialInspection,
  onFinalized,
  onCompletedTrip,
  readOnly = false,
}: ReturnChecklistModalProps) {
  const { csrfToken } = useAuth();

  const minOdometer = checkInInspection?.odometerKm ?? 0;
  const initialOdo = initialInspection?.odometerKm ?? (minOdometer > 0 ? minOdometer + 45 : 15500);

  const [odometerKm, setOdometerKm] = useState<number>(initialOdo);
  const [fuelPercent, setFuelPercent] = useState<number>(initialInspection?.fuelPercent ?? 85);
  const [damageNotes, setDamageNotes] = useState<string>('');
  const [photos, setPhotos] = useState<Record<AngleType, { mediaId: string; previewUrl: string }>>({
    FRONT: { mediaId: '', previewUrl: '' },
    REAR: { mediaId: '', previewUrl: '' },
    LEFT: { mediaId: '', previewUrl: '' },
    RIGHT: { mediaId: '', previewUrl: '' },
  });

  const [uploadingAngle, setUploadingAngle] = useState<AngleType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentInspection, setCurrentInspection] = useState<Inspection | null>(
    initialInspection ?? null,
  );

  useEffect(() => {
    if (initialInspection) {
      setCurrentInspection(initialInspection);
      setOdometerKm(initialInspection.odometerKm || initialOdo);
      setFuelPercent(initialInspection.fuelPercent ?? 85);
      setDamageNotes(
        typeof initialInspection.damageNotes === 'string' ? initialInspection.damageNotes : '',
      );

      const initialPhotos: Record<AngleType, { mediaId: string; previewUrl: string }> = {
        FRONT: { mediaId: '', previewUrl: '' },
        REAR: { mediaId: '', previewUrl: '' },
        LEFT: { mediaId: '', previewUrl: '' },
        RIGHT: { mediaId: '', previewUrl: '' },
      };

      if (initialInspection.photos && Array.isArray(initialInspection.photos)) {
        initialInspection.photos.forEach((p: InspectionPhoto) => {
          if (p.angle in initialPhotos) {
            initialPhotos[p.angle as AngleType] = {
              mediaId: p.mediaId,
              previewUrl: p.readUrl || '',
            };
          }
        });
      }
      setPhotos(initialPhotos);
    }
  }, [initialInspection, initialOdo]);

  if (!isOpen) return null;

  const isFinalized = currentInspection?.acknowledged || false;
  const isComplete4Angles = Boolean(
    photos.FRONT.mediaId && photos.REAR.mediaId && photos.LEFT.mediaId && photos.RIGHT.mediaId,
  );

  const handleFileUpload = async (angle: AngleType, file: File) => {
    if (!csrfToken) return;
    setError(null);
    setUploadingAngle(angle);

    try {
      const intent = await createUploadIntent(
        {
          purpose: 'INSPECTION_PHOTO',
          bookingId,
          mimeType: file.type as 'image/jpeg' | 'image/png',
          sizeBytes: file.size,
        },
        csrfToken,
      );

      await uploadToPresignedUrl(intent.uploadUrl, file, file.type);
      await verifyMedia(intent.mediaId, csrfToken);

      const localPreview = URL.createObjectURL(file);
      setPhotos((prev) => ({
        ...prev,
        [angle]: {
          mediaId: intent.mediaId,
          previewUrl: localPreview,
        },
      }));
    } catch (err: any) {
      setError(`Lỗi khi tải ảnh góc ${angle}: ${err.message || 'Không thể upload'}`);
    } finally {
      setUploadingAngle(null);
    }
  };

  const validateOdometer = () => {
    if (minOdometer > 0 && odometerKm < minOdometer) {
      setError(
        `Số km trả xe (${odometerKm} km) không được nhỏ hơn số km nhận xe (${minOdometer} km). (Quy tắc BR-10)`,
      );
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!csrfToken) return;
    if (!validateOdometer()) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const photoList = Object.entries(photos)
      .filter(([_, v]) => !!v.mediaId)
      .map(([angle, v]) => ({ angle: angle as AngleType, mediaId: v.mediaId }));

    try {
      const saved = await saveInspectionApi(
        bookingId,
        {
          type: 'CHECK_OUT',
          odometerKm,
          fuelPercent,
          damageNotes: damageNotes.trim(),
          version: currentInspection?.version ?? 1,
          photos: photoList,
        },
        csrfToken,
      );
      setCurrentInspection(saved);
      setSuccessMessage('Đã lưu bản nháp biên bản trả xe thành công!');
    } catch (err: any) {
      setError(err.message || 'Không thể lưu bản nháp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!csrfToken) return;
    if (!validateOdometer()) return;

    if (!isComplete4Angles) {
      setError(
        'Vui lòng chụp đầy đủ 4 góc xe (Đầu, Đuôi, Sườn trái, Sườn phải) trước khi ký chốt biên bản trả xe.',
      );
      return;
    }

    setIsFinalizing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const photoList = Object.entries(photos)
        .filter(([_, v]) => !!v.mediaId)
        .map(([angle, v]) => ({ angle: angle as AngleType, mediaId: v.mediaId }));

      await saveInspectionApi(
        bookingId,
        {
          type: 'CHECK_OUT',
          odometerKm,
          fuelPercent,
          damageNotes: damageNotes.trim(),
          version: currentInspection?.version ?? 1,
          photos: photoList,
        },
        csrfToken,
      );

      const finalized = await finalizeInspectionApi(bookingId, 'CHECK_OUT', csrfToken);
      setCurrentInspection(finalized);
      setSuccessMessage(
        'Biên bản trả xe đã được ký chốt thành công! Bạn có thể hoàn tất chuyến đi.',
      );
      onFinalized(finalized);
    } catch (err: any) {
      setError(err.message || 'Không thể chốt biên bản kiểm tra trả xe.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!csrfToken) return;
    setIsCompleting(true);
    setError(null);
    try {
      const completed = await completeBookingApi(bookingId, csrfToken);
      if (onCompletedTrip) {
        onCompletedTrip(completed);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể hoàn tất chuyến đi. Vui lòng kiểm tra lại.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      id="modal-return-checklist"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏁</span>
              <div>
                <h2 className="text-lg font-black tracking-tight">
                  Biên bản trả xe (Check-out Checklist)
                </h2>
                <p className="text-xs text-emerald-100">
                  {isFinalized
                    ? 'Biên bản đã được ký chốt an toàn và lưu trữ bất biến.'
                    : 'Ghi nhận hiện trạng xe sau khi sử dụng để phục vụ quyết toán hoàn cọc (BR-10).'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status Banners */}
          {error && (
            <div
              id="return-inspection-error"
              className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-center gap-3"
            >
              <span className="text-lg">⚠️</span>
              <p className="font-medium">{error}</p>
            </div>
          )}

          {successMessage && (
            <div
              id="return-inspection-success"
              className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-700 flex items-center gap-3"
            >
              <span className="text-lg">✓</span>
              <p className="font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Checklist 4 Góc Xe */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Ảnh hiện trạng 4 góc sau chuyến (Bắt buộc đủ 4 góc)
              </h3>
              <span
                id="return-photo-completion-badge"
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isComplete4Angles
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`}
              >
                {isComplete4Angles ? '✓ Đã chụp đủ 4 góc' : '• Thiếu ảnh'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ANGLES.map((cfg) => {
                const photo = photos[cfg.angle];
                const isUploading = uploadingAngle === cfg.angle;

                return (
                  <div
                    key={cfg.angle}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{cfg.icon}</span>
                        <h4 className="text-xs font-black text-slate-800">{cfg.label}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2.5">{cfg.sub}</p>
                    </div>

                    <div className="relative aspect-video rounded-xl bg-slate-200/80 border border-slate-300 overflow-hidden flex items-center justify-center group">
                      {photo.previewUrl ? (
                        <img
                          src={photo.previewUrl}
                          alt={cfg.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <span className="text-2xl text-slate-400 block mb-1">📷</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Chưa có ảnh
                          </span>
                        </div>
                      )}

                      {/* Upload overlay */}
                      {!isFinalized && !readOnly && (
                        <label
                          htmlFor={`return-photo-upload-${cfg.angle}`}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-xs font-semibold"
                        >
                          {isUploading ? (
                            <span>Đang upload...</span>
                          ) : (
                            <>
                              <span>{photo.previewUrl ? 'Thay đổi ảnh' : 'Tải ảnh lên'}</span>
                              <span className="text-[10px] text-slate-300 mt-1">
                                JPEG/PNG ≤ 5MB
                              </span>
                            </>
                          )}
                          <input
                            id={`return-photo-upload-${cfg.angle}`}
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={isUploading}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(cfg.angle, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Odometer & Fuel Reading */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              2. Chỉ số đồng hồ ODO & Mức pin/xăng khi trả xe
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số km hiển thị trên ODO (km) *
                </label>
                <div className="relative">
                  <input
                    id="return-odometer-input"
                    type="number"
                    min={minOdometer}
                    disabled={isFinalized || readOnly}
                    value={odometerKm}
                    onChange={(e) => setOdometerKm(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                    km
                  </span>
                </div>
                {minOdometer > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Số km lúc nhận xe:{' '}
                    <strong className="text-slate-700">{minOdometer.toLocaleString()} km</strong>.
                    Chỉ số trả phải ≥ {minOdometer.toLocaleString()} km.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mức nhiên liệu / Pin (%) *
                </label>
                <div className="relative">
                  <input
                    id="return-fuel-input"
                    type="number"
                    min={0}
                    max={100}
                    disabled={isFinalized || readOnly}
                    value={fuelPercent}
                    onChange={(e) => setFuelPercent(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Mức lúc nhận:{' '}
                  <strong className="text-slate-700">
                    {checkInInspection?.fuelPercent ?? 100}%
                  </strong>
                  . Nếu hao hụt: 30.000 ₫/1%.
                </p>
              </div>
            </div>
          </div>

          {/* Damage & Condition Notes */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              3. Ghi chú hiện trạng trả xe
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">
              Ghi chú lại tình trạng xe khi hoàn trả (sạch sẽ, xước dăm nếu có, tài sản để quên...).
            </p>
            <textarea
              id="return-damage-notes-input"
              rows={2}
              disabled={isFinalized || readOnly}
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Nhập ghi chú hiện trạng khi hoàn trả (không bắt buộc)..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {isFinalized ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <span>✓</span> Biên bản trả xe đã ký chốt.
              </span>
            ) : (
              <span>* Hãy kiểm tra kỹ 4 góc trước khi ký chốt biên bản.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-300 transition-colors"
            >
              Đóng
            </button>

            {!isFinalized && !readOnly && (
              <>
                <button
                  id="btn-save-return-draft"
                  type="button"
                  disabled={isSaving || isFinalizing}
                  onClick={handleSaveDraft}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
                </button>

                <button
                  id="btn-finalize-return"
                  type="button"
                  disabled={!isComplete4Angles || isSaving || isFinalizing}
                  onClick={handleFinalize}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFinalizing ? 'Đang chốt...' : 'Ký chốt biên bản trả'}
                </button>
              </>
            )}

            {isFinalized && !readOnly && onCompletedTrip && (
              <button
                id="btn-complete-trip"
                type="button"
                disabled={isCompleting}
                onClick={handleCompleteTrip}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {isCompleting ? 'Đang xử lý...' : '🏁 Hoàn tất chuyến đi'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
