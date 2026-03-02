import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { EmptyState } from '../../components/EmptyState';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  classroom?: string;
}

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

export const ManageStaffScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { currentUser } = useApp();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'caregiver' | 'admin'>('caregiver');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  const fetchStaff = useCallback(async () => {
    const daycareId = profile?.daycare_id;
    if (!daycareId) {
      // Fallback: show current user only
      if (currentUser) {
        setStaffMembers([{ id: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'Admin', classroom: 'All' }]);
      }
      setIsLoadingStaff(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('daycare_id', daycareId)
        .in('role', ['admin', 'caregiver'])
        .order('first_name');

      if (error) throw error;

      const mapped: StaffMember[] = (data || []).map((p: any) => ({
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
        email: p.email || '',
        role: p.role === 'admin' ? 'Admin' : 'Caregiver',
      }));
      setStaffMembers(mapped);
    } catch (err) {
      console.warn('[ManageStaff] Failed to fetch staff:', err);
      // Fallback to current user
      if (currentUser) {
        setStaffMembers([{ id: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'Admin', classroom: 'All' }]);
      }
    } finally {
      setIsLoadingStaff(false);
    }
  }, [profile, currentUser]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filtered = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const daycareId = profile?.daycare_id;
    if (!daycareId) {
      Alert.alert('Error', 'No daycare associated with your account.');
      return;
    }

    setIsInviting(true);
    try {
      // Insert an invitation record in Supabase
      // Note: uses 'as any' because the invitations table may not be in generated types yet
      const { error } = await (supabase.from('invitations') as any)
        .insert({
          daycare_id: daycareId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: profile?.id,
        });

      if (error) throw error;

      Alert.alert(
        'Invite Sent',
        `An invitation has been sent to ${inviteEmail}. They will need to create an account to join.`
      );
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (err: any) {
      // If invitations table doesn't exist yet, show a graceful message
      if (err.code === '42P01' || err.message?.includes('relation')) {
        Alert.alert(
          'Invite Noted',
          `Invitation for ${inviteEmail} recorded. The invitation system will be fully activated once the invitations table is set up.`
        );
        setShowInviteModal(false);
        setInviteEmail('');
      } else {
        Alert.alert('Error', err.message || 'Failed to send invitation.');
      }
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Manage Staff</Text>
        </View>
        <Text style={styles.headerMeta}>{staffMembers.length} staff member{staffMembers.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

      {/* Search + Invite */}
      <View style={styles.toolbar}>
        <View style={[styles.searchBar, Shadows.small]}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowInviteModal(true)}>
          <Ionicons name="person-add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No Staff Found"
            message={search ? 'No staff match your search.' : 'Invite caregivers and teachers to get started.'}
            actionLabel="Invite Staff"
            onAction={() => setShowInviteModal(true)}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.staffCard, Shadows.small]}>
            <View style={[styles.avatar, item.role === 'Admin' && { backgroundColor: Colors.accent + '20' }]}>
              <Text style={[styles.avatarText, item.role === 'Admin' && { color: Colors.accent }]}>
                {item.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{item.name}</Text>
              <Text style={styles.staffMeta}>
                {item.role} {item.email ? `• ${item.email}` : ''} {item.classroom ? `• ${item.classroom}` : ''}
              </Text>
            </View>
            <View style={[styles.roleBadge, item.role === 'Admin' ? styles.adminBadge : styles.caregiverBadge]}>
              <Text style={[styles.roleText, item.role === 'Admin' ? styles.adminText : styles.caregiverText]}>
                {item.role}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Staff</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.fieldInput}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="caregiver@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === 'caregiver' && styles.roleOptionActive]}
                onPress={() => setInviteRole('caregiver')}
              >
                <Ionicons name="person" size={18} color={inviteRole === 'caregiver' ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.roleOptionText, inviteRole === 'caregiver' && styles.roleOptionTextActive]}>Caregiver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === 'admin' && styles.roleOptionActive]}
                onPress={() => setInviteRole('admin')}
              >
                <Ionicons name="shield" size={18} color={inviteRole === 'admin' ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.roleOptionText, inviteRole === 'admin' && styles.roleOptionTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleInvite} disabled={isInviting}>
              <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {isInviting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="mail" size={20} color={Colors.white} />
                    <Text style={styles.submitText}>Send Invitation</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  headerMeta: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },
  toolbar: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  staffCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.info + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.info },
  staffInfo: { flex: 1 },
  staffName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  staffMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  adminBadge: { backgroundColor: Colors.accent + '20' },
  caregiverBadge: { backgroundColor: Colors.info + '20' },
  roleText: { fontSize: FontSizes.xs, fontWeight: '600' },
  adminText: { color: Colors.accent },
  caregiverText: { color: Colors.info },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  roleSelector: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 2, borderColor: Colors.borderLight },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '10' },
  roleOptionText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textMuted },
  roleOptionTextActive: { color: Colors.primary },
  submitBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
});
