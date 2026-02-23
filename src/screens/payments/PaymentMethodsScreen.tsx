import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodsScreenProps {
  onClose?: () => void;
}

// In production, these would come from Stripe via an Edge Function
const mockMethods: PaymentMethod[] = [];

export const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({ onClose }) => {
  const [methods] = useState<PaymentMethod[]>(mockMethods);
  const [isLoading, setIsLoading] = useState(false);

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      default: return 'card-outline';
    }
  };

  const handleAddCard = async () => {
    setIsLoading(true);
    try {
      // In production: call Stripe SetupIntent Edge Function → open Payment Sheet
      Alert.alert(
        'Add Payment Method',
        'This will open the Stripe payment sheet to securely add a new card.',
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add payment method');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCard = (methodId: string) => {
    Alert.alert(
      'Remove Card',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // In production: call Stripe detach payment method
            Alert.alert('Removed', 'Payment method has been removed.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Payment Methods</Text>
      <Text style={styles.subtitle}>Manage your payment methods for subscriptions and invoices.</Text>

      {methods.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Payment Methods</Text>
          <Text style={styles.emptyBody}>
            Add a payment method to subscribe to plans or pay invoices.
          </Text>
        </View>
      ) : (
        methods.map((method) => (
          <View key={method.id} style={[styles.card, method.isDefault && styles.cardDefault]}>
            <View style={styles.cardLeft}>
              <Ionicons name={getCardIcon(method.brand)} size={28} color={Colors.primary} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardBrand}>
                  {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                </Text>
                <Text style={styles.cardExpiry}>
                  Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                </Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              {method.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Default</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => handleRemoveCard(method.id)}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.addBtn} onPress={handleAddCard} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.addBtnText}>Add Payment Method</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
        <Text style={styles.securityText}>
          Payment information is securely processed by Stripe. LittleJourney never stores your full card details.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md },
  emptyBody: { fontSize: FontSizes.md, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, ...Shadows.small, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardDefault: { borderColor: Colors.primary },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardInfo: {},
  cardBrand: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  cardExpiry: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  defaultBadge: { backgroundColor: Colors.primaryLight + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  defaultText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.primary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.lg, borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: BorderRadius.lg, marginTop: Spacing.md, marginBottom: Spacing.xl,
  },
  addBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  securityText: { fontSize: FontSizes.xs, color: Colors.textMuted, flex: 1, lineHeight: 18 },
});
