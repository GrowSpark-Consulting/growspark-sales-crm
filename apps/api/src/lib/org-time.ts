export interface InstantBounds {
  start: Date;
  end: Date;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') };
}

function localDateTimeToUtc(parts: DateParts, timeZone: string): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += target - represented;
  }
  return new Date(guess);
}

function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  return localDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** Half-open UTC instants spanning the organisation's local calendar day. */
export function orgDayBounds(now: Date, timeZone: string): InstantBounds {
  const local = zonedParts(now, timeZone);
  return orgCalendarDayBounds(local.year, local.month, local.day, timeZone);
}

export function orgCalendarDayBounds(year: number, month: number, day: number, timeZone: string): InstantBounds {
  const normalized = new Date(Date.UTC(year, month - 1, day));
  const next = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), normalized.getUTCDate() + 1));
  return {
    start: localMidnight(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, normalized.getUTCDate(), timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  };
}

export function orgDateBounds(date: string, timeZone: string): InstantBounds {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError('Expected an ISO calendar date');
  return orgCalendarDayBounds(Number(match[1]), Number(match[2]), Number(match[3]), timeZone);
}

export function addOrgDays(date: Date, days: number, timeZone: string): Date {
  const local = zonedParts(date, timeZone);
  const target = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return localMidnight(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), timeZone);
}

export function orgDateKey(date: Date, timeZone: string): string {
  const local = zonedParts(date, timeZone);
  return `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

/** Half-open UTC instants spanning the organisation's local calendar month. */
export function orgMonthBounds(now: Date, timeZone: string): InstantBounds {
  const local = zonedParts(now, timeZone);
  return orgCalendarMonthBounds(local.year, local.month, timeZone);
}

export function orgCalendarMonthBounds(year: number, month: number, timeZone: string): InstantBounds {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 1));
  return {
    start: localMidnight(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 1, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, timeZone),
  };
}
