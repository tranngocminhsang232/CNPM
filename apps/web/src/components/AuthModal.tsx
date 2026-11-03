'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEMO_ACCOUNTS = [
  {
    role: 'Người thuê',
    name: 'Thuê 1',
    email: 'renter1@carsharing.local',
    badge: 'Khách thuê',
  },
  {
    role: 'Chủ xe 1',
    name: 'Chủ 1',
    email: 'owner1@carsharing.local',
    badge: 'Chủ xe',
  },
  {
    role: 'Chủ xe 2',
    name: 'Chủ 2',
    email: 'owner2@carsharing.local',
    badge: 'Chủ xe',
  },
];

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('DemoPassword123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, 'DemoPassword123!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      id="auth-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-content"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Đăng nhập tài khoản
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Trải nghiệm nền tảng thuê & chia sẻ xe tự lái
            </p>
          </div>
          <button
            id="auth-modal-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '8px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {error && (
            <div
              id="auth-error-alert"
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                color: '#b91c1c',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Quick Demo Login */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Đăng nhập nhanh với tài khoản Demo
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  id={`quick-login-${acc.email.split('@')[0]}`}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email)}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.background = '#f0f9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                      {acc.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{acc.email}</div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: acc.badge === 'Chủ xe' ? '#e0f2fe' : '#f0fdf4',
                      color: acc.badge === 'Chủ xe' ? '#0369a1' : '#15803d',
                    }}
                  >
                    {acc.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '20px 0',
              color: '#94a3b8',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ padding: '0 10px' }}>HOẶC ĐĂNG NHẬP THỦ CÔNG</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="auth-email-input"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Email
              </label>
              <input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="auth-password-input"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Mật khẩu
              </label>
              <input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
