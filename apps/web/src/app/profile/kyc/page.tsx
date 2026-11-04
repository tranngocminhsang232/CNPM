'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { AuthModal } from '../../../components/AuthModal';
import {
  createUploadIntent,
  fetchDriverLicense,
  submitDriverLicense,
  uploadToPresignedUrl,
  verifyMedia,
  DriverLicense,
} from '../../../lib/api';

export default function KycPage() {
  const { user, csrfToken, refreshUser, isLoading: isAuthLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [license, setLicense] = useState<DriverLicense | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [licenseNumber, setLicenseNumber] = useState('');
  const [fullName, setFullName] = useState(user?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [licenseClass, setLicenseClass] = useState('B2');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  useEffect(() => {
    if (user?.name) setFullName((value) => value || user.name);
  }, [user?.name]);

  useEffect(() => {
    async function load() {
      try {
        const lic = await fetchDriverLicense();
        setLicense(lic);
      } catch {
        // user might not have license yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (selectedFile) {
        setUploadProgress('Đang chuẩn bị tải ảnh...');
        const intent = await createUploadIntent(
          {
            purpose: 'IDENTITY_DOCUMENT',
            mimeType: selectedFile.type as 'image/jpeg' | 'image/png',
            sizeBytes: selectedFile.size,
          },
          csrfToken,
        );

        setUploadProgress('Đang tải ảnh bằng lái...');
        await uploadToPresignedUrl(intent.uploadUrl, selectedFile, selectedFile.type);

        setUploadProgress('Đang kiểm tra tính hợp lệ file...');
        await verifyMedia(intent.mediaId, csrfToken);
      }

      setUploadProgress('Đang nộp hồ sơ GPLX...');
      const submitted = await submitDriverLicense(
        {
          licenseNumber,
          fullName,
          dateOfBirth,
          licenseClass: licenseClass as any,
          expiryDate,
        },
        csrfToken,
      );

      setLicense(submitted);
      setSuccess('Hồ sơ Giấy phép lái xe đã được nộp thành công và đang chờ xét duyệt!');
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Nộp hồ sơ thất bại');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  if (isAuthLoading)
    return (
      <main id="main-content" tabIndex={-1} className="site-container py-12">
        <p role="status">Đang tải tài khoản…</p>
      </main>
    );
  if (!user)
    return (
      <main id="main-content" tabIndex={-1} className="site-container py-12">
        <div className="result-state">
          <h1 className="text-2xl font-semibold">Xác thực bằng lái xe</h1>
          <p>Đăng nhập để xem hoặc gửi hồ sơ bằng lái của bạn.</p>
          <button type="button" className="button button-primary" onClick={() => setAuthOpen(true)}>
            Đăng nhập để tiếp tục
          </button>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </main>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Xác thực Bằng lái xe (KYC)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cung cấp thông tin Giấy phép lái xe để đủ điều kiện thuê xe tự lái và trải nghiệm công
            nghệ nhận xe tức thì.
          </p>
        </div>

        {error && (
          <div
            id="kyc-error-alert"
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            id="kyc-success-alert"
            role="status"
            className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400">Đang tải thông tin hồ sơ...</div>
        ) : license ? (
          /* Profile Card */
          <div id="kyc-profile-card" className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-sm font-semibold text-slate-400">Trạng thái xét duyệt</span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    id="kyc-status-tag"
                    className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${
                      license.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : license.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {license.status === 'VERIFIED'
                      ? 'ĐÃ XÁC THỰC'
                      : license.status === 'PENDING'
                        ? 'ĐANG CHỜ DUYỆT'
                        : 'BỊ TỪ CHỐI'}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-slate-400">
                Mã hồ sơ: <span className="font-mono text-slate-600">{license.id.slice(0, 8)}</span>
              </div>
            </div>

            {license.status === 'REJECTED' && license.rejectionReason && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                <strong>Lý do từ chối:</strong> {String(license.rejectionReason)}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-slate-400">Số Giấy phép lái xe</span>
                <div id="license-number-display" className="text-base font-semibold text-slate-800">
                  {license.licenseNumber}
                </div>
              </div>

              <div>
                <span className="text-sm text-slate-400">Họ và tên</span>
                <div id="license-name-display" className="text-base font-semibold text-slate-800">
                  {license.fullName}
                </div>
              </div>

              <div>
                <span className="text-sm text-slate-400">Ngày sinh</span>
                <div className="text-sm font-medium text-slate-700">
                  {new Date(license.dateOfBirth).toLocaleDateString('vi-VN')}
                </div>
              </div>

              <div>
                <span className="text-sm text-slate-400">Hạng bằng</span>
                <div className="text-sm font-semibold text-brand-600">{license.licenseClass}</div>
              </div>

              <div>
                <span className="text-sm text-slate-400">Ngày hết hạn</span>
                <div className="text-sm font-medium text-slate-700">
                  {new Date(license.expiryDate).toLocaleDateString('vi-VN')}
                </div>
              </div>

              <div>
                <span className="text-sm text-slate-400">Thời điểm xác minh</span>
                <div className="text-sm font-medium text-slate-700">
                  {license.verifiedAt
                    ? new Date(String(license.verifiedAt)).toLocaleString('vi-VN')
                    : 'Chưa xét duyệt'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="kyc-license-number"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Số Giấy phép lái xe (12 chữ số chuẩn VN)
                </label>
                <input
                  id="kyc-license-number"
                  inputMode="numeric"
                  type="text"
                  required
                  pattern="^[0-9]{12}$"
                  maxLength={12}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Ví dụ: 079199012345"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="kyc-fullname"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Họ và tên trên bằng lái
                </label>
                <input
                  id="kyc-fullname"
                  autoComplete="name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="NGUYỄN VĂN A"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm uppercase focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="kyc-dob" className="block text-sm font-semibold text-slate-700">
                    Ngày sinh
                  </label>
                  <input
                    id="kyc-dob"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="kyc-class" className="block text-sm font-semibold text-slate-700">
                    Hạng GPLX
                  </label>
                  <select
                    id="kyc-class"
                    value={licenseClass}
                    onChange={(e) => setLicenseClass(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    {['B1', 'B2', 'C', 'D', 'E', 'FB2', 'FC', 'FD', 'FE'].map((cls) => (
                      <option key={cls} value={cls}>
                        Hạng {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="kyc-expiry"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Ngày hết hạn (ít nhất 30 ngày)
                  </label>
                  <input
                    id="kyc-expiry"
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label
                  htmlFor="kyc-photo-file"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Ảnh chụp mặt trước GPLX (không bắt buộc · JPEG / PNG, tối đa 5MB)
                </label>
                <input
                  id="kyc-photo-file"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (
                        !['image/jpeg', 'image/png'].includes(file.type) ||
                        file.size > 5 * 1024 * 1024
                      ) {
                        setError('Chọn ảnh JPEG hoặc PNG không quá 5MB.');
                        setSelectedFile(null);
                        e.target.value = '';
                        return;
                      }
                      setError(null);
                      setSelectedFile(file);
                    }
                  }}
                  className="mt-1.5 w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
                />
                <p className="mt-1 text-sm text-slate-400">
                  Tài liệu định danh được lưu trữ riêng tư và chỉ bạn cùng kiểm duyệt viên mới có
                  quyền xem.
                </p>
              </div>

              {uploadProgress && (
                <div
                  role="status"
                  className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700 font-medium"
                >
                  {uploadProgress}
                </div>
              )}

              <button
                id="kyc-submit-btn"
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ xác thực'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
