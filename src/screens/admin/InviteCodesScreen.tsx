import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';

type InviteCode = {
  id: string;
  code: string;
  role: 'parent' | 'caregiver' | 'family';
  child_id: string | null;
  classroom_id: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

export const InviteCodesScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { profile, daycare } = useAuth();
  const { children } = useApp();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'parent' | 'caregiver'>('parent');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch existing invite codes
  const fetchCodes = useCallback(async () => {
    if (!profile?.daycare_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('daycare_id', profile.daycare_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCodes(data || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load invite codes');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.daycare_id]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  // Generate new invite code
  const handleGenerate = async () => {
    if (!profile?.daycare_id) return;

    setIsGenerating(true);
    try {
      const insertData: any = {
        daycare_id: profile.daycare_id,
        role: selectedRole,
        created_by: profile.id,
      };

      // Link to a child for parent invites
      if (selectedRole === 'parent' && selectedChildId) {
        insertData.child_id = selectedChildId;
      }

      const { data, error } = await supabase
        .from('invite_codes')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Refresh list
      await fetchCodes();

      Alert.alert(
        'Invite Code Created!',
        `Code: ${data.code}\n\nShare this code with the ${selectedRole} to join ${daycare?.name || 'your daycare'}.`,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(code);
      } else {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(code);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      Alert.alert('Code', code);
    }
  };

  const activeCodes = codes.filter((c) => !c.used_by && new Date(c.expires_at) > new Date());
  const usedCodes = codes.filter((c) => c.used_by);
  const expiredCodes = codes.filter((c) => !c.used_by && new Date(c.expires_at) <= new Date());

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntilExpiry = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#6C63FF', '#3F3D9E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            {navigation && (
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Invite Management</Text>
              <Text style={styles.headerTitle}>{daycare?.name || 'Your Daycare'}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activeCodes.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{usedCodes.length}</Text>
              <Text style={styles.statLabel}>Redeemed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{expiredCodes.length}</Text>
              <Text style={styles.statLabel}>Expired</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Generate Section */}
          <Text style={styles.sectionTitle}>Generate New Code</Text>
          <View style={[styles.generateCard, Shadows.small]}>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleOption, selectedRole === 'parent' && styles.roleOptionActive]}
                onPress={() => setSelectedRole('parent')}
              >
                <Text style={styles.roleEmoji}>👨‍👩‍👧</Text>
                <Text style={[styles.roleText, selectedRole === 'parent' && styles.roleTextActive]}>Parent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, selectedRole === 'caregiver' && styles.roleOptionActive]}
                onPress={() => setSelectedRole('caregiver')}
              >
                <Text style={styles.roleEmoji}>👩‍🏫</Text>
                <Text style={[styles.roleText, selectedRole === 'caregiver' && styles.roleTextActive]}>Caregiver</Text>
              </TouchableOpacity>
            </View>

            {/* Child selection for parent invites */}
            {selectedRole === 'parent' && children.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Link to Child (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
                  <TouchableOpacity
                    style={[styles.childChip, !selectedChildId && styles.childChipActive]}
                    onPress={() => setSelectedChildId(null)}
                  >
                    <Text style={[styles.childChipText, !selectedChildId && styles.childChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {children.map((child) => (
                    <TouchableOpacity
                      key={child.id}
                      style={[styles.childChip, selectedChildId === child.id && styles.childChipActive]}
                      onPress={() => setSelectedChildId(child.id)}
                    >
                      <Text style={[styles.childChipText, selectedChildId === child.id && styles.childChipTextActive]}>
                        {child.firstName} {child.lastName?.[0]}.
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={[styles.generateBtn, isGenerating && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateBtnGradient}
              >
                {isGenerating ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
                    <Text style={styles.generateBtnText}>Generate Invite Code</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Active Codes */}
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <>
              {activeCodes.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Active Codes</Text>
                  {activeCodes.map((code) => (
                    <TouchableOpacity
                      key={code.id}
                      style={[styles.codeCard, Shadows.small]}
                      onPress={() => copyToClipboard(code.code)}
                    >
                      <View style={styles.codeLeft}>
                        <View style={[styles.codeIcon, { backgroundColor: Colors.success + '15' }]}>
                          <Ionicons name="key" size={20} color={Colors.success} />
                        </View>
                        <View>
                          <Text style={styles.codeText}>{code.code}</Text>
                          <Text style={styles.codeMeta}>
                            {code.role} · expires in {daysUntilExpiry(code.expires_at)}d
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={copiedCode === code.code ? 'checkmark' : 'copy-outline'}
                        size={20}
                        color={copiedCode === code.code ? Colors.success : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {usedCodes.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Redeemed</Text>
                  {usedCodes.slice(0, 10).map((code) => (
                    <View key={code.id} style={[styles.codeCard, styles.codeCardUsed, Shadows.small]}>
                      <View style={styles.codeLeft}>
                        <View style={[styles.codeIcon, { backgroundColor: Colors.textMuted + '15' }]}>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.textMuted} />
                        </View>
                        <View>
                          <Text style={[styles.codeText, { color: Colors.textMuted }]}>{code.code}</Text>
                          <Text style={styles.codeMeta}>
                            {code.role} · used {formatDate(code.used_at || code.created_at)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {activeCodes.length === 0 && usedCodes.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="ticket-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Invite Codes Yet</Text>
                  <Text style={styles.emptyText}>
                    Generate invite codes above to invite parents and caregivers to join your daycare.
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.round,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    color: Colors.white,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  statLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  content: { padding: Spacing.lg },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  generateCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  roleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  roleEmoji: { fontSize: 24, marginBottom: Spacing.xs },
  roleText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  roleTextActive: { color: Colors.primary },
  childScroll: { marginBottom: Spacing.sm },
  childChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: Spacing.sm,
  },
  childChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  childChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
  childChipTextActive: { color: Colors.white },
  generateBtn: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.7 },
  generateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  generateBtnText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  codeCardUsed: { opacity: 0.6 },
  codeLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  codeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeText: {
    fontSize: FontSizes.md,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  codeMeta: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
});
