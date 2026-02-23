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
  const { redeemInviteCode, signOut, profile } = useAuth();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  signOutBtn: { alignItems: 'center', marginTop: Spacing.xl },
  signOutText: { fontSize: FontSizes.sm, color: Colors.textMuted },
});
