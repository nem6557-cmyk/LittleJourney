import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { config } from '../../lib/config';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  features: PlanFeature[];
  popular?: boolean;
}

const daycarePlans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    priceNote: '/month',
    features: [
      { text: 'Up to 20 children', included: true },
      { text: '1 classroom', included: true },
      { text: 'Timeline & messaging', included: true },
      { text: 'Daily reports', included: true },
      { text: 'Photo gallery', included: false },
      { text: 'Tuition invoicing', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$59',
    priceNote: '/month',
    popular: true,
    features: [
      { text: 'Up to 50 children', included: true },
      { text: '5 classrooms', included: true },
      { text: 'Timeline & messaging', included: true },
      { text: 'Daily reports', included: true },
      { text: 'Photo gallery', included: true },
      { text: 'Tuition invoicing', included: true },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    priceNote: '/month',
    features: [
      { text: 'Unlimited children', included: true },
      { text: 'Unlimited classrooms', included: true },
      { text: 'Timeline & messaging', included: true },
      { text: 'Daily reports', included: true },
      { text: 'Photo gallery', included: true },
      { text: 'Tuition invoicing', included: true },
      { text: 'Priority support + API', included: true },
    ],
  },
];

const parentPlans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: '',
    features: [
      { text: 'View timeline', included: true },
      { text: 'Basic messaging', included: true },
      { text: 'Daily summary', included: true },
      { text: 'HD photo downloads', included: false },
      { text: 'Detailed reports', included: false },
      { text: 'Milestone analytics', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$4.99',
    priceNote: '/month',
    popular: true,
    features: [
      { text: 'View timeline', included: true },
      { text: 'Basic messaging', included: true },
      { text: 'Daily summary', included: true },
      { text: 'HD photo downloads', included: true },
      { text: 'Detailed reports', included: true },
      { text: 'Milestone analytics', included: true },
    ],
  },
];

export const SubscriptionScreen: React.FC<{ type: 'daycare' | 'parent'; onClose?: () => void }> = ({ type, onClose }) => {
  const { profile, daycare } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const plans = type === 'daycare' ? daycarePlans : parentPlans;

  const handleSubscribe = async (planId: string) => {
    setIsLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await supabase.functions.invoke('create-checkout', {
        body: {
          plan: type === 'parent' ? 'parent_premium' : planId,
          daycareId: daycare?.id || profile?.daycare_id,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) throw response.error;

      const { url } = response.data;
      if (url) {
        // Open Stripe Checkout URL in browser
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Checkout', 'Please complete your subscription at:\n' + url);
        }
      } else {
        Alert.alert('Error', 'No checkout URL returned. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create checkout session');
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

      <Text style={styles.title}>{type === 'daycare' ? 'Choose Your Plan' : 'Upgrade to Premium'}</Text>
      <Text style={styles.subtitle}>
        {type === 'daycare'
          ? 'All plans include a 14-day free trial. No credit card required.'
          : 'Unlock HD photos, detailed reports, and milestone analytics.'}
      </Text>

      {plans.map((plan) => (
        <TouchableOpacity
          key={plan.id}
          style={[styles.planCard, plan.popular && styles.planCardPopular, selectedPlan === plan.id && styles.planCardSelected]}
          onPress={() => setSelectedPlan(plan.id)}
        >
          {plan.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planPriceNote}>{plan.priceNote}</Text>
            </View>
          </View>

          {plan.features.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons
                name={feature.included ? 'checkmark-circle' : 'close-circle-outline'}
                size={18}
                color={feature.included ? Colors.success : Colors.textMuted}
              />
              <Text style={[styles.featureText, !feature.included && styles.featureTextMuted]}>
                {feature.text}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.selectBtn, plan.popular && styles.selectBtnPopular]}
            onPress={() => handleSubscribe(plan.id)}
            disabled={isLoading}
          >
            {plan.popular ? (
              <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.selectBtnGradient}>
                {isLoading && selectedPlan === plan.id ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.selectBtnTextWhite}>
                    {type === 'daycare' ? 'Start Free Trial' : plan.id === 'free' ? 'Current Plan' : 'Upgrade Now'}
                  </Text>
                )}
              </LinearGradient>
            ) : (
              <View style={styles.selectBtnFlat}>
                <Text style={styles.selectBtnText}>
                  {type === 'daycare' ? 'Start Free Trial' : plan.id === 'free' ? 'Current Plan' : 'Select'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl, lineHeight: 22 },
  planCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.borderLight, ...Shadows.small },
  planCardPopular: { borderColor: Colors.primary },
  planCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '08' },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round },
  popularText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.white },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  planName: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
  planPriceNote: { fontSize: FontSizes.sm, color: Colors.textMuted, marginLeft: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  featureText: { fontSize: FontSizes.md, color: Colors.textPrimary },
  featureTextMuted: { color: Colors.textMuted },
  selectBtn: { marginTop: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  selectBtnPopular: {},
  selectBtnGradient: { alignItems: 'center', paddingVertical: Spacing.md },
  selectBtnFlat: { alignItems: 'center', paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: BorderRadius.lg },
  selectBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textSecondary },
  selectBtnTextWhite: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
});
