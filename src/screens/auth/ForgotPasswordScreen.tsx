import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { forgotPasswordSchema } from '../../lib/validators';

interface ForgotPasswordScreenProps {
  navigation?: any;
  onNavigateToLogin?: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation, onNavigateToLogin }) => {
  const { resetPassword } = useAuth();
  const goToLogin = () => navigation ? navigation.navigate('Login') : onNavigateToLogin?.();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.sentCard}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-open-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.sentTitle}>Check Your Email</Text>
          <Text style={styles.sentText}>
            We've sent a password reset link to <Text style={{ fontWeight: '700' }}>{email}</Text>. Please check your inbox and follow the instructions.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={goToLogin}>
            <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.backBtnGradient}>
              <Text style={styles.backBtnText}>Back to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backArrow} onPress={goToLogin}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Ionicons name="key-outline" size={48} color={Colors.white} />
          <Text style={styles.headerTitle}>Reset Password</Text>
          <Text style={styles.headerSubtitle}>Enter your email and we'll send you a reset link</Text>
        </LinearGradient>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.resetBtn, isLoading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={isLoading}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.resetBtnGradient}>
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color={Colors.white} />
                  <Text style={styles.resetBtnText}>Send Reset Link</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchBtn} onPress={goToLogin}>
            <Text style={styles.switchText}>
              Remember your password? <Text style={styles.link}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  backArrow: { position: 'absolute', left: Spacing.lg, top: 60 },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800', marginTop: Spacing.md },
  headerSubtitle: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl },
  form: { padding: Spacing.lg, marginTop: Spacing.md },
  label: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  inputBoxError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },
  errorText: { fontSize: FontSizes.xs, color: Colors.danger, marginTop: 4 },
  resetBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  btnDisabled: { opacity: 0.7 },
  resetBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  resetBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  switchBtn: { alignItems: 'center', marginTop: Spacing.xl },
  switchText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  link: { color: Colors.primary, fontWeight: '600' },
  // Sent state
  sentCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  sentIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  sentTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  sentText: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  backBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', width: '100%' },
  backBtnGradient: { alignItems: 'center', paddingVertical: Spacing.md },
  backBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
});
