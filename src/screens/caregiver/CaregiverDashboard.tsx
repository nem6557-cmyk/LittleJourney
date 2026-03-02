import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { formatTime, getActivityEmoji } from '../../utils/helpers';
import { ActivityType, MoodType } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage.service';
import { CaregiverSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';

const quickActions: { type: ActivityType; label: string; emoji: string; color: string }[] = [
  { type: 'meal', label: 'Meal', emoji: '🍽️', color: Colors.meal },
  { type: 'nap', label: 'Nap', emoji: '😴', color: Colors.nap },
  { type: 'diaper', label: 'Diaper', emoji: '👶', color: Colors.diaper },
  { type: 'activity', label: 'Activity', emoji: '🎨', color: Colors.activity },
  { type: 'photo', label: 'Photo', emoji: '📸', color: Colors.photo },
  { type: 'milestone', label: 'Milestone', emoji: '🌟', color: Colors.milestone },
  { type: 'note', label: 'Note', emoji: '📝', color: Colors.note },
  { type: 'medication', label: 'Medicine', emoji: '💊', color: Colors.medication },
];

const moodOptions: { mood: MoodType; emoji: string; label: string }[] = [
  { mood: 'happy', emoji: '😊', label: 'Happy' },
  { mood: 'calm', emoji: '😌', label: 'Calm' },
  { mood: 'playful', emoji: '🤪', label: 'Playful' },
  { mood: 'sleepy', emoji: '😴', label: 'Sleepy' },
  { mood: 'fussy', emoji: '😫', label: 'Fussy' },
];

const mealTypes = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const mealAmounts = ['All', 'Most', 'Some', 'None'];
const diaperTypes = ['Wet', 'Dirty', 'Both', 'Dry'];
const incidentTypes = ['Fall', 'Bite', 'Scratch', 'Bump', 'Allergic Reaction', 'Illness', 'Other'];
const severityOptions = ['Minor', 'Moderate', 'Serious'];

export const CaregiverDashboard = () => {
  const {
    currentUser, children, selectedChild, selectChild,
    timelineEntries, addTimelineEntry, isCheckedIn, toggleCheckIn,
    showAlert, attendance, updateAttendance, addIncident, addNotification,
  } = useApp();
  const { profile: authProfile, isDemoMode } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<typeof quickActions[0] | null>(null);
  const [logNote, setLogNote] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType>('happy');
  const [selectedMealType, setSelectedMealType] = useState('Lunch');
  const [selectedAmount, setSelectedAmount] = useState('Most');
  const [selectedDiaper, setSelectedDiaper] = useState('Wet');
  const [napAction, setNapAction] = useState<'sleeping' | 'woke_up'>('sleeping');
  const [mealItems, setMealItems] = useState('');

  // Medication form state
  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  // Milestone form state
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneCategory, setMilestoneCategory] = useState('cognitive');
  // Incident form state
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentType, setIncidentType] = useState('Fall');
  const [incidentSeverity, setIncidentSeverity] = useState('Minor');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentAction, setIncidentAction] = useState('');

  // Attendance modal state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Photo attachments
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setAttachedPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setAttachedPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removePhoto = (index: number) => {
    setAttachedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const childEntries = useMemo(
    () =>
      timelineEntries
        .filter((e) => e.childId === selectedChild.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [timelineEntries, selectedChild.id]
  );

  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;

  const handleQuickAction = (action: typeof quickActions[0]) => {
    setSelectedAction(action);
    setLogNote('');
    setAttachedPhotos([]);
    setMedicationName('');
    setMedicationDosage('');
    setMealItems('');
    setMilestoneTitle('');
    setMilestoneCategory('cognitive');
    if (action.type === 'photo') {
      // For photo type, immediately open picker then show form
      pickImage();
    }
    setShowLogModal(true);
  };

  // Upload photos to Supabase Storage, returning public/signed URLs
  const uploadPhotos = async (uris: string[]): Promise<string[]> => {
    const daycareId = authProfile?.daycare_id;
    if (!daycareId || isDemoMode) return uris; // In demo mode, keep local URIs
    const uploaded: string[] = [];
    for (const uri of uris) {
      try {
        const url = await storageService.uploadTimelinePhoto(daycareId, selectedChild.id, uri);
        uploaded.push(url);
      } catch (err) {
        console.warn('[CaregiverDashboard] Photo upload failed, using local URI:', err);
        uploaded.push(uri); // Graceful fallback
      }
    }
    return uploaded;
  };

  const submitLog = async () => {
    if (!selectedAction || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let title = `${selectedAction.emoji} ${selectedAction.label}`;
      let description = logNote || undefined;
      let details: Record<string, any> = {};

      switch (selectedAction.type) {
        case 'meal':
          title = selectedMealType;
          const items = mealItems.split(',').map((s) => s.trim()).filter(Boolean);
          details = { mealType: selectedMealType.toLowerCase(), amount: selectedAmount.toLowerCase(), items: items.length > 0 ? items : undefined };
          if (!description) description = `${selectedMealType}${items.length > 0 ? ` — ${items.join(', ')}` : ''} — ate ${selectedAmount.toLowerCase()}.`;
          break;
        case 'nap':
          title = napAction === 'sleeping' ? 'Nap Time Started' : 'Woke Up from Nap';
          details = { status: napAction };
          if (napAction === 'woke_up') {
            const lastSleep = [...timelineEntries]
              .filter((e) => e.childId === selectedChild.id && e.type === 'nap' && e.details?.status === 'sleeping')
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            if (lastSleep) {
              const diffMs = Date.now() - new Date(lastSleep.timestamp).getTime();
              const hours = Math.floor(diffMs / 3600000);
              const mins = Math.floor((diffMs % 3600000) / 60000);
              const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              details.duration = duration;
              details.startTime = lastSleep.timestamp;
              if (!description) description = `Napped for ${duration}. Woke up refreshed.`;
            }
          }
          break;
        case 'diaper':
          title = 'Diaper Change';
          details = { diaperType: selectedDiaper.toLowerCase() };
          if (!description) description = `${selectedDiaper} diaper.`;
          break;
        case 'milestone':
          title = milestoneTitle || 'New Milestone!';
          details = { milestone: milestoneTitle, category: milestoneCategory };
          if (!description) description = `${selectedChild.firstName} reached a new milestone: ${milestoneTitle || 'Amazing achievement'}!`;
          break;
        case 'medication':
          title = medicationName ? `Medicine: ${medicationName}` : 'Medication Administered';
          details = { medication: medicationName, dosage: medicationDosage, administeredAt: new Date().toISOString() };
          if (!description) description = `${medicationName || 'Medication'}${medicationDosage ? ` — ${medicationDosage}` : ''} administered.`;
          break;
        case 'photo':
          title = logNote || 'Fun Moment!';
          if (!description) description = logNote || `A fun moment captured for ${selectedChild.firstName}!`;
          break;
      }

      // Upload photos to Supabase Storage before creating the entry
      const photoUrls = attachedPhotos.length > 0 ? await uploadPhotos(attachedPhotos) : undefined;

      addTimelineEntry({
        childId: selectedChild.id, type: selectedAction.type, title, description, details,
        mood: selectedMood, photos: photoUrls,
      });
      setShowLogModal(false);
      setLogNote('');
      setAttachedPhotos([]);
      setSelectedAction(null);
      showAlert('Logged!', `${selectedAction.label} entry saved for ${selectedChild.firstName}.`);
    } catch (err) {
      console.error('[CaregiverDashboard] submitLog error:', err);
      showAlert('Error', 'Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitIncident = () => {
    if (!incidentDesc.trim() || !incidentLocation.trim()) {
      showAlert('Missing Information', 'Please fill in the location and description.');
      return;
    }
    addIncident({
      childId: selectedChild.id,
      childName: `${selectedChild.firstName} ${selectedChild.lastName}`,
      type: incidentType.toLowerCase().replace(' ', '_') as any,
      severity: incidentSeverity.toLowerCase() as any,
      location: incidentLocation,
      description: incidentDesc,
      actionTaken: incidentAction || 'Monitored and comforted.',
      parentNotified: true,
      witnessName: currentUser.name,
    });
    setShowIncidentModal(false);
    setIncidentType('Fall');
    setIncidentSeverity('Minor');
    setIncidentLocation('');
    setIncidentDesc('');
    setIncidentAction('');
    showAlert('Incident Reported', `Incident report filed for ${selectedChild.firstName}. Parent has been notified.`);
  };

  const handleCheckOut = () => {
    Alert.alert(`Check Out ${selectedChild.firstName}?`, 'This will record the checkout time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check Out', style: 'destructive', onPress: toggleCheckIn },
    ]);
  };

  const handleCheckIn = () => {
    Alert.alert(`Check In ${selectedChild.firstName}?`, 'This will record the check-in time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check In', onPress: toggleCheckIn },
    ]);
  };

  const handleEmergency = () => {
    Alert.alert(
      '🚨 Emergency Alert',
      'This will send an immediate alert to all parents and administrators. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Alert', style: 'destructive', onPress: () => {
          addNotification({
            type: 'alert',
            title: '🚨 Emergency Alert',
            body: `Emergency alert issued by ${currentUser.name} for ${selectedChild.classroom || 'classroom'}. Please check in immediately.`,
            read: false,
            icon: '🚨',
          });
          addTimelineEntry({
            childId: selectedChild.id,
            type: 'incident',
            title: '🚨 Emergency Alert Issued',
            description: `Emergency alert sent to all parents and staff by ${currentUser.name}.`,
            isUrgent: true,
          });
          showAlert('Alert Sent', 'Emergency notification sent to all parents and staff.');
        }},
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return Colors.success;
      case 'late': return Colors.warning;
      case 'absent': return Colors.danger;
      case 'excused': return Colors.info;
      default: return Colors.textMuted;
    }
  };

  if (!currentUser || !selectedChild) {
    return (
      <View style={styles.container}>
        <CaregiverSkeleton />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="people-outline"
          title="No Children Assigned"
          message="No children have been assigned to your classroom yet. Please contact your admin."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#4facfe', '#00f2fe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                {new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 17 ? 'Good afternoon,' : 'Good evening,'}
              </Text>
              <Text style={styles.headerTitle}>{currentUser.name}</Text>
            </View>
            <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergency}>
              <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </View>
          <View style={styles.classInfo}>
            <Ionicons name="people" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.classText}>
              {selectedChild.classroom || 'Classroom'} {'\u2022'} {presentCount} children present
            </Text>
          </View>
        </LinearGradient>

        {/* Active Children */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Active Children</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {children.map((child) => {
              const isActive = child.id === selectedChild.id;
              return (
                <TouchableOpacity key={child.id} style={[styles.childChip, isActive && styles.childChipActive]} onPress={() => selectChild(child.id)}>
                  <View style={[styles.chipAvatar, { backgroundColor: isActive ? Colors.white : Colors.primaryLight + '30' }]}>
                    <Text style={[styles.chipAvatarText, { color: Colors.primary }]}>{child.firstName.charAt(0)}</Text>
                  </View>
                  <Text style={[styles.chipName, isActive && styles.chipNameActive]}>
                    {child.firstName} {child.lastName.charAt(0)}.
                  </Text>
                  {child.allergies.length > 0 && <View style={[styles.chipStatus, { backgroundColor: Colors.warning }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Quick Log for {selectedChild.firstName}</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.type} style={[styles.actionCard, Shadows.small]} onPress={() => handleQuickAction(action)} accessibilityLabel={`Log ${action.label} for ${selectedChild.firstName}`} accessibilityRole="button">
                <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                  <Text style={styles.actionEmoji}>{action.emoji}</Text>
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Extra Actions Row */}
        <View style={styles.sectionPad}>
          <View style={styles.extraRow}>
            <TouchableOpacity style={[styles.extraBtn, Shadows.small]} onPress={() => setShowIncidentModal(true)}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.danger} />
              <Text style={[styles.extraBtnText, { color: Colors.danger }]}>Incident Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.extraBtn, Shadows.small]} onPress={() => setShowAttendanceModal(true)}>
              <Ionicons name="clipboard-outline" size={20} color={Colors.info} />
              <Text style={[styles.extraBtnText, { color: Colors.info }]}>Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mood Check */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Current Mood</Text>
          <View style={[styles.moodRow, Shadows.small]}>
            {moodOptions.map((option) => (
              <TouchableOpacity
                key={option.mood}
                style={[styles.moodChip, selectedMood === option.mood && styles.moodChipActive]}
                onPress={() => {
                  setSelectedMood(option.mood);
                  addTimelineEntry({ childId: selectedChild.id, type: 'mood', title: `Mood: ${option.label}`, mood: option.mood });
                }}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
                <Text style={[styles.moodLabel, selectedMood === option.mood && styles.moodLabelActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Allergy Alerts */}
        {selectedChild.allergies.length > 0 && (
          <View style={styles.sectionPad}>
            <View style={[styles.alertCard, Shadows.small]}>
              <Ionicons name="warning" size={20} color={Colors.danger} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Allergy Alert — {selectedChild.firstName} {selectedChild.lastName}</Text>
                <Text style={styles.alertText}>{selectedChild.allergies.join(', ')} — Avoid contact</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Recent Log</Text>
          {childEntries.length === 0 && (
            <View style={[styles.emptyCard, Shadows.small]}>
              <Text style={styles.emptyText}>No entries yet for {selectedChild.firstName} today.</Text>
              <Text style={styles.emptySubtext}>Use the quick actions above to start logging.</Text>
            </View>
          )}
          {childEntries.slice(0, 8).map((entry) => (
            <View key={entry.id} style={[styles.logItem, Shadows.small]}>
              <Text style={styles.logEmoji}>{getActivityEmoji(entry.type)}</Text>
              <View style={styles.logContent}>
                <Text style={styles.logTitle}>{entry.title}</Text>
                {entry.description && <Text style={styles.logDesc} numberOfLines={1}>{entry.description}</Text>}
              </View>
              <Text style={styles.logTime}>{formatTime(entry.timestamp)}</Text>
            </View>
          ))}
        </View>

        {/* Check-in / Check-out */}
        <View style={styles.sectionPad}>
          <TouchableOpacity style={[styles.checkButton, Shadows.medium]} onPress={isCheckedIn ? handleCheckOut : handleCheckIn}>
            <LinearGradient
              colors={isCheckedIn ? ['#FF5722', '#FF9800'] : ['#4CAF50', '#8BC34A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.checkGradient}
            >
              <Ionicons name={isCheckedIn ? 'log-out-outline' : 'log-in-outline'} size={22} color={Colors.white} />
              <Text style={styles.checkText}>
                {isCheckedIn ? `Check Out ${selectedChild.firstName}` : `Check In ${selectedChild.firstName}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Log Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedAction?.emoji} Log {selectedAction?.label}</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalChild}>For: {selectedChild.firstName} {selectedChild.lastName}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedAction?.type === 'meal' && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>Meal Type</Text>
                  <View style={styles.optionRow}>
                    {mealTypes.map((m) => (
                      <TouchableOpacity key={m} style={[styles.optionChip, selectedMealType === m && styles.optionChipSelected]} onPress={() => setSelectedMealType(m)}>
                        <Text style={[styles.optionChipText, selectedMealType === m && styles.optionChipTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.optionLabel}>Food Items (comma separated)</Text>
                  <TextInput style={styles.noteInput} placeholder="e.g. Oatmeal, Milk, Berries..." placeholderTextColor={Colors.textMuted} value={mealItems} onChangeText={setMealItems} />
                  <Text style={styles.optionLabel}>Amount Eaten</Text>
                  <View style={styles.optionRow}>
                    {mealAmounts.map((a) => (
                      <TouchableOpacity key={a} style={[styles.optionChip, selectedAmount === a && styles.optionChipSelected]} onPress={() => setSelectedAmount(a)}>
                        <Text style={[styles.optionChipText, selectedAmount === a && styles.optionChipTextSelected]}>{a}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {selectedAction?.type === 'nap' && (
                <View style={styles.optionGroup}>
                  <View style={styles.optionRow}>
                    <TouchableOpacity style={[styles.optionChip, napAction === 'sleeping' && { backgroundColor: Colors.nap + '20' }]} onPress={() => setNapAction('sleeping')}>
                      <Text style={[styles.optionChipText, napAction === 'sleeping' && { color: Colors.nap, fontWeight: '700' }]}>Started Napping</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.optionChip, napAction === 'woke_up' && { backgroundColor: Colors.nap + '20' }]} onPress={() => setNapAction('woke_up')}>
                      <Text style={[styles.optionChipText, napAction === 'woke_up' && { color: Colors.nap, fontWeight: '700' }]}>Woke Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {selectedAction?.type === 'diaper' && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>Diaper Type</Text>
                  <View style={styles.optionRow}>
                    {diaperTypes.map((d) => (
                      <TouchableOpacity key={d} style={[styles.optionChip, selectedDiaper === d && styles.optionChipSelected]} onPress={() => setSelectedDiaper(d)}>
                        <Text style={[styles.optionChipText, selectedDiaper === d && styles.optionChipTextSelected]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {selectedAction?.type === 'medication' && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>Medication Name</Text>
                  <TextInput style={styles.noteInput} placeholder="e.g. Tylenol, Benadryl..." placeholderTextColor={Colors.textMuted} value={medicationName} onChangeText={setMedicationName} />
                  <Text style={styles.optionLabel}>Dosage</Text>
                  <TextInput style={styles.noteInput} placeholder="e.g. 5ml, 1 tablet..." placeholderTextColor={Colors.textMuted} value={medicationDosage} onChangeText={setMedicationDosage} />
                </View>
              )}
              {selectedAction?.type === 'milestone' && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>Milestone Title</Text>
                  <TextInput style={styles.noteInput} placeholder="e.g. Counted to 10, First words..." placeholderTextColor={Colors.textMuted} value={milestoneTitle} onChangeText={setMilestoneTitle} />
                  <Text style={styles.optionLabel}>Category</Text>
                  <View style={styles.optionRow}>
                    {['cognitive', 'motor', 'social', 'language', 'self_care'].map((cat) => (
                      <TouchableOpacity key={cat} style={[styles.optionChip, milestoneCategory === cat && styles.optionChipSelected]} onPress={() => setMilestoneCategory(cat)}>
                        <Text style={[styles.optionChipText, milestoneCategory === cat && styles.optionChipTextSelected]}>{cat.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <Text style={styles.optionLabel}>{selectedAction?.type === 'photo' ? 'Caption (optional)' : 'Note (optional)'}</Text>
              <TextInput style={styles.noteInput} placeholder="Add details..." placeholderTextColor={Colors.textMuted} value={logNote} onChangeText={setLogNote} multiline numberOfLines={3} />

              {/* Photo attachment */}
              <Text style={styles.optionLabel}>Photos</Text>
              <View style={styles.photoAttachRow}>
                <TouchableOpacity style={styles.photoAttachBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={22} color={Colors.primary} />
                  <Text style={styles.photoAttachText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoAttachBtn} onPress={pickImage}>
                  <Ionicons name="images" size={22} color={Colors.secondary} />
                  <Text style={[styles.photoAttachText, { color: Colors.secondary }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
              {attachedPhotos.length > 0 && (
                <View style={styles.attachedPreview}>
                  {attachedPhotos.map((uri, idx) => (
                    <View key={idx} style={styles.attachedItem}>
                      <Image source={{ uri }} style={styles.attachedThumbImage} resizeMode="cover" />
                      <Text style={styles.attachedName} numberOfLines={1}>Photo {idx + 1}</Text>
                      <TouchableOpacity onPress={() => removePhoto(idx)}>
                        <Ionicons name="close-circle" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.submitButton} onPress={submitLog} disabled={isSubmitting}>
                <LinearGradient colors={isSubmitting ? [Colors.textMuted, Colors.textMuted] : [Colors.primary, Colors.primaryDark]} style={styles.submitGradient}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="checkmark" size={22} color={Colors.white} />
                  )}
                  <Text style={styles.submitText}>{isSubmitting ? 'Saving...' : 'Save Entry'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Incident Report Modal */}
      <Modal visible={showIncidentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚨 Incident Report</Text>
              <TouchableOpacity onPress={() => setShowIncidentModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalChild}>For: {selectedChild.firstName} {selectedChild.lastName}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.optionLabel}>Type of Incident</Text>
              <View style={styles.optionRow}>
                {incidentTypes.map((t) => (
                  <TouchableOpacity key={t} style={[styles.optionChip, incidentType === t && styles.optionChipSelected]} onPress={() => setIncidentType(t)}>
                    <Text style={[styles.optionChipText, incidentType === t && styles.optionChipTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.optionLabel}>Severity</Text>
              <View style={styles.optionRow}>
                {severityOptions.map((s) => (
                  <TouchableOpacity key={s} style={[styles.optionChip, incidentSeverity === s && { backgroundColor: s === 'Serious' ? Colors.danger : s === 'Moderate' ? Colors.warning : Colors.success }]} onPress={() => setIncidentSeverity(s)}>
                    <Text style={[styles.optionChipText, incidentSeverity === s && { color: Colors.white, fontWeight: '700' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.optionLabel}>Location *</Text>
              <TextInput style={styles.singleInput} placeholder="e.g. Outdoor Playground" placeholderTextColor={Colors.textMuted} value={incidentLocation} onChangeText={setIncidentLocation} />

              <Text style={styles.optionLabel}>Description *</Text>
              <TextInput style={styles.noteInput} placeholder="What happened..." placeholderTextColor={Colors.textMuted} value={incidentDesc} onChangeText={setIncidentDesc} multiline numberOfLines={4} />

              <Text style={styles.optionLabel}>Action Taken</Text>
              <TextInput style={styles.noteInput} placeholder="What was done to help..." placeholderTextColor={Colors.textMuted} value={incidentAction} onChangeText={setIncidentAction} multiline numberOfLines={3} />

              <TouchableOpacity style={styles.submitButton} onPress={submitIncident}>
                <LinearGradient colors={[Colors.danger, '#FF7043']} style={styles.submitGradient}>
                  <Ionicons name="document-text" size={22} color={Colors.white} />
                  <Text style={styles.submitText}>Submit Report</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attendance Modal */}
      <Modal visible={showAttendanceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Attendance</Text>
              <TouchableOpacity onPress={() => setShowAttendanceModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.attendanceSummary}>
              <View style={[styles.attendanceStat, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.attendanceStatNum, { color: Colors.success }]}>{attendance.filter((a) => a.status === 'present').length}</Text>
                <Text style={styles.attendanceStatLabel}>Present</Text>
              </View>
              <View style={[styles.attendanceStat, { backgroundColor: Colors.warningLight }]}>
                <Text style={[styles.attendanceStatNum, { color: Colors.warning }]}>{attendance.filter((a) => a.status === 'late').length}</Text>
                <Text style={styles.attendanceStatLabel}>Late</Text>
              </View>
              <View style={[styles.attendanceStat, { backgroundColor: Colors.dangerLight }]}>
                <Text style={[styles.attendanceStatNum, { color: Colors.danger }]}>{attendance.filter((a) => a.status === 'absent').length}</Text>
                <Text style={styles.attendanceStatLabel}>Absent</Text>
              </View>
              <View style={[styles.attendanceStat, { backgroundColor: Colors.infoLight }]}>
                <Text style={[styles.attendanceStatNum, { color: Colors.info }]}>{attendance.filter((a) => a.status === 'excused').length}</Text>
                <Text style={styles.attendanceStatLabel}>Excused</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {attendance.map((record) => (
                <View key={record.childId} style={styles.attendanceRow}>
                  <View style={styles.attendanceAvatar}>
                    <Text style={styles.attendanceAvatarText}>{record.childName.charAt(0)}</Text>
                  </View>
                  <View style={styles.attendanceInfo}>
                    <Text style={styles.attendanceName}>{record.childName}</Text>
                    {record.checkInTime && <Text style={styles.attendanceTime}>In: {formatTime(record.checkInTime)}</Text>}
                    {record.checkOutTime && <Text style={styles.attendanceTime}>Out: {formatTime(record.checkOutTime)}</Text>}
                    {record.note && <Text style={styles.attendanceNote}>{record.note}</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) + '20' }]}
                    onPress={() => {
                      const statuses = ['present', 'late', 'absent', 'excused'] as const;
                      const idx = statuses.indexOf(record.status as any);
                      const next = statuses[(idx + 1) % statuses.length];
                      updateAttendance(record.childId, { status: next });
                    }}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)' },
  headerTitle: { fontSize: FontSizes.xxxl, color: Colors.white, fontWeight: '800' },
  emergencyBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  classInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  classText: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  sectionPad: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  childChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.round, paddingRight: Spacing.md, paddingLeft: 4, paddingVertical: 4, marginRight: Spacing.sm, ...Shadows.small },
  childChipActive: { backgroundColor: Colors.primary },
  chipAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  chipAvatarText: { fontSize: FontSizes.sm, fontWeight: '700' },
  chipName: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600', marginLeft: Spacing.sm },
  chipNameActive: { color: Colors.white },
  chipStatus: { width: 8, height: 8, borderRadius: 4, marginLeft: Spacing.sm },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', width: '22%', minWidth: 72, flexGrow: 1, maxWidth: '25%' },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600' },
  extraRow: { flexDirection: 'row', gap: Spacing.sm },
  extraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  extraBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },
  moodRow: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: Spacing.xs },
  moodChip: { flex: 1, alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md },
  moodChipActive: { backgroundColor: Colors.primaryLight + '20' },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 4 },
  moodLabelActive: { color: Colors.primary, fontWeight: '600' },
  alertCard: { flexDirection: 'row', backgroundColor: Colors.dangerLight, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.md },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.danger },
  alertText: { fontSize: FontSizes.sm, color: Colors.danger, opacity: 0.8, marginTop: 2 },
  emptyCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  logEmoji: { fontSize: 24 },
  logContent: { flex: 1 },
  logTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  logDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  logTime: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '500' },
  checkButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  checkGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  checkText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  modalChild: { fontSize: FontSizes.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  optionGroup: { marginBottom: Spacing.md },
  optionLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  optionChip: { backgroundColor: Colors.background, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round },
  optionChipSelected: { backgroundColor: Colors.primary },
  optionChipText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '500' },
  optionChipTextSelected: { color: Colors.white, fontWeight: '700' },
  noteInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginTop: Spacing.xs },
  singleInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, marginTop: Spacing.xs },
  submitButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginVertical: Spacing.lg },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  attendanceSummary: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  attendanceStat: { flex: 1, alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.sm },
  attendanceStatNum: { fontSize: FontSizes.xxl, fontWeight: '800' },
  attendanceStatLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  attendanceAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  attendanceAvatarText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700' },
  attendanceInfo: { flex: 1 },
  attendanceName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  attendanceTime: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  attendanceNote: { fontSize: FontSizes.xs, color: Colors.info, fontStyle: 'italic', marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  photoAttachRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  photoAttachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight, borderStyle: 'dashed' },
  photoAttachText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  attachedPreview: { marginTop: Spacing.sm, gap: Spacing.xs },
  attachedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm, gap: Spacing.sm },
  attachedThumb: { width: 32, height: 32, borderRadius: BorderRadius.sm, backgroundColor: Colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center' },
  attachedThumbImage: { width: 32, height: 32, borderRadius: BorderRadius.sm },
  attachedName: { flex: 1, fontSize: FontSizes.sm, color: Colors.textSecondary },
});
