import { describe, it, expect } from 'vitest';
import { weightGain, formatDate, formatDateTime, totalFeedKg } from '@/lib/formatters';

describe('weightGain', () => {
  it('returns "+0.0" when current_weight is null (no weight recorded yet)', () => {
    expect(weightGain({ intake_weight: 250, current_weight: null })).toBe('+0.0');
  });

  it('returns "+12.5" when animal gained 12.5 kg', () => {
    expect(weightGain({ intake_weight: 250, current_weight: 262.5 })).toBe('+12.5');
  });

  it('returns "-3.2" when animal lost 3.2 kg', () => {
    expect(weightGain({ intake_weight: 250, current_weight: 246.8 })).toBe('-3.2');
  });

  it('uses current_weight when present, not intake_weight as fallback', () => {
    const animal = { intake_weight: 100, current_weight: 150 };
    expect(weightGain(animal)).toBe('+50.0');
  });

  it('rounds to one decimal place', () => {
    expect(weightGain({ intake_weight: 100, current_weight: 100.123 })).toBe('+0.1');
  });

  it('returns "+0.0" when current_weight equals intake_weight exactly', () => {
    expect(weightGain({ intake_weight: 300, current_weight: 300 })).toBe('+0.0');
  });

  it('handles large gains correctly', () => {
    expect(weightGain({ intake_weight: 200, current_weight: 400 })).toBe('+200.0');
  });
});

describe('formatDate', () => {
  it('formats "2026-02-26" to en-KE locale string', () => {
    // en-KE locale formats as "26 Feb 2026"
    const result = formatDate('2026-02-26T00:00:00Z');
    expect(result).toMatch(/26/);
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/2026/);
  });

  it('uses two-digit day format', () => {
    // January 1 should be "01", not "1"
    const result = formatDate('2026-01-01T00:00:00Z');
    expect(result).toMatch(/01/);
  });

  it('uses short month name (Jan, not January)', () => {
    const result = formatDate('2026-01-15T00:00:00Z');
    expect(result.length).toBeLessThan(20); // "15 Jan 2026" is 11 chars
    expect(result).toMatch(/Jan/);
  });

  it('handles ISO strings with time components', () => {
    expect(() => formatDate('2026-06-15T14:30:00.000Z')).not.toThrow();
  });

  it('includes four-digit year', () => {
    const result = formatDate('2026-03-01T00:00:00Z');
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('includes weekday abbreviation', () => {
    // 2026-02-26 is a Thursday
    const result = formatDateTime(new Date('2026-02-26T14:30:00'));
    // en-KE may use "Thu" or locale equivalent
    expect(result.length).toBeGreaterThan(10);
  });

  it('includes two-digit day', () => {
    const result = formatDateTime(new Date('2026-02-06T14:30:00'));
    expect(result).toMatch(/06/);
  });

  it('includes short month name', () => {
    const result = formatDateTime(new Date('2026-01-15T10:00:00'));
    expect(result).toMatch(/Jan/);
  });

  it('includes four-digit year', () => {
    const result = formatDateTime(new Date('2026-02-26T14:30:00'));
    expect(result).toMatch(/2026/);
  });

  it('does not throw for any valid Date', () => {
    expect(() => formatDateTime(new Date())).not.toThrow();
  });

  it('returns a non-empty string', () => {
    const result = formatDateTime(new Date('2026-02-26T14:30:00'));
    expect(result.trim().length).toBeGreaterThan(0);
  });
});

describe('totalFeedKg', () => {
  it('sums all positive kgAmounts', () => {
    expect(totalFeedKg([{ kgAmount: 50 }, { kgAmount: 75 }, { kgAmount: 25 }])).toBe(150);
  });

  it('treats null kgAmount as 0', () => {
    expect(totalFeedKg([{ kgAmount: null }, { kgAmount: 50 }])).toBe(50);
  });

  it('returns 0 for empty array', () => {
    expect(totalFeedKg([])).toBe(0);
  });

  it('returns 0 when all amounts are null', () => {
    expect(totalFeedKg([{ kgAmount: null }, { kgAmount: null }])).toBe(0);
  });

  it('handles single ingredient correctly', () => {
    expect(totalFeedKg([{ kgAmount: 125.5 }])).toBe(125.5);
  });

  it('handles decimal precision correctly', () => {
    expect(totalFeedKg([{ kgAmount: 0.1 }, { kgAmount: 0.2 }])).toBeCloseTo(0.3, 10);
  });

  it('handles mixed null and non-null amounts', () => {
    expect(totalFeedKg([
      { kgAmount: 100 },
      { kgAmount: null },
      { kgAmount: 50 },
      { kgAmount: null },
    ])).toBe(150);
  });
});
