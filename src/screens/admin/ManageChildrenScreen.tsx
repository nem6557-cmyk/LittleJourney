import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { childrenService } from '../../services/children.service';
import { EmptyState } from '../../components/EmptyState';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

export const ManageChildrenScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { children, selectedChild, selectChild } = useApp();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [newDateOfBirth, setNewDateOfBirth] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filtered = children.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }

    const daycareId = profile?.daycare_id;
    if (!daycareId) {
      Alert.alert('Error', 'No daycare associated with your account.');
      return;
    }

    setIsAdding(true);
    try {
      await childrenService.createChild({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        daycare_id: daycareId,
        date_of_birth: newDateOfBirth.trim() || new Date().toISOString().split('T')[0],
        classroom_id: null,
        avatar_url: null,
        medical_notes: null,
      });

      Alert.alert('Success', `${newFirstName} ${newLastName} has been enrolled.`);
      setShowAddModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewClassroom('');
      setNewDateOfBirth('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add child. Please try again.');
    } finally {
      setIsAdding(false);
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
          <Text style={styles.headerTitle}>Manage Children</Text>
        </View>
        <Text style={styles.headerMeta}>{children.length} children enrolled</Text>
      </LinearGradient>

      {/* Search + Add */}
      <View style={styles.toolbar}>
        <View style={[styles.searchBar, Shadows.small]}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search children..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.white} />
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
            title="No Children Found"
            message={search ? 'No children match your search.' : 'No children enrolled yet. Add your first child.'}
            actionLabel="Add Child"
            onAction={() => setShowAddModal(true)}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.childCard, Shadows.small]} onPress={() => selectChild(item.id)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.firstName.charAt(0)}</Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{item.firstName} {item.lastName}</Text>
              <Text style={styles.childMeta}>
                {item.classroom || 'Unassigned'} {item.allergies.length > 0 ? `• ${item.allergies.length} allergies` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      {/* Add Child Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Child</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>First Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={newFirstName}
              onChangeText={setNewFirstName}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Last Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={newLastName}
              onChangeText={setNewLastName}
              placeholder="Last name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={styles.fieldInput}
              value={newDateOfBirth}
              onChangeText={setNewDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Classroom</Text>
            <TextInput
              style={styles.fieldInput}
              value={newClassroom}
              onChangeText={setNewClassroom}
              placeholder="e.g. Butterfly Room (optional)"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={isAdding}>
              <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {isAdding ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color={Colors.white} />
                    <Text style={styles.submitText}>Add Child</Text>
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
  childCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  childInfo: { flex: 1 },
  childName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  childMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  submitBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
});
