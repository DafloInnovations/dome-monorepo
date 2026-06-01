export * from "./booking";
export * from "./chat-message";
export * from "./facility";
export * from "./open-game";
export * from "./payment";
export * from "./review";
export * from "./slot";
export * from "./user";
export * from "./vendor";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  errors?: Record<string, string[]>;
}
