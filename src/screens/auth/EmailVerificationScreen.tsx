import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing, FontSizes, Shadows } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

interface EmailVerificationScreenProps {
  email: string;
  onBackToLogin: () => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  email,
  onBackToLogin,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setResent(true);
        // Reset after 30s to allow resending again
        setTimeout(() => setResent(false), 30000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={48} color={Colors.white} />
        </View>
        <Text style={styles.headerTitle}>Verify Your Email</Text>
        <Text style={styles.headerSubtitle}>Almost there!</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={[styles.card, Shadows.medium]}>
          <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
          <Text style={styles.cardTitle}>Account Created!</Text>
          <Text style={styles.cardText}>
            We've sent a verification link to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.cardText}>
            Please check your inbox and click the link to activate your account.
          </Text>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Didn't get the email?</Text>
          <View style={styles.tipRow}>
            <Ionicons name="folder-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tipText}>Check your spam or junk folder</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tipText}>Allow a few minutes for delivery</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="at-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tipText}>Verify the email address is correct</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.resendBtn, (isResending || resent) && styles.btnDisabled]}
          onPress={handleResend}
          disabled={isResending || resent}
        >
          {isResending ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Ionicons
                name={resent ? 'checkmark-outline' : 'refresh-outline'}
                size={18}
                color={resent ? Colors.success : Colors.primary}
              />
              <Text style={[styles.resendBtnText, resent && { color: Colors.success }]}>
                {resent ? 'Email Sent!' : 'Resend Verification Email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginBtn} onPress={onBackToLogin}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginBtnGradient}
          >
            <Ionicons name="log-in-outline" size={20} color={Colors.white} />
            <Text style={styles.loginBtnText}>Back to Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 80,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    color: Colors.white,
    fontWeight: '800',
    marginTop: Spacing.md,
  },
  headerSubtitle: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.xs,
  },
  content: { padding: Spacing.xl, flex: 1 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
    paddingVertical: Spacing.xs,
  },
  tips: { marginTop: Spacing.xl },
  tipsTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  btnDisabled: { opacity: 0.6 },
  resendBtnText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '700',
  },
  loginBtn: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  loginBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  loginBtnText: {
    fontSize: FontSizes.lg,
    color: Colors.white,
    fontWeight: '700',
  },
});
