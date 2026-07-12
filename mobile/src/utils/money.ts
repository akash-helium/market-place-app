export function formatPaise(paise: number | null | undefined): string {
  if (paise == null) return "N/A";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
