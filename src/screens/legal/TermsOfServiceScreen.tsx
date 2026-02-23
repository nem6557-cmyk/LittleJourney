import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '../../theme/colors';

interface TermsOfServiceScreenProps {
  onClose?: () => void;
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({ onClose }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.updated}>Last updated: February 2026</Text>

      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.body}>
        By using LittleJourney, you agree to these Terms of Service. If you are a daycare administrator, you also agree on behalf of your organization. If you are a parent or guardian, your use constitutes acceptance of these terms.
      </Text>

      <Text style={styles.sectionTitle}>2. Service Description</Text>
      <Text style={styles.body}>
        LittleJourney is a childcare communication platform that enables real-time activity updates, secure messaging, photo sharing, milestone tracking, daily reports, attendance management, and tuition invoicing between daycare centers and families.
      </Text>

      <Text style={styles.sectionTitle}>3. User Accounts</Text>
      <Text style={styles.body}>
        You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration. Daycare administrators are responsible for managing staff and parent access within their organization.
      </Text>

      <Text style={styles.sectionTitle}>4. Subscription & Billing</Text>
      <Text style={styles.body}>
        Daycare centers may subscribe to paid plans. All plans include a 14-day free trial. Subscriptions renew automatically unless canceled. Parents may optionally subscribe to premium features. Refunds are handled per our refund policy.
      </Text>

      <Text style={styles.sectionTitle}>5. Acceptable Use</Text>
      <Text style={styles.body}>
        You agree not to: share inappropriate content, use the service for unauthorized commercial purposes, attempt to access data belonging to other organizations, harass or abuse other users, or reverse engineer the service.
      </Text>

      <Text style={styles.sectionTitle}>6. Content Ownership</Text>
      <Text style={styles.body}>
        Photos, messages, and other content you upload remain your property. By uploading content, you grant LittleJourney a license to store, display, and transmit that content as necessary to provide the service. Daycare-generated content (activity logs, reports) is co-owned by the daycare and accessible to authorized parents.
      </Text>

      <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
      <Text style={styles.body}>
        LittleJourney provides a communication tool and is not responsible for the quality of childcare. We are not liable for any indirect, incidental, or consequential damages arising from use of the service.
      </Text>

      <Text style={styles.sectionTitle}>8. Termination</Text>
      <Text style={styles.body}>
        Either party may terminate the service at any time. Upon termination, you may export your data within 30 days. After 30 days, data will be permanently deleted in accordance with our Privacy Policy.
      </Text>

      <Text style={styles.sectionTitle}>9. Contact</Text>
      <Text style={styles.body}>
        For questions about these terms, contact us at legal@littlejourney.app
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
