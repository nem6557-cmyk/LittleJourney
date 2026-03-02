import {
  formatTime,
  formatDateShort,
  getRelativeTime,
  getActivityIcon,
  getActivityEmoji,
  getMoodEmoji,
  getChildAge,
} from '../utils/helpers';

// ============================================================
// formatTime
// ============================================================

describe('formatTime', () => {
  it('formats morning time', () => {
    // 9:05 AM UTC — result depends on local TZ, but format should match H:MM AM/PM
    const result = formatTime('2026-03-01T09:05:00Z');
    expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it('formats a known local time correctly', () => {
    // Create a date at exactly 2:30 PM local time
    const d = new Date(2026, 2, 1, 14, 30, 0); // March 1, 2026, 2:30 PM local
    const result = formatTime(d.toISOString());
    expect(result).toBe('2:30 PM');
  });

  it('formats a known local midnight correctly', () => {
    const d = new Date(2026, 2, 1, 0, 0, 0); // March 1, 2026, 12:00 AM local
    const result = formatTime(d.toISOString());
    expect(result).toBe('12:00 AM');
  });
});

// ============================================================
// formatDateShort
// ============================================================

describe('formatDateShort', () => {
  it('formats a date to short form', () => {
    // Use a local date to avoid timezone shift
    const d = new Date(2026, 2, 15); // March 15, 2026 local
    const result = formatDateShort(d.toISOString());
    expect(result).toMatch(/Mar\s+15/);
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateShort('not-a-date')).toBe('');
  });
});

// ============================================================
// getRelativeTime
// ============================================================

describe('getRelativeTime', () => {
  it('returns "Just now" for future dates', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(getRelativeTime(future)).toBe('Just now');
  });

  it('returns "Just now" for <1 minute ago', () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    expect(getRelativeTime(recent)).toBe('Just now');
  });

  it('returns minutes ago for <1 hour', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(getRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for <24 hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(getRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('falls back to short date for >24 hours', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();
    const result = getRelativeTime(twoDaysAgo);
    // Should be a short date like "Feb 27" not "48h ago"
    expect(result).not.toContain('h ago');
    expect(result).not.toContain('m ago');
  });
});

// ============================================================
// getActivityIcon
// ============================================================

describe('getActivityIcon', () => {
  it('maps known types to icons', () => {
    expect(getActivityIcon('meal')).toBe('restaurant');
    expect(getActivityIcon('nap')).toBe('bed');
    expect(getActivityIcon('photo')).toBe('camera');
    expect(getActivityIcon('incident')).toBe('alert-circle');
  });

  it('returns fallback for unknown type', () => {
    expect(getActivityIcon('unknown')).toBe('circle');
  });
});

// ============================================================
// getActivityEmoji
// ============================================================

describe('getActivityEmoji', () => {
  it('maps known types to emojis', () => {
    expect(getActivityEmoji('meal')).toBeTruthy();
    expect(getActivityEmoji('checkin')).toBeTruthy();
  });

  it('returns fallback for unknown type', () => {
    expect(getActivityEmoji('xyz')).toBeTruthy();
  });
});

// ============================================================
// getMoodEmoji
// ============================================================

describe('getMoodEmoji', () => {
  it('returns emoji for known moods', () => {
    expect(getMoodEmoji('happy')).toBeTruthy();
    expect(getMoodEmoji('fussy')).toBeTruthy();
  });

  it('returns empty string for undefined', () => {
    expect(getMoodEmoji(undefined)).toBe('');
  });

  it('returns fallback for unknown mood', () => {
    expect(getMoodEmoji('angry')).toBeTruthy();
  });
});

// ============================================================
// getChildAge
// ============================================================

describe('getChildAge', () => {
  it('returns months for infants under 1 year', () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dob = sixMonthsAgo.toISOString().split('T')[0];
    expect(getChildAge(dob)).toMatch(/\d+ months/);
  });

  it('returns years and months for older children', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 3);
    const dob = twoYearsAgo.toISOString().split('T')[0];
    const result = getChildAge(dob);
    expect(result).toMatch(/\d+y \d+m/);
  });

  it('returns "Unknown" for invalid date', () => {
    expect(getChildAge('not-a-date')).toBe('Unknown');
  });

  it('returns "Not born yet" for future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(getChildAge(future.toISOString().split('T')[0])).toBe('Not born yet');
  });

  it('returns exact years when months are 0', () => {
    const exactlyTwoYears = new Date();
    exactlyTwoYears.setFullYear(exactlyTwoYears.getFullYear() - 2);
    const dob = exactlyTwoYears.toISOString().split('T')[0];
    expect(getChildAge(dob)).toMatch(/2 years?/);
  });
});
