import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { classroomsService, Classroom } from '../../services/classrooms.service';
import { EmptyState } from '../../components/EmptyState';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

export const ManageClassroomsScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { profile } = useAuth();
  const daycareId = profile?.daycare_id;

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAgeGroup, setNewAgeGroup] = useState('');
  const [newCapacity, setNewCapacity] = useState('12');
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgeGroup, setEditAgeGroup] = useState('');
  const [editCapacity, setEditCapacity] = useState('12');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadClassrooms = useCallback(async () => {
    if (!daycareId) {
      setClassrooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await classroomsService.list(daycareId);
      setClassrooms(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  }, [daycareId]);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  const parseCapacity = (raw: string): number => {
    const n = parseInt(raw.trim(), 10);
    if (Number.isNaN(n) || n <= 0) return 12;
    return n;
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('Required', 'Classroom name is required.');
      return;
    }
    if (!daycareId) {
      Alert.alert('Error', 'No daycare associated with your account.');
      return;
    }

    setIsAdding(true);
    try {
      await classroomsService.create({
        daycare_id: daycareId,
        name: newName.trim(),
        age_group: newAgeGroup.trim() || null,
        capacity: parseCapacity(newCapacity),
      });
      await loadClassrooms();
      Alert.alert('Success', `${newName.trim()} has been created.`);
      setShowAddModal(false);
      setNewName('');
      setNewAgeGroup('');
      setNewCapacity('12');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add classroom. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (classroom: Classroom) => {
    setEditId(classroom.id);
    setEditName(classroom.name);
    setEditAgeGroup(classroom.age_group || '');
    setEditCapacity(String(classroom.capacity));
  };

  const closeEditModal = () => {
    setEditId(null);
    setEditName('');
    setEditAgeGroup('');
    setEditCapacity('12');
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    if (!editName.trim()) {
      Alert.alert('Required', 'Classroom name is required.');
      return;
    }

    setIsSaving(true);
    try {
      await classroomsService.update(editId, {
        name: editName.trim(),
        age_group: editAgeGroup.trim() || null,
        capacity: parseCapacity(editCapacity),
      });
      await loadClassrooms();
      Alert.alert('Success', `${editName.trim()} has been updated.`);
      closeEditModal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update classroom.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    const name = editName.trim() || 'this classroom';
    Alert.alert(
      'Delete Classroom',
      `Are you sure you want to delete ${name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!editId) return;
            setIsDeleting(true);
            try {
              await classroomsService.remove(editId);
              await loadClassrooms();
              Alert.alert('Removed', `${name} has been deleted.`);
              closeEditModal();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete classroom.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>Manage Classrooms</Text>
        </View>
        <Text style={styles.headerMeta}>{classrooms.length} classrooms</Text>
      </LinearGradient>

      {/* Add */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarSpacer} />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              title="No Classrooms Found"
              message="No classrooms yet. Add your first classroom."
              actionLabel="Add Classroom"
              onAction={() => setShowAddModal(true)}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.classCard, Shadows.small]}
              onPress={() => openEditModal(item)}
            >
              <View style={styles.avatar}>
                <Ionicons name="business" size={20} color={Colors.primary} />
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{item.name}</Text>
                <Text style={styles.classMeta}>
                  {item.age_group || 'No age group'} • Capacity {item.capacity}
                </Text>
              </View>
              <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add Classroom Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Classroom</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Classroom name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Age Group</Text>
            <TextInput
              style={styles.fieldInput}
              value={newAgeGroup}
              onChangeText={setNewAgeGroup}
              placeholder="e.g. Toddlers (1-2)"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Capacity</Text>
            <TextInput
              style={styles.fieldInput}
              value={newCapacity}
              onChangeText={setNewCapacity}
              placeholder="12"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={isAdding}>
              <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {isAdding ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color={Colors.white} />
                    <Text style={styles.submitText}>Add Classroom</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Classroom Modal */}
      <Modal visible={editId !== null} animationType="slide" transparent onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Classroom</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Classroom name"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Age Group</Text>
            <TextInput
              style={styles.fieldInput}
              value={editAgeGroup}
              onChangeText={setEditAgeGroup}
              placeholder="e.g. Toddlers (1-2)"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Capacity</Text>
            <TextInput
              style={styles.fieldInput}
              value={editCapacity}
              onChangeText={setEditCapacity}
              placeholder="12"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveEdit} disabled={isSaving || isDeleting}>
              <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color={Colors.white} />
                    <Text style={styles.submitText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? (
                <ActivityIndicator color={Colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  <Text style={styles.deleteText}>Delete Classroom</Text>
                </>
              )}
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
  toolbarSpacer: { flex: 1 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  classCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  classInfo: { flex: 1 },
  className: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  classMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  submitBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  deleteText: { fontSize: FontSizes.md, color: Colors.danger, fontWeight: '700' },
});
