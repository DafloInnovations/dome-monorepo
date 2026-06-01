export function formatDateCA(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(date));
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hours!, minutes!, 0, 0);
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatSlotTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isToday(date: Date | string): boolean {
  return new Date(date).toDateString() === new Date().toDateString();
}

export function isFuture(date: Date | string): boolean {
  return new Date(date) > new Date();
}

export function isPast(date: Date | string): boolean {
  return new Date(date) < new Date();
}

export function slotDurationLabel(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = (eh! * 60 + em!) - (sh! * 60 + sm!);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    days.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function getWeekDates(referenceDate?: Date): string[] {
  const ref = referenceDate ?? new Date();
  const day = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
}
