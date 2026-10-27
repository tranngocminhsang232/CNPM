'use client';

import { useEffect, useState, useCallback } from 'react';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

interface HealthResponse {
  data: HealthData;
}

type ConnectionState = 'loading' | 'connected' | 'error';

export default function HomePage() {
  const [state, setState] = useState<ConnectionState>('loading');
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  const checkHealth = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      // Gọi endpoint health cùng origin qua Next.js rewrite (/api/v1/health -> NestJS backend)
      const res = await fetch('/api/v1/health', {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi với mã lỗi HTTP ${res.status}`);
      }

      const json = (await res.json()) as HealthResponse;
      if (json && json.data && json.data.status === 'ok') {
        setHealthData(json.data);
        setState('connected');
        setLastCheckedAt(new Date().toLocaleTimeString('vi-VN'));
      } else {
        throw new Error('Định dạng phản hồi từ API không đúng chuẩn { data }');
      }
    } catch (err: unknown) {
      setState('error');
      setHealthData(null);
      setErrorMessage(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ backend');
      setLastCheckedAt(new Date().toLocaleTimeString('vi-VN'));
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between p-4 sm:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
            CS
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Car Sharing</h1>
            <p className="text-xs text-slate-500">Nền Tảng Thuê Xe Tự Lái Tức Thì</p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Giai đoạn G0 — Baseline
          </span>
        </div>
      </header>

      {/* Main Status Container */}
      <section className="max-w-xl mx-auto w-full my-8 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Trạng Thái Kết Nối Hệ Thống</h2>
          <p className="text-sm text-slate-500 mt-1">
            Xác minh kết nối cùng origin giữa Next.js Web và NestJS Backend qua{' '}
            <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs">
              /api/v1/health
            </code>
          </p>
        </div>

        {/* Loading State */}
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-600">
              Đang kiểm tra kết nối tới Backend...
            </p>
          </div>
        )}

        {/* Connected State */}
        {state === 'connected' && healthData && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-emerald-900">Kết Nối Thành Công</h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Next.js và NestJS API đang giao tiếp ổn định cùng origin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 block">Trạng thái API</span>
                <span className="font-semibold text-slate-800 uppercase">{healthData.status}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Thời gian hoạt động (Uptime)</span>
                <span className="font-semibold text-slate-800">{healthData.uptime} giây</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/60">
                <span className="text-xs text-slate-400 block">Dấu thời gian máy chủ (UTC)</span>
                <span className="font-mono text-xs text-slate-700 break-all">
                  {healthData.timestamp}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <span>Kiểm tra lúc: {lastCheckedAt}</span>
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Kiểm tra lại
              </button>
            </div>
          </div>
        )}

        {/* Error / Disconnected State */}
        {state === 'error' && (
          <div className="space-y-6">
            <div className="flex items-start space-x-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-rose-900">Mất Kết Nối Tới Backend</h3>
                <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
              <p className="font-medium text-slate-700">Hướng dẫn khắc phục:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Đảm bảo NestJS Backend đang chạy trên cổng 4000.</li>
                <li>
                  Lệnh khởi động API:{' '}
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                    pnpm --filter @carsharing/api run start:dev
                  </code>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <span>Kiểm tra lúc: {lastCheckedAt}</span>
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Thử kết nối lại
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 border-t border-slate-200 pt-4">
        Hệ thống Car Sharing MVP — Hoàn thành Task G0-04 (Next.js 16 App Router & Same-origin
        Rewrite)
      </footer>
    </main>
  );
}
