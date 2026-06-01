import type {
  CreateOpenGameInput,
  OpenGame,
  OpenGameFilters,
  PaginatedResponse,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class OpenGamesResource {
  constructor(private readonly fetch: Fetcher) {}

  list(filters?: OpenGameFilters): Promise<PaginatedResponse<OpenGame>> {
    return this.fetch("/open-games", { params: filters as Record<string, string> });
  }

  get(id: string): Promise<OpenGame> {
    return this.fetch(`/open-games/${id}`);
  }

  create(input: CreateOpenGameInput): Promise<OpenGame> {
    return this.fetch("/open-games", { method: "POST", body: input });
  }

  join(id: string): Promise<OpenGame> {
    return this.fetch(`/open-games/${id}/join`, { method: "POST" });
  }

  leave(id: string): Promise<void> {
    return this.fetch(`/open-games/${id}/leave`, { method: "DELETE" });
  }

  cancel(id: string): Promise<OpenGame> {
    return this.fetch(`/open-games/${id}/cancel`, { method: "PUT" });
  }
}
