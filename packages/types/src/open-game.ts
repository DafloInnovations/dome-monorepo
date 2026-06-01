import type { SportType } from "./facility";

export type OpenGameStatus = "open" | "full" | "cancelled" | "completed";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "any";

export interface OpenGameParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;
  paymentStatus: "paid" | "unpaid";
}

export interface OpenGame {
  id: string;
  slotId: string;
  facilityId: string;
  hostUserId: string;
  sport: SportType;
  title: string;
  description?: string;
  status: OpenGameStatus;
  skillLevel: SkillLevel;
  maxPlayers: number;
  currentPlayers: number;
  pricePerPlayerCAD: number;
  participants: OpenGameParticipant[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpenGameInput {
  slotId: string;
  facilityId: string;
  sport: SportType;
  title: string;
  description?: string;
  skillLevel: SkillLevel;
  maxPlayers: number;
  pricePerPlayerCAD: number;
  isPublic?: boolean;
}

export interface OpenGameFilters {
  sport?: SportType;
  skillLevel?: SkillLevel;
  city?: string;
  date?: string;
  hasSpace?: boolean;
  page?: number;
  limit?: number;
}
