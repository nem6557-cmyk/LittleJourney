import {
  parseDollarsToCents, formatCents, daysUntil, effectiveInvoiceStatus,
  summarizeSubscription, canPurchaseSubscriptionHere, MAX_INVOICE_CENTS,
} from '../lib/billing';

describe('parseDollarsToCents', () => {
  it.each([
    ['45', 4500], ['45.5', 4550], ['45.05', 4505], ['$1,250.50', 125050],
    [' 0.99 ', 99], ['1000000', 100_000_000],
  ])('parses %s -> %d', (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it('avoids floating point drift (19.99, 0.07, 1.15 are exact)', () => {
    expect(parseDollarsToCents('19.99')).toBe(1999);
    expect(parseDollarsToCents('0.07')).toBe(7);
    expect(parseDollarsToCents('1.15')).toBe(115);
  });

  it.each(['', 'abc', '-5', '0', '0.00', '1.234', '1e3', '1,2,3.4x', '1000000.01', '12.', '.5', '$$5'])(
    'rejects %p',
    (input) => { expect(parseDollarsToCents(input)).toBeNull(); },
  );

  it('rejects amounts above the DB maximum', () => {
    expect(parseDollarsToCents('1000000.01')).toBeNull();
    expect(MAX_INVOICE_CENTS).toBe(100_000_000);
  });
});

describe('formatCents', () => {
  it('formats with grouping and two decimals', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(100_000_000)).toBe('$1,000,000.00');
    expect(formatCents(-250)).toBe('-$2.50');
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-06-01T12:00:00Z').getTime();
  it('rounds partial days up and never goes negative', () => {
    expect(daysUntil('2026-06-02T00:00:00Z', now)).toBe(1);
    expect(daysUntil('2026-06-08T12:00:00Z', now)).toBe(7);
    expect(daysUntil('2026-05-01T00:00:00Z', now)).toBe(0);
  });
  it('handles missing/invalid dates', () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('nope', now)).toBeNull();
  });
});

describe('effectiveInvoiceStatus', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  it('flags pending invoices past their due date as overdue', () => {
    expect(effectiveInvoiceStatus('pending', '2026-06-14', now)).toBe('overdue');
  });
  it('keeps pending invoices due today or later as pending', () => {
    expect(effectiveInvoiceStatus('pending', '2026-06-15', now)).toBe('pending');
    expect(effectiveInvoiceStatus('pending', '2026-07-01', now)).toBe('pending');
  });
  it('never changes paid / void / draft', () => {
    expect(effectiveInvoiceStatus('paid', '2020-01-01', now)).toBe('paid');
    expect(effectiveInvoiceStatus('void', '2020-01-01', now)).toBe('void');
    expect(effectiveInvoiceStatus('draft', '2020-01-01', now)).toBe('draft');
  });
});

describe('summarizeSubscription', () => {
  const now = new Date('2026-06-01T00:00:00Z').getTime();
  it('prompts for a plan when there is none', () => {
    expect(summarizeSubscription(null, now).needsPlan).toBe(true);
  });
  it('shows trial days left and warns near the end', () => {
    const s = summarizeSubscription({ status: 'trialing', plan: 'starter', trialEnd: '2026-06-11T00:00:00Z' }, now);
    expect(s.headline).toBe('Free trial — 10 days left');
    expect(s.tone).toBe('good');
    const w = summarizeSubscription({ status: 'trialing', plan: 'starter', trialEnd: '2026-06-03T00:00:00Z' }, now);
    expect(w.tone).toBe('warn');
  });
  it('treats an expired trial as needing a plan', () => {
    const s = summarizeSubscription({ status: 'trialing', plan: 'starter', trialEnd: '2026-05-01T00:00:00Z' }, now);
    expect(s.needsPlan).toBe(true);
    expect(s.tone).toBe('bad');
  });
  it('reports active, past_due and canceled states', () => {
    expect(summarizeSubscription({ status: 'active', plan: 'professional', trialEnd: '2026-06-30T00:00:00Z' }, now).headline).toBe('Professional plan');
    expect(summarizeSubscription({ status: 'past_due', plan: 'starter', trialEnd: null }, now).tone).toBe('bad');
    expect(summarizeSubscription({ status: 'canceled', plan: 'starter', trialEnd: null }, now).needsPlan).toBe(true);
  });
});

describe('canPurchaseSubscriptionHere', () => {
  it('only allows web purchases (store billing policy)', () => {
    expect(canPurchaseSubscriptionHere('web')).toBe(true);
    expect(canPurchaseSubscriptionHere('ios')).toBe(false);
    expect(canPurchaseSubscriptionHere('android')).toBe(false);
  });
});
