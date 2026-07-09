/**
 * Standalone legal screen — the app's Privacy Policy.
 *
 * NOTE: This component is not yet wired into navigation. It is intended to be
 * linked from Profile (Privacy section), the COPPA ConsentScreen, and the
 * SignUp flow. Render it as a modal/route and pass `onClose` to dismiss.
 * Do not delete — it is required content for COPPA/FERPA compliance and app
 * store review.
 */
import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '../../theme/colors';
import { config } from '../../lib/config';

interface PrivacyPolicyScreenProps {
  onClose?: () => void;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onClose }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: February 2026</Text>

      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.body}>
        LittleJourney collects information necessary to provide childcare communication services. This includes account information (name, email, role), child information entered by parents and caregivers (name, date of birth, allergies, medical notes), activity data (meals, naps, milestones), photos, and messages.
      </Text>

      <Text style={styles.sectionTitle}>2. Children's Privacy</Text>
      <Text style={styles.body}>
        LittleJourney is designed to support parental consent workflows for children's data. We do not collect information directly from children under 13. All child data is entered by parents, guardians, or authorized caregivers. Parental consent is required before child data is shown to parent or family accounts. Parents can request review, deletion, or refusal of further collection through their account settings or by contacting support.
      </Text>

      <Text style={styles.sectionTitle}>3. Educational Records</Text>
      <Text style={styles.body}>
        Educational records are handled with role-based access controls. Access is limited to authorized daycare staff, parents, guardians, and family users who have been invited by an authorized account.
      </Text>

      <Text style={styles.sectionTitle}>4. How We Use Information</Text>
      <Text style={styles.body}>
        We use collected information to: provide real-time activity updates to parents, enable secure communication between parents and caregivers, generate daily reports and milestone tracking, process payments and invoicing, and improve our services.
      </Text>

      <Text style={styles.sectionTitle}>5. Data Storage & Security</Text>
      <Text style={styles.body}>
        All data is stored using Supabase (PostgreSQL) with row-level security policies that help isolate each daycare's records. Authentication tokens are stored using device-level encryption (Keychain on iOS, Keystore on Android). Data is encrypted in transit using TLS.
      </Text>

      <Text style={styles.sectionTitle}>6. Data Sharing</Text>
      <Text style={styles.body}>
        We do not sell or share personal information with third parties for marketing purposes. Data is shared only with: your daycare center (as authorized), payment processors (Stripe) for transaction processing, and cloud infrastructure providers necessary to operate the service.
      </Text>

      <Text style={styles.sectionTitle}>7. Data Retention & Deletion</Text>
      <Text style={styles.body}>
        Account data is retained while your account is active. You can request complete data export or deletion at any time through Profile {'>'} Privacy {'>'} Data Management. Upon deletion request, all personal data is permanently removed within 30 days.
      </Text>

      <Text style={styles.sectionTitle}>8. Your Rights</Text>
      <Text style={styles.body}>
        You have the right to: access your data, correct inaccuracies, request deletion, export your data in machine-readable format, withdraw consent for data collection, and opt out of non-essential communications.
      </Text>

      <Text style={styles.sectionTitle}>9. Contact Us</Text>
      <Text style={styles.body}>
        For privacy inquiries, contact us at {config.privacyEmail}
      </Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.sm, marginBottom: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.xs },
  updated: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  body: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24 },
});
