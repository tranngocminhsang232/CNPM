'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { AuthModal } from './AuthModal';

const links = [
  ['nav-profile-kyc-link', '/profile/kyc', 'Hồ sơ bằng lái'],
  ['nav-renter-bookings-link', '/bookings', 'Chuyến đi của tôi'],
  ['nav-owner-dashboard-link', '/owner/dashboard', 'Tổng quan chủ xe'],
  ['nav-owner-bookings-link', '/owner/bookings', 'Quản lý yêu cầu thuê'],
  ['nav-owner-vehicles-link', '/owner/vehicles', 'Xe của tôi'],
  ['nav-new-vehicle-link', '/owner/vehicles/new', 'Đăng xe cho thuê'],
] as const;

export function UserNav() {
  const { user, logout, isLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!dropdownOpen) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [dropdownOpen]);
  if (isLoading && !isModalOpen)
    return (
      <span className="account-loading" aria-label="Đang tải tài khoản">
        …
      </span>
    );
  if (!user)
    return (
      <>
        <button
          id="nav-login-btn"
          type="button"
          className="button button-primary"
          onClick={() => setIsModalOpen(true)}
        >
          Đăng nhập
        </button>
        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  const status =
    user.kycStatus === 'VERIFIED'
      ? 'Đã xác thực'
      : user.kycStatus === 'PENDING'
        ? 'Chờ duyệt'
        : user.kycStatus === 'REJECTED'
          ? 'Cần cập nhật hồ sơ'
          : 'Chưa xác thực';
  return (
    <div
      className="account-nav"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropdownOpen(false);
      }}
    >
      <button
        id="user-menu-trigger"
        type="button"
        className="account-trigger"
        ref={triggerRef}
        aria-expanded={dropdownOpen}
        aria-controls="user-menu-dropdown"
        onClick={() => setDropdownOpen((open) => !open)}
      >
        <span className="account-avatar">{user.name?.charAt(0).toUpperCase() || 'U'}</span>
        <span className="account-identity">
          <span id="nav-user-name">{user.name}</span>
          <span id="nav-kyc-badge">{status}</span>
        </span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {dropdownOpen && (
        <div id="user-menu-dropdown" className="account-dropdown">
          <div className="account-email">{user.email}</div>
          {links.map(([id, href, label]) => (
            <Link key={id} id={id} href={href} onClick={() => setDropdownOpen(false)}>
              {label}
            </Link>
          ))}
          <button
            id="nav-logout-btn"
            type="button"
            onClick={async () => {
              setDropdownOpen(false);
              await logout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
