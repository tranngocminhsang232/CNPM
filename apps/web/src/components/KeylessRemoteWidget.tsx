'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { triggerKeylessOperationApi, type Booking, type KeylessOperation } from '../lib/api';

interface KeylessRemoteWidgetProps {
  booking: Booking;
  inspectionFinalized: boolean;
  onOpenInspection: () => void;
  onKeylessSuccess?: (updatedBookingStatus?: string) => void;
}

export function KeylessRemoteWidget({
  booking,
  inspectionFinalized,
  onOpenInspection,
  onKeylessSuccess,
}: KeylessRemoteWidgetProps) {
  const { csrfToken } = useAuth();

  const [doorLocked, setDoorLocked] = useState<boolean>(booking.status !== 'IN_PROGRESS');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<'LOCK' | 'UNLOCK' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vehicleName = booking.vehicle
    ? `${booking.vehicle.brand} ${booking.vehicle.model}`
    : 'Xe tự lái';
  const plate =
    booking.vehicle && typeof booking.vehicle.plateNormalized === 'string'
      ? (booking.vehicle.plateNormalized as string)
      : 'Xe Keyless';
  const isApproved = booking.status === 'APPROVED';
  const isInProgress = booking.status === 'IN_PROGRESS';
  const canOperate = isApproved || isInProgress;

  const handleCommand = async (action: 'LOCK' | 'UNLOCK') => {
    if (!csrfToken) return;

    // Check inspection requirement for UNLOCK on APPROVED booking
    if (action === 'UNLOCK' && isApproved && !inspectionFinalized) {
      setErrorMessage(
        'Quy định an toàn: Bạn cần chụp ảnh và ký chốt biên bản kiểm tra nhận xe (CHECK_IN) trước khi mở khóa xe.',
      );
      return;
    }

    setIsTransmitting(true);
    setActiveAction(action);
    setErrorMessage(null);
    setStatusMessage(null);

    // Generate unique client idempotency key (min 16 chars)
    const idempotencyKey = `keyless-${action.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res: KeylessOperation = await triggerKeylessOperationApi(
        booking.id,
        { action },
        idempotencyKey,
        csrfToken,
      );

      if (res.status === 'SUCCESS') {
        if (action === 'UNLOCK') {
          setDoorLocked(false);
          setStatusMessage('✓ Chốt cửa đã mở! Vui lòng vào xe và bắt đầu hành trình.');
        } else {
          setDoorLocked(true);
          setStatusMessage('✓ Chốt cửa xe đã khóa an toàn!');
        }

        // Notify parent if booking state transitioned to IN_PROGRESS
        if (res.bookingStatus) {
          onKeylessSuccess?.(res.bookingStatus);
        }
      } else if (res.status === 'UNKNOWN') {
        setErrorMessage(
          'Mất tín hiệu tạm thời tới xe (có thể do đỗ dưới hầm). Vui lòng kiểm tra lại hoặc đối soát lệnh.',
        );
      } else {
        setErrorMessage('Thiết bị xe báo lỗi phần cứng khi thực hiện lệnh. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể gửi lệnh điều khiển tới xe.');
    } finally {
      setIsTransmitting(false);
      setActiveAction(null);
    }
  };

  return (
    <div
      id="keyless-remote-widget"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 p-6 text-white shadow-2xl border border-slate-700/60"
    >
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="relative flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
            <span className="text-xl">🔑</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide">
                Chìa Khóa Ảo (Digital Keyless)
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                IoT Online
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {vehicleName} • Biển số: <span className="font-semibold text-slate-200">{plate}</span>
            </p>
          </div>
        </div>

        {/* Telemetry Indicator */}
        <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 border border-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-medium text-slate-300">GSM: Ổn định</span>
        </div>
      </div>

      {/* Door Status Banner */}
      <div className="relative my-5 rounded-xl bg-slate-800/50 p-4 border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
              doorLocked
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {doorLocked ? '🔒' : '🔓'}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Trạng thái chốt cửa</div>
            <div id="keyless-door-status" className="text-sm font-bold tracking-wide">
              {doorLocked ? (
                <span className="text-amber-400">ĐÃ KHÓA CỬA</span>
              ) : (
                <span className="text-emerald-400">ĐÃ MỞ KHÓA</span>
              )}
            </div>
          </div>
        </div>

        {isApproved && (
          <div className="text-right">
            <span className="rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/30">
              Sẵn sàng nhận xe
            </span>
          </div>
        )}

        {isInProgress && (
          <div className="text-right">
            <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              Chuyến đi đang diễn ra
            </span>
          </div>
        )}
      </div>

      {/* Checklist Gatekeeper Warning if approved & not finalized */}
      {isApproved && !inspectionFinalized && (
        <div
          id="keyless-inspection-warning"
          className="relative mb-5 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-xl font-bold">⚠</span>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Yêu cầu bắt buộc trước khi mở khóa
              </h4>
              <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
                Vui lòng chụp ảnh 4 góc xe và ký chốt biên bản bàn giao xe (CHECK_IN) tại bãi trước
                khi điều khiển khóa ảo Keyless.
              </p>
              <button
                id="btn-open-inspection"
                type="button"
                onClick={onOpenInspection}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 active:scale-95 transition"
              >
                <span>📷</span> Bắt đầu kiểm tra xe & chụp ảnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Complete Confirmation if approved & finalized */}
      {isApproved && inspectionFinalized && (
        <div
          id="keyless-inspection-passed"
          className="relative mb-5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span className="text-xs font-semibold text-emerald-300">
              Biên bản kiểm tra xe đã chốt. Bạn có thể mở khóa nhận xe!
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenInspection}
            className="text-xs text-slate-400 underline hover:text-white"
          >
            Xem lại biên bản
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {statusMessage && (
        <div
          id="keyless-success-banner"
          className="relative mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2"
        >
          <span>✓</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          id="keyless-error-banner"
          className="relative mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2"
        >
          <span className="font-bold">✕</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Remote Buttons */}
      <div className="relative grid grid-cols-2 gap-4">
        {/* Unlock Button */}
        <button
          id="btn-keyless-unlock"
          type="button"
          disabled={!canOperate || isTransmitting}
          onClick={() => handleCommand('UNLOCK')}
          className={`relative group flex flex-col items-center justify-center rounded-xl p-4 transition-all duration-200 border ${
            isApproved && !inspectionFinalized
              ? 'border-slate-800 bg-slate-900/60 text-slate-500 opacity-60 hover:opacity-100'
              : 'border-blue-500/40 bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-blue-600 active:scale-98'
          }`}
        >
          <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
            {isTransmitting && activeAction === 'UNLOCK' ? '⏳' : '🔓'}
          </span>
          <span className="text-sm font-bold tracking-wide">
            {isTransmitting && activeAction === 'UNLOCK' ? 'Đang gửi lệnh...' : 'MỞ KHÓA XE'}
          </span>
          <span className="mt-0.5 text-[10px] text-blue-200/80">
            {isApproved ? 'Nhận xe & Bắt đầu' : 'Mở chốt toàn bộ cửa'}
          </span>
        </button>

        {/* Lock Button */}
        <button
          id="btn-keyless-lock"
          type="button"
          disabled={!canOperate || isTransmitting}
          onClick={() => handleCommand('LOCK')}
          className="relative group flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-4 text-white shadow-lg shadow-slate-900/40 hover:from-slate-750 hover:to-slate-850 active:scale-98 transition-all duration-200"
        >
          <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
            {isTransmitting && activeAction === 'LOCK' ? '⏳' : '🔒'}
          </span>
          <span className="text-sm font-bold tracking-wide">
            {isTransmitting && activeAction === 'LOCK' ? 'Đang gửi lệnh...' : 'KHÓA CỬA XE'}
          </span>
          <span className="mt-0.5 text-[10px] text-slate-400">Chốt an toàn toàn bộ cửa</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="relative mt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
        <span>Giao thức: Keyless Telematics IoT v1.1</span>
        <span>Mã hóa: SHA-256 + Idempotent</span>
      </div>
    </div>
  );
}
