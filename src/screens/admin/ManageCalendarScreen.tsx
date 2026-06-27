import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { calendarService } from '../../services/calendar.service';
import { EmptyState } from '../../components/EmptyState';
import type { DbCalendarEvent } from '../../types/database';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

type EventType = DbCalendarEvent['type'];

const EVENT_TYPES: { value: EventType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'event', label: 'Event', icon: 'calendar-outline' },
  { value: 'holiday', label: 'Holiday', icon: 'sunny-outline' },
  { value: 'closure', label: 'Closure', icon: 'lock-closed-outline' },
  { value: 'conference', label: 'Conference', icon: 'people-outline' },
];

const TYPE_LABELS: Record<EventType, string> = {
  event: 'Event',
  holiday: 'Holiday',
  closure: 'Closure',
  conference: 'Conference',
  vaccination: 'Vaccination',
  birthday: 'Birthday',
};

const formatEventDate = (startAt: string, allDay: boolean): string => {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  const datePart = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (allDay) return `${datePart} • All day`;
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
};

export const ManageCalendarScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { profile } = useAuth();
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newType, setNewType] = useState<EventType>('event');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const daycareId = profile?.daycare_id;
    if (!daycareId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const data = await calendarService.getEvents(daycareId, { from: nowIso });
      setEvents((data ?? []) as DbCalendarEvent[]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.daycare_id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewDate('');
    setNewTime('');
    setNewType('event');
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Title is required.');
      return;
    }

    const date = newDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const time = newTime.trim();
    const hasTime = time.length > 0;
    if (hasTime && !/^\d{2}:\d{2}$/.test(time)) {
      Alert.alert('Invalid Time', 'Please enter time as HH:MM (24-hour), or leave it blank.');
      return;
    }

    // Build a Date from the parts so we can validate it is a real calendar date.
    const isoCandidate = hasTime ? `${date}T${time}:00` : `${date}T00:00:00`;
    const start = new Date(isoCandidate);
    if (Number.isNaN(start.getTime())) {
      Alert.alert('Invalid Date', 'The date or time you entered is not a real date.');
      return;
    }

    const daycareId = profile?.daycare_id;
    const createdBy = profile?.id;
    if (!daycareId || !createdBy) {
      Alert.alert('Error', 'No daycare associated with your account.');
      return;
    }

    setIsAdding(true);
    try {
      await calendarService.createEvent({
        daycare_id: daycareId,
        classroom_id: null,
        type: newType,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        start_at: start.toISOString(),
        end_at: null,
        all_day: !hasTime,
        created_by: createdBy,
      });
      await loadEvents();
      Alert.alert('Success', `"${newTitle.trim()}" has been added to the calendar.`);
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = (item: DbCalendarEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await calendarService.deleteEvent(item.id);
              await loadEvents();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete event.');
            } finally {
              setDeletingId(null);
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
          <Text style={styles.headerTitle}>Manage Calendar</Text>
        </View>
        <Text style={styles.headerMeta}>{events.length} upcoming event{events.length === 1 ? '' : 's'}</Text>
      </LinearGradient>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>Upcoming Events</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Upcoming Events"
              message="No events scheduled yet. Add your first event."
              actionLabel="Add Event"
              onAction={() => setShowAddModal(true)}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.eventCard, Shadows.small]}>
              <View style={styles.eventIcon}>
                <Ionicons name="calendar" size={20} color={Colors.primary} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventMeta}>{formatEventDate(item.start_at, item.all_day)}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{TYPE_LABELS[item.type] ?? item.type}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                disabled={deletingId === item.id}
                style={styles.deleteIconBtn}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator color={Colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Event Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Optional details"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.fieldInput}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Time (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={newTime}
              onChangeText={setNewTime}
              placeholder="HH:MM (24-hour) — leave blank for all day"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => {
                const active = newType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setNewType(t.value)}
                  >
                    <Ionicons name={t.icon} size={16} color={active ? Colors.white : Colors.textSecondary} />
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={isAdding}>
              <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {isAdding ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="calendar" size={20} color={Colors.white} />
                    <Text style={styles.submitText}>Add Event</Text>
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
  toolbar: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center', justifyContent: 'space-between' },
  toolbarLabel: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  eventIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  eventMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  typeBadge: { alignSelf: 'flex-start', marginTop: Spacing.xs, backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.primary, textTransform: 'uppercase' },
  deleteIconBtn: { padding: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  fieldInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.background },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white },
  submitBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
});
