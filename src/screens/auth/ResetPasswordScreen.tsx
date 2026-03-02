import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

interface ResetPasswordScreenProps {
  onComplete: () => void;
}

export const ResetPasswordScreen = ({ onComplete }: ResetPasswordScreenProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => onComplete(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSubtext}>Redirecting you to the app...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.logo}>🦋</Text>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>Enter your new password below</Text>
      </LinearGradient>

      <View style={styles.form}>
        <Text style={styles.label}>New Password</Text>
        <View style={[styles.inputContainer, Shadows.small]}>
          <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <View style={[styles.inputContainer, Shadows.small]}>
          <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {newPassword.length > 0 && newPassword.length < 8 && (
          <Text style={styles.hint}>Password must be at least 8 characters</Text>
        )}
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text style={styles.hint}>Passwords do not match</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (!isValid || isSubmitting) && styles.buttonDisabled]}
          disabled={!isValid || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 80,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  logo: { fontSize: 48, marginBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.xs },
  form: { padding: Spacing.xl },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },
  hint: { fontSize: FontSizes.sm, color: Colors.warning, marginTop: Spacing.xs },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, marginTop: Spacing.sm },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.white },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  successTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.lg },
  successSubtext: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: Spacing.sm },
});
