import type {
  ChatMessage,
  Conversation,
  CreateConversationInput,
  PaginatedResponse,
  SendMessageInput,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class ChatResource {
  constructor(private readonly fetch: Fetcher) {}

  conversations(): Promise<PaginatedResponse<Conversation>> {
    return this.fetch("/chat/conversations");
  }

  conversation(id: string): Promise<Conversation> {
    return this.fetch(`/chat/conversations/${id}`);
  }

  createConversation(input: CreateConversationInput): Promise<Conversation> {
    return this.fetch("/chat/conversations", { method: "POST", body: input });
  }

  messages(
    conversationId: string,
    params?: { cursor?: string; limit?: number }
  ): Promise<{ messages: ChatMessage[]; nextCursor?: string }> {
    return this.fetch(`/chat/conversations/${conversationId}/messages`, { params });
  }

  send(input: SendMessageInput): Promise<ChatMessage> {
    return this.fetch(`/chat/conversations/${input.conversationId}/messages`, {
      method: "POST",
      body: { content: input.content, type: input.type },
    });
  }

  markRead(conversationId: string): Promise<void> {
    return this.fetch(`/chat/conversations/${conversationId}/read`, { method: "PUT" });
  }
}
