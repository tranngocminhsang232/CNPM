'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { AuthModal } from './AuthModal';

export function UserNav() {
  const { user, logout, isLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const getKycBadge = (status?: string) => {
    switch (status) {
      case 'VERIFIED':
        return { text: 'Đã xác thực', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'PENDING':
        return { text: 'Chờ duyệt', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'REJECTED':
        return { text: 'Bị từ chối', bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
      default:
        return { text: 'Chưa KYC', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
    }
  };

  if (!mounted || isLoading) {
    return (
      <div
        className="text-xs text-slate-400 py-2 px-3 font-medium select-none"
        suppressHydrationWarning
      >
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <button
          id="nav-login-btn"
          type="button"
          suppressHydrationWarning
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          Đăng nhập
        </button>
        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  const badge = getKycBadge(user.kycStatus);

  return (
    <div style={{ position: 'relative' }} suppressHydrationWarning>
      <div
        id="user-menu-trigger"
        onClick={() => setDropdownOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          borderRadius: '10px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#0284c7',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>

        <div style={{ textAlign: 'left' }}>
          <div
            id="nav-user-name"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}
          >
            {user.name}
          </div>
          <span
            id="nav-kyc-badge"
            style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '4px',
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
              marginTop: '2px',
            }}
          >
            {badge.text}
          </span>
        </div>

        <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '4px' }}>▼</span>
      </div>

      {dropdownOpen && (
        <div
          id="user-menu-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '220px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            padding: '8px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Đang đăng nhập</div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#0f172a',
                wordBreak: 'break-all',
              }}
            >
              {user.email}
            </div>
          </div>

          <Link
            id="nav-profile-kyc-link"
            href="/profile/kyc"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>Hồ sơ GPLX (KYC)</span>
            <span
              style={{
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.text}
            </span>
          </Link>

          <Link
            id="nav-renter-bookings-link"
            href="/bookings"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              display: 'block',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Chuyến đi của tôi
          </Link>

          <Link
            id="nav-owner-dashboard-link"
            href="/owner/dashboard"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              display: 'block',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            📊 Bảng điều khiển chủ xe
          </Link>

          <Link
            id="nav-owner-bookings-link"
            href="/owner/bookings"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              display: 'block',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Quản lý yêu cầu thuê
          </Link>

          <Link
            id="nav-owner-vehicles-link"
            href="/owner/vehicles"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              display: 'block',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Xe của tôi
          </Link>

          <Link
            id="nav-new-vehicle-link"
            href="/owner/vehicles/new"
            onClick={() => setDropdownOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#0284c7',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'block',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            + Đăng xe cho thuê
          </Link>

          <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

          <button
            id="nav-logout-btn"
            type="button"
            onClick={async () => {
              setDropdownOpen(false);
              await logout();
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#b91c1c',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
