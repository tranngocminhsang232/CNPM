'use client';

import { Icon } from './Icon';
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
          setStatusMessage('Chốt cửa đã mở! Vui lòng vào xe và bắt đầu hành trình.');
        } else {
          setDoorLocked(true);
          setStatusMessage('Chốt cửa xe đã khóa an toàn!');
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
    <section
      id="keyless-remote-widget"
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
            <Icon name="key" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Chìa khóa Keyless</h3>
            <p className="mt-1 text-sm text-slate-500">
              {vehicleName} · {plate}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Mô phỏng
        </span>
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <Icon name={doorLocked ? 'lock' : 'unlock'} />
          <div>
            <p className="text-xs text-slate-500">Trạng thái chốt cửa</p>
            <p id="keyless-door-status" className="text-sm font-semibold text-slate-900">
              {doorLocked ? 'ĐÃ KHÓA CỬA' : 'ĐÃ MỞ KHÓA'}
            </p>
          </div>
        </div>
        <span className="text-sm text-slate-600">
          {isApproved
            ? 'Sẵn sàng nhận xe'
            : isInProgress
              ? 'Chuyến đi đang diễn ra'
              : 'Chưa thể điều khiển'}
        </span>
      </div>
      {isApproved && !inspectionFinalized && (
        <div
          id="keyless-inspection-warning"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
        >
          <h4 className="text-sm font-semibold">Yêu cầu bắt buộc trước khi mở khóa</h4>
          <p className="mt-2 text-sm">
            Chụp đủ 4 góc xe và ký biên bản nhận xe để bảo đảm quyền lợi của bạn.
          </p>
          <button
            id="btn-open-inspection"
            type="button"
            onClick={onOpenInspection}
            className="button button-secondary mt-4"
          >
            <Icon name="camera" /> Bắt đầu kiểm tra xe
          </button>
        </div>
      )}
      {isApproved && inspectionFinalized && (
        <div
          id="keyless-inspection-passed"
          className="mb-5 rounded-lg bg-brand-50 p-4 text-brand-800"
        >
          <p className="text-sm">Biên bản đã chốt. Bạn có thể mở khóa nhận xe.</p>
          <button
            type="button"
            onClick={onOpenInspection}
            className="mt-2 min-h-11 text-sm underline underline-offset-4"
          >
            Xem lại biên bản
          </button>
        </div>
      )}
      {statusMessage && (
        <div
          id="keyless-success-banner"
          role="status"
          className="mb-4 rounded-lg bg-brand-50 p-4 text-sm text-brand-800"
        >
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div
          id="keyless-error-banner"
          role="alert"
          className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="btn-keyless-unlock"
          type="button"
          disabled={!canOperate || isTransmitting}
          onClick={() => handleCommand('UNLOCK')}
          className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm font-semibold ${isApproved && !inspectionFinalized ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'}`}
        >
          <Icon name={isTransmitting && activeAction === 'UNLOCK' ? 'clock' : 'unlock'} />
          <span>
            {isTransmitting && activeAction === 'UNLOCK' ? 'Đang gửi lệnh…' : 'Mở khóa xe'}
          </span>
        </button>
        <button
          id="btn-keyless-lock"
          type="button"
          disabled={!canOperate || isTransmitting}
          onClick={() => handleCommand('LOCK')}
          className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Icon name={isTransmitting && activeAction === 'LOCK' ? 'clock' : 'lock'} />
          <span>
            {isTransmitting && activeAction === 'LOCK' ? 'Đang gửi lệnh…' : 'Khóa cửa xe'}
          </span>
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Lệnh điều khiển được xử lý trong môi trường mô phỏng.
      </p>
    </section>
  );
}
