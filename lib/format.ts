const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatPrice(amount: number | null | undefined): string | null {
  return typeof amount === 'number' ? inr.format(amount) : null;
}

// The database stores money as whole paise (₹1 = 100 paise); people type and read rupees.
export const toRupees = (paise: number | string | null | undefined): number | null => (paise === null || paise === undefined ? null : Number(paise) / 100);
export const toPaise = (rupees: number | null): number | null => (rupees === null ? null : Math.round(rupees * 100));
export const formatPaise = (paise: number | string | null | undefined) => formatPrice(toRupees(paise));

/** Reads a typed price: "2500", "2,500", "₹2,500", "Rs.2,500", "Rs 2500/-", "INR 2500" or "2500.50". Empty = on request. */
export function parseRupees(raw: string): number | null | 'invalid' {
  const s = raw.replace(/rs\.?|inr|₹|\/-|[,\s]/gi, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 'invalid';
  const n = Number(s);
  return n <= 1_000_000 ? n : 'invalid';
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }): string {
  // Dates are stored as YYYY-MM-DD (a calendar day in India); format at noon UTC so the day never shifts.
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'Asia/Kolkata' }).format(new Date(`${iso}T12:00:00Z`));
}

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
