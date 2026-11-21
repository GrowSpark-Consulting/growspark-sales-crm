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
  const start = localMidnight(local.year, local.month, local.day, timeZone);
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return { start, end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone) };
}

/** Half-open UTC instants spanning the organisation's local calendar month. */
export function orgMonthBounds(now: Date, timeZone: string): InstantBounds {
  const local = zonedParts(now, timeZone);
  const next = new Date(Date.UTC(local.year, local.month, 1));
  return {
    start: localMidnight(local.year, local.month, 1, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, timeZone),
  };
}
