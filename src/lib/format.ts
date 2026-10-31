// Indian number and date formats used across the app
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const num = (v: number | null | undefined, dp = 0) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: dp });

export const inr = (v: number | null | undefined, dp = 0) => (v === null || v === undefined ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

export const inrShort = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '—';
  const a = Math.abs(v);
  if (a >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  return inr(v);
};

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d.length === 10 ? d + 'T00:00:00' : d));

export const date = (d?: string | Date | null) => {
  if (!d) return '—';
  const x = toDate(d);
  return `${String(x.getDate()).padStart(2, '0')} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
};
export const dateShort = (d?: string | Date | null) => {
  if (!d) return '—';
  const x = toDate(d);
  return `${String(x.getDate()).padStart(2, '0')} ${MONTHS[x.getMonth()]}`;
};
export const dateTime = (d?: string | Date | null) => {
  if (!d) return '—';
  const x = toDate(d);
  return `${dateShort(x)} · ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};
export const ago = (d?: string | Date | null) => {
  if (!d) return '—';
  const m = (Date.now() - toDate(d).getTime()) / 60000;
  if (m < 1) return 'just now';
  if (m < 60) return Math.round(m) + ' min ago';
  if (m < 60 * 24) return Math.round(m / 60) + ' h ago';
  return Math.round(m / 1440) + ' d ago';
};
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const financialYear = () => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
export const fileSize = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};
export const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + y;
};
// Rupees in words (Indian system), for printed bills
export function rupeesInWords(amount: number) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
  const three = (n: number) => (n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
  let n = Math.round(Math.abs(amount));
  if (!n) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

/* ── Process time ──────────────────────────────────────────────────────────
 * Operation times are stored in minutes, but a shop floor talks in hours and
 * days. One day is one 8-hour shift, which is how this plant runs them.
 */
export const MIN_PER_HOUR = 60;
export const MIN_PER_DAY = 8 * 60;
export type TimeUnit = 'min' | 'h' | 'day';

export const TIME_UNITS: Array<{ value: TimeUnit; label: string; min: number }> = [
  { value: 'min', label: 'Minutes', min: 1 },
  { value: 'h', label: 'Hours', min: MIN_PER_HOUR },
  { value: 'day', label: 'Days (8 h shift)', min: MIN_PER_DAY },
];

export const toMinutes = (value: number, unit: TimeUnit) =>
  Math.round(value * (TIME_UNITS.find((u) => u.value === unit)?.min ?? 1) * 1000) / 1000;

export const fromMinutes = (minutes: number, unit: TimeUnit) =>
  Math.round((minutes / (TIME_UNITS.find((u) => u.value === unit)?.min ?? 1)) * 1000) / 1000;

/** The largest unit that states these minutes without an awkward fraction. */
export function bestUnit(...minutes: number[]): TimeUnit {
  const vals = minutes.filter((m) => m > 0);
  if (!vals.length) return 'min';
  if (vals.every((m) => m % MIN_PER_DAY === 0)) return 'day';
  if (vals.every((m) => m % MIN_PER_HOUR === 0)) return 'h';
  return 'min';
}

/** "315 min" reads as "5 h 15 min"; a full shift reads as "1 d". */
export function duration(minutes: number | null | undefined, opts: { short?: boolean } = {}): string {
  const total = Math.round((Number(minutes) || 0) * 100) / 100;
  if (total <= 0) return '—';
  if (total < 1) return `${num(total, 2)} min`;
  const d = Math.floor(total / MIN_PER_DAY);
  const h = Math.floor((total - d * MIN_PER_DAY) / MIN_PER_HOUR);
  const m = Math.round((total - d * MIN_PER_DAY - h * MIN_PER_HOUR) * 100) / 100;
  const parts: string[] = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${num(m, m % 1 ? 2 : 0)} min`);
  return (opts.short ? parts.slice(0, 2) : parts).join(' ');
}
