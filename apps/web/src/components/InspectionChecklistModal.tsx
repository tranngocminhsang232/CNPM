'use client';

import { Icon } from './Icon';
import { useDialog } from '../lib/use-dialog';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  createUploadIntent,
  uploadToPresignedUrl,
  verifyMedia,
  saveInspectionApi,
  finalizeInspectionApi,
  type Inspection,
  type InspectionPhoto,
} from '../lib/api';

interface InspectionChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  initialInspection?: Inspection | null;
  onFinalized: (inspection: Inspection) => void;
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
    label: '1. Đầu xe & Biển số',
    sub: 'Chụp chính diện góc trước xe',
    icon: 'car',
  },
  {
    angle: 'REAR',
    label: '2. Đuôi xe & Đèn hậu',
    sub: 'Chụp chính diện đuôi và biển số sau',
    icon: 'car',
  },
  {
    angle: 'LEFT',
    label: '3. Sườn trái xe',
    sub: 'Chụp toàn bộ hông và 2 lốp bên lái',
    icon: 'car',
  },
  {
    angle: 'RIGHT',
    label: '4. Sườn phải xe',
    sub: 'Chụp toàn bộ hông và 2 lốp bên phụ',
    icon: 'car',
  },
];

export function InspectionChecklistModal({
  isOpen,
  onClose,
  bookingId,
  initialInspection,
  onFinalized,
  readOnly = false,
}: InspectionChecklistModalProps) {
  const { csrfToken } = useAuth();

  const [odometerKm, setOdometerKm] = useState<number>(15420);
  const [fuelPercent, setFuelPercent] = useState<number>(90);
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync initialInspection if available
  useEffect(() => {
    if (initialInspection) {
      setOdometerKm(initialInspection.odometerKm || 15420);
      setFuelPercent(initialInspection.fuelPercent ?? 90);
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
  }, [initialInspection]);

  useDialog(isOpen, onClose, 'inspection-checklist-modal');

  if (!isOpen) return null;

  const uploadedCount = ANGLES.filter((a) => !!photos[a.angle].mediaId).length;
  const isComplete4Angles = uploadedCount === 4;
  const isFinalized = initialInspection?.acknowledged || false;

  const handleFileUpload = async (angle: AngleType, file: File) => {
    if (!csrfToken) return;
    setError(null);
    setUploadingAngle(angle);

    try {
      // 1. Create upload intent
      const intent = await createUploadIntent(
        {
          purpose: 'INSPECTION_PHOTO',
          bookingId,
          mimeType: file.type as 'image/jpeg' | 'image/png',
          sizeBytes: file.size,
        },
        csrfToken,
      );

      // 2. Upload directly to S3/MinIO
      await uploadToPresignedUrl(intent.uploadUrl, file, file.type);

      // 3. Verify media
      await verifyMedia(intent.mediaId, csrfToken);

      // 4. Update photo state
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

  const handleSaveDraft = async () => {
    if (!csrfToken) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const photoList = Object.entries(photos)
      .filter(([_, v]) => !!v.mediaId)
      .map(([angle, v]) => ({ angle: angle as AngleType, mediaId: v.mediaId }));

    try {
      await saveInspectionApi(
        bookingId,
        {
          type: 'CHECK_IN',
          odometerKm,
          fuelPercent,
          damageNotes: damageNotes.trim(),
          version: initialInspection?.version ?? 1,
          photos: photoList,
        },
        csrfToken,
      );
      setSuccessMessage('Đã lưu bản nháp biên bản bàn giao thành công!');
    } catch (err: any) {
      setError(err.message || 'Không thể lưu bản nháp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!csrfToken) return;
    if (!isComplete4Angles) {
      setError(
        'Vui lòng chụp đầy đủ 4 góc xe (Đầu, Đuôi, Sườn trái, Sườn phải) trước khi chốt biên bản.',
      );
      return;
    }

    setIsFinalizing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Save draft with all 4 photos first
      const photoList = Object.entries(photos)
        .filter(([_, v]) => !!v.mediaId)
        .map(([angle, v]) => ({ angle: angle as AngleType, mediaId: v.mediaId }));

      await saveInspectionApi(
        bookingId,
        {
          type: 'CHECK_IN',
          odometerKm,
          fuelPercent,
          damageNotes: damageNotes.trim(),
          version: initialInspection?.version ?? 1,
          photos: photoList,
        },
        csrfToken,
      );

      // 2. Finalize
      const finalized = await finalizeInspectionApi(bookingId, 'CHECK_IN', csrfToken);
      setSuccessMessage('Biên bản bàn giao nhận xe đã được ký chốt thành công!');
      onFinalized(finalized);
    } catch (err: any) {
      setError(err.message || 'Không thể chốt biên bản bàn giao xe.');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div
      id="inspection-checklist-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 overflow-y-auto"
    >
      <div
        id="inspection-checklist-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Kiểm tra và nhận xe"
        tabIndex={-1}
        className="dialog-surface relative my-8 w-full max-w-3xl rounded-2xl bg-white overflow-hidden border border-slate-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4 text-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-xl font-semibold">
              <Icon name="clipboard" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Kiểm tra và nhận xe</h2>
              <p className="text-sm text-slate-400">
                Chụp 4 góc xe, ghi nhận số km & mức pin/xăng để bảo đảm quyền lợi đôi bên
              </p>
            </div>
          </div>
          <button
            aria-label="Đóng hộp thoại"
            id="btn-close-inspection-modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Progress Banner */}
          <div className="flex flex-wrap gap-3 items-center justify-between rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Tiến độ chụp ảnh checklist 4 góc xe
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                Bắt buộc đủ 4 góc trước khi có thể mở khóa số Keyless nhận xe
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                id="inspection-progress-badge"
                className={`rounded-full whitespace-nowrap px-3 py-1 text-sm font-semibold ${
                  isComplete4Angles
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`}
              >
                {uploadedCount}/4 góc ảnh {isComplete4Angles ? 'Đủ điều kiện' : '• Đang thiếu'}
              </span>
            </div>
          </div>

          {error && (
            <div
              id="inspection-error-banner"
              className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-start gap-2"
            >
              <span className="text-base font-semibold">
                <Icon name="alert" />
              </span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="inspection-success-banner"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700 flex items-start gap-2"
            >
              <span className="text-base font-semibold">OK</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* 4 Angles Photo Grid */}
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-3">
              1. Ảnh chụp 4 góc xe (Bắt buộc)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ANGLES.map((cfg) => {
                const photo = photos[cfg.angle];
                const isUploading = uploadingAngle === cfg.angle;
                const hasPhoto = !!photo.mediaId;

                return (
                  <div
                    key={cfg.angle}
                    id={`inspection-card-${cfg.angle.toLowerCase()}`}
                    className={`relative rounded-lg border p-4 transition ${
                      hasPhoto
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          <Icon name={cfg.icon} />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{cfg.label}</div>
                          <div className="text-sm text-slate-500">{cfg.sub}</div>
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
                          hasPhoto
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {hasPhoto ? 'Đã chụp' : 'Chưa chụp'}
                      </span>
                    </div>

                    {/* Preview box */}
                    <div className="relative mt-2 flex h-36 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white overflow-hidden">
                      {photo.previewUrl ? (
                        <img
                          src={photo.previewUrl}
                          alt={cfg.label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-3">
                          <span className="text-3xl text-slate-300">
                            <Icon name="camera" />
                          </span>
                          <p className="mt-1 text-sm text-slate-400">Nhấn để chọn ảnh hoặc chụp</p>
                        </div>
                      )}

                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white text-sm font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Đang upload...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hidden input trigger */}
                    {!readOnly && !isFinalized && (
                      <label className="mt-3 block rounded-lg text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
                        <span className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition">
                          {hasPhoto ? 'Chụp lại ảnh khác' : 'Chọn ảnh / Chụp ảnh'}
                        </span>
                        <input
                          id={`input-photo-${cfg.angle.toLowerCase()}`}
                          type="file"
                          accept="image/jpeg,image/png"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(cfg.angle, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Odometer & Fuel Input */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">
              2. Chỉ số công tơ mét & Pin / Xăng
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Số km hiển thị trên ODO (km) *
                </label>
                <input
                  id="input-inspection-odometer"
                  type="number"
                  min="0"
                  max="1000000"
                  disabled={readOnly || isFinalized}
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                  placeholder="Ví dụ: 15420"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Mức Pin / Nhiên liệu hiện tại:{' '}
                  <span className="text-brand-600 font-semibold">{fuelPercent}%</span> *
                </label>
                <input
                  id="input-inspection-fuel"
                  type="range"
                  min="0"
                  max="100"
                  disabled={readOnly || isFinalized}
                  value={fuelPercent}
                  onChange={(e) => setFuelPercent(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mt-2"
                />
              </div>
            </div>
          </div>

          {/* Damage Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              3. Ghi chú tình trạng xe, vết xước sẵn có (Tùy chọn)
            </label>
            <textarea
              id="input-inspection-notes"
              rows={2}
              disabled={readOnly || isFinalized}
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Ví dụ: Có vết xước nhỏ 2cm ở cản trước bên phụ, lốp xe đủ áp suất..."
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            aria-label="Đóng hộp thoại"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Đóng
          </button>

          {!readOnly && !isFinalized && (
            <div className="flex w-full sm:w-auto items-center gap-3">
              <button
                id="btn-save-inspection-draft"
                type="button"
                disabled={isSaving || isFinalizing}
                onClick={handleSaveDraft}
                className="w-full sm:w-auto rounded-lg border border-brand-600 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
              </button>

              <button
                id="btn-finalize-inspection"
                type="button"
                disabled={!isComplete4Angles || isFinalizing || isSaving}
                onClick={handleFinalize}
                className="w-full sm:w-auto rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isFinalizing ? 'Đang chốt...' : 'Ký xác nhận & Chốt biên bản'}
              </button>
            </div>
          )}

          {isFinalized && (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span>Biên bản đã được chốt và đóng dấu điện tử</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
