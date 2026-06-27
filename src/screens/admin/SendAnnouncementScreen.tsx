import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { announcementsService, Announcement } from '../../services/announcements.service';
import { EmptyState } from '../../components/EmptyState';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

type Audience = 'all' | 'parents' | 'caregivers';

const AUDIENCE_OPTIONS: { value: Audience; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: 'Everyone', icon: 'people-outline' },
  { value: 'parents', label: 'Parents', icon: 'home-outline' },
  { value: 'caregivers', label: 'Caregivers', icon: 'school-outline' },
];

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'Everyone',
  parents: 'Parents',
  caregivers: 'Caregivers',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString();
}

export const SendAnnouncementScreen = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { profile } = useAuth();
  const daycareId = profile?.daycare_id ?? null;
  const authorId = profile?.id ?? null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [isSending, setIsSending] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    if (!daycareId) {
      setAnnouncements([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await announcementsService.list(daycareId);
      setAnnouncements(data);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, [daycareId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Required', 'Title and message are required.');
      return;
    }
    if (!daycareId || !authorId) {
      Alert.alert('Error', 'No daycare associated with your account.');
      return;
    }

    setIsSending(true);
    try {
      await announcementsService.create({
        daycare_id: daycareId,
        author_id: authorId,
        title: title.trim(),
        body: body.trim(),
        audience,
      });
      setTitle('');
      setBody('');
      setAudience('all');
      await loadAnnouncements();
      Alert.alert('Announcement Sent', 'Recipients will see it in their notifications feed.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send announcement. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const renderCompose = () => (
    <View style={styles.composeWrap}>
      <View style={[styles.composeCard, Shadows.small]}>
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.fieldInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Announcement title"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Message</Text>
        <TextInput
          style={[styles.fieldInput, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="Write your announcement..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Audience</Text>
        <View style={styles.audienceRow}>
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audience === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.audienceChip, active && styles.audienceChipActive]}
                onPress={() => setAudience(opt.value)}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={active ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.audienceChipText, active && styles.audienceChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSend} disabled={isSending}>
          <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
            {isSending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={Colors.white} />
                <Text style={styles.submitText}>Send</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.caption}>
          Recipients see this in their notifications feed.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Past Announcements</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6C63FF', '#3F3D9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Send Announcement</Text>
        </View>
        <Text style={styles.headerMeta}>{announcements.length} sent</Text>
      </LinearGradient>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderCompose}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <EmptyState
              icon="megaphone-outline"
              title="No Announcements Yet"
              message="Announcements you send will appear here."
            />
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, Shadows.small]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardTime}>{relativeTime(item.created_at)}</Text>
            </View>
            <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
            <View style={styles.audienceTag}>
              <Ionicons name="people-outline" size={12} color={Colors.primary} />
              <Text style={styles.audienceTagText}>{AUDIENCE_LABELS[item.audience]}</Text>
            </View>
          </View>
        )}
      />
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
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.lg },
  composeWrap: { marginBottom: Spacing.sm },
  composeCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  bodyInput: { minHeight: 100 },
  audienceRow: { flexDirection: 'row', gap: Spacing.sm },
  audienceChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.background },
  audienceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  audienceChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  audienceChipTextActive: { color: Colors.white },
  submitBtn: { marginTop: Spacing.xl, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  submitText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  caption: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  loader: { marginTop: Spacing.xl },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  cardTime: { fontSize: FontSizes.xs, color: Colors.textMuted },
  cardBody: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  audienceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm, alignSelf: 'flex-start', backgroundColor: Colors.primary + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  audienceTagText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.primary },
});
