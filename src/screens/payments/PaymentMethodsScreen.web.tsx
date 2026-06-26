import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSizes } from '../../theme/colors';

interface PaymentMethodsScreenProps {
  onClose?: () => void;
}

/**
 * Web stub — @stripe/stripe-react-native (PaymentSheet) is native-only and
 * cannot be bundled for web. Card management is available in the mobile app;
 * on web we show an explanatory message instead of importing the native module.
 */
export const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({ onClose }) => (
  <View style={styles.container}>
    <Text style={styles.title}>Payment Methods</Text>
    <Ionicons name="phone-portrait-outline" size={40} color={Colors.primary} style={{ marginVertical: Spacing.md }} />
    <Text style={styles.body}>
      Adding and managing saved cards is available in the LittleJourney mobile
      app. You can still view and pay invoices here on the web.
    </Text>
    {onClose && (
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>Back</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: Spacing.xl, alignItems: 'center' },
  title: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  body: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  closeBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  closeText: { color: Colors.primary, fontWeight: '600', fontSize: FontSizes.md },
});
