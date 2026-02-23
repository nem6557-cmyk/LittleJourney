import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { TimelineCard } from '../../components/TimelineCard';
import { getChildAge, getMoodEmoji } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { ActivityType } from '../../types';

const getGreetingTime = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
};

const filterOptions: { label: string; type: ActivityType | 'all' }[] = [
  { label: 'All', type: 'all' },
  { label: '🍽️ Meals', type: 'meal' },
  { label: '😴 Naps', type: 'nap' },
  { label: '🎨 Activities', type: 'activity' },
  { label: '📸 Photos', type: 'photo' },
  { label: '🌟 Milestones', type: 'milestone' },
  { label: '👶 Diapers', type: 'diaper' },
];

export const TimelineScreen = () => {
  const {
    currentRole, currentUser, selectedChild, children, selectChild,
    timelineEntries, todayStats, showAlert,
    notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActivityType | 'all'>('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifDisplayCount, setNotifDisplayCount] = useState(8);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setActiveFilter('all');
    setSearchText('');
    setTimeout(() => setRefreshing(false), 500);
  };

  const childEntries = useMemo(() => {
    let entries = timelineEntries
      .filter((e) => e.childId === selectedChild.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (activeFilter !== 'all') {
      entries = entries.filter((e) => e.type === activeFilter);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q)
      );
    }

    return entries;
  }, [timelineEntries, selectedChild.id, activeFilter, searchText]);

  const firstName = currentUser.name.split(' ')[0];
  const childInitial = selectedChild.firstName.charAt(0);

  // Derive caregiver from actual timeline entries
  const latestCaregiverEntry = useMemo(() => {
    return timelineEntries
      .filter((e) => e.childId === selectedChild.id && e.createdBy.role === 'caregiver')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [timelineEntries, selectedChild.id]);
  const caregiverName = latestCaregiverEntry?.createdBy.name || 'Caregiver';
  const caregiverInitial = caregiverName.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, '').charAt(0);

  const latestNote = useMemo(() => {
    const allEntries = timelineEntries
      .filter((e) => e.childId === selectedChild.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const withDesc = allEntries.find(
      (e) => e.description && e.description.length > 30 && e.createdBy.role === 'caregiver'
    );
    return withDesc?.description || `${selectedChild.firstName} is having a great day!`;
  }, [timelineEntries, selectedChild]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        scrollEventThrottle={16}
      >
        {/* Hero Header */}
        <LinearGradient
          colors={currentRole === 'parent' ? ['#667eea', '#764ba2'] : ['#4facfe', '#00f2fe']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>
                  {currentRole === 'parent' ? getGreetingTime() : selectedChild.classroom || 'Classroom'}
                </Text>
                <Text style={styles.headerTitle}>{firstName}</Text>
              </View>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => setShowNotifications(!showNotifications)}
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.white} />
                {unreadNotificationCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadNotificationCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Child Card */}
            <View style={styles.childCard}>
              <View style={styles.childAvatar}>
                <Text style={styles.childAvatarText}>{childInitial}</Text>
              </View>
              <View style={styles.childInfo}>
                <Text style={styles.childName}>
                  {selectedChild.firstName} {selectedChild.lastName}
                </Text>
                <Text style={styles.childMeta}>
                  {getChildAge(selectedChild.dateOfBirth)} {selectedChild.classroom ? `\u2022 ${selectedChild.classroom}` : ''}
                </Text>
              </View>
              <View style={styles.moodContainer}>
                <Text style={styles.moodEmoji}>{getMoodEmoji(todayStats.currentMood)}</Text>
                <Text style={styles.moodLabel}>{todayStats.currentMood}</Text>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statEmoji}>🍽️</Text>
                <Text style={styles.statValue}>{todayStats.meals}</Text>
                <Text style={styles.statLabel}>Meals</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statEmoji}>😴</Text>
                <Text style={styles.statValue}>{todayStats.napDuration}</Text>
                <Text style={styles.statLabel}>Nap</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statEmoji}>🎨</Text>
                <Text style={styles.statValue}>{todayStats.activities}</Text>
                <Text style={styles.statLabel}>Activities</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statEmoji}>📸</Text>
                <Text style={styles.statValue}>{todayStats.photos}</Text>
                <Text style={styles.statLabel}>Photos</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Notification Dropdown */}
        {showNotifications && (
          <View style={[styles.notificationDropdown, Shadows.large]}>
            <View style={styles.notifDropHeader}>
              <Text style={styles.notifDropTitle}>Notifications</Text>
              {unreadNotificationCount > 0 && (
                <TouchableOpacity onPress={() => { markAllNotificationsRead(); setShowNotifications(false); }}>
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              {notifications.slice(0, notifDisplayCount).map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                  onPress={() => {
                    markNotificationRead(notif.id);
                    setShowNotifications(false);
                  }}
                >
                  <Text style={styles.notifIcon}>{notif.icon || '🔔'}</Text>
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>{notif.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                  </View>
                  {!notif.read && <View style={styles.notifDot} />}
                </TouchableOpacity>
              ))}
              {notifications.length > notifDisplayCount && (
                <TouchableOpacity
                  style={styles.showMoreNotifs}
                  onPress={() => setNotifDisplayCount((prev) => prev + 8)}
                >
                  <Text style={styles.showMoreNotifsText}>Show More ({notifications.length - notifDisplayCount} remaining)</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.viewAllNotifsBtn}
              onPress={() => { setShowNotifications(false); setShowAllNotifications(true); }}
            >
              <Text style={styles.viewAllNotifsText}>View All Notifications</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Caregiver Note */}
        <View style={styles.caregiverNote}>
          <View style={[styles.caregiverNoteCard, Shadows.small]}>
            <View style={styles.caregiverHeader}>
              <View style={styles.caregiverAvatar}>
                <Text style={styles.caregiverAvatarText}>{caregiverInitial}</Text>
              </View>
              <View>
                <Text style={styles.caregiverName}>{caregiverName}</Text>
                <Text style={styles.caregiverRole}>Lead Teacher, {selectedChild.classroom || 'Classroom'}</Text>
              </View>
            </View>
            <Text style={styles.caregiverMessage}>"{latestNote}"</Text>
          </View>
        </View>

        {/* Child selector (parents with multiple children) */}
        {currentRole === 'parent' && children.length > 1 && (
          <View style={styles.childSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
              {children.map((child) => {
                const isActive = child.id === selectedChild.id;
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childSelectorChip, isActive && styles.childSelectorChipActive]}
                    onPress={() => selectChild(child.id)}
                  >
                    <View style={[styles.childSelectorAvatar, isActive && { backgroundColor: Colors.white }]}>
                      <Text style={[styles.childSelectorAvatarText, isActive && { color: Colors.primary }]}>
                        {child.firstName.charAt(0)}
                      </Text>
                    </View>
                    <Text style={[styles.childSelectorName, isActive && styles.childSelectorNameActive]}>
                      {child.firstName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Allergy banner */}
        {selectedChild.allergies.length > 0 && (
          <View style={styles.allergyBanner}>
            <View style={[styles.allergyCard, Shadows.small]}>
              <Ionicons name="warning" size={18} color={Colors.danger} />
              <Text style={styles.allergyTitle}>Allergies:</Text>
              <Text style={styles.allergyList}>{selectedChild.allergies.join(', ')}</Text>
            </View>
          </View>
        )}

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, Shadows.small]}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search timeline..."
              placeholderTextColor={Colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {filterOptions.map((f) => (
            <TouchableOpacity
              key={f.type}
              style={[styles.filterChip, activeFilter === f.type && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.type)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.type && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Live Status */}
        <View style={styles.liveStatus}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Updates</Text>
          <Text style={styles.liveSubtext}>{'\u2022'} {childEntries.length} entries{activeFilter !== 'all' ? ` (filtered)` : ' today'}</Text>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {childEntries.map((entry, index) => (
            <TimelineCard
              key={entry.id}
              entry={entry}
              isFirst={index === 0}
              isLast={index === childEntries.length - 1}
            />
          ))}
        </View>

        {childEntries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌤️</Text>
            <Text style={styles.emptyTitle}>
              {searchText || activeFilter !== 'all' ? 'No matching entries' : 'No entries yet today'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchText || activeFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Updates will appear here as caregivers log activities.'}
            </Text>
          </View>
        )}

        {childEntries.length > 0 && (
          <View style={styles.timelineEnd}>
            <View style={styles.timelineEndDot} />
            <Text style={styles.timelineEndText}>Start of day</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Full Notifications Modal */}
      <Modal visible={showAllNotifications} animationType="slide" transparent>
        <View style={styles.fullNotifOverlay}>
          <View style={styles.fullNotifContent}>
            <View style={styles.fullNotifHeader}>
              <Text style={styles.fullNotifTitle}>All Notifications</Text>
              <TouchableOpacity onPress={() => setShowAllNotifications(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {unreadNotificationCount > 0 && (
              <TouchableOpacity style={styles.markAllReadFullBtn} onPress={markAllNotificationsRead}>
                <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                <Text style={styles.markAllReadFullText}>Mark all as read ({unreadNotificationCount})</Text>
              </TouchableOpacity>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                  onPress={() => markNotificationRead(notif.id)}
                >
                  <Text style={styles.notifIcon}>{notif.icon || '🔔'}</Text>
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>{notif.title}</Text>
                    <Text style={styles.notifBody}>{notif.body}</Text>
                  </View>
                  {!notif.read && <View style={styles.notifDot} />}
                </TouchableOpacity>
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
  header: { paddingTop: 60, paddingBottom: Spacing.xl, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerContent: { paddingHorizontal: Spacing.lg },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  headerTitle: { fontSize: FontSizes.xxxl, color: Colors.white, fontWeight: '800' },
  notificationBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.secondary, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  childCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  childAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  childAvatarText: { fontSize: FontSizes.xl, color: Colors.white, fontWeight: '700' },
  childInfo: { flex: 1, marginLeft: Spacing.md },
  childName: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  childMeta: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  moodContainer: { alignItems: 'center' },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize', marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
  stat: { alignItems: 'center', flex: 1 },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '800' },
  statLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Notification dropdown
  notificationDropdown: { backgroundColor: Colors.card, marginHorizontal: Spacing.lg, marginTop: -Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  notifDropHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  notifDropTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  markAllRead: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
  notifItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  notifItemUnread: { backgroundColor: Colors.primaryLight + '08' },
  notifIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary },
  notifTitleUnread: { fontWeight: '800' },
  notifBody: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  showMoreNotifs: { paddingVertical: Spacing.md, alignItems: 'center' },
  showMoreNotifsText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
  viewAllNotifsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  viewAllNotifsText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  // Full notifications modal
  fullNotifOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  fullNotifContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '90%' },
  fullNotifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  fullNotifTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  markAllReadFullBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  markAllReadFullText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },

  caregiverNote: { paddingHorizontal: Spacing.lg, marginTop: -Spacing.md, marginBottom: Spacing.md },
  caregiverNoteCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md },
  caregiverHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  caregiverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  caregiverAvatarText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  caregiverName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  caregiverRole: { fontSize: FontSizes.xs, color: Colors.textMuted },
  caregiverMessage: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  allergyBanner: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  allergyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dangerLight, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm },
  allergyTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.danger },
  allergyList: { fontSize: FontSizes.sm, color: Colors.danger, flex: 1 },

  // Search
  searchContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },

  // Filter
  filterRow: { marginBottom: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: { backgroundColor: Colors.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round, ...Shadows.small },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: Colors.white },

  liveStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  liveSubtext: { fontSize: FontSizes.sm, color: Colors.textMuted },
  timeline: { paddingTop: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: FontSizes.md, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  timelineEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  timelineEndDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.borderLight },
  timelineEndText: { fontSize: FontSizes.sm, color: Colors.textMuted, fontStyle: 'italic' },

  // Child selector
  childSelector: { marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  childSelectorChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.round, paddingRight: Spacing.md, paddingLeft: 4, paddingVertical: 4, ...Shadows.small },
  childSelectorChipActive: { backgroundColor: Colors.primary },
  childSelectorAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight + '30', justifyContent: 'center', alignItems: 'center' },
  childSelectorAvatarText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary },
  childSelectorName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary, marginLeft: Spacing.sm },
  childSelectorNameActive: { color: Colors.white },
});
