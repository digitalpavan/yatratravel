const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatPrice(amount: number | null | undefined): string | null {
  return typeof amount === 'number' ? inr.format(amount) : null;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }): string {
  // Dates are stored as YYYY-MM-DD (a calendar day in India); format at noon UTC so the day never shifts.
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'Asia/Kolkata' }).format(new Date(`${iso}T12:00:00Z`));
}

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
