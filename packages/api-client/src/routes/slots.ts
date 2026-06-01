import type {
  CreateRecurringSlotInput,
  CreateSlotInput,
  Slot,
  SlotAvailability,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class SlotsResource {
  constructor(private readonly fetch: Fetcher) {}

  availability(facilityId: string, date: string): Promise<SlotAvailability> {
    return this.fetch(`/facilities/${facilityId}/slots`, { params: { date } });
  }

  get(id: string): Promise<Slot> {
    return this.fetch(`/slots/${id}`);
  }

  create(input: CreateSlotInput): Promise<Slot> {
    return this.fetch("/slots", { method: "POST", body: input });
  }

  createRecurring(input: CreateRecurringSlotInput): Promise<Slot[]> {
    return this.fetch("/slots/recurring", { method: "POST", body: input });
  }

  update(id: string, input: Partial<CreateSlotInput>): Promise<Slot> {
    return this.fetch(`/slots/${id}`, { method: "PUT", body: input });
  }

  block(id: string): Promise<Slot> {
    return this.fetch(`/slots/${id}/block`, { method: "PUT" });
  }

  delete(id: string): Promise<void> {
    return this.fetch(`/slots/${id}`, { method: "DELETE" });
  }
}
