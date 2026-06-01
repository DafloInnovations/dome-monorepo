import type {
  CreateReviewInput,
  PaginatedResponse,
  Review,
  ReviewSummary,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class ReviewsResource {
  constructor(private readonly fetch: Fetcher) {}

  forFacility(
    facilityId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Review>> {
    return this.fetch(`/reviews/facility/${facilityId}`, { params });
  }

  summary(facilityId: string): Promise<ReviewSummary> {
    return this.fetch(`/reviews/facility/${facilityId}/summary`);
  }

  create(input: CreateReviewInput): Promise<Review> {
    return this.fetch("/reviews", { method: "POST", body: input });
  }

  replyAsVendor(id: string, reply: string): Promise<Review> {
    return this.fetch(`/reviews/${id}/reply`, { method: "PUT", body: { reply } });
  }

  delete(id: string): Promise<void> {
    return this.fetch(`/reviews/${id}`, { method: "DELETE" });
  }
}
