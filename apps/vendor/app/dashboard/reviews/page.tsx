"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../../../components/layout/Header";
import { api, type VendorReview } from "../../../lib/api";

const SORT_OPTS = [
  { value: "newest", label: "Newest" },
  { value: "lowest", label: "Lowest Rated" },
] as const;

const RATING_OPTS = ["All", "5", "4", "3", "2", "1"] as const;

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function ReviewCard({
  review,
  onReply,
}: {
  review: VendorReview;
  onReply: (reviewId: string, current: string) => void;
}) {
  const date = review.booking.slot?.date
    ? new Date(review.booking.slot.date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="bg-[#111] border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {review.user.firstName} {review.user.lastName.charAt(0)}.
          </p>
          <p className="text-xs text-muted mt-0.5">
            {review.facility.name} · {date}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StarDisplay rating={review.rating} />
          {review.isVerified && (
            <span className="text-[10px] text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">
              Verified
            </span>
          )}
        </div>
      </div>

      {review.title && (
        <p className="text-sm font-semibold text-white">{review.title}</p>
      )}
      {review.body && (
        <p className="text-sm text-[#aaa] leading-relaxed">{review.body}</p>
      )}

      {(review.courtQuality || review.cleanliness || review.valueForMoney || review.staffFriendly) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {review.courtQuality != null && <span className="text-muted">🎾 Court <span className="text-amber-400 font-semibold">{review.courtQuality}★</span></span>}
          {review.cleanliness != null && <span className="text-muted">🧹 Clean <span className="text-amber-400 font-semibold">{review.cleanliness}★</span></span>}
          {review.valueForMoney != null && <span className="text-muted">💰 Value <span className="text-amber-400 font-semibold">{review.valueForMoney}★</span></span>}
          {review.staffFriendly != null && <span className="text-muted">😊 Staff <span className="text-amber-400 font-semibold">{review.staffFriendly}★</span></span>}
        </div>
      )}

      {review.vendorReply ? (
        <div className="bg-[#0d0d0d] border-l-2 border-primary rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-primary mb-1">Your reply</p>
          <p className="text-sm text-[#aaa]">{review.vendorReply}</p>
          <button
            className="text-xs text-primary hover:underline mt-2"
            onClick={() => onReply(review.id, review.vendorReply ?? "")}
          >
            Edit reply
          </button>
        </div>
      ) : (
        <button
          className="self-start text-xs text-primary border border-primary/40 hover:bg-primary/10 rounded-dome px-3 py-1.5 transition-colors"
          onClick={() => onReply(review.id, "")}
        >
          Reply to this review
        </button>
      )}
    </div>
  );
}

function ReplyModal({
  reviewId,
  initial,
  onClose,
  onSave,
}: {
  reviewId: string;
  initial: string;
  onClose: () => void;
  onSave: (reviewId: string, text: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(reviewId, trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reply");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111] border border-border rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4">
        <h3 className="text-lg font-bold text-white">Reply to review</h3>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Write a professional, helpful response…"
          className="bg-black border border-border rounded-dome px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{text.length}/1000</span>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-white border border-border rounded-dome transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="px-4 py-2 text-sm text-white bg-primary rounded-dome disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving…" : "Save Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [total, setTotal] = useState(0);
  const [unanswered, setUnanswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<"newest" | "lowest">("newest");
  const [ratingFilter, setRatingFilter] = useState<string>("All");
  const [replyTarget, setReplyTarget] = useState<{ id: string; current: string } | null>(null);

  const load = useCallback(async (p: number, s: string, r: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), limit: "20", sort: s };
      if (r !== "All") params["rating"] = r;
      const res = await api.reviews.list(params);
      const d = res.data;
      if (p === 1) {
        setReviews(d.reviews);
      } else {
        setReviews((prev) => [...prev, ...d.reviews]);
      }
      setTotal(d.total);
      setUnanswered(d.unanswered);
      setHasMore(d.hasMore);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, sort, ratingFilter); }, [sort, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveReply(reviewId: string, text: string) {
    const res = await api.reviews.reply(reviewId, text);
    const updated = res.data;
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, vendorReply: updated.vendorReply, vendorRepliedAt: updated.vendorRepliedAt } : r)));
    setUnanswered((n) => Math.max(0, n - 1));
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Reviews" />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111] border border-border rounded-xl p-4">
            <p className="text-2xl font-black text-white">{total}</p>
            <p className="text-xs text-muted mt-0.5">Total reviews</p>
          </div>
          <div className="bg-[#111] border border-border rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">{unanswered}</p>
            <p className="text-xs text-muted mt-0.5">Awaiting reply</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex gap-1">
            {SORT_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); }}
                className={`px-3 py-1.5 text-xs rounded-dome transition-colors ${
                  sort === opt.value ? "bg-primary text-white" : "bg-[#111] border border-border text-muted hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {RATING_OPTS.map((r) => (
              <button
                key={r}
                onClick={() => setRatingFilter(r)}
                className={`px-3 py-1.5 text-xs rounded-dome transition-colors ${
                  ratingFilter === r ? "bg-primary text-white" : "bg-[#111] border border-border text-muted hover:text-white"
                }`}
              >
                {r === "All" ? "All" : `${r}★`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading && reviews.length === 0 ? (
          <div className="text-muted text-sm py-12 text-center">Loading reviews…</div>
        ) : error ? (
          <div className="text-red-400 text-sm py-8 text-center">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="text-muted text-sm py-12 text-center">
            No reviews yet. Once guests review your facilities they'll show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                onReply={(id, current) => setReplyTarget({ id, current })}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => load(page + 1, sort, ratingFilter)}
                disabled={loading}
                className="w-full py-3 text-sm text-muted border border-border rounded-xl hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </main>

      {replyTarget && (
        <ReplyModal
          reviewId={replyTarget.id}
          initial={replyTarget.current}
          onClose={() => setReplyTarget(null)}
          onSave={handleSaveReply}
        />
      )}
    </div>
  );
}
