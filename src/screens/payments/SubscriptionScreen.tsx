import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../lib/config';
import {
  createCheckoutSession, getSubscriptionStatus, openBillingPortal, PLAN_FEATURES,
} from '../../lib/stripe';
import { canPurchaseSubscriptionHere, summarizeSubscription } from '../../lib/billing';

type DaycarePlanId = 'starter' | 'professional' | 'enterprise';

interface PlanCard {
  id: DaycarePlanId;
  name: string;
  popular?: boolean;
}

const PLANS: PlanCard[] = [
  { id: 'starter', name: 'Starter' },
  { id: 'professional', name: 'Professional', popular: true },
  { id: 'enterprise', name: 'Enterprise' },
];

const limitText = (n: number, noun: string) =>
  n === Infinity || n < 0 ? `Unlimited ${noun}` : `Up to ${n} ${noun}`;

const featureList = (id: DaycarePlanId) => {
  const f = PLAN_FEATURES[id];
  return [
    { text: limitText(f.maxChildren, 'children'), included: true },
    { text: f.maxClassrooms === 1 ? '1 classroom' : limitText(f.maxClassrooms, 'classrooms'), included: true },
    { text: 'Timeline, messaging & daily reports', included: true },
    { text: 'Photo gallery', included: f.photoGallery },
    { text: 'Tuition invoicing', included: f.tuitionInvoicing },
    { text: 'Priority support', included: f.prioritySupport },
  ];
};

const TONE_COLORS = {
  good: { bg: Colors.successLight, fg: Colors.success },
  warn: { bg: Colors.warningLight, fg: Colors.warning },
  bad: { bg: Colors.dangerLight, fg: Colors.danger },
  neutral: { bg: Colors.borderLight, fg: Colors.textSecondary },
};

/**
 * Daycare subscription screen (admins only).
 *
 * Families use Little Journey for free — there is nothing for a parent to buy.
 * Plans can only be purchased on the web: Apple and Google require their own
 * billing for digital subscriptions sold inside native apps, so the mobile apps
 * show status and point admins to the web dashboard.
 */
export const SubscriptionScreen: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { profile, daycare } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<{ status: string; plan: string | null; trialEnd: string | null } | null>(null);

  const canBuy = canPurchaseSubscriptionHere(Platform.OS);
  const daycareId = daycare?.id || profile?.daycare_id || undefined;

  const refresh = useCallback(async () => {
    setLoading(true);
    setSub(daycareId ? await getSubscriptionStatus(daycareId) : null);
    setLoading(false);
  }, [daycareId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Returning from Stripe (web redirect or app resume) should show the new plan.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onFocus = () => { refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const summary = summarizeSubscription(sub);
  const tone = TONE_COLORS[summary.tone];
  const hasLiveSubscription = !!sub && ['active', 'past_due'].includes(sub.status);

  const handleChoose = async (plan: DaycarePlanId) => {
    setBusy(plan);
    const result = await createCheckoutSession({ plan });
    setBusy(null);
    if (!result.ok) Alert.alert('Could not start checkout', result.error);
  };

  const handleManage = async () => {
    setBusy('portal');
    const result = await openBillingPortal();
    setBusy(null);
    if (!result.ok) Alert.alert('Could not open billing', result.error);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Plan & Billing</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
      ) : (
        <View style={[styles.summaryCard, { backgroundColor: tone.bg }]} accessibilityRole="summary">
          <Text style={[styles.summaryHeadline, { color: tone.fg }]}>{summary.headline}</Text>
          <Text style={styles.summaryDetail}>{summary.detail}</Text>
        </View>
      )}

      {!canBuy && (
        <View style={styles.noteCard}>
          <Ionicons name="laptop-outline" size={22} color={Colors.primary} />
          <Text style={styles.noteText}>
            Plans are managed on the web. Sign in at littlejourney.app from a browser to choose a plan, update your
            card, view receipts, or cancel. Families never pay to use the app.
          </Text>
        </View>
      )}

      {canBuy && hasLiveSubscription && (
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={handleManage}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Manage billing, change plan or cancel"
        >
          {busy === 'portal' ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.manageBtnText}>Manage billing / cancel</Text>}
        </TouchableOpacity>
      )}

      <Text style={styles.subtitle}>
        {`All plans start with a ${config.daycareTrial.durationDays}-day free trial, then bill monthly. Cancel anytime.`}
      </Text>

      {PLANS.map((plan) => {
        const price = config.plans.daycare[plan.id].price / 100;
        const isCurrent = !!sub && sub.plan === plan.id && ['active', 'trialing'].includes(sub.status) && hasLiveSubscription;
        return (
          <View
            key={plan.id}
            style={[styles.planCard, plan.popular && styles.planCardPopular]}
            accessibilityLabel={`${plan.name} plan, $${price} per month`}
          >
            {plan.popular && (
              <View style={styles.popularBadge}><Text style={styles.popularText}>Most Popular</Text></View>
            )}
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>{`$${price}`}</Text>
                <Text style={styles.planPriceNote}>/month</Text>
              </View>
            </View>

            {featureList(plan.id).map((feature) => (
              <View key={feature.text} style={styles.featureRow}>
                <Ionicons
                  name={feature.included ? 'checkmark-circle' : 'close-circle-outline'}
                  size={18}
                  color={feature.included ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.featureText, !feature.included && styles.featureTextMuted]}>{feature.text}</Text>
              </View>
            ))}

            {canBuy && (
              <TouchableOpacity
                style={[styles.selectBtn, plan.popular && styles.selectBtnPopular, (isCurrent || hasLiveSubscription) && styles.selectBtnDisabled]}
                onPress={() => handleChoose(plan.id)}
                disabled={busy !== null || isCurrent || hasLiveSubscription}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy !== null || isCurrent || hasLiveSubscription }}
              >
                {busy === plan.id ? (
                  <ActivityIndicator color={plan.popular ? Colors.white : Colors.primary} />
                ) : (
                  <Text style={[styles.selectBtnText, plan.popular && styles.selectBtnTextWhite]}>
                    {isCurrent ? 'Current plan' : hasLiveSubscription ? 'Change in billing portal' : 'Start free trial'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.md, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.lg },
  subtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginVertical: Spacing.lg, lineHeight: 22 },
  summaryCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  summaryHeadline: { fontSize: FontSizes.lg, fontWeight: '800' },
  summaryDetail: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  noteCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'flex-start', ...Shadows.small },
  noteText: { flex: 1, fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22 },
  manageBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  manageBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.md },
  planCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.borderLight, ...Shadows.small },
  planCardPopular: { borderColor: Colors.primary },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round },
  popularText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.white },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  planName: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
  planPriceNote: { fontSize: FontSizes.sm, color: Colors.textMuted, marginLeft: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  featureText: { fontSize: FontSizes.md, color: Colors.textPrimary, flexShrink: 1 },
  featureTextMuted: { color: Colors.textMuted },
  selectBtn: { marginTop: Spacing.md, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, minHeight: 48, justifyContent: 'center' },
  selectBtnPopular: { backgroundColor: Colors.primary },
  selectBtnDisabled: { opacity: 0.5 },
  selectBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  selectBtnTextWhite: { color: Colors.white },
});
