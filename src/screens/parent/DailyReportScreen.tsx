import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { formatDate, formatTime, getMoodEmoji, getActivityEmoji } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { DailyReportSkeleton } from '../../components/LoadingSkeleton';

export const DailyReportScreen = () => {
  const {
    selectedChild, todayStats, timelineEntries, shareContent, showAlert,
    generateDailyNarrative, generateHighlights, sendMessage, conversations, currentUser,
  } = useApp();
  const [showFullNarrative, setShowFullNarrative] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const [thanked, setThanked] = useState(false);

  if (!selectedChild || !currentUser) {
    return (
      <View style={styles.container}>
        <DailyReportSkeleton />
      </View>
    );
  }

  const todayDate = new Date().toISOString().split('T')[0];

  const childEntries = useMemo(
    () =>
      timelineEntries
        .filter((e) => e.childId === selectedChild.id && new Date(e.timestamp).toDateString() === new Date().toDateString())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [timelineEntries, selectedChild.id]
  );

  const childInitial = selectedChild.firstName.charAt(0);

  // Derive caregiver + their note from today's entries
  const caregiverEntry = useMemo(
    () => childEntries.find((e) => e.createdBy.role === 'caregiver' && e.description?.trim()) || null,
    [childEntries]
  );
  const todayCaregiver = caregiverEntry?.createdBy || null;
  const caregiverNote = caregiverEntry?.description?.trim() || '';
  const caregiverName = todayCaregiver?.name || 'Your caregiver';
  const caregiverInitial = caregiverName.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, '').charAt(0);

  // Dynamic report generation
  const narrative = useMemo(() => generateDailyNarrative(), [generateDailyNarrative]);
  const highlights = useMemo(() => generateHighlights(), [generateHighlights]);

  const handleShare = () => {
    const summary = `${selectedChild.firstName}'s Daily Report - ${formatDate(todayDate)}\n\n${narrative}\n\n--- Shared from Little Journey`;
    shareContent(summary);
  };

  const handleSavePdf = async () => {
    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #333; }
          h1 { color: #6C63FF; margin-bottom: 4px; }
          h2 { color: #555; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          .date { color: #888; font-size: 14px; margin-bottom: 20px; }
          .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
          .stat { background: #f5f5ff; border-radius: 8px; padding: 12px 16px; text-align: center; flex: 1; min-width: 80px; }
          .stat-value { font-size: 22px; font-weight: 800; color: #6C63FF; }
          .stat-label { font-size: 11px; color: #888; margin-top: 2px; }
          .highlight { padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
          .highlight::before { content: "\\2022"; color: #FF6B9D; margin-right: 8px; }
          .narrative { background: #FFF8F0; border: 1px solid #FFE4CC; border-radius: 8px; padding: 16px; margin: 12px 0; line-height: 1.6; }
          .entry-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
          .entry-time { color: #888; font-size: 12px; width: 60px; }
          .entry-title { font-weight: 600; }
          .entry-desc { color: #888; font-size: 13px; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${selectedChild.firstName}'s Daily Report</h1>
        <div class="date">${formatDate(todayDate)} &bull; ${selectedChild.classroom || 'School'}</div>

        <div class="stats">
          <div class="stat"><div class="stat-value">${todayStats.meals}</div><div class="stat-label">Meals</div></div>
          <div class="stat"><div class="stat-value">${todayStats.naps}</div><div class="stat-label">Naps</div></div>
          <div class="stat"><div class="stat-value">${todayStats.diaperChanges}</div><div class="stat-label">Diapers</div></div>
          <div class="stat"><div class="stat-value">${todayStats.activities}</div><div class="stat-label">Activities</div></div>
          <div class="stat"><div class="stat-value">${todayStats.photos}</div><div class="stat-label">Photos</div></div>
        </div>

        <h2>Highlights</h2>
        ${highlights.map((h) => `<div class="highlight">${h}</div>`).join('')}

        <h2>${selectedChild.firstName}'s Story</h2>
        <div class="narrative">${narrative.replace(/\n/g, '<br/>')}</div>

        <h2>Activity Log</h2>
        ${childEntries.map((e) => `
          <div class="entry-row">
            <span class="entry-time">${formatTime(e.timestamp)}</span>
            <span>
              <span class="entry-title">${getActivityEmoji(e.type)} ${e.title}</span>
              ${e.description ? `<br/><span class="entry-desc">${e.description}</span>` : ''}
            </span>
          </div>
        `).join('')}

        <div class="footer">Generated by Little Journey &bull; ${formatDate(todayDate)}</div>
      </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${selectedChild.firstName}'s Daily Report` });
      } else {
        showAlert('PDF Saved', `Report saved to: ${uri}`);
      }
    } catch {
      showAlert('Report Saved', `${selectedChild.firstName}'s daily report has been saved.`);
    }
  };

  const handleThank = () => {
    setThanked(true);
    // Find the conversation with the caregiver (not hardcoded)
    const caregiverConv = conversations.find((c) =>
      c.participants.some((p) => p.role === 'caregiver' && p.id !== currentUser.id)
    );
    const convId = caregiverConv?.id || conversations[0]?.id;
    if (convId) {
      sendMessage(
        `Thank you so much for taking such great care of ${selectedChild.firstName} today! We really appreciate everything you do! 💝`,
        false,
        convId
      );
    }
    showAlert('Thank You Sent!', `Your appreciation has been sent to ${caregiverName}.`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#f093fb', '#f5576c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Daily Report</Text>
        <Text style={styles.headerDate}>{formatDate(todayDate)}</Text>
        <View style={styles.headerChild}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>{childInitial}</Text>
          </View>
          <Text style={styles.childName}>{selectedChild.firstName}'s Day</Text>
          <Text style={styles.moodEmoji}>{getMoodEmoji(todayStats.currentMood)}</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>🍽️</Text>
            <Text style={styles.summaryValue}>{todayStats.meals}</Text>
            <Text style={styles.summaryLabel}>Meals</Text>
          </View>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>😴</Text>
            <Text style={styles.summaryValue}>{todayStats.naps}</Text>
            <Text style={styles.summaryLabel}>Nap</Text>
            <Text style={styles.summaryExtra}>{todayStats.napDuration}</Text>
          </View>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>👶</Text>
            <Text style={styles.summaryValue}>{todayStats.diaperChanges}</Text>
            <Text style={styles.summaryLabel}>Diapers</Text>
          </View>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>🎨</Text>
            <Text style={styles.summaryValue}>{todayStats.activities}</Text>
            <Text style={styles.summaryLabel}>Activities</Text>
          </View>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>📸</Text>
            <Text style={styles.summaryValue}>{todayStats.photos}</Text>
            <Text style={styles.summaryLabel}>Photos</Text>
          </View>
          <View style={[styles.summaryCard, Shadows.small]}>
            <Text style={styles.summaryEmoji}>{getMoodEmoji(todayStats.currentMood)}</Text>
            <Text style={styles.summaryValue}>
              {todayStats.currentMood.charAt(0).toUpperCase() + todayStats.currentMood.slice(1)}
            </Text>
            <Text style={styles.summaryLabel}>Mood</Text>
          </View>
        </View>

        {/* Highlights — dynamically generated */}
        <View style={[styles.section, Shadows.small]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>✨</Text>
            <Text style={styles.sectionTitle}>Today's Highlights</Text>
          </View>
          {highlights.map((highlight, index) => (
            <View key={index} style={styles.highlightItem}>
              <View style={styles.highlightDot} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>

        {/* AI Narrative — dynamically generated */}
        <View style={[styles.section, styles.narrativeSection, Shadows.small]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📖</Text>
            <Text style={styles.sectionTitle}>{selectedChild.firstName}'s Story Today</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color={Colors.primary} />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={styles.narrative}>
            {showFullNarrative ? narrative : (narrative.length > 250 ? narrative.substring(0, 250) + '...' : narrative)}
          </Text>
          {narrative.length > 250 && (
            <TouchableOpacity style={styles.readMore} onPress={() => setShowFullNarrative(!showFullNarrative)}>
              <Text style={styles.readMoreText}>{showFullNarrative ? 'Show less' : 'Read full story'}</Text>
              <Ionicons name={showFullNarrative ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Full Activity Log — expandable */}
        <View style={[styles.section, Shadows.small]}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowEntries(!showEntries)}>
            <Text style={styles.sectionIcon}>📋</Text>
            <Text style={styles.sectionTitle}>Full Activity Log ({childEntries.length})</Text>
            <Ionicons name={showEntries ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          {showEntries && childEntries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryEmoji}>{getActivityEmoji(entry.type)}</Text>
              <View style={styles.entryContent}>
                <Text style={styles.entryTitle}>{entry.title}</Text>
                {entry.description && (
                  <Text style={styles.entryDesc} numberOfLines={2}>{entry.description}</Text>
                )}
              </View>
              <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
            </View>
          ))}
          {showEntries && childEntries.length === 0 && (
            <Text style={styles.emptyText}>No entries recorded today.</Text>
          )}
        </View>

        {/* Caregiver Note */}
        {caregiverNote !== '' && (
          <View style={[styles.section, Shadows.small]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>💌</Text>
              <Text style={styles.sectionTitle}>Note from Caregiver</Text>
            </View>
            <View style={styles.caregiverCard}>
              <View style={styles.caregiverAvatar}>
                <Text style={styles.caregiverAvatarText}>{caregiverInitial}</Text>
              </View>
              <Text style={styles.caregiverNote}>
                {caregiverNote} — {caregiverName}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.primaryLight + '20' }]}
            onPress={handleSavePdf}
          >
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={[styles.actionButtonText, { color: Colors.primary }]}>Save PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.secondaryLight + '30' }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={Colors.secondary} />
            <Text style={[styles.actionButtonText, { color: Colors.secondary }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: thanked ? Colors.successLight : Colors.successLight + '60' }]}
            onPress={handleThank}
            disabled={thanked}
          >
            <Ionicons name={thanked ? 'heart' : 'heart-outline'} size={20} color={Colors.success} />
            <Text style={[styles.actionButtonText, { color: Colors.success }]}>
              {thanked ? 'Sent!' : 'Thank'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  headerDate: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.xs },
  headerChild: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, gap: Spacing.sm },
  childAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  childAvatarText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  childName: { fontSize: FontSizes.xl, color: Colors.white, fontWeight: '700', flex: 1 },
  moodEmoji: { fontSize: 32 },
  content: { padding: Spacing.lg },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  summaryCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', width: '31%', flexGrow: 1 },
  summaryEmoji: { fontSize: 24, marginBottom: Spacing.xs },
  summaryValue: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  summaryLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  summaryExtra: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  section: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  sectionIcon: { fontSize: 20 },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round, gap: 4 },
  aiBadgeText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '700' },
  highlightItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm, gap: Spacing.sm },
  highlightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.secondary, marginTop: 6 },
  highlightText: { fontSize: FontSizes.md, color: Colors.textPrimary, lineHeight: 22, flex: 1 },
  narrativeSection: { backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#FFE4CC' },
  narrative: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  readMoreText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: '600' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  entryEmoji: { fontSize: 22 },
  entryContent: { flex: 1 },
  entryTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  entryDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  entryTime: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '500' },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  caregiverCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  caregiverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  caregiverAvatarText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  caregiverNote: { flex: 1, fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, padding: Spacing.md, borderRadius: BorderRadius.lg },
  actionButtonText: { fontSize: FontSizes.sm, fontWeight: '600' },
});
