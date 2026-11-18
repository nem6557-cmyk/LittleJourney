/**
 * Pure billing helpers (no React / network) so the money and date logic that
 * the Billing screens rely on is unit-tested.
 */

export const MAX_INVOICE_CENTS = 100_000_000; // $1,000,000.00 — matches the DB trigger

/**
 * Parse a user-typed dollar amount ("1,250.50", "$45", "45.5") into integer
 * cents WITHOUT floating-point arithmetic. Returns null when invalid, zero,
 * negative, has more than 2 decimals, or exceeds the maximum.
 */
export function parseDollarsToCents(input: string): number | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/^\$/, '').split(',').join('');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const cents = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const total = dollars * 100 + cents;
  if (total <= 0 || total > MAX_INVOICE_CENTS) return null;
  return total;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString();
  let grouped = '';
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) grouped += ',';
    grouped += whole[i];
  }
  return `${sign}$${grouped}.${(abs % 100).toString().padStart(2, '0')}`;
}

/** Whole days remaining until `iso` (rounded up, never negative). null if no date. */
export function daysUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - now) / 86_400_000));
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'void';

/** A pending invoice whose due date has passed is overdue, whatever the DB says. */
export function effectiveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string,
  now: Date = new Date(),
): InvoiceStatus {
  if (status !== 'pending') return status;
  const today = now.toISOString().slice(0, 10);
  return dueDate < today ? 'overdue' : 'pending';
}

export interface SubscriptionSummary {
  headline: string;
  detail: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  /** true when the daycare should be prompted to subscribe */
  needsPlan: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  trial: 'Free trial',
};

export function summarizeSubscription(
  sub: { status: string; plan: string | null; trialEnd: string | null } | null,
  now: number = Date.now(),
): SubscriptionSummary {
  if (!sub) {
    return {
      headline: 'No plan yet',
      detail: 'Choose a plan to keep using Little Journey after your trial.',
      tone: 'neutral',
      needsPlan: true,
    };
  }
  const plan = PLAN_NAMES[sub.plan ?? ''] ?? 'Your plan';
  const days = daysUntil(sub.trialEnd, now);

  switch (sub.status) {
    case 'trialing':
      if (days === 0) {
        return { headline: 'Free trial ended', detail: 'Subscribe to continue using Little Journey.', tone: 'bad', needsPlan: true };
      }
      return {
        headline: `Free trial — ${days ?? '?'} day${days === 1 ? '' : 's'} left`,
        detail: `${plan} plan. You won't be charged until the trial ends.`,
        tone: days !== null && days <= 3 ? 'warn' : 'good',
        needsPlan: false,
      };
    case 'active':
      return {
        headline: `${plan} plan`,
        detail: days !== null ? `Renews in ${days} day${days === 1 ? '' : 's'}.` : 'Active.',
        tone: 'good',
        needsPlan: false,
      };
    case 'past_due':
      return { headline: 'Payment failed', detail: 'Update your card to keep your subscription active.', tone: 'bad', needsPlan: false };
    case 'canceled':
      return { headline: 'Subscription canceled', detail: 'Choose a plan to reactivate.', tone: 'bad', needsPlan: true };
    default:
      return { headline: plan, detail: sub.status, tone: 'neutral', needsPlan: false };
  }
}

/**
 * Apple (guideline 3.1.1) and Google Play require their own billing for digital
 * subscriptions sold inside a native app. Daycare plans are therefore only
 * purchasable on the web; native apps show status and direct admins to the web
 * dashboard (no in-app purchase UI and no external-payment link).
 */
export function canPurchaseSubscriptionHere(platformOS: string): boolean {
  return platformOS === 'web';
}
