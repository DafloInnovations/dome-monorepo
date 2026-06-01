import type {
  CreateFacilityInput,
  Facility,
  FacilityFilters,
  PaginatedResponse,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class FacilitiesResource {
  constructor(private readonly fetch: Fetcher) {}

  list(filters?: FacilityFilters): Promise<PaginatedResponse<Facility>> {
    return this.fetch("/facilities", { params: filters as Record<string, string> });
  }

  get(id: string): Promise<Facility> {
    return this.fetch(`/facilities/${id}`);
  }

  create(input: CreateFacilityInput): Promise<Facility> {
    return this.fetch("/facilities", { method: "POST", body: input });
  }

  update(id: string, input: Partial<CreateFacilityInput>): Promise<Facility> {
    return this.fetch(`/facilities/${id}`, { method: "PUT", body: input });
  }

  delete(id: string): Promise<void> {
    return this.fetch(`/facilities/${id}`, { method: "DELETE" });
  }

  myFacilities(): Promise<PaginatedResponse<Facility>> {
    return this.fetch("/facilities/mine");
  }
}
