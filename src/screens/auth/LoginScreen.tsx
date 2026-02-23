import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface LoginScreenProps {
  onLogin: (role: 'parent' | 'caregiver') => void;
}

const onboardingSlides = [
  {
    emoji: '🦋',
    title: 'Welcome to Little Journey',
    subtitle: 'A living journal of your child\'s day',
    color: '#667eea',
  },
  {
    emoji: '📸',
    title: 'Real-Time Updates',
    subtitle: 'Photos, meals, naps, and milestones — as they happen',
    color: '#f093fb',
  },
  {
    emoji: '💬',
    title: 'Stay Connected',
    subtitle: 'Secure messaging with your child\'s caregivers',
    color: '#4facfe',
  },
  {
    emoji: '📊',
    title: 'Daily Reports',
    subtitle: 'AI-generated narratives of your child\'s wonderful day',
    color: '#fa709a',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [screen, setScreen] = useState<'onboarding' | 'login'>('onboarding');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'parent' | 'caregiver'>('parent');
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentSlide,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [currentSlide]);

  const handleNext = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setScreen('login');
    }
  };

  const handleLogin = () => {
    setIsLoading(true);
    // Simulate a brief loading state
    setTimeout(() => {
      setIsLoading(false);
      onLogin(selectedRole);
    }, 800);
  };

  const handleDemoLogin = (role: 'parent' | 'caregiver') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(role);
    }, 600);
  };

  if (screen === 'onboarding') {
    const slide = onboardingSlides[currentSlide];
    return (
      <LinearGradient
        colors={[slide.color, '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.onboardingContainer}
      >
        <Animated.View style={[styles.onboardingContent, { opacity: fadeAnim }]}>
          {/* Skip button */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setScreen('login')}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Slide content */}
          <View style={styles.slideContent}>
            <Text style={styles.slideEmoji}>{slide.emoji}</Text>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
          </View>

          {/* Pagination dots */}
          <View style={styles.pagination}>
            {onboardingSlides.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setCurrentSlide(i)}
                accessibilityLabel={`Go to slide ${i + 1}`}
                accessibilityRole="button"
              >
                <View
                  style={[styles.dot, i === currentSlide && styles.dotActive]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Next / Get Started button */}
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            accessibilityLabel={currentSlide === onboardingSlides.length - 1 ? 'Get started' : 'Next slide'}
            accessibilityRole="button"
          >
            <View style={styles.nextBtnInner}>
              <Text style={styles.nextBtnText}>
                {currentSlide === onboardingSlides.length - 1 ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.loginContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.loginScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loginHeader}
        >
          <Text style={styles.loginLogo}>🦋</Text>
          <Text style={styles.loginAppName}>Little Journey</Text>
          <Text style={styles.loginTagline}>A living journal of your child's day</Text>
        </LinearGradient>

        <View style={styles.loginForm}>
          {/* Role Selector */}
          <Text style={styles.formLabel}>I am a</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleOption, selectedRole === 'parent' && styles.roleOptionActive]}
              onPress={() => setSelectedRole('parent')}
              accessibilityLabel="Select parent role"
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRole === 'parent' }}
            >
              <Text style={styles.roleEmoji}>👨‍👩‍👧</Text>
              <Text style={[styles.roleText, selectedRole === 'parent' && styles.roleTextActive]}>Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleOption, selectedRole === 'caregiver' && styles.roleOptionActive]}
              onPress={() => setSelectedRole('caregiver')}
              accessibilityLabel="Select caregiver role"
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRole === 'caregiver' }}
            >
              <Text style={styles.roleEmoji}>👩‍🏫</Text>
              <Text style={[styles.roleText, selectedRole === 'caregiver' && styles.roleTextActive]}>Caregiver</Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <Text style={styles.formLabel}>Email</Text>
          <View style={[styles.inputContainer, Shadows.small]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Password */}
          <Text style={styles.formLabel}>Password</Text>
          <View style={[styles.inputContainer, Shadows.small]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            accessibilityLabel="Forgot password"
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInBtn, isLoading && styles.signInBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityLabel="Sign in"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInGradient}
            >
              {isLoading ? (
                <Text style={styles.signInText}>Signing in...</Text>
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                  <Text style={styles.signInText}>Sign In</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or try a demo</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Demo Buttons */}
          <View style={styles.demoRow}>
            <TouchableOpacity
              style={[styles.demoBtn, Shadows.small]}
              onPress={() => handleDemoLogin('parent')}
              accessibilityLabel="Try demo as parent"
              accessibilityRole="button"
            >
              <Text style={styles.demoBtnEmoji}>👨‍👩‍👧</Text>
              <Text style={styles.demoBtnText}>Parent Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoBtn, Shadows.small]}
              onPress={() => handleDemoLogin('caregiver')}
              accessibilityLabel="Try demo as caregiver"
              accessibilityRole="button"
            >
              <Text style={styles.demoBtnEmoji}>👩‍🏫</Text>
              <Text style={styles.demoBtnText}>Caregiver Demo</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerBadges}>
              <View style={styles.footerBadge}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
                <Text style={styles.footerBadgeText}>COPPA Compliant</Text>
              </View>
              <View style={styles.footerBadge}>
                <Ionicons name="lock-closed" size={14} color={Colors.primary} />
                <Text style={styles.footerBadgeText}>End-to-End Encrypted</Text>
              </View>
            </View>
            <Text style={styles.footerVersion}>Little Journey v1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ── Onboarding ──
  onboardingContainer: { flex: 1 },
  onboardingContent: { flex: 1, justifyContent: 'space-between', paddingTop: 60, paddingBottom: 50, paddingHorizontal: Spacing.lg },
  skipBtn: { alignSelf: 'flex-end', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  skipText: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  slideContent: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  slideEmoji: { fontSize: 80, marginBottom: Spacing.xl },
  slideTitle: { fontSize: FontSizes.xxxl, color: Colors.white, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.md },
  slideSubtitle: { fontSize: FontSizes.lg, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 26, maxWidth: 300 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: Colors.white, width: 28 },
  nextBtn: { alignSelf: 'center' },
  nextBtnInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.round, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, gap: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  nextBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },

  // ── Login ──
  loginContainer: { flex: 1, backgroundColor: Colors.background },
  loginScroll: { flexGrow: 1 },
  loginHeader: { paddingTop: 70, paddingBottom: Spacing.xxl, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  loginLogo: { fontSize: 56, marginBottom: Spacing.sm },
  loginAppName: { fontSize: FontSizes.xxxl, color: Colors.white, fontWeight: '800' },
  loginTagline: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },

  loginForm: { padding: Spacing.lg, marginTop: -Spacing.md },

  formLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm },

  roleSelector: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, borderWidth: 2, borderColor: Colors.borderLight, ...Shadows.small },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '12' },
  roleEmoji: { fontSize: 24 },
  roleText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  roleTextActive: { color: Colors.primary, fontWeight: '700' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  input: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },

  forgotBtn: { alignSelf: 'flex-end', marginTop: Spacing.sm },
  forgotText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },

  signInBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  signInBtnDisabled: { opacity: 0.7 },
  signInGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  signInText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dividerText: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '500' },

  demoRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  demoBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  demoBtnEmoji: { fontSize: 28 },
  demoBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },

  footer: { alignItems: 'center', marginTop: Spacing.xxl, paddingBottom: Spacing.lg },
  footerBadges: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  footerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round, ...Shadows.small },
  footerBadgeText: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '500' },
  footerVersion: { fontSize: FontSizes.xs, color: Colors.textMuted },
});
