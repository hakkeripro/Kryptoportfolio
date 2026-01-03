export function nowISO(date = new Date()): string {
  return date.toISOString();
}

export function isValidISO(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toISOString() === iso;
}
