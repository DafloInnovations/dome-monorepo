"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "../../../components/layout/Header";
import { apiFetch, type AdminReview, type AdminReviewsResponse } from "../../../lib/api";

const PAGE_SIZE = 20;

const FILTER_OPTS = [
  { value: "all",     label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "hidden",  label: "Hidden" },
] as const;

const RATING_OPTS = ["All", "5", "4", "3", "2", "1"] as const;

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tight">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function FlagBadge({ flaggedAt, flagReason }: { flaggedAt: string | null; flagReason: string | null }) {
  if (!flaggedAt) return null;
  return (
    <span
      title={flagReason ?? undefined}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 rounded-full px-2 py-0.5"
    >
      🚩 Flagged
    </span>
  );
}

function ReviewRow({
  review,
  onToggleVisibility,
}: {
  review: AdminReview;
  onToggleVisibility: (id: string, current: boolean) => void;
}) {
  const date = new Date(review.createdAt).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <tr className="border-t border-[#1a1a1a] hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm text-white font-medium">
          {review.user.firstName} {review.user.lastName.charAt(0)}.
        </p>
        <p className="text-xs text-muted mt-0.5">{date}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-white">{review.facility.name}</p>
        <span className="text-[10px] text-muted bg-[#1a1a1a] rounded-full px-2 py-0.5">
          {review.sport.toLowerCase()}
        </span>
      </td>
      <td className="px-4 py-3">
        <StarDisplay rating={review.rating} />
      </td>
      <td className="px-4 py-3 max-w-xs">
        {review.title && (
          <p className="text-xs font-semibold text-white mb-0.5">{review.title}</p>
        )}
        {review.body && (
          <p className="text-xs text-muted line-clamp-2">{review.body}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <FlagBadge flaggedAt={review.flaggedAt} flagReason={review.flagReason} />
          {!review.isVisible && (
            <span className="inline-flex items-center text-[10px] font-semibold text-orange-400 bg-orange-400/10 rounded-full px-2 py-0.5">
              Hidden
            </span>
          )}
          {review.isVerified && (
            <span className="inline-flex items-center text-[10px] font-semibold text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">
              Verified
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleVisibility(review.id, review.isVisible)}
          className={`text-xs font-medium px-3 py-1.5 rounded-dome border transition-colors ${
            review.isVisible
              ? "border-orange-400/40 text-orange-400 hover:bg-orange-400/10"
              : "border-green-400/40 text-green-400 hover:bg-green-400/10"
          }`}
        >
          {review.isVisible ? "Hide" : "Unhide"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "flagged" | "hidden">("all");
  const [ratingFilter, setRatingFilter] = useState<string>("All");

  const load = useCallback(async (p: number, f: string, r: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (f === "flagged") params.set("flagged", "true");
      if (r !== "All") params.set("rating", r);

      const res = await apiFetch<{ data: AdminReviewsResponse }>(`/reviews/admin?${params}`);
      const d = res.data;
      let filtered = d.reviews;
      if (f === "hidden") filtered = filtered.filter((rev) => !rev.isVisible);
      if (p === 1) setReviews(filtered);
      else setReviews((prev) => [...prev, ...filtered]);
      setTotal(d.total);
      setHasMore(d.hasMore);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, filter, ratingFilter); }, [filter, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleVisibility(reviewId: string, current: boolean) {
    try {
      await apiFetch(`/reviews/${reviewId}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible: !current }),
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, isVisible: !current, flaggedAt: null, flagReason: null } : r))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update visibility");
    }
  }

  const flaggedCount = reviews.filter((r) => r.flaggedAt).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Reviews" />
      <main className="flex-1 px-6 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-sidebar border border-[#1a1a1a] rounded-xl p-4">
            <p className="text-2xl font-black text-white">{total}</p>
            <p className="text-xs text-muted mt-0.5">Total reviews</p>
          </div>
          <div className="bg-sidebar border border-[#1a1a1a] rounded-xl p-4">
            <p className="text-2xl font-black text-red-400">{flaggedCount}</p>
            <p className="text-xs text-muted mt-0.5">Flagged (this page)</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex gap-1">
            {FILTER_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-dome transition-colors ${
                  filter === opt.value
                    ? "bg-primary text-white"
                    : "bg-sidebar border border-[#1a1a1a] text-muted hover:text-white"
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
                  ratingFilter === r
                    ? "bg-primary text-white"
                    : "bg-sidebar border border-[#1a1a1a] text-muted hover:text-white"
                }`}
              >
                {r === "All" ? "All" : `${r}★`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading && reviews.length === 0 ? (
          <p className="text-muted text-sm py-12 text-center">Loading reviews…</p>
        ) : error ? (
          <p className="text-red-400 text-sm py-8 text-center">{error}</p>
        ) : reviews.length === 0 ? (
          <p className="text-muted text-sm py-12 text-center">No reviews found.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
              <table className="w-full text-left bg-sidebar">
                <thead>
                  <tr className="text-xs text-muted border-b border-[#1a1a1a]">
                    <th className="px-4 py-3 font-semibold">Reviewer</th>
                    <th className="px-4 py-3 font-semibold">Facility</th>
                    <th className="px-4 py-3 font-semibold">Rating</th>
                    <th className="px-4 py-3 font-semibold">Content</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <ReviewRow
                      key={r.id}
                      review={r}
                      onToggleVisibility={toggleVisibility}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <button
                onClick={() => load(page + 1, filter, ratingFilter)}
                disabled={loading}
                className="mt-4 w-full py-3 text-sm text-muted border border-[#1a1a1a] rounded-xl hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
