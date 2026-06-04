import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StarRating from "../../../../components/ui/StarRating";
import { serverFetch, type Facility, type Review } from "../../../../lib/api";

interface PageProps { params: { id: string } }

interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
  distribution: Record<string, number>;
  subRatings: {
    courtQuality: number | null;
    cleanliness: number | null;
    valueForMoney: number | null;
    staffFriendly: number | null;
  };
}

interface ReviewsResponse {
  reviews: Review[];
  summary: ReviewSummary;
  total: number;
  hasMore: boolean;
}

async function getFacilityName(id: string): Promise<string | null> {
  try {
    const res = await serverFetch<{ data: Facility }>(`/facilities/${id}`);
    return res.data.name;
  } catch { return null; }
}

async function getReviews(id: string, sort = "newest", page = 1): Promise<ReviewsResponse | null> {
  try {
    const qs = new URLSearchParams({ sort, page: String(page), limit: "20" });
    const res = await serverFetch<{ data: ReviewsResponse }>(`/reviews/facility/${id}?${qs}`);
    return res.data;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const name = await getFacilityName(params.id);
  return { title: name ? `Reviews — ${name}` : "Reviews" };
}

function DistributionBar({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-xs">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = dist[star] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="text-muted w-5 text-right">{star}★</span>
            <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-2 bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-muted w-6 text-right text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = review.booking?.slot.date
    ? new Date(review.booking.slot.date).toLocaleDateString("en-CA", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="bg-surface border border-[#1e1e1e] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {review.user.firstName} {review.user.lastName.charAt(0)}.
          </p>
          {date && <p className="text-xs text-muted mt-0.5">{date}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StarRating rating={review.rating} />
          <span className="text-[10px] text-muted bg-[#222] rounded-full px-2 py-0.5">
            {review.sport.toLowerCase()}
          </span>
        </div>
      </div>

      {review.title && (
        <p className="text-sm font-semibold text-white">{review.title}</p>
      )}
      {review.body && (
        <p className="text-sm text-[#aaa] leading-relaxed">{review.body}</p>
      )}

      {(review.courtQuality || review.cleanliness || review.valueForMoney || review.staffFriendly) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {review.courtQuality != null && (
            <span className="text-xs text-muted">🎾 Court <span className="text-amber-400 font-semibold">{review.courtQuality}★</span></span>
          )}
          {review.cleanliness != null && (
            <span className="text-xs text-muted">🧹 Clean <span className="text-amber-400 font-semibold">{review.cleanliness}★</span></span>
          )}
          {review.valueForMoney != null && (
            <span className="text-xs text-muted">💰 Value <span className="text-amber-400 font-semibold">{review.valueForMoney}★</span></span>
          )}
          {review.staffFriendly != null && (
            <span className="text-xs text-muted">😊 Staff <span className="text-amber-400 font-semibold">{review.staffFriendly}★</span></span>
          )}
        </div>
      )}

      {review.vendorReply && (
        <div className="bg-[#111] border-l-2 border-primary rounded-lg px-4 py-3 mt-1">
          <p className="text-xs font-bold text-primary mb-1">Vendor reply</p>
          <p className="text-sm text-[#aaa]">{review.vendorReply}</p>
        </div>
      )}
    </div>
  );
}

export default async function FacilityReviewsPage({ params }: PageProps) {
  const [facilityName, reviewsData] = await Promise.all([
    getFacilityName(params.id),
    getReviews(params.id),
  ]);

  if (!facilityName) notFound();

  const summary = reviewsData?.summary;
  const reviews = reviewsData?.reviews ?? [];

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Back */}
        <Link
          href={`/facilities/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-6 transition-colors"
        >
          ← Back to {facilityName}
        </Link>

        <h1 className="text-2xl font-black mb-8">
          Reviews
          <span className="text-muted font-normal text-lg ml-2">— {facilityName}</span>
        </h1>

        {/* Summary */}
        {summary && summary.totalReviews > 0 ? (
          <div className="bg-surface border border-[#1e1e1e] rounded-2xl p-6 mb-8 flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center justify-center gap-1 shrink-0">
              <span className="text-6xl font-black text-white leading-none">
                {summary.averageRating?.toFixed(1) ?? "—"}
              </span>
              <StarRating rating={Math.round(summary.averageRating ?? 0)} size="md" />
              <span className="text-sm text-muted mt-1">
                {summary.totalReviews} review{summary.totalReviews !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <DistributionBar dist={summary.distribution} total={summary.totalReviews} />
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {summary.subRatings.courtQuality != null && (
                  <span className="text-muted">🎾 Court <span className="text-amber-400 font-semibold">{summary.subRatings.courtQuality.toFixed(1)}</span></span>
                )}
                {summary.subRatings.cleanliness != null && (
                  <span className="text-muted">🧹 Clean <span className="text-amber-400 font-semibold">{summary.subRatings.cleanliness.toFixed(1)}</span></span>
                )}
                {summary.subRatings.valueForMoney != null && (
                  <span className="text-muted">💰 Value <span className="text-amber-400 font-semibold">{summary.subRatings.valueForMoney.toFixed(1)}</span></span>
                )}
                {summary.subRatings.staffFriendly != null && (
                  <span className="text-muted">😊 Staff <span className="text-amber-400 font-semibold">{summary.subRatings.staffFriendly.toFixed(1)}</span></span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-[#1e1e1e] rounded-2xl p-8 mb-8 text-center text-muted">
            No reviews yet. Be the first to review this facility!
          </div>
        )}

        {/* Review list */}
        {reviews.length > 0 && (
          <div className="flex flex-col gap-4">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
