import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';

interface InvoiceItem {
  description: string;
  amount: number;
}

interface InvoiceDetailProps {
  invoice: {
    id: string;
    childName: string;
    daycareName: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    amount: number;
    dueDate: string;
    paidDate?: string;
    description: string;
    items?: InvoiceItem[];
    createdAt: string;
  };
  onClose?: () => void;
  onPay?: (invoiceId: string) => Promise<void>;
}

export const InvoiceDetailScreen: React.FC<InvoiceDetailProps> = ({
  invoice,
  onClose,
  onPay,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const statusColors: Record<string, string> = {
    pending: Colors.warning,
    paid: Colors.success,
    overdue: Colors.danger,
    cancelled: Colors.textMuted,
  };

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toFixed(2)}`;

  const handlePay = async () => {
    setIsLoading(true);
    try {
      if (onPay) {
        await onPay(invoice.id);
        Alert.alert('Payment Successful', 'Your invoice has been paid. A receipt will be sent to your email.');
      } else {
        Alert.alert('Payment', 'This will open the Stripe payment sheet to pay this invoice.');
      }
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message || 'Could not process payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Invoice Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Invoice</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[invoice.status] + '20' }]}>
          <Text style={[styles.statusText, { color: statusColors[invoice.status] }]}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.invoiceId}>Invoice #{invoice.id.slice(0, 8).toUpperCase()}</Text>

      {/* Details */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>From</Text>
          <Text style={styles.detailValue}>{invoice.daycareName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>For</Text>
          <Text style={styles.detailValue}>{invoice.childName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Description</Text>
          <Text style={styles.detailValue}>{invoice.description}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Issue Date</Text>
          <Text style={styles.detailValue}>
            {new Date(invoice.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Due Date</Text>
          <Text style={[styles.detailValue, invoice.status === 'overdue' && { color: Colors.danger }]}>
            {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        {invoice.paidDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Paid Date</Text>
            <Text style={[styles.detailValue, { color: Colors.success }]}>
              {new Date(invoice.paidDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        )}
      </View>

      {/* Line Items */}
      {invoice.items && invoice.items.length > 0 && (
        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>Line Items</Text>
          {invoice.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemDesc}>{item.description}</Text>
              <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.amount)}</Text>
          </View>
        </View>
      )}

      {/* Total (if no line items) */}
      {(!invoice.items || invoice.items.length === 0) && (
        <View style={styles.totalCard}>
          <Text style={styles.totalCardLabel}>Amount Due</Text>
          <Text style={styles.totalCardAmount}>{formatCurrency(invoice.amount)}</Text>
        </View>
      )}

      {/* Pay Button */}
      {(invoice.status === 'pending' || invoice.status === 'overdue') && (
        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePay}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="card" size={20} color={Colors.white} />
              <Text style={styles.payBtnText}>Pay {formatCurrency(invoice.amount)}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {invoice.status === 'paid' && (
        <View style={styles.paidNotice}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={styles.paidNoticeText}>This invoice has been paid. Thank you!</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round },
  statusText: { fontSize: FontSizes.sm, fontWeight: '700' },
  invoiceId: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.xl },
  detailsCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, ...Shadows.small,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  detailLabel: { fontSize: FontSizes.sm, color: Colors.textMuted, flex: 1 },
  detailValue: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  itemsCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, ...Shadows.small,
  },
  itemsTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  itemDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  itemAmount: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md, marginTop: Spacing.sm,
  },
  totalLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  totalAmount: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.primary },
  totalCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.small,
  },
  totalCardLabel: { fontSize: FontSizes.sm, color: Colors.textMuted },
  totalCardAmount: { fontSize: 36, fontWeight: '800', color: Colors.primary, marginTop: Spacing.xs },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  payBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  paidNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.success + '15', borderRadius: BorderRadius.lg, padding: Spacing.lg,
  },
  paidNoticeText: { fontSize: FontSizes.md, color: Colors.success, fontWeight: '600' },
});
