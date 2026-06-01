export type MessageType = "text" | "image" | "system";
export type ConversationContext = "booking" | "open-game" | "support";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  context: ConversationContext;
  bookingId?: string;
  openGameId?: string;
  participantIds: string[];
  title?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  type?: MessageType;
}

export interface CreateConversationInput {
  context: ConversationContext;
  participantIds: string[];
  bookingId?: string;
  openGameId?: string;
  title?: string;
}
