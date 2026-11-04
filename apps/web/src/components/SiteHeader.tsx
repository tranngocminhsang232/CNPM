'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserNav } from './UserNav';

const ownerLinks = [
  ['/owner/dashboard', 'Tổng quan'],
  ['/owner/bookings', 'Yêu cầu thuê'],
  ['/owner/vehicles', 'Xe của tôi'],
  ['/owner/vehicles/new', 'Đăng xe'],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const owner = pathname.startsWith('/owner');
  return (
    <>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" aria-label="CarShare — Trang chủ">
            <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
              <path
                d="M6 18 9 9h14l3 9M5 18h22v7H5zM9 25v3m14-3v3M9 21h3m8 0h3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              CarShare<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav aria-label="Điều hướng chính" className="primary-nav">
            <Link
              href="/"
              aria-current={
                pathname === '/' || pathname.startsWith('/vehicles/') ? 'page' : undefined
              }
            >
              Tìm xe
            </Link>
            <Link
              href="/bookings"
              aria-current={
                pathname.startsWith('/bookings') || pathname === '/checkout' ? 'page' : undefined
              }
            >
              Chuyến đi
            </Link>
            <Link href="/owner/dashboard" aria-current={owner ? 'page' : undefined}>
              Chủ xe
            </Link>
          </nav>
          <UserNav />
        </div>
      </header>
      {owner && (
        <nav className="owner-nav" aria-label="Quản lý cho thuê">
          <div className="site-container">
            {ownerLinks.map(([href, label]) => (
              <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
