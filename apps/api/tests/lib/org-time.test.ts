import { describe, expect, it } from 'vitest';
import { orgDayBounds, orgMonthBounds } from '../../src/lib/org-time.js';

describe('organisation time bounds', () => {
  it('changes the Asia/Kolkata day exactly at local midnight', () => {
    const before = orgDayBounds(new Date('2026-11-21T18:00:00.000Z'), 'Asia/Kolkata'); // 23:30 IST
    const after = orgDayBounds(new Date('2026-11-21T19:00:00.000Z'), 'Asia/Kolkata'); // 00:30 IST next day
    expect(before.start.toISOString()).toBe('2026-11-20T18:30:00.000Z');
    expect(before.end.toISOString()).toBe('2026-11-21T18:30:00.000Z');
    expect(after.start.toISOString()).toBe('2026-11-21T18:30:00.000Z');
  });

  it('returns the local calendar month as half-open UTC bounds', () => {
    const bounds = orgMonthBounds(new Date('2026-11-21T12:00:00.000Z'), 'Asia/Kolkata');
    expect(bounds.start.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });
});
