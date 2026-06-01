export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  bookingId: string;
  facilityId: string;
  userId: string;
  rating: ReviewRating;
  comment?: string;
  isVerified: boolean;
  vendorReply?: string;
  vendorRepliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewInput {
  bookingId: string;
  facilityId: string;
  rating: ReviewRating;
  comment?: string;
}

export interface ReviewSummary {
  facilityId: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<ReviewRating, number>;
}
