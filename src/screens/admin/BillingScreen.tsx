import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { invoicesService } from '../../services/invoices.service';
import {
  ConnectStatus, getConnectStatus, getSubscriptionStatus, openConnect, openInvoicePayment,
  PLATFORM_FEE_PERCENT,
} from '../../lib/stripe';
import {
  effectiveInvoiceStatus, formatCents, parseDollarsToCents, summarizeSubscription, InvoiceStatus,
} from '../../lib/billing';
import { SubscriptionScreen } from '../payments/SubscriptionScreen';
import { EmptyState } from '../../components/EmptyState';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

interface InvoiceRow {
  id: string;
  amount_cents: number;
  status: InvoiceStatus;
  due_date: string;
  description: string;
  stripe_invoice_id: string | null;
  parent?: { first_name: string; last_name: string } | null;
  child?: { first_name: string; last_name: string } | null;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: Colors.borderLight, fg: Colors.textSecondary, label: 'Not sent' },
  pending: { bg: Colors.warningLight, fg: Colors.warning, label: 'Awaiting payment' },
  overdue: { bg: Colors.dangerLight, fg: Colors.danger, label: 'Overdue' },
  paid: { bg: Colors.successLight, fg: Colors.success, label: 'Paid' },
  void: { bg: Colors.borderLight, fg: Colors.textMuted, label: 'Cancelled' },
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && isoDate(d) === value;
}

export const BillingScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { profile, daycare } = useAuth();
  const { children } = useApp();
  const daycareId = profile?.daycare_id ?? daycare?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [sub, setSub] = useState<{ status: string; plan: string | null; trialEnd: string | null } | null>(null);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  // New-invoice form
  const [showNew, setShowNew] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [parents, setParents] = useState<Array<{ id: string; name: string }>>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(plusDays(14));
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!daycareId) { setLoading(false); return; }
    try {
      const [s, c, inv] = await Promise.all([
        getSubscriptionStatus(daycareId),
        getConnectStatus(),
        invoicesService.getDaycareInvoices(daycareId),
      ]);
      setSub(s);
      setConnect(c);
      setInvoices((inv ?? []) as unknown as InvoiceRow[]);
    } catch (err) {
      console.warn('[Billing] load failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [daycareId]);

  useEffect(() => { load(); }, [load]);

  // Choosing a child resolves who gets billed.
  useEffect(() => {
    let cancelled = false;
    if (!childId) { setParents([]); setParentId(null); return; }
    setParentsLoading(true);
    invoicesService.getChildBillingParents(childId)
      .then((rows) => {
        if (cancelled) return;
        const list = rows.map((r) => ({
          id: r.parent_id,
          name: [r.parent?.first_name, r.parent?.last_name].filter(Boolean).join(' ') || r.parent?.email || 'Parent',
        }));
        setParents(list);
        setParentId(list.length === 1 ? list[0].id : null);
      })
      .catch(() => { if (!cancelled) { setParents([]); setParentId(null); } })
      .finally(() => { if (!cancelled) setParentsLoading(false); });
    return () => { cancelled = true; };
  }, [childId]);

  const summary = useMemo(() => summarizeSubscription(sub), [sub]);
  const payoutsReady = !!connect?.onboardingComplete;

  const handleConnect = async (action: 'onboard' | 'dashboard') => {
    setConnectBusy(true);
    const result = await openConnect(action);
    setConnectBusy(false);
    if (!result.ok) Alert.alert('Stripe', result.error);
  };

  const resetForm = () => {
    setChildId(null); setParents([]); setParentId(null);
    setDescription(''); setAmount(''); setDueDate(plusDays(14));
  };

  const sendInvoice = async (invoiceId: string) => {
    const result = await openInvoicePayment(invoiceId.trim());
    return result;
  };

  const handleCreate = async () => {
    if (!daycareId || !childId || !parentId) {
      Alert.alert('Missing information', 'Choose a child and who should be billed.');
      return;
    }
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      Alert.alert('Invalid amount', 'Enter a dollar amount between $0.01 and $1,000,000.00 (for example 850 or 850.50).');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing description', 'Describe what this invoice is for (for example "March tuition").');
      return;
    }
    if (!isValidDate(dueDate)) {
      Alert.alert('Invalid due date', 'Use the format YYYY-MM-DD.');
      return;
    }
    if (dueDate < isoDate(new Date())) {
      Alert.alert('Invalid due date', 'The due date cannot be in the past.');
      return;
    }
    if (!payoutsReady) {
      Alert.alert('Set up payments first', 'Finish Stripe payout setup so families can pay you online.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await invoicesService.createInvoice({
        daycare_id: daycareId,
        parent_id: parentId,
        child_id: childId,
        amount_cents: cents,
        due_date: dueDate,
        description: description.trim(),
        line_items: [{ description: description.trim(), amount: cents }],
        status: 'draft',
      });
      const sent = await sendInvoice(created.id);
      if (sent.ok === false) {
        Alert.alert('Saved, not sent', `${sent.error}\n\nThe invoice is saved. Tap it in the list to send it again.`);
      } else {
        Alert.alert('Invoice sent', 'The family has been notified and emailed a secure payment link.');
      }
      setShowNew(false);
      resetForm();
      await load();
    } catch (err: any) {
      Alert.alert('Could not create invoice', err?.message || 'Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoiceTap = (inv: InvoiceRow) => {
    if (inv.stripe_invoice_id || inv.status !== 'draft') {
      Alert.alert(
        inv.description,
        `${formatCents(inv.amount_cents)} — ${STATUS_STYLE[effectiveInvoiceStatus(inv.status, inv.due_date)]?.label ?? inv.status}\nDue ${inv.due_date}`,
      );
      return;
    }
    Alert.alert(inv.description, `${formatCents(inv.amount_cents)} — not sent yet.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await invoicesService.deleteUnsentInvoice(inv.id); await load(); }
          catch (err: any) { Alert.alert('Could not delete', err?.message || 'Please try again.'); }
        },
      },
      {
        text: 'Send now',
        onPress: async () => {
          const r = await sendInvoice(inv.id);
          if (r.ok === false) Alert.alert('Not sent', r.error); else await load();
        },
      },
    ]);
  };

  if (showPlans) {
    return <SubscriptionScreen onClose={() => { setShowPlans(false); load(); }} />;
  }

  const subTone = { good: Colors.success, warn: Colors.warning, bad: Colors.danger, neutral: Colors.textSecondary }[summary.tone];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle} accessibilityRole="header">Billing & Payments</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Plan */}
          <TouchableOpacity style={[styles.card, Shadows.small]} onPress={() => setShowPlans(true)} accessibilityRole="button" accessibilityLabel={`Your plan: ${summary.headline}. Open plan and billing`}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Your Little Journey plan</Text>
                <Text style={[styles.cardHeadline, { color: subTone }]}>{summary.headline}</Text>
                <Text style={styles.cardDetail}>{summary.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Payouts */}
          <View style={[styles.card, Shadows.small]}>
            <Text style={styles.cardLabel}>Tuition payments</Text>
            <Text style={styles.cardHeadline}>{payoutsReady ? 'Online payments are on' : 'Set up online payments'}</Text>
            <Text style={styles.cardDetail}>
              {payoutsReady
                ? 'Families can pay invoices by card. Funds are paid out to your bank by Stripe.'
                : connect === null
                  ? 'Could not check your Stripe status. Check your connection and retry.'
                  : 'Connect a bank account with Stripe (about 5 minutes) so families can pay tuition online.'}
            </Text>
            <Text style={styles.feeNote}>
              {`Little Journey keeps a ${PLATFORM_FEE_PERCENT}% platform fee on each tuition payment, in addition to Stripe's card processing fees.`}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => (connect === null ? load() : handleConnect(payoutsReady ? 'dashboard' : 'onboard'))}
              disabled={connectBusy}
              accessibilityRole="button"
            >
              {connectBusy ? <ActivityIndicator color={Colors.white} /> : (
                <Text style={styles.primaryBtnText}>
                  {connect === null ? 'Retry' : payoutsReady ? 'Open Stripe dashboard' : connect?.accountId ? 'Continue setup' : 'Set up payments'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Invoices */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Invoices</Text>
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowNew(true)} accessibilityRole="button" accessibilityLabel="Create new invoice">
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>

          {invoices.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No invoices yet" message="Create an invoice to bill a family for tuition." actionLabel="New Invoice" onAction={() => setShowNew(true)} />
          ) : (
            invoices.map((inv) => {
              const status = effectiveInvoiceStatus(inv.status, inv.due_date);
              const st = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
              const who = [inv.child?.first_name, inv.child?.last_name].filter(Boolean).join(' ');
              return (
                <TouchableOpacity key={inv.id} style={[styles.invoiceRow, Shadows.small]} onPress={() => handleInvoiceTap(inv)} accessibilityRole="button" accessibilityLabel={`${inv.description}, ${formatCents(inv.amount_cents)}, ${st.label}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceTitle} numberOfLines={1}>{inv.description}</Text>
                    <Text style={styles.invoiceMeta} numberOfLines={1}>{who ? `${who} • ` : ''}Due {inv.due_date}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.invoiceAmount}>{formatCents(inv.amount_cents)}</Text>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* New invoice */}
      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={[styles.sheet, Shadows.large]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">New invoice</Text>
              <TouchableOpacity onPress={() => setShowNew(false)} style={styles.closeHit} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Child</Text>
              <View style={styles.chips}>
                {children.map((c) => (
                  <TouchableOpacity key={c.id} style={[styles.chip, childId === c.id && styles.chipActive]} onPress={() => setChildId(c.id)} accessibilityRole="button" accessibilityState={{ selected: childId === c.id }}>
                    <Text style={[styles.chipText, childId === c.id && styles.chipTextActive]}>{c.firstName} {c.lastName}</Text>
                  </TouchableOpacity>
                ))}
                {children.length === 0 && <Text style={styles.hint}>Add a child first (Manage Children).</Text>}
              </View>

              {childId && (
                <>
                  <Text style={styles.fieldLabel}>Bill to</Text>
                  {parentsLoading ? <ActivityIndicator color={Colors.primary} /> : parents.length === 0 ? (
                    <Text style={styles.hint}>No parent is linked to this child yet. Create a parent invite code for them first.</Text>
                  ) : (
                    <View style={styles.chips}>
                      {parents.map((p) => (
                        <TouchableOpacity key={p.id} style={[styles.chip, parentId === p.id && styles.chipActive]} onPress={() => setParentId(p.id)} accessibilityRole="button" accessibilityState={{ selected: parentId === p.id }}>
                          <Text style={[styles.chipText, parentId === p.id && styles.chipTextActive]}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="e.g. March tuition" placeholderTextColor={Colors.textMuted} maxLength={120} accessibilityLabel="Invoice description" />

              <Text style={styles.fieldLabel}>Amount (USD)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="850.00" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" accessibilityLabel="Invoice amount in dollars" />

              <Text style={styles.fieldLabel}>Due date</Text>
              <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Due date, year month day" />

              <Text style={styles.feeNote}>
                {`A ${PLATFORM_FEE_PERCENT}% platform fee plus Stripe processing fees apply. The family gets an emailed payment link and an in-app notification.`}
              </Text>

              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={submitting} accessibilityRole="button">
                {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Create & send invoice</Text>}
              </TouchableOpacity>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.xl, color: Colors.white, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardHeadline: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  cardDetail: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  feeNote: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  primaryBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.md, minHeight: 36 },
  newBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, minHeight: 64 },
  invoiceTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  invoiceMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  invoiceAmount: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary },
  badge: { borderRadius: BorderRadius.round, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sheetTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  closeHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, minHeight: 48, fontSize: FontSizes.md, color: Colors.textPrimary, backgroundColor: Colors.background },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.md, minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.white },
  hint: { fontSize: FontSizes.sm, color: Colors.textMuted, lineHeight: 18 },
});
