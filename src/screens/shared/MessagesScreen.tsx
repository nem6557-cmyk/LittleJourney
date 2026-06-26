import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { MessagesSkeleton } from '../../components/LoadingSkeleton';
import { formatTime, getRelativeTime } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { trackScreen, trackEvent, AnalyticsEvents } from '../../lib/analytics';
import { storageService } from '../../services/storage.service';
import { useAuth } from '../../context/AuthContext';
import { Message, Conversation } from '../../types';

export const MessagesScreen = () => {
  const {
    currentRole, currentUser, messages, conversations, sendMessage,
    markMessagesRead, activeConversationId, setActiveConversation,
    selectedChild, showAlert, isLoading,
  } = useApp();
  const { profile: authProfile } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const scrollViewRef = useRef<ScrollView>(null);

  // Track screen view on mount (#34)
  useEffect(() => {
    trackScreen('Messages');
  }, []);

  // Mark messages read when viewing a conversation
  useEffect(() => {
    if (activeConversationId) {
      markMessagesRead(activeConversationId);
    }
  }, [activeConversationId, markMessagesRead]);

  useEffect(() => {
    if (activeConversationId) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, activeConversationId]);


  const handleSend = () => {
    if (!inputText.trim() || !activeConversationId) return;
    sendMessage(inputText.trim(), isUrgent, activeConversationId);
    trackEvent(AnalyticsEvents.MESSAGE_SENT, { urgent: isUrgent });
    setInputText('');
    setIsUrgent(false);
  };

  const isOwnMessage = (msg: Message) => msg.senderId === currentUser.id;

  const conversationMessages = useMemo(() =>
    messages.filter((m) => m.conversationId === activeConversationId),
    [messages, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Apply filter
    if (messageFilter === 'unread') {
      result = result.filter((c) => {
        const unread = messages.filter(
          (m) => m.conversationId === c.id && !m.read && m.senderId !== currentUser.id
        ).length;
        return unread > 0;
      });
    } else if (messageFilter === 'urgent') {
      result = result.filter((c) => {
        return messages.some(
          (m) => m.conversationId === c.id && m.isUrgent
        );
      });
    }

    // Apply search
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      result = result.filter((c) => {
        const otherNames = c.participants
          .filter((p) => p.id !== currentUser.id)
          .map((p) => p.name.toLowerCase())
          .join(' ');
        const title = (c.title || '').toLowerCase();
        return otherNames.includes(q) || title.includes(q) || c.lastMessage.text.toLowerCase().includes(q);
      });
    }

    return result;
  }, [conversations, messages, localSearch, messageFilter, currentUser.id]);

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title) return conv.title;
    const others = conv.participants.filter((p) => p.id !== currentUser.id);
    return others.map((p) => p.name).join(', ');
  };

  const getConversationSubtitle = (conv: Conversation) => {
    if (conv.type === 'announcement') return 'Group Announcement';
    const others = conv.participants.filter((p) => p.id !== currentUser.id);
    if (others.length === 1) {
      const other = others[0];
      if (other.role === 'caregiver') return `Lead Teacher, ${selectedChild.classroom || 'Classroom'}`;
      if (other.role === 'admin') return 'Administration';
      return `${selectedChild.firstName}'s ${other.role}`;
    }
    return `${conv.participants.length} members`;
  };

  const getConversationInitial = (conv: Conversation) => {
    if (conv.type === 'announcement') return '📢';
    const others = conv.participants.filter((p) => p.id !== currentUser.id);
    if (others.length === 0) return '?';
    return others[0].name.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, '').charAt(0);
  };

  const getConversationUnread = (conv: Conversation) => {
    return messages.filter(
      (m) => m.conversationId === conv.id && !m.read && m.senderId !== currentUser.id
    ).length;
  };

  // Show skeleton while data is loading (#35)
  if (isLoading || !currentUser || !selectedChild) {
    return (
      <View style={styles.container}>
        <MessagesSkeleton />
      </View>
    );
  }

  // ── Conversation List View ──
  if (!activeConversationId) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerMeta}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </Text>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, Shadows.small]}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={Colors.textMuted}
              value={localSearch}
              onChangeText={setLocalSearch}
            />
            {localSearch.length > 0 && (
              <TouchableOpacity onPress={() => setLocalSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Message filter chips */}
        <View style={styles.msgFilterRow}>
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'unread' as const, label: 'Unread' },
            { key: 'urgent' as const, label: 'Urgent' },
          ]).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.msgFilterChip, messageFilter === f.key && styles.msgFilterChipActive]}
              onPress={() => setMessageFilter(f.key)}
              accessibilityLabel={`Filter by ${f.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: messageFilter === f.key }}
            >
              <Text style={[styles.msgFilterText, messageFilter === f.key && styles.msgFilterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.convListContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.encryptionNotice}>
              <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
              <Text style={styles.encryptionText}>All messages are encrypted and private</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No conversations found</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          initialNumToRender={10}
          renderItem={({ item: conv }) => {
            const unread = getConversationUnread(conv);
            return (
              <TouchableOpacity
                style={[styles.convItem, Shadows.small]}
                onPress={() => setActiveConversation(conv.id)}
              >
                <View style={[
                  styles.convAvatar,
                  conv.type === 'announcement' && { backgroundColor: Colors.accent + '20' },
                ]}>
                  <Text style={[
                    styles.convAvatarText,
                    conv.type === 'announcement' && { fontSize: 20 },
                  ]}>
                    {getConversationInitial(conv)}
                  </Text>
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={[styles.convName, unread > 0 && styles.convNameUnread]} numberOfLines={1}>
                      {getConversationTitle(conv)}
                    </Text>
                    <Text style={styles.convTime}>{getRelativeTime(conv.lastMessage.timestamp)}</Text>
                  </View>
                  <Text style={styles.convSubtitle}>{getConversationSubtitle(conv)}</Text>
                  <View style={styles.convBottom}>
                    <Text style={[styles.convPreview, unread > 0 && styles.convPreviewUnread]} numberOfLines={1}>
                      {conv.lastMessage.senderId === currentUser.id ? 'You: ' : ''}
                      {conv.lastMessage.text}
                    </Text>
                    {unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // ── Active Conversation View ──
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const partnerName = activeConv ? getConversationTitle(activeConv) : 'Chat';
  const partnerSubtitle = activeConv ? getConversationSubtitle(activeConv) : '';
  const partnerInitial = activeConv ? getConversationInitial(activeConv) : '?';

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chatHeader}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => setActiveConversation(null)}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.chatHeaderAvatar}>
          <Text style={styles.chatHeaderAvatarText}>{partnerInitial}</Text>
        </View>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{partnerName}</Text>
          <Text style={styles.chatHeaderMeta}>{partnerSubtitle}</Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date separator */}
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>Today</Text>
            <View style={styles.dateLine} />
          </View>

          {conversationMessages.map((msg) => {
            const own = isOwnMessage(msg);
            return (
              <View
                key={msg.id}
                style={[styles.messageBubbleContainer, own ? styles.ownMessage : styles.otherMessage]}
              >
                {!own && (
                  <View style={styles.messageAvatar}>
                    <Text style={styles.messageAvatarText}>
                      {msg.senderName.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, '').charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={[styles.messageBubble, own ? styles.ownBubble : styles.otherBubble, msg.isUrgent && styles.urgentBubble]}>
                  {/* Show sender name in group conversations */}
                  {!own && activeConv && activeConv.participants.length > 2 && (
                    <Text style={styles.senderLabel}>{msg.senderName}</Text>
                  )}
                  {msg.isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Ionicons name="warning" size={12} color={Colors.danger} />
                      <Text style={styles.urgentText}>Urgent</Text>
                    </View>
                  )}
                  {msg.text.startsWith('[photo:') ? (
                    <Image
                      source={{ uri: msg.text.slice(7, -1) }}
                      style={{ width: 200, height: 150, borderRadius: BorderRadius.md, marginTop: 4 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[styles.messageText, own && styles.ownMessageText]}>{msg.text}</Text>
                  )}
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, own && styles.ownMessageTime]}>
                      {formatTime(msg.timestamp)}
                    </Text>
                    {own && (
                      <Ionicons
                        name={msg.read ? 'checkmark-done' : 'checkmark'}
                        size={14}
                        color={own ? 'rgba(255,255,255,0.7)' : Colors.textMuted}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputContainer, Shadows.medium]}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.inputAction}
              onPress={async () => {
                const uploadAndSendPhoto = async (uri: string) => {
                  setIsUploadingPhoto(true);
                  try {
                    const daycareId = authProfile?.daycare_id;
                    if (daycareId) {
                      const ext = uri.split('.').pop() || 'jpg';
                      const filename = `msg_${Date.now()}.${ext}`;
                      const path = `${daycareId}/messages/${filename}`;
                      const uploadedUrl = await storageService.uploadImage('timelinePhotos', path, uri);
                      sendMessage(`[photo:${uploadedUrl}]`, false, activeConversationId || undefined);
                    } else {
                      // Fallback: send local URI (won't persist across devices)
                      sendMessage(`[photo:${uri}]`, false, activeConversationId || undefined);
                    }
                  } catch (err: any) {
                    console.warn('[Messages] Photo upload failed:', err);
                    // Fallback to local URI on error
                    sendMessage(`[photo:${uri}]`, false, activeConversationId || undefined);
                  } finally {
                    setIsUploadingPhoto(false);
                  }
                };

                Alert.alert('Attach Photo', 'Choose a source', [
                  { text: 'Camera', onPress: async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') { showAlert('Permission Required', 'Camera access is needed.'); return; }
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                      await uploadAndSendPhoto(result.assets[0].uri);
                    }
                  }},
                  { text: 'Gallery', onPress: async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') { showAlert('Permission Required', 'Gallery access is needed.'); return; }
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                    if (!result.canceled && result.assets?.[0]) {
                      await uploadAndSendPhoto(result.assets[0].uri);
                    }
                  }},
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              {isUploadingPhoto ? (
                <Text style={{ fontSize: 10, color: Colors.primary }}>Uploading…</Text>
              ) : (
                <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              )}
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.urgentToggle, isUrgent && styles.urgentToggleActive]}
              onPress={() => setIsUrgent(!isUrgent)}
            >
              <Ionicons name="warning-outline" size={18} color={isUrgent ? Colors.danger : Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, inputText.trim() ? styles.sendButtonActive : null]}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={18} color={inputText.trim() ? Colors.white : Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {isUrgent && (
            <View style={styles.urgentWarning}>
              <Ionicons name="information-circle" size={14} color={Colors.warning} />
              <Text style={styles.urgentWarningText}>
                This will send as an urgent message with a priority notification
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  // Conversation list header
  header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  headerMeta: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },

  // Search
  searchContainer: { paddingHorizontal: Spacing.lg, marginTop: -Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },

  // Conversation list
  convListContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  // Message filter chips
  msgFilterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
  msgFilterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  msgFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  msgFilterText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  msgFilterTextActive: { color: Colors.white },

  encryptionNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: 4, marginBottom: Spacing.sm },
  encryptionText: { fontSize: FontSizes.xs, color: Colors.textMuted },
  convItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  convAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  convAvatarText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  convNameUnread: { fontWeight: '800' },
  convTime: { fontSize: FontSizes.xs, color: Colors.textMuted },
  convSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  convBottom: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
  convPreview: { fontSize: FontSizes.sm, color: Colors.textMuted, flex: 1, marginRight: Spacing.sm },
  convPreviewUnread: { color: Colors.textPrimary, fontWeight: '600' },
  unreadBadge: { backgroundColor: Colors.secondary, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  unreadText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: Spacing.md },

  // Chat header
  chatHeader: { paddingTop: 60, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  chatHeaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  chatHeaderAvatarText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  chatHeaderInfo: { flex: 1, marginLeft: Spacing.sm },
  chatHeaderName: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  chatHeaderMeta: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)' },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.xs },

  // Messages
  messagesList: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: Spacing.sm },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dateText: { fontSize: FontSizes.xs, color: Colors.textMuted, paddingHorizontal: Spacing.md, fontWeight: '600' },
  messageBubbleContainer: { flexDirection: 'row', marginBottom: Spacing.xs, maxWidth: '85%' },
  ownMessage: { alignSelf: 'flex-end' },
  otherMessage: { alignSelf: 'flex-start' },
  messageAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm, marginTop: 4 },
  messageAvatarText: { fontSize: FontSizes.xs, color: Colors.white, fontWeight: '700' },
  messageBubble: { borderRadius: BorderRadius.lg, padding: Spacing.md, maxWidth: '100%' },
  ownBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: Colors.card, borderBottomLeftRadius: 4, ...Shadows.small },
  urgentBubble: { borderWidth: 1, borderColor: Colors.dangerLight },
  senderLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.xs },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xs },
  urgentText: { fontSize: FontSizes.xs, color: Colors.danger, fontWeight: '700' },
  messageText: { fontSize: FontSizes.md, color: Colors.textPrimary, lineHeight: 22 },
  ownMessageText: { color: Colors.white },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: Spacing.xs },
  messageTime: { fontSize: FontSizes.xs, color: Colors.textMuted },
  ownMessageTime: { color: 'rgba(255,255,255,0.7)' },

  // Input
  inputContainer: { backgroundColor: Colors.card, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  inputAction: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxHeight: 100 },
  input: { fontSize: FontSizes.md, color: Colors.textPrimary, maxHeight: 80 },
  urgentToggle: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  urgentToggleActive: { backgroundColor: Colors.dangerLight },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: Colors.primary },
  urgentWarning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm },
  urgentWarningText: { fontSize: FontSizes.xs, color: Colors.warning },
  // Call modal styles
  callOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  callScreen: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: 100, paddingBottom: 60 },
  callInfo: { alignItems: 'center' },
  callVideoIcon: { marginBottom: Spacing.lg },
  callAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  callAvatarText: { fontSize: 40, color: Colors.white, fontWeight: '700' },
  callName: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.white },
  callType: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  callTimerText: { fontSize: FontSizes.xl, color: Colors.white, fontWeight: '600', marginTop: Spacing.lg },
  callActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  callActionBtn: { alignItems: 'center', gap: Spacing.xs },
  callActionLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.8)' },
  callEndBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger, justifyContent: 'center', alignItems: 'center' },
});
