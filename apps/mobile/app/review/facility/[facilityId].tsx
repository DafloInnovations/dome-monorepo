import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useReviews, type FacilityReview, type ReviewSummary } from "../../../src/hooks/useReviews";

const C = {
  bg: "#000000",
  surface: "#1C1C1E",
  primary: "#E85068",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const SORT_OPTS = [
  { value: "newest",  label: "Newest" },
  { value: "highest", label: "Highest" },
  { value: "lowest",  label: "Lowest" },
] as const;

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: size, color: n <= rating ? "#F59E0B" : "#3A3A3C" }}>★</Text>
      ))}
    </View>
  );
}

function DistributionBar({ dist, total }: { dist: Record<number, number>; total: number }) {
  return (
    <View style={styles.distWrap}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = dist[star] ?? 0;
        const pct = total > 0 ? count / total : 0;
        return (
          <View key={star} style={styles.distRow}>
            <Text style={styles.distStar}>{star}★</Text>
            <View style={styles.distBarBg}>
              <View style={[styles.distBarFill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={styles.distCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SubRatingPill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <View style={styles.subPill}>
      <Text style={styles.subPillLabel}>{label}</Text>
      <Text style={styles.subPillValue}>{value.toFixed(1)} ★</Text>
    </View>
  );
}

function ReviewCard({ review }: { review: FacilityReview }) {
  const [expanded, setExpanded] = useState(false);
  const longBody = (review.body?.length ?? 0) > 200;
  const displayBody = longBody && !expanded ? review.body!.slice(0, 200) + "…" : review.body;
  const dateLabel = new Date(review.booking.slot.date).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View>
          <Text style={styles.reviewerName}>
            {review.user.firstName} {review.user.lastName.charAt(0)}.
          </Text>
          <Text style={styles.reviewDate}>{dateLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Stars rating={review.rating} />
          <View style={styles.sportBadge}>
            <Text style={styles.sportBadgeText}>{review.sport.toLowerCase()}</Text>
          </View>
        </View>
      </View>

      {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
      {displayBody ? (
        <View>
          <Text style={styles.reviewBody}>{displayBody}</Text>
          {longBody && (
            <Pressable onPress={() => setExpanded((v) => !v)}>
              <Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {review.vendorReply ? (
        <View style={styles.vendorReply}>
          <Text style={styles.vendorReplyLabel}>Vendor reply</Text>
          <Text style={styles.vendorReplyText}>{review.vendorReply}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FacilityReviewsScreen() {
  const { facilityId, facilityName } = useLocalSearchParams<{
    facilityId: string;
    facilityName: string;
  }>();
  const { fetchFacilityReviews, loading } = useReviews();
  const [sort, setSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [reviews, setReviews] = useState<FacilityReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (p: number, s: typeof sort) => {
      const result = await fetchFacilityReviews(facilityId!, { page: p, limit: 10, sort: s });
      if (p === 1) {
        setReviews(result.reviews);
        setSummary(result.summary);
      } else {
        setReviews((prev) => [...prev, ...result.reviews]);
      }
      setHasMore(result.hasMore);
      setPage(p);
    },
    [facilityId, fetchFacilityReviews]
  );

  useEffect(() => { load(1, sort); }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.avgRating}>
                {summary.averageRating?.toFixed(1) ?? "—"}
              </Text>
              <View style={{ gap: 4 }}>
                <Stars rating={Math.round(summary.averageRating ?? 0)} size={18} />
                <Text style={styles.totalReviews}>{summary.totalReviews} review{summary.totalReviews !== 1 ? "s" : ""}</Text>
              </View>
            </View>
            <DistributionBar dist={summary.distribution} total={summary.totalReviews} />
            <View style={styles.subPills}>
              <SubRatingPill label="🎾 Court" value={summary.subRatings.courtQuality} />
              <SubRatingPill label="🧹 Clean" value={summary.subRatings.cleanliness} />
              <SubRatingPill label="💰 Value" value={summary.subRatings.valueForMoney} />
              <SubRatingPill label="😊 Staff" value={summary.subRatings.staffFriendly} />
            </View>
          </View>
        )}

        {/* Sort */}
        <View style={styles.sortRow}>
          {SORT_OPTS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.sortChip, sort === opt.value && styles.sortChipActive]}
              onPress={() => setSort(opt.value)}
            >
              <Text style={[styles.sortChipText, sort === opt.value && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Reviews list */}
        {loading && reviews.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
          </View>
        ) : (
          <>
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            {hasMore && (
              <Pressable
                style={styles.loadMore}
                onPress={() => load(page + 1, sort)}
                disabled={loading}
              >
                <Text style={styles.loadMoreText}>{loading ? "Loading…" : "Load more"}</Text>
              </Pressable>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  summaryCard: { backgroundColor: C.surface, margin: 16, borderRadius: 16, padding: 16, gap: 16 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avgRating: { color: C.text, fontSize: 48, fontWeight: "800" },
  totalReviews: { color: C.muted, fontSize: 13 },
  distWrap: { gap: 5 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distStar: { color: C.muted, fontSize: 12, width: 20, textAlign: "right" },
  distBarBg: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  distBarFill: { height: 6, backgroundColor: "#F59E0B", borderRadius: 3 },
  distCount: { color: C.muted, fontSize: 11, width: 24, textAlign: "right" },
  subPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subPill: {
    backgroundColor: "#2C2C2E",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  subPillLabel: { color: C.muted, fontSize: 12 },
  subPillValue: { color: "#F59E0B", fontSize: 12, fontWeight: "700" },
  sortRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: C.surface },
  sortChipActive: { backgroundColor: C.primary },
  sortChipText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  sortChipTextActive: { color: C.text },
  reviewCard: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  reviewerName: { color: C.text, fontSize: 14, fontWeight: "700" },
  reviewDate: { color: C.muted, fontSize: 12, marginTop: 2 },
  sportBadge: { backgroundColor: "#2C2C2E", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  sportBadgeText: { color: C.muted, fontSize: 10, fontWeight: "600" },
  reviewTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  reviewBody: { color: "#ABABAB", fontSize: 13, lineHeight: 19 },
  readMore: { color: C.primary, fontSize: 12, fontWeight: "600", marginTop: 4 },
  vendorReply: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.primary,
    gap: 4,
  },
  vendorReplyLabel: { color: C.primary, fontSize: 11, fontWeight: "700" },
  vendorReplyText: { color: "#ABABAB", fontSize: 13 },
  emptyText: { color: C.muted, fontSize: 14 },
  loadMore: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  loadMoreText: { color: C.muted, fontSize: 13 },
});
