import React from 'react';

export type BookingStatusType =
  'REQUESTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

interface BookingStatusBadgeProps {
  status: BookingStatusType | string;
  size?: 'sm' | 'md' | 'lg';
}

export function BookingStatusBadge({ status, size = 'md' }: BookingStatusBadgeProps) {
  const getConfig = (st: string) => {
    switch (st) {
      case 'REQUESTED':
        return {
          label: 'Chờ chủ xe duyệt',
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500 animate-pulse',
        };
      case 'APPROVED':
        return {
          label: 'Đã duyệt • Sẵn sàng',
          bg: 'bg-sky-50',
          text: 'text-sky-700',
          border: 'border-sky-200',
          dot: 'bg-sky-500',
        };
      case 'IN_PROGRESS':
        return {
          label: 'Đang trong chuyến đi',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500 animate-pulse',
        };
      case 'COMPLETED':
        return {
          label: 'Chuyến đi hoàn thành',
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          dot: 'bg-purple-500',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          dot: 'bg-slate-400',
        };
      case 'REJECTED':
        return {
          label: 'Chủ xe từ chối',
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: st,
          bg: 'bg-slate-50',
          text: 'text-slate-600',
          border: 'border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  const config = getConfig(status);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  }[size];

  return (
    <span
      id="booking-status-badge"
      data-testid="booking-status-badge"
      className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
