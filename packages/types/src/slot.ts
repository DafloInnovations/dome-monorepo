export type SlotStatus = "available" | "booked" | "blocked" | "open-game";

export interface Slot {
  id: string;
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCAD: number;
  status: SlotStatus;
  recurrenceGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlotInput {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
  priceCAD: number;
}

export interface CreateRecurringSlotInput extends CreateSlotInput {
  repeatUntil: string;
  repeatDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
}

export interface SlotAvailability {
  facilityId: string;
  date: string;
  slots: Slot[];
}
