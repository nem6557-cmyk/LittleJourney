import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export const InviteCodeScreen: React.FC = () => {
  const { redeemInviteCode, joinDemoDaycare, signOut, profile } = useAuth();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isJoiningDemo, setIsJoiningDemo] = useState(false);
  const [error, setError] = useState('');

  const handleRedeem = async () => {
    setError('');
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 8) {
      setError('Invite code must be 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { error: redeemError } = await redeemInviteCode(cleanCode);
      if (redeemError) {
        setError(redeemError);
      }
      // Success: AuthContext will refresh profile and AppNavigator will redirect
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
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
        <Ionicons name="ticket-outline" size={48} color={Colors.white} />
        <Text style={styles.headerTitle}>Enter Invite Code</Text>
        <Text style={styles.headerSubtitle}>
          {profile?.role === 'parent'
            ? 'Ask your daycare for an invite code to connect with your child.'
            : 'Enter the invite code from your daycare administrator.'}
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.codeContainer}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => { setCode(t.toUpperCase()); setError(''); }}
            placeholder="ENTER CODE"
            placeholderTextColor={Colors.textMuted}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            textAlign="center"
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.hint}>
          The code is 8 characters and was provided by your daycare. It looks like: <Text style={{ fontWeight: '700' }}>A1B2C3D4</Text>
        </Text>

        <TouchableOpacity
          style={[styles.redeemBtn, isLoading && styles.btnDisabled]}
          onPress={handleRedeem}
          disabled={isLoading || code.length !== 8}
        >
          <LinearGradient
            colors={code.length === 8 ? ['#667eea', '#764ba2'] : ['#ccc', '#aaa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.redeemBtnGradient}
          >
            {isLoading ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                <Text style={styles.redeemBtnText}>Join Daycare</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Demo daycare is a development/pilot affordance only — never shown in
            production so real users can't self-join the shared sample tenant. */}
        {__DEV__ && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.demoBtn, isJoiningDemo && styles.btnDisabled]}
              onPress={async () => {
                setIsJoiningDemo(true);
                setError('');
                const { error: joinError } = await joinDemoDaycare();
                if (joinError) {
                  setError(joinError);
                }
                setIsJoiningDemo(false);
              }}
              disabled={isJoiningDemo}
              accessibilityLabel="Join demo daycare"
              accessibilityRole="button"
            >
              {isJoiningDemo ? <ActivityIndicator color={Colors.primary} /> : (
                <>
                  <Ionicons name="school-outline" size={20} color={Colors.primary} />
                  <Text style={styles.demoBtnText}>Join Demo Daycare (Pilot)</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.demoHint}>
              Try the app with Sunshine Academy, a pre-configured demo daycare with sample children and classrooms.
            </Text>
          </>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out and use a different account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 80, paddingBottom: Spacing.xl, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl, paddingHorizontal: Spacing.xl },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800', marginTop: Spacing.md },
  headerSubtitle: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.sm, textAlign: 'center', lineHeight: 22 },
  content: { padding: Spacing.xl, flex: 1 },
  codeContainer: { marginTop: Spacing.xl },
  codeInput: { fontSize: 32, fontWeight: '800', letterSpacing: 8, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, borderWidth: 2, borderColor: Colors.borderLight, color: Colors.textPrimary, ...Shadows.small },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center', marginTop: Spacing.sm },
  hint: { fontSize: FontSizes.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg, lineHeight: 20 },
  redeemBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  btnDisabled: { opacity: 0.7 },
  redeemBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  redeemBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dividerText: { paddingHorizontal: Spacing.md, fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  demoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.card },
  demoBtnText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: '700' },
  demoHint: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18 },
  signOutBtn: { alignItems: 'center', marginTop: Spacing.xl },
  signOutText: { fontSize: FontSizes.sm, color: Colors.textMuted },
});
