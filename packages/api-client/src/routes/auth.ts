import type { AuthTokens, LoginInput, RegisterInput, User } from "@dome/types";
import type { Fetcher } from "../fetcher";

export class AuthResource {
  constructor(private readonly fetch: Fetcher) {}

  register(input: RegisterInput): Promise<{ user: User; tokens: AuthTokens }> {
    return this.fetch("/auth/register", { method: "POST", body: input });
  }

  login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    return this.fetch("/auth/login", { method: "POST", body: input });
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.fetch("/auth/refresh", { method: "POST", body: { refreshToken } });
  }

  logout(): Promise<void> {
    return this.fetch("/auth/logout", { method: "DELETE" });
  }
}
