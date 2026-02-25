import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { config } from '../../lib/config';

interface ConsentScreenProps {
  parentName: string;
  childName: string;
  daycareName: string;
  onConsent: () => Promise<void>;
  onDecline: () => void;
}

/**
 * COPPA Parental Consent Screen.
 * Required before any child data can be collected.
 * Must be completed by verified parent/guardian.
 */
export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  parentName,
  childName,
  daycareName,
  onConsent,
  onDecline,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConsent = async () => {
    if (!agreed) {
      Alert.alert('Required', 'Please review and check the consent checkbox to continue.');
      return;
    }
    setIsLoading(true);
    try {
      await onConsent();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record consent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Parental Consent Required</Text>
      <Text style={styles.subtitle}>
        COPPA (Children's Online Privacy Protection Act) Compliance
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What We Need Your Consent For</Text>
        <Text style={styles.infoBody}>
          {daycareName} uses LittleJourney to communicate with you about your child's day. To provide this service, we need your permission to collect and store information about {childName || 'your child'}.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information Collected:</Text>
        {[
          'Child\'s name and date of birth',
          'Classroom assignment and attendance records',
          'Daily activity logs (meals, naps, learning)',
          'Photos taken during daycare activities',
          'Health information (allergies, medical notes)',
          'Developmental milestones and observations',
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Ionicons name="ellipse" size={6} color={Colors.textSecondary} style={{ marginTop: 7 }} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How Information Is Used:</Text>
        {[
          'Shared with authorized caregivers at your daycare center',
          'Displayed to you through the LittleJourney app',
          'Used to generate daily reports and milestone tracking',
          'Never sold to third parties or used for advertising',
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Ionicons name="ellipse" size={6} color={Colors.textSecondary} style={{ marginTop: 7 }} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Rights:</Text>
        {[
          'Review all data collected about your child at any time',
          'Request correction of any inaccurate information',
          'Request deletion of your child\'s data',
          'Withdraw consent at any time (may limit service functionality)',
          'Export your child\'s data in machine-readable format',
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAgreed(!agreed)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={agreed ? 'checkbox' : 'square-outline'}
          size={24}
          color={agreed ? Colors.primary : Colors.textMuted}
        />
        <Text style={styles.checkboxText}>
          I, {parentName || 'the parent/guardian'}, consent to the collection and use of {childName ? `${childName}'s` : "my child's"} information as described above. I understand I can withdraw this consent at any time.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.consentBtn, !agreed && styles.consentBtnDisabled]}
        onPress={handleConsent}
        disabled={!agreed || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.consentBtnText}>I Consent</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
        <Text style={styles.declineBtnText}>Decline & Go Back</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        For questions about this consent or our privacy practices, contact us at {config.privacyEmail}
      </Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  iconContainer: { alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSizes.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xl },
  infoCard: {
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  infoBody: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  bulletText: { fontSize: FontSizes.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  checkboxText: { fontSize: FontSizes.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  consentBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  consentBtnDisabled: { opacity: 0.5 },
  consentBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  declineBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  declineBtnText: { fontSize: FontSizes.md, color: Colors.textMuted },
  footer: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
