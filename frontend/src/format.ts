const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const shortDateWithYear = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const clockTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function timeAgo(iso: string): string {
  const elapsed = Date.now() - Date.parse(iso);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return relative.format(-Math.round(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.round(elapsed / HOUR), 'hour');
  if (elapsed < 7 * DAY) return relative.format(-Math.round(elapsed / DAY), 'day');
  return formatDate(iso);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const format = date.getFullYear() === new Date().getFullYear() ? shortDate : shortDateWithYear;
  return format.format(date);
}

export function formatTime(iso: string): string {
  return clockTime.format(new Date(iso));
}

export function formatLongDay(iso: string): string {
  return longDay.format(new Date(iso));
}

export function dayAndTime(iso: string): string {
  const date = new Date(iso);
  const days = calendarDaysAgo(date);
  const day = days === 0 ? 'today' : days === 1 ? 'yesterday' : `on ${formatDate(iso)}`;
  return `${day} at ${clockTime.format(date)}`;
}

export function count(amount: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${amount.toLocaleString()} ${amount === 1 ? noun : pluralNoun}`;
}

function calendarDaysAgo(date: Date): number {
  const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
}
