import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Car Sharing — Nền Tảng Thuê Xe Tự Lái Tức Thì',
  description: 'Hệ thống chia sẻ và thuê xe tự lái tiện lợi, minh bạch và an toàn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased selection:bg-blue-500 selection:text-white">{children}</body>
    </html>
  );
}
