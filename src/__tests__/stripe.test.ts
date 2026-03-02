import { calculatePlatformFee, isDaycareFeatureEnabled, isParentFeatureEnabled, PLATFORM_FEE_PERCENT } from '../lib/stripe';

// ============================================================
// calculatePlatformFee
// ============================================================

describe('calculatePlatformFee', () => {
  it('calculates 5% fee on a dollar amount', () => {
    // $100.00 = 10000 cents → 5% = 500 cents
    expect(calculatePlatformFee(10000)).toBe(500);
  });

  it('rounds to nearest cent', () => {
    // $33.33 = 3333 cents → 5% = 166.65 → rounds to 167
    expect(calculatePlatformFee(3333)).toBe(167);
  });

  it('returns 0 for zero amount', () => {
    expect(calculatePlatformFee(0)).toBe(0);
  });

  it('uses the correct fee percentage', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(5);
  });
});

// ============================================================
// isDaycareFeatureEnabled
// ============================================================

describe('isDaycareFeatureEnabled', () => {
  it('returns false for undefined tier', () => {
    expect(isDaycareFeatureEnabled(undefined, 'photoGallery')).toBe(false);
  });

  it('starter plan has no photo gallery', () => {
    expect(isDaycareFeatureEnabled('starter', 'photoGallery')).toBe(false);
  });

  it('professional plan has photo gallery', () => {
    expect(isDaycareFeatureEnabled('professional', 'photoGallery')).toBe(true);
  });

  it('enterprise plan has all features', () => {
    expect(isDaycareFeatureEnabled('enterprise', 'photoGallery')).toBe(true);
    expect(isDaycareFeatureEnabled('enterprise', 'tuitionInvoicing')).toBe(true);
    expect(isDaycareFeatureEnabled('enterprise', 'prioritySupport')).toBe(true);
    expect(isDaycareFeatureEnabled('enterprise', 'apiAccess')).toBe(true);
  });

  it('starter plan has no tuition invoicing', () => {
    expect(isDaycareFeatureEnabled('starter', 'tuitionInvoicing')).toBe(false);
  });
});

// ============================================================
// isParentFeatureEnabled
// ============================================================

describe('isParentFeatureEnabled', () => {
  it('returns false for undefined plan', () => {
    expect(isParentFeatureEnabled(undefined, 'hdPhotos')).toBe(false);
  });

  it('free plan has no premium features', () => {
    expect(isParentFeatureEnabled('free', 'hdPhotos')).toBe(false);
    expect(isParentFeatureEnabled('free', 'detailedReports')).toBe(false);
    expect(isParentFeatureEnabled('free', 'milestoneAnalytics')).toBe(false);
  });

  it('premium plan has all features', () => {
    expect(isParentFeatureEnabled('premium', 'hdPhotos')).toBe(true);
    expect(isParentFeatureEnabled('premium', 'detailedReports')).toBe(true);
    expect(isParentFeatureEnabled('premium', 'milestoneAnalytics')).toBe(true);
  });
});
