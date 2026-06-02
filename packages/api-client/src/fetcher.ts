/// <reference lib="dom" />
import type { ApiError, ApiResponse } from "@dome/types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestConfig<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

export class DomeApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "DomeApiError";
    this.status = error.status;
    this.code = error.code;
    this.errors = error.errors;
  }
}

export type TokenProvider = () => string | null | Promise<string | null>;

export function createFetcher(baseUrl: string, getToken: TokenProvider) {
  return async function fetcher<T>(
    path: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const token = await getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...config.headers,
    };

    let url = `${baseUrl}${path}`;
    if (config.params) {
      const qs = Object.entries(config.params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      method: config.method ?? "GET",
      headers,
      body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      const errorBody: ApiError = await response
        .json()
        .catch(() => ({ message: "Unknown error", status: response.status }));
      throw new DomeApiError({ ...errorBody, status: response.status });
    }

    const json: ApiResponse<T> = await response.json();
    return json.data;
  };
}

export type Fetcher = ReturnType<typeof createFetcher>;
