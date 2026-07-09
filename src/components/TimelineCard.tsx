import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../theme/colors';
import { TimelineEntry } from '../types';
import { formatTime, getActivityEmoji, getMoodEmoji, getRelativeTime } from '../utils/helpers';
import { useApp } from '../context/AppContext';

const activityColors: Record<string, string> = {
  meal: Colors.meal, nap: Colors.nap, diaper: Colors.diaper,
  activity: Colors.activity, milestone: Colors.milestone, photo: Colors.photo,
  note: Colors.note, medication: Colors.medication, checkin: Colors.checkin,
  checkout: Colors.checkout, mood: Colors.accent, incident: Colors.danger,
};

const activityIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  meal: 'restaurant-outline', nap: 'moon-outline', diaper: 'water-outline',
  activity: 'color-palette-outline', milestone: 'star-outline', photo: 'camera-outline',
  note: 'document-text-outline', medication: 'medkit-outline', checkin: 'log-in-outline',
  checkout: 'log-out-outline', incident: 'alert-circle-outline',
};

const reactionEmojis = ['❤️', '👍', '😊', '🎉', '🥰'];

interface Props {
  entry: TimelineEntry;
  isFirst?: boolean;
  isLast?: boolean;
}

export const TimelineCard: React.FC<Props> = ({ entry, isFirst, isLast }) => {
  const { currentUser, addComment, deleteComment, toggleReaction, deleteTimelineEntry } = useApp();
  const [showDetail, setShowDetail] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);

  const color = activityColors[entry.type] || Colors.primary;
  const icon = activityIcons[entry.type] || 'ellipse-outline';

  const userReactions = (entry.reactions || []).filter((r) => r.userId === currentUser.id);
  const hasLoved = userReactions.some((r) => r.emoji === '❤️');
  const totalReactions = (entry.reactions || []).length;
  const commentCount = (entry.comments || []).length;

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment(entry.id, commentText.trim());
    setCommentText('');
  };

  const handleReaction = (emoji: string) => {
    toggleReaction(entry.id, emoji);
    setShowReactions(false);
  };

  const handleDeleteEntry = () => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTimelineEntry(entry.id); setShowDetail(false); } },
    ]);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment(entry.id, commentId) },
    ]);
  };

  const isOwnEntry = entry.createdBy.id === currentUser.id;

  return (
    <View style={styles.container}>
      {/* Timeline line */}
      <View style={styles.timelineTrack}>
        {!isFirst && <View style={[styles.lineTop, { backgroundColor: Colors.borderLight }]} />}
        <View style={[styles.dot, { backgroundColor: color }]}>
          <Ionicons name={icon} size={14} color={Colors.white} />
        </View>
        {!isLast && <View style={[styles.lineBottom, { backgroundColor: Colors.borderLight }]} />}
      </View>

      {/* Card content */}
      <TouchableOpacity
        style={[styles.card, Shadows.small, entry.isUrgent && styles.urgentCard]}
        onPress={() => setShowDetail(true)}
        activeOpacity={0.8}
      >
        {entry.isUrgent && (
          <View style={styles.urgentBanner}>
            <Ionicons name="warning" size={14} color={Colors.danger} />
            <Text style={styles.urgentBannerText}>Urgent</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.time}>{formatTime(entry.timestamp)}</Text>
            <View style={[styles.typeBadge, { backgroundColor: color + '18' }]}>
              <Text style={[styles.typeText, { color }]}>
                {getActivityEmoji(entry.type)} {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
              </Text>
            </View>
          </View>
          {entry.mood && <Text style={styles.mood}>{getMoodEmoji(entry.mood)}</Text>}
        </View>

        {/* Title */}
        <Text style={styles.title}>{entry.title}</Text>

        {/* Description */}
        {entry.description && (
          <Text style={styles.description} numberOfLines={3}>{entry.description}</Text>
        )}

        {/* Meal details */}
        {entry.type === 'meal' && entry.details && (
          <View style={styles.mealDetails}>
            {entry.details.items?.map((item: string, i: number) => (
              <View key={i} style={styles.mealItem}>
                <View style={[styles.mealDot, { backgroundColor: color }]} />
                <Text style={styles.mealItemText}>{item}</Text>
              </View>
            ))}
            {entry.details.amount && (
              <View style={[styles.amountBadge, {
                backgroundColor: entry.details.amount === 'all' ? Colors.successLight :
                  entry.details.amount === 'most' ? Colors.warningLight : Colors.dangerLight,
              }]}>
                <Text style={[styles.amountText, {
                  color: entry.details.amount === 'all' ? Colors.success :
                    entry.details.amount === 'most' ? Colors.warning : Colors.danger,
                }]}>Ate {entry.details.amount}</Text>
              </View>
            )}
          </View>
        )}

        {/* Nap details */}
        {entry.type === 'nap' && entry.details?.duration && (
          <View style={[styles.napBadge, { backgroundColor: Colors.nap + '18' }]}>
            <Ionicons name="time-outline" size={14} color={Colors.nap} />
            <Text style={[styles.napText, { color: Colors.nap }]}>{entry.details.duration}</Text>
          </View>
        )}

        {/* Photo */}
        {entry.photos && entry.photos.length > 0 && (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: entry.photos[0] }}
              style={styles.photoImage}
              resizeMode="cover"
            />
            {entry.photos.length > 1 && (
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>+{entry.photos.length - 1}</Text>
              </View>
            )}
          </View>
        )}

        {/* Milestone badge */}
        {entry.type === 'milestone' && (
          <View style={styles.milestoneBanner}>
            <Text style={styles.milestoneIcon}>🏆</Text>
            <Text style={styles.milestoneText}>Milestone Achieved!</Text>
          </View>
        )}

        {/* Reaction display */}
        {totalReactions > 0 && (
          <View style={styles.reactionDisplay}>
            {[...new Set((entry.reactions || []).map((r) => r.emoji))].map((emoji) => (
              <View key={emoji} style={styles.reactionChip}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={styles.reactionCount}>
                  {(entry.reactions || []).filter((r) => r.emoji === emoji).length}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleReaction('❤️')}
            onLongPress={() => setShowReactions(true)}
          >
            <Ionicons
              name={hasLoved ? 'heart' : 'heart-outline'}
              size={18}
              color={hasLoved ? Colors.secondary : Colors.textMuted}
            />
            <Text style={[styles.actionText, hasLoved && { color: Colors.secondary }]}>
              {hasLoved ? 'Loved' : 'Love'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowDetail(true)}>
            <Ionicons name="chatbubble-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.actionText}>
              {commentCount > 0 ? `${commentCount}` : 'Comment'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.caregiver}>by {entry.createdBy.name}</Text>
        </View>

        {/* Inline reaction picker */}
        {showReactions && (
          <View style={[styles.reactionPicker, Shadows.medium]}>
            {reactionEmojis.map((emoji) => (
              <TouchableOpacity key={emoji} style={styles.reactionPickerItem} onPress={() => handleReaction(emoji)}>
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{entry.title}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {isOwnEntry && (
                  <TouchableOpacity onPress={handleDeleteEntry}>
                    <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowDetail(false)}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailMeta}>
                <View style={[styles.typeBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.typeText, { color }]}>
                    {getActivityEmoji(entry.type)} {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                  </Text>
                </View>
                <Text style={styles.detailTime}>{formatTime(entry.timestamp)}</Text>
                {entry.mood && <Text style={{ fontSize: 20 }}>{getMoodEmoji(entry.mood)}</Text>}
              </View>

              {entry.description && (
                <Text style={styles.detailDesc}>{entry.description}</Text>
              )}

              {entry.type === 'meal' && entry.details?.items && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Items</Text>
                  {entry.details.items.map((item: string, i: number) => (
                    <Text key={i} style={styles.detailItem}>  {'\u2022'} {item}</Text>
                  ))}
                  {entry.details.amount && (
                    <Text style={styles.detailItem}>Amount eaten: {entry.details.amount}</Text>
                  )}
                </View>
              )}

              {entry.type === 'incident' && entry.details && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Incident Details</Text>
                  {entry.details.severity && <Text style={styles.detailItem}>Severity: {entry.details.severity}</Text>}
                  {entry.details.location && <Text style={styles.detailItem}>Location: {entry.details.location}</Text>}
                  {entry.details.actionTaken && <Text style={styles.detailItem}>Action: {entry.details.actionTaken}</Text>}
                </View>
              )}

              {entry.photos && entry.photos.length > 0 && (
                <View style={styles.detailPhotos}>
                  {entry.photos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={styles.detailPhotoImage}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              )}

              <Text style={styles.detailCreatedBy}>
                Logged by {entry.createdBy.name} {'\u2022'} {getRelativeTime(entry.timestamp)}
              </Text>

              {/* Reactions */}
              <View style={styles.detailReactions}>
                <Text style={styles.detailSectionTitle}>Reactions</Text>
                <View style={styles.reactionPickerRow}>
                  {reactionEmojis.map((emoji) => {
                    const count = (entry.reactions || []).filter((r) => r.emoji === emoji).length;
                    const hasReacted = userReactions.some((r) => r.emoji === emoji);
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.reactionOption, hasReacted && styles.reactionOptionActive]}
                        onPress={() => handleReaction(emoji)}
                      >
                        <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                        {count > 0 && <Text style={styles.reactionOptionCount}>{count}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Comments */}
              <View style={styles.commentSection}>
                <Text style={styles.detailSectionTitle}>
                  Comments {commentCount > 0 ? `(${commentCount})` : ''}
                </Text>

                {(entry.comments || []).map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{comment.userName.charAt(0)}</Text>
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentName}>{comment.userName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.commentTime}>{getRelativeTime(comment.timestamp)}</Text>
                          {comment.userId === currentUser.id && (
                            <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                              <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  </View>
                ))}

                {commentCount === 0 && (
                  <Text style={styles.noComments}>No comments yet. Be the first!</Text>
                )}

                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    placeholderTextColor={Colors.textMuted}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.commentSend, commentText.trim() ? styles.commentSendActive : null]}
                    onPress={handleAddComment}
                    disabled={!commentText.trim()}
                  >
                    <Ionicons name="send" size={16} color={commentText.trim() ? Colors.white : Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: Spacing.md },
  timelineTrack: { width: 40, alignItems: 'center' },
  lineTop: { width: 2, flex: 1 },
  lineBottom: { width: 2, flex: 1 },
  dot: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  card: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, marginLeft: Spacing.sm },
  urgentCard: { borderWidth: 1, borderColor: Colors.dangerLight },
  urgentBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm, backgroundColor: Colors.dangerLight, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  urgentBannerText: { fontSize: FontSizes.xs, color: Colors.danger, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  time: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600' },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  typeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  mood: { fontSize: 20 },
  title: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  description: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.sm },
  mealDetails: { marginTop: Spacing.xs, gap: Spacing.xs },
  mealItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealDot: { width: 6, height: 6, borderRadius: 3 },
  mealItemText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  amountBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round, marginTop: Spacing.xs },
  amountText: { fontSize: FontSizes.xs, fontWeight: '600' },
  napBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round, gap: Spacing.xs, marginTop: Spacing.xs },
  napText: { fontSize: FontSizes.md, fontWeight: '700' },
  photoContainer: { marginTop: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden', position: 'relative' as const },
  photoImage: { height: 160, borderRadius: BorderRadius.md, width: '100%', backgroundColor: Colors.borderLight },
  photoBadge: { position: 'absolute' as const, top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: BorderRadius.round, paddingHorizontal: 8, paddingVertical: 2 },
  photoBadgeText: { fontSize: FontSizes.xs, color: Colors.white, fontWeight: '700' },
  detailPhotos: { marginVertical: Spacing.md, gap: Spacing.sm },
  detailPhotoImage: { height: 220, borderRadius: BorderRadius.md, width: '100%', backgroundColor: Colors.borderLight },
  milestoneBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', borderRadius: BorderRadius.md, padding: Spacing.sm, marginTop: Spacing.sm, gap: Spacing.sm },
  milestoneIcon: { fontSize: 24 },
  milestoneText: { fontSize: FontSizes.md, fontWeight: '700', color: '#F57F17' },
  reactionDisplay: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  reactionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round, gap: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: Spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '500' },
  caregiver: { fontSize: FontSizes.xs, color: Colors.textMuted, marginLeft: 'auto', fontStyle: 'italic' },
  reactionPicker: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.round, padding: Spacing.sm, gap: Spacing.sm, position: 'absolute', bottom: 50, left: Spacing.md, zIndex: 10 },
  reactionPickerItem: { padding: Spacing.xs },
  reactionPickerEmoji: { fontSize: 22 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: Spacing.md },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  detailTime: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  detailDesc: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24, marginBottom: Spacing.md },
  detailSection: { marginBottom: Spacing.md },
  detailSectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  detailItem: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24 },
  detailCreatedBy: { fontSize: FontSizes.sm, color: Colors.textMuted, fontStyle: 'italic', marginVertical: Spacing.md },
  detailReactions: { marginBottom: Spacing.lg },
  reactionPickerRow: { flexDirection: 'row', gap: Spacing.sm },
  reactionOption: { alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.sm, minWidth: 48 },
  reactionOptionActive: { backgroundColor: Colors.primaryLight + '30', borderWidth: 1, borderColor: Colors.primaryLight },
  reactionOptionEmoji: { fontSize: 22 },
  reactionOptionCount: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  commentSection: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md },
  commentItem: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { fontSize: FontSizes.xs, color: Colors.white, fontWeight: '700' },
  commentBody: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  commentName: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  commentTime: { fontSize: FontSizes.xs, color: Colors.textMuted },
  commentText: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  noComments: { fontSize: FontSizes.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  commentInput: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSizes.sm, color: Colors.textPrimary, maxHeight: 80 },
  commentSend: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  commentSendActive: { backgroundColor: Colors.primary },
});
