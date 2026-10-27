'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { createReviewApi, type Review } from '../lib/api';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  targetRole?: string;
  onReviewSubmitted: (review: Review) => void;
}

const STAR_LABELS: Record<number, string> = {
  1: 'Rất không hài lòng (1 sao)',
  2: 'Chưa tốt (2 sao)',
  3: 'Bình thường (3 sao)',
  4: 'Hài lòng (4 sao)',
  5: 'Tuyệt vời, rất hài lòng (5 sao)',
};

export function ReviewModal({
  isOpen,
  onClose,
  bookingId,
  targetRole = 'đối tác',
  onReviewSubmitted,
}: ReviewModalProps) {
  const { csrfToken } = useAuth();

  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeScore = hoverScore !== null ? hoverScore : score;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csrfToken) return;

    if (!comment.trim()) {
      setError('Vui lòng nhập nhận xét của bạn về chuyến đi.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const review = await createReviewApi(
        bookingId,
        {
          score,
          comment: comment.trim(),
        },
        csrfToken,
      );
      onReviewSubmitted(review);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-review"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <h3 className="font-black text-slate-900 text-lg">Đánh giá chuyến đi</h3>
              <p className="text-xs text-slate-500">
                Chia sẻ trải nghiệm của bạn với {targetRole} (Quy tắc BR-12)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            id="review-error-banner"
            className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star selector */}
          <div className="text-center py-2">
            <div className="flex justify-center items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isLit = starVal <= activeScore;
                return (
                  <button
                    key={starVal}
                    id={`star-rating-${starVal}`}
                    type="button"
                    onClick={() => setScore(starVal)}
                    onMouseEnter={() => setHoverScore(starVal)}
                    onMouseLeave={() => setHoverScore(null)}
                    className="text-3xl sm:text-4xl transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
                  >
                    <span className={isLit ? 'text-amber-400' : 'text-slate-200'}>★</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-slate-700">
              {STAR_LABELS[activeScore] || `${activeScore} sao`}
            </p>
          </div>

          {/* Comment textarea */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">Nhận xét chi tiết *</label>
              <span className="text-[10px] text-slate-400">{comment.length}/2000 ký tự</span>
            </div>
            <textarea
              id="review-comment-input"
              rows={4}
              required
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ về chất lượng xe, độ sạch sẽ, thái độ và hỗ trợ của chủ xe..."
              className="w-full rounded-2xl border border-slate-300 p-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              id="btn-submit-review"
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
