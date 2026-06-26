import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { getChildAge, formatDateShort } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { GallerySkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Milestone, LearningPlan, CalendarEvent } from '../../types';
import { milestonesService } from '../../services/milestones.service';
import { supabase } from '../../lib/supabase';

type Tab = 'gallery' | 'milestones' | 'calendar' | 'learning';

const categoryColors: Record<string, string> = {
  cognitive: Colors.primary,
  motor: Colors.success,
  social: Colors.secondary,
  language: Colors.info,
  self_care: Colors.accent,
};

const eventTypeIcons: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  event: { icon: 'calendar', color: Colors.primary },
  holiday: { icon: 'sunny', color: Colors.accent },
  conference: { icon: 'people', color: Colors.info },
  vaccination: { icon: 'medkit', color: Colors.danger },
  closure: { icon: 'close-circle', color: Colors.textMuted },
  birthday: { icon: 'gift', color: Colors.secondary },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface PhotoEntry {
  id: string;
  label: string;
  date: string;
  color: string;
  timestamp: string;
  description?: string;
  createdByName: string;
  monthKey: string;
  type: string;
  photoUri: string;
}

export const GalleryScreen = () => {
  const {
    selectedChild, timelineEntries, shareContent, showAlert,
    learningPlans: contextPlans,
    milestones: contextMilestones,
    calendarEvents: contextCalendarEvents,
    currentUser,
  } = useApp();

  if (!selectedChild || !currentUser) {
    return (
      <View style={styles.container}>
        <GallerySkeleton />
      </View>
    );
  }
  const [activeTab, setActiveTab] = useState<Tab>('gallery');
  const [milestoneData, setMilestoneData] = useState<Milestone[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>(contextPlans);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'meals' | 'activities' | 'milestones' | 'other'>('all');
  const [searchGallery, setSearchGallery] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState<string | null>(null);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(contextCalendarEvents);
  const [favoritePhotoIds, setFavoritePhotoIds] = useState<Set<string>>(new Set());

  // Sync learning plans from context when they change
  useEffect(() => {
    if (contextPlans.length > 0) {
      setLearningPlans(contextPlans);
    }
  }, [contextPlans]);

  // Sync milestones from context (filtered to selected child)
  useEffect(() => {
    const childMilestones = contextMilestones.filter((m) => m.childId === selectedChild.id);
    if (childMilestones.length > 0) {
      setMilestoneData(childMilestones);
    }
  }, [contextMilestones, selectedChild.id]);

  // Sync calendar events from context
  useEffect(() => {
    if (contextCalendarEvents.length > 0) {
      setCalendarEvents(contextCalendarEvents);
    }
  }, [contextCalendarEvents]);

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'gallery', label: 'Gallery', icon: 'images-outline' },
    { key: 'milestones', label: 'Growth', icon: 'trending-up-outline' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
    { key: 'learning', label: 'Learning', icon: 'book-outline' },
  ];

  // Generate photo entries from timeline
  const photoEntries: PhotoEntry[] = useMemo(() => {
    const withPhotos = timelineEntries
      .filter((e) => e.childId === selectedChild.id && e.photos && e.photos.length > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const colors = ['#f093fb', '#4facfe', '#FFD93D', '#FF6B9D', '#6C63FF', '#FF9800', '#4CAF50', '#9B59B6', '#4ECDC4'];
    return withPhotos.map((e, i) => {
      const d = new Date(e.timestamp);
      return {
        id: e.id,
        label: e.title || e.description?.substring(0, 20) || 'Photo',
        date: d.toDateString() === new Date().toDateString() ? 'Today' : formatDateShort(e.timestamp),
        color: colors[i % colors.length],
        timestamp: e.timestamp,
        description: e.description,
        createdByName: e.createdBy.name,
        monthKey: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`,
        type: e.type,
        photoUri: e.photos![0],
      };
    });
  }, [timelineEntries, selectedChild.id]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    let result = photoEntries;
    if (galleryFilter !== 'all') {
      const typeMap: Record<string, string[]> = {
        meals: ['meal'],
        activities: ['activity'],
        milestones: ['milestone'],
        other: ['photo', 'note', 'nap', 'diaper', 'checkin', 'checkout', 'mood', 'incident', 'medication'],
      };
      const types = typeMap[galleryFilter] || [];
      result = result.filter((p) => types.includes(p.type));
    }
    if (searchGallery.trim()) {
      const q = searchGallery.toLowerCase();
      result = result.filter((p) =>
        p.label.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.createdByName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [photoEntries, galleryFilter, searchGallery]);

  // Group photos by month
  const photosByMonth = useMemo(() => {
    const groups: { key: string; title: string; photos: PhotoEntry[] }[] = [];
    const map = new Map<string, PhotoEntry[]>();
    for (const p of filteredPhotos) {
      if (!map.has(p.monthKey)) map.set(p.monthKey, []);
      map.get(p.monthKey)!.push(p);
    }
    for (const [key, photos] of map.entries()) {
      const [year, month] = key.split('-').map(Number);
      const title = `${MONTH_NAMES[month]} ${year}`;
      groups.push({ key, title, photos });
    }
    return groups;
  }, [filteredPhotos]);

  const selectedPhoto = selectedPhotoIndex !== null ? filteredPhotos[selectedPhotoIndex] : null;

  const toggleMilestone = async (id: string) => {
    const target = milestoneData.find((m) => m.id === id);
    if (!target) return;
    const wasAchieved = !!target.achievedDate;

    // Optimistic local update
    setMilestoneData((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, achievedDate: m.achievedDate ? undefined : new Date().toISOString().split('T')[0] }
          : m
      )
    );

    try {
      if (wasAchieved) {
        // Un-mark: no service helper exists for clearing, so update directly.
        const { error } = await supabase
          .from('milestones')
          .update({ achieved_at: null, noted_by: null })
          .eq('id', id);
        if (error) throw error;
      } else {
        await milestonesService.markAchieved(id, currentUser.id);
      }
    } catch {
      // Revert on failure
      setMilestoneData((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, achievedDate: target.achievedDate } : m
        )
      );
      showAlert('Could not save', 'We couldn\'t update this milestone. Please try again.');
    }
  };

  const toggleLearningActivity = (planId: string, actIndex: number) => {
    setLearningPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              activities: p.activities.map((a, i) =>
                i === actIndex ? { ...a, completed: !a.completed } : a
              ),
            }
          : p
      )
    );
  };

  // Filtered milestones
  const filteredMilestones = useMemo(() => {
    if (!milestoneFilter) return milestoneData;
    return milestoneData.filter((m) => m.category === milestoneFilter);
  }, [milestoneData, milestoneFilter]);

  // Filtered calendar events
  const filteredEvents = useMemo(() => {
    let events = [...calendarEvents].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (calendarSearch.trim()) {
      const q = calendarSearch.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q)
      );
    }
    return events;
  }, [calendarSearch, calendarEvents]);

  // Upcoming vs past events
  const now = new Date();
  const upcomingEvents = filteredEvents.filter((e) => new Date(e.date) >= now);
  const pastEvents = filteredEvents.filter((e) => new Date(e.date) < now);

  const galleryFilterChips: { key: typeof galleryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'meals', label: 'Meals' },
    { key: 'activities', label: 'Activities' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'other', label: 'Other' },
  ];

  const milestoneCategories = ['cognitive', 'language', 'motor', 'social', 'self_care'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#a8edea', '#fed6e3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{selectedChild.firstName}'s World</Text>
        <Text style={styles.headerMeta}>
          {getChildAge(selectedChild.dateOfBirth)} {selectedChild.classroom ? `\u2022 ${selectedChild.classroom}` : ''}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* ── Gallery Tab ── */}
        {activeTab === 'gallery' && (
          <>
            {/* Search */}
            <View style={[styles.searchBar, Shadows.small]}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search photos..."
                placeholderTextColor={Colors.textMuted}
                value={searchGallery}
                onChangeText={setSearchGallery}
              />
              {searchGallery !== '' && (
                <TouchableOpacity onPress={() => setSearchGallery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {galleryFilterChips.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.filterChip, galleryFilter === chip.key && styles.filterChipActive]}
                  onPress={() => setGalleryFilter(chip.key)}
                >
                  <Text style={[styles.filterChipText, galleryFilter === chip.key && styles.filterChipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>
                {filteredPhotos.length} Photo{filteredPhotos.length !== 1 ? 's' : ''}
                {galleryFilter !== 'all' || searchGallery ? ' (filtered)' : ''}
              </Text>
            </View>

            {filteredPhotos.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📷</Text>
                <Text style={styles.emptyTitle}>No photos found</Text>
                <Text style={styles.emptySubtext}>
                  {searchGallery || galleryFilter !== 'all'
                    ? 'Try adjusting your search or filter.'
                    : 'Photos will appear as caregivers capture moments.'}
                </Text>
              </View>
            ) : (
              <>
                {photosByMonth.map((group) => (
                  <View key={group.key}>
                    <Text style={styles.monthHeader}>{group.title}</Text>
                    <View style={styles.galleryGrid}>
                      {group.photos.map((photo) => {
                        const globalIndex = filteredPhotos.indexOf(photo);
                        return (
                          <TouchableOpacity
                            key={photo.id}
                            style={styles.galleryItem}
                            onPress={() => setSelectedPhotoIndex(globalIndex)}
                          >
                            <View>
                              <Image
                                source={{ uri: photo.photoUri }}
                                style={styles.galleryImage}
                                resizeMode="cover"
                              />
                              {favoritePhotoIds.has(photo.id) && (
                                <View style={styles.favBadge}>
                                  <Ionicons name="heart" size={12} color={Colors.white} />
                                </View>
                              )}
                            </View>
                            <Text style={styles.galleryLabel} numberOfLines={1}>{photo.label}</Text>
                            <Text style={styles.galleryDate}>{photo.date}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}

            <View style={styles.galleryActions}>
              <TouchableOpacity
                style={[styles.galleryAction, Shadows.small]}
                onPress={() => shareContent(`${selectedChild.firstName}'s Photo Album\n\n${filteredPhotos.length} photos from ${selectedChild.classroom || 'school'}\n\nShared from Little Journey`)}
              >
                <Ionicons name="share-outline" size={20} color={Colors.primary} />
                <Text style={styles.galleryActionText}>Share All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.galleryAction, Shadows.small]}
                onPress={() => shareContent(`Check out ${selectedChild.firstName}'s latest photos from ${selectedChild.classroom || 'school'}!`)}
              >
                <Ionicons name="share-outline" size={20} color={Colors.secondary} />
                <Text style={[styles.galleryActionText, { color: Colors.secondary }]}>Share Album</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Milestones Tab ── */}
        {activeTab === 'milestones' && (
          <>
            <Text style={styles.sectionTitle}>Developmental Progress</Text>
            <Text style={styles.sectionSubtitle}>Based on CDC/WHO guidelines for {getChildAge(selectedChild.dateOfBirth)}</Text>

            {milestoneCategories.map((cat) => {
              const catMilestones = milestoneData.filter((m) => m.category === cat);
              const achieved = catMilestones.filter((m) => m.achievedDate).length;
              const total = catMilestones.length;
              const pct = total > 0 ? (achieved / total) * 100 : 0;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.progressCard, Shadows.small, milestoneFilter === cat && styles.progressCardActive]}
                  onPress={() => setMilestoneFilter(milestoneFilter === cat ? null : cat)}
                >
                  <View style={styles.progressHeader}>
                    <View style={[styles.categoryDot, { backgroundColor: categoryColors[cat] }]} />
                    <Text style={styles.categoryName}>{cat.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                    <Text style={styles.progressCount}>{achieved}/{total}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: categoryColors[cat] }]} />
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.milestoneListHeader}>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
                {milestoneFilter
                  ? `${milestoneFilter.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Milestones`
                  : 'All Milestones'}
              </Text>
              {milestoneFilter && (
                <TouchableOpacity onPress={() => setMilestoneFilter(null)} style={styles.clearFilterBtn}>
                  <Text style={styles.clearFilterText}>Show All</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Tap to mark/unmark as achieved</Text>

            {filteredMilestones.map((ms) => (
              <TouchableOpacity key={ms.id} style={[styles.milestoneItem, Shadows.small]} onPress={() => toggleMilestone(ms.id)}>
                <View style={[styles.milestoneCheck, { backgroundColor: ms.achievedDate ? categoryColors[ms.category] : Colors.borderLight }]}>
                  {ms.achievedDate ? (
                    <Ionicons name="checkmark" size={14} color={Colors.white} />
                  ) : (
                    <View style={styles.milestoneEmpty} />
                  )}
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneTitle, !ms.achievedDate && styles.milestonePending]}>{ms.title}</Text>
                  <Text style={styles.milestoneAge}>{ms.ageRange}</Text>
                  {ms.achievedDate && <Text style={styles.milestoneDate}>Achieved: {formatDateShort(ms.achievedDate)}</Text>}
                </View>
                <View style={[styles.milestoneCat, { backgroundColor: categoryColors[ms.category] + '18' }]}>
                  <Text style={[styles.milestoneCatText, { color: categoryColors[ms.category] }]}>{ms.category.replace('_', ' ')}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Overall summary */}
            <View style={[styles.summaryBanner, Shadows.small]}>
              <Text style={styles.summaryBannerEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryBannerTitle}>
                  {milestoneData.filter((m) => m.achievedDate).length} of {milestoneData.length} milestones achieved
                </Text>
                <Text style={styles.summaryBannerSubtext}>
                  {selectedChild.firstName} is doing great!
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.shareButton, Shadows.small]}
              onPress={() => {
                const achieved = milestoneData.filter((m) => m.achievedDate).length;
                shareContent(`${selectedChild.firstName}'s Developmental Progress\n\n${achieved}/${milestoneData.length} milestones achieved\n\nShared from Little Journey`);
              }}
            >
              <Ionicons name="share-outline" size={18} color={Colors.primary} />
              <Text style={styles.shareButtonText}>Share with Pediatrician</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Calendar Tab ── */}
        {activeTab === 'calendar' && (
          <>
            {/* Calendar search */}
            <View style={[styles.searchBar, Shadows.small]}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search events..."
                placeholderTextColor={Colors.textMuted}
                value={calendarSearch}
                onChangeText={setCalendarSearch}
              />
              {calendarSearch !== '' && (
                <TouchableOpacity onPress={() => setCalendarSearch('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {upcomingEvents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming Events ({upcomingEvents.length})</Text>
                {upcomingEvents.map((event) => {
                  const config = eventTypeIcons[event.type] || eventTypeIcons.event;
                  const daysUntil = Math.ceil((new Date(event.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[styles.eventCard, Shadows.small]}
                      onPress={() => showAlert(
                        event.title,
                        `${formatDateShort(event.date)}${event.time ? ` at ${event.time}` : ''}\n\n${event.description || ''}${event.location ? `\n\nLocation: ${event.location}` : ''}`
                      )}
                    >
                      <View style={[styles.eventIcon, { backgroundColor: config.color + '18' }]}>
                        <Ionicons name={config.icon} size={20} color={config.color} />
                      </View>
                      <View style={styles.eventContent}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventDate}>
                          {formatDateShort(event.date)}{event.time ? ` at ${event.time}` : ''}
                        </Text>
                        {event.description && <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>}
                        {event.location && (
                          <View style={styles.eventLocation}>
                            <Ionicons name="location" size={12} color={Colors.textMuted} />
                            <Text style={styles.eventLocationText}>{event.location}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.daysUntilBadge}>
                        <Text style={styles.daysUntilText}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {pastEvents.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: Spacing.lg, color: Colors.textMuted }]}>
                  Past Events ({pastEvents.length})
                </Text>
                {pastEvents.map((event) => {
                  const config = eventTypeIcons[event.type] || eventTypeIcons.event;
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[styles.eventCard, Shadows.small, { opacity: 0.6 }]}
                      onPress={() => showAlert(
                        event.title,
                        `${formatDateShort(event.date)}${event.time ? ` at ${event.time}` : ''}\n\n${event.description || ''}${event.location ? `\n\nLocation: ${event.location}` : ''}`
                      )}
                    >
                      <View style={[styles.eventIcon, { backgroundColor: config.color + '18' }]}>
                        <Ionicons name={config.icon} size={20} color={config.color} />
                      </View>
                      <View style={styles.eventContent}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventDate}>
                          {formatDateShort(event.date)}{event.time ? ` at ${event.time}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {filteredEvents.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.emptyTitle}>No events found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your search.</Text>
              </View>
            )}
          </>
        )}

        {/* ── Learning Tab ── */}
        {activeTab === 'learning' && (
          <>
            <Text style={styles.sectionTitle}>This Week's Learning Plan</Text>
            {learningPlans.map((plan) => {
              const completed = plan.activities.filter((a) => a.completed).length;
              const total = plan.activities.length;
              const pct = total > 0 ? (completed / total) * 100 : 0;
              return (
                <View key={plan.id} style={[styles.planCard, Shadows.small]}>
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{plan.title || 'Weekly Learning Plan'}</Text>
                      {(plan.weekStart || plan.week) && (
                        <Text style={styles.planWeek}>
                          {plan.weekStart ? `Week of ${formatDateShort(plan.weekStart)}` : plan.week}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.planBadge, pct === 100 && styles.planBadgeComplete]}>
                      <Text style={[styles.planBadgeText, pct === 100 && styles.planBadgeTextComplete]}>
                        {pct === 100 ? 'Done!' : `${Math.round(pct)}%`}
                      </Text>
                    </View>
                  </View>

                  {(plan.goals?.length ?? 0) > 0 && (
                    <>
                      <Text style={styles.planSubtitle}>Goals</Text>
                      {plan.goals!.map((goal, i) => (
                        <View key={i} style={styles.goalItem}>
                          <Ionicons name="flag" size={14} color={Colors.primary} />
                          <Text style={styles.goalText}>{goal}</Text>
                        </View>
                      ))}
                    </>
                  )}

                  <Text style={styles.planSubtitle}>Activities</Text>
                  {plan.activities.map((act, i) => (
                    <TouchableOpacity key={i} style={styles.actItem} onPress={() => toggleLearningActivity(plan.id, i)}>
                      <Ionicons
                        name={act.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={act.completed ? Colors.success : Colors.textMuted}
                      />
                      <View style={styles.actContent}>
                        <Text style={[styles.actName, act.completed && styles.actCompleted]}>{act.name}</Text>
                        <Text style={styles.actDesc}>{act.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.planProgress}>
                    <Text style={styles.planProgressText}>
                      {completed}/{total} completed
                    </Text>
                    <View style={styles.planProgressBar}>
                      <View style={[styles.planProgressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Photo detail modal ── */}
      <Modal visible={selectedPhotoIndex !== null} animationType="fade" transparent>
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, Shadows.large]}>
            {/* Navigation header */}
            <View style={styles.photoModalHeader}>
              <TouchableOpacity onPress={() => setSelectedPhotoIndex(null)} style={styles.photoModalClose}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.photoModalCounter}>
                {selectedPhotoIndex !== null ? `${selectedPhotoIndex + 1} of ${filteredPhotos.length}` : ''}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Photo */}
            {selectedPhoto && (
              <Image
                source={{ uri: selectedPhoto.photoUri }}
                style={styles.photoModalRealImage}
                resizeMode="cover"
              />
            )}

            {/* Photo info */}
            <View style={styles.photoModalInfo}>
              <Text style={styles.photoModalDate}>{selectedPhoto?.date}</Text>
              {selectedPhoto?.description && (
                <Text style={styles.photoModalDesc}>{selectedPhoto.description}</Text>
              )}
              <Text style={styles.photoModalBy}>By {selectedPhoto?.createdByName}</Text>
            </View>

            {/* Navigation arrows */}
            <View style={styles.photoModalNav}>
              <TouchableOpacity
                style={[styles.photoNavBtn, selectedPhotoIndex === 0 && styles.photoNavBtnDisabled]}
                disabled={selectedPhotoIndex === 0}
                onPress={() => setSelectedPhotoIndex((prev) => prev !== null ? prev - 1 : null)}
              >
                <Ionicons name="chevron-back" size={22} color={selectedPhotoIndex === 0 ? Colors.borderLight : Colors.primary} />
                <Text style={[styles.photoNavText, selectedPhotoIndex === 0 && { color: Colors.borderLight }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoNavBtn, selectedPhotoIndex === filteredPhotos.length - 1 && styles.photoNavBtnDisabled]}
                disabled={selectedPhotoIndex === filteredPhotos.length - 1}
                onPress={() => setSelectedPhotoIndex((prev) => prev !== null ? prev + 1 : null)}
              >
                <Text style={[styles.photoNavText, selectedPhotoIndex === filteredPhotos.length - 1 && { color: Colors.borderLight }]}>Next</Text>
                <Ionicons name="chevron-forward" size={22} color={selectedPhotoIndex === filteredPhotos.length - 1 ? Colors.borderLight : Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.photoModalActions}>
              <TouchableOpacity
                style={styles.photoModalBtn}
                onPress={() => {
                  if (selectedPhoto) {
                    shareContent(`Photo: ${selectedPhoto.label}\nFrom: ${selectedPhoto.createdByName}\n\n${selectedPhoto.photoUri}\n\nShared from Little Journey`);
                  }
                }}
              >
                <Ionicons name="share-outline" size={22} color={Colors.primary} />
                <Text style={styles.photoModalBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoModalBtn}
                onPress={() => shareContent(`Photo: ${selectedPhoto?.label}\n${selectedPhoto?.description || ''}\n\nShared from Little Journey`)}
              >
                <Ionicons name="share-outline" size={22} color={Colors.secondary} />
                <Text style={[styles.photoModalBtnText, { color: Colors.secondary }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoModalBtn}
                onPress={() => {
                  if (selectedPhoto) {
                    setFavoritePhotoIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(selectedPhoto.id)) {
                        next.delete(selectedPhoto.id);
                      } else {
                        next.add(selectedPhoto.id);
                      }
                      return next;
                    });
                  }
                }}
              >
                <Ionicons name={selectedPhoto && favoritePhotoIds.has(selectedPhoto.id) ? 'heart' : 'heart-outline'} size={22} color={Colors.danger} />
                <Text style={[styles.photoModalBtnText, { color: Colors.danger }]}>{selectedPhoto && favoritePhotoIds.has(selectedPhoto.id) ? 'Favorited' : 'Favorite'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  headerMeta: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, marginTop: -Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.xs, ...Shadows.small },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: 4 },
  tabActive: { backgroundColor: Colors.primaryLight + '20' },
  tabText: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },
  content: { padding: Spacing.lg },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary, paddingVertical: 4 },

  // Filter chips
  filterRow: { marginBottom: Spacing.md, flexGrow: 0 },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round, backgroundColor: Colors.card, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.white },

  // Section
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionSubtitle: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },

  // Gallery
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  galleryTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  monthHeader: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  galleryItem: { width: '31%', minWidth: 90, maxWidth: '32%' },
  galleryImage: { aspectRatio: 1, borderRadius: BorderRadius.md, backgroundColor: Colors.borderLight },
  favBadge: { position: 'absolute' as const, top: 4, right: 4, backgroundColor: Colors.danger, borderRadius: 10, width: 20, height: 20, justifyContent: 'center' as const, alignItems: 'center' as const },
  galleryLabel: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.xs },
  galleryDate: { fontSize: FontSizes.xs, color: Colors.textMuted },
  galleryActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  galleryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  galleryActionText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },

  // Milestones
  milestoneListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearFilterBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: Colors.primaryLight + '20', borderRadius: BorderRadius.round },
  clearFilterText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
  progressCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  progressCardActive: { borderWidth: 2, borderColor: Colors.primary },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  progressCount: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  milestoneItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  milestoneCheck: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  milestoneEmpty: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.textMuted },
  milestoneContent: { flex: 1 },
  milestoneTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  milestonePending: { color: Colors.textMuted },
  milestoneAge: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  milestoneDate: { fontSize: FontSizes.xs, color: Colors.success, fontWeight: '500', marginTop: 2 },
  milestoneCat: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  milestoneCatText: { fontSize: FontSizes.xs, fontWeight: '600' },
  summaryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.md, gap: Spacing.md },
  summaryBannerEmoji: { fontSize: 32 },
  summaryBannerTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  summaryBannerSubtext: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm },
  shareButtonText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.primary },

  // Calendar
  eventCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  eventIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  eventDate: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '500', marginTop: 2 },
  eventDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  eventLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  eventLocationText: { fontSize: FontSizes.xs, color: Colors.textMuted },
  daysUntilBadge: { backgroundColor: Colors.primaryLight + '20', borderRadius: BorderRadius.round, paddingHorizontal: Spacing.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  daysUntilText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary },

  // Learning
  planCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  planTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary },
  planWeek: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '500', marginTop: 2, marginBottom: Spacing.lg },
  planBadge: { backgroundColor: Colors.primaryLight + '20', borderRadius: BorderRadius.round, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  planBadgeComplete: { backgroundColor: Colors.successLight },
  planBadgeText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary },
  planBadgeTextComplete: { color: Colors.success },
  planSubtitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  goalItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  goalText: { fontSize: FontSizes.md, color: Colors.textSecondary, flex: 1 },
  actItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md },
  actContent: { flex: 1 },
  actName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  actCompleted: { textDecorationLine: 'line-through', color: Colors.textMuted },
  actDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  planProgress: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  planProgressText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  planProgressBar: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  planProgressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },

  // Photo modal
  photoModalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  photoModalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, width: '100%', maxWidth: 500, overflow: 'hidden' },
  photoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  photoModalClose: { padding: 4 },
  photoModalCounter: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  photoModalRealImage: { height: 260, marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm, backgroundColor: Colors.borderLight },
  photoModalInfo: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  photoModalDate: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  photoModalDesc: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  photoModalBy: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  photoModalNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  photoNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.xs },
  photoNavBtnDisabled: { opacity: 0.4 },
  photoNavText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  photoModalActions: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md },
  photoModalBtn: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  photoModalBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
});
