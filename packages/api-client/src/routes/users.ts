import type { UpdateUserInput, User } from "@dome/types";
import type { Fetcher } from "../fetcher";

export class UsersResource {
  constructor(private readonly fetch: Fetcher) {}

  me(): Promise<User> {
    return this.fetch("/users/me");
  }

  update(input: UpdateUserInput): Promise<User> {
    return this.fetch("/users/me", { method: "PUT", body: input });
  }

  delete(): Promise<void> {
    return this.fetch("/users/me", { method: "DELETE" });
  }
}
