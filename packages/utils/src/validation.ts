export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidCanadianPostalCode(code: string): boolean {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(code.trim());
}

export function formatPostalCode(code: string): string {
  const clean = code.replace(/[\s-]/g, "").toUpperCase();
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}

export function isValidCanadianPhone(phone: string): boolean {
  return /^(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(phone.trim());
}

export function formatCanadianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidBusinessNumber(bn: string): boolean {
  return /^\d{9}$/.test(bn.replace(/[\s-]/g, ""));
}

export function isValidGSTHSTNumber(number: string): boolean {
  const clean = number.replace(/[\s-]/g, "");
  return /^\d{9}RT\d{4}$/i.test(clean);
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function passwordStrength(password: string): "weak" | "fair" | "strong" {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
  if (score <= 2) return "weak";
  if (score <= 4) return "fair";
  return "strong";
}

export function isValidSlotTime(startTime: string, endTime: string): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h! * 60 + m!;
  };
  return toMinutes(startTime) < toMinutes(endTime);
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
