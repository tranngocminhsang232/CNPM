import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { SiteHeader } from '../components/SiteHeader';

export const metadata: Metadata = {
  title: 'CarShare — Thuê xe tự lái cho hành trình của bạn',
  description: 'Hệ thống chia sẻ và thuê xe tự lái tiện lợi, minh bạch và an toàn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
