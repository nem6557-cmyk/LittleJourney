import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { signUpSchema } from '../../lib/validators';
import type { UserRole } from '../../types';

interface SignUpScreenProps {
  navigation?: any;
  onNavigateToLogin?: () => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation, onNavigateToLogin }) => {
  const { signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'parent' | 'caregiver' | 'admin'>('parent');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSignUp = async () => {
    setErrors({});

    // Validate
    const result = signUpSchema.safeParse({
      firstName, lastName, email, password, confirmPassword,
      role: selectedRole, agreeToTerms,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        role: selectedRole as UserRole,
      });

      if (error) {
        Alert.alert('Sign Up Failed', error.message);
      } else {
        Alert.alert(
          'Account Created!',
          'Your account has been created successfully. Please sign in to continue.',
          [{ text: 'Sign In', onPress: () => navigation ? navigation.navigate('Login') : onNavigateToLogin?.() }]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { key: 'parent' as const, emoji: '👨‍👩‍👧', label: 'Parent', desc: 'View your child\'s day' },
    { key: 'caregiver' as const, emoji: '👩‍🏫', label: 'Caregiver', desc: 'Log activities' },
    { key: 'admin' as const, emoji: '🏫', label: 'Daycare Admin', desc: 'Manage your center' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerEmoji}>🦋</Text>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join Little Journey today</Text>
        </LinearGradient>

        <View style={styles.form}>
          {/* Role Selection */}
          <Text style={styles.label}>I am a</Text>
          <View style={styles.roleRow}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.key}
                style={[styles.roleCard, selectedRole === role.key && styles.roleCardActive]}
                onPress={() => setSelectedRole(role.key)}
              >
                <Text style={styles.roleEmoji}>{role.emoji}</Text>
                <Text style={[styles.roleLabel, selectedRole === role.key && styles.roleLabelActive]}>{role.label}</Text>
                <Text style={styles.roleDesc}>{role.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>First Name</Text>
              <View style={[styles.inputBox, errors.firstName && styles.inputBoxError]}>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={Colors.textMuted} />
              </View>
              {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Last Name</Text>
              <View style={[styles.inputBox, errors.lastName && styles.inputBoxError]}>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={Colors.textMuted} />
              </View>
              {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
            </View>
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number" placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputBox, errors.confirmPassword && styles.inputBoxError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showPassword} />
          </View>
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

          {/* Terms checkbox */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreeToTerms(!agreeToTerms)}>
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
            <Text style={styles.checkText}>
              I agree to the <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
          {errors.agreeToTerms && <Text style={styles.errorText}>{errors.agreeToTerms}</Text>}

          {/* COPPA notice for parents */}
          {selectedRole === 'parent' && (
            <View style={styles.coppaNotice}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.coppaText}>
                By signing up, you provide parental consent under COPPA for your child's data to be collected by the daycare. You can revoke consent at any time.
              </Text>
            </View>
          )}

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpBtn, isLoading && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color={Colors.white} />
                  <Text style={styles.btnText}>Create Account</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Navigate to Login */}
          <TouchableOpacity style={styles.switchBtn} onPress={() => navigation ? navigation.navigate('Login') : onNavigateToLogin?.()}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.link}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  headerSubtitle: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },
  form: { padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', gap: Spacing.sm },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 2, borderColor: Colors.borderLight, ...Shadows.small },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '12' },
  roleEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  roleLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary },
  roleLabelActive: { color: Colors.primary },
  roleDesc: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  inputBoxError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },
  errorText: { fontSize: FontSizes.xs, color: Colors.danger, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.lg },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkText: { flex: 1, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  link: { color: Colors.primary, fontWeight: '600' },
  coppaNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.success + '12', borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  coppaText: { flex: 1, fontSize: FontSizes.xs, color: Colors.textSecondary, lineHeight: 18 },
  signUpBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  btnDisabled: { opacity: 0.7 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  btnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  switchBtn: { alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xxl },
  switchText: { fontSize: FontSizes.md, color: Colors.textSecondary },
});
