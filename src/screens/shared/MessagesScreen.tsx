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
    currentUser, messages, conversations, sendMessage,
    markMessagesRead, activeConversationId, setActiveConversation,
    selectedChild, showAlert, isLoading,
    createConversation, listContacts, editMessage, deleteMessage,
  } = useApp();
  const { profile: authProfile } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const scrollViewRef = useRef<ScrollView>(null);

  // ── In-thread search + edit/delete state ──
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // ── Compose (new message) flow ──
  const [composeOpen, setComposeOpen] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const openCompose = async () => {
    setSelectedRecipients([]);
    setComposeOpen(true);
    setContactsLoading(true);
    try {
      const list = await listContacts();
      setContacts(list);
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const closeCompose = () => {
    if (isCreatingConversation) return;
    setComposeOpen(false);
    setSelectedRecipients([]);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleCreateConversation = async () => {
    if (selectedRecipients.length === 0 || isCreatingConversation) return;
    setIsCreatingConversation(true);
    try {
      const { error } = await createConversation(selectedRecipients);
      if (error) {
        showAlert('Could Not Start Conversation', error);
        return;
      }
      // Success: the new conversation becomes active and the list refreshes.
      setComposeOpen(false);
      setSelectedRecipients([]);
    } catch {
      showAlert('Could Not Start Conversation', 'Something went wrong. Please try again.');
    } finally {
      setIsCreatingConversation(false);
    }
  };

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

  // In-thread text search (case-insensitive). Empty/closed shows all messages.
  const visibleThreadMessages = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!threadSearchOpen || !q) return conversationMessages;
    return conversationMessages.filter((m) =>
      !m.deleted && m.text.toLowerCase().includes(q)
    );
  }, [conversationMessages, threadSearch, threadSearchOpen]);

  const closeThreadSearch = () => {
    setThreadSearchOpen(false);
    setThreadSearch('');
  };

  // ── Edit / delete actions for own messages ──
  const startEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const confirmEditMessage = () => {
    const trimmed = editingText.trim();
    if (!editingMessageId || !trimmed) {
      cancelEditMessage();
      return;
    }
    editMessage(editingMessageId, trimmed);
    cancelEditMessage();
  };

  const confirmDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'This message will be removed for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMessage(messageId),
        },
      ]
    );
  };

  const openMessageActions = (msg: Message) => {
    if (msg.deleted) return;
    // Photo messages can be deleted but not text-edited.
    const isPhoto = msg.text.startsWith('[photo:');
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (!isPhoto) {
      buttons.push({ text: 'Edit', onPress: () => startEditMessage(msg) });
    }
    buttons.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDeleteMessage(msg.id) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message Options', undefined, buttons);
  };

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

  // ── Compose (new message) modal — shared by FAB and empty-state CTA ──
  const renderComposeModal = () => (
    <Modal
      visible={composeOpen}
      animationType="slide"
      transparent
      onRequestClose={closeCompose}
    >
      <View style={styles.composeOverlay}>
        <View style={styles.composeSheet}>
          <View style={styles.composeHeader}>
            <Text style={styles.composeTitle}>New Message</Text>
            <TouchableOpacity
              onPress={closeCompose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.composeSubtitle}>Select one or more recipients</Text>

          {contactsLoading ? (
            <View style={styles.composeEmpty}>
              <Text style={styles.composeEmptyText}>Loading contacts…</Text>
            </View>
          ) : contacts.length === 0 ? (
            <View style={styles.composeEmpty}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.composeEmptyText}>No contacts available</Text>
            </View>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              style={styles.composeList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = selectedRecipients.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.contactRow, selected && styles.contactRowSelected]}
                    onPress={() => toggleRecipient(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>
                        {item.name.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, '').charAt(0) || '?'}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.contactRole}>{item.role}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? Colors.primary : Colors.borderLight}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[
              styles.composeConfirm,
              (selectedRecipients.length === 0 || isCreatingConversation) && styles.composeConfirmDisabled,
            ]}
            onPress={handleCreateConversation}
            disabled={selectedRecipients.length === 0 || isCreatingConversation}
            accessibilityRole="button"
          >
            <Text style={styles.composeConfirmText}>
              {isCreatingConversation
                ? 'Starting…'
                : selectedRecipients.length > 0
                  ? `Start Conversation (${selectedRecipients.length})`
                  : 'Start Conversation'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
              <Text style={styles.encryptionText}>Messages are private and secure</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No conversations found</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={openCompose}
                accessibilityLabel="Start a new message"
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={18} color={Colors.white} />
                <Text style={styles.emptyCtaText}>New Message</Text>
              </TouchableOpacity>
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

        {/* Compose FAB */}
        <TouchableOpacity
          style={[styles.composeFab, Shadows.medium]}
          onPress={openCompose}
          accessibilityLabel="New message"
          accessibilityRole="button"
        >
          <Ionicons name="create" size={24} color={Colors.white} />
        </TouchableOpacity>

        {renderComposeModal()}
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
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => (threadSearchOpen ? closeThreadSearch() : setThreadSearchOpen(true))}
          accessibilityLabel={threadSearchOpen ? 'Close search' : 'Search messages'}
          accessibilityRole="button"
        >
          <Ionicons name={threadSearchOpen ? 'close' : 'search'} size={20} color={Colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* In-thread search bar */}
      {threadSearchOpen && (
        <View style={styles.threadSearchContainer}>
          <View style={[styles.searchBar, Shadows.small]}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search in conversation..."
              placeholderTextColor={Colors.textMuted}
              value={threadSearch}
              onChangeText={setThreadSearch}
              autoFocus
            />
            {threadSearch.length > 0 && (
              <TouchableOpacity onPress={() => setThreadSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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

          {threadSearchOpen && threadSearch.trim() && visibleThreadMessages.length === 0 && (
            <View style={styles.threadSearchEmpty}>
              <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.threadSearchEmptyText}>No messages match “{threadSearch.trim()}”</Text>
            </View>
          )}

          {visibleThreadMessages.map((msg) => {
            const own = isOwnMessage(msg);
            const isEditing = editingMessageId === msg.id;
            const isPhoto = msg.text.startsWith('[photo:');
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
                <TouchableOpacity
                  activeOpacity={own && !msg.deleted ? 0.7 : 1}
                  onLongPress={own && !msg.deleted ? () => openMessageActions(msg) : undefined}
                  delayLongPress={300}
                  accessibilityLabel={own && !msg.deleted ? 'Message options' : undefined}
                  style={[styles.messageBubble, own ? styles.ownBubble : styles.otherBubble, msg.isUrgent && !msg.deleted && styles.urgentBubble, msg.deleted && styles.deletedBubble]}
                >
                  {/* Show sender name in group conversations */}
                  {!own && !msg.deleted && activeConv && activeConv.participants.length > 2 && (
                    <Text style={styles.senderLabel}>{msg.senderName}</Text>
                  )}
                  {msg.deleted ? (
                    <View style={styles.deletedRow}>
                      <Ionicons name="ban-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.deletedText}>This message was deleted</Text>
                    </View>
                  ) : isEditing ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={[styles.editInput, own && styles.ownMessageText]}
                        value={editingText}
                        onChangeText={setEditingText}
                        multiline
                        autoFocus
                        maxLength={1000}
                        placeholder="Edit message..."
                        placeholderTextColor={own ? 'rgba(255,255,255,0.6)' : Colors.textMuted}
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity onPress={cancelEditMessage} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="Cancel edit">
                          <Text style={[styles.editBtnText, own && styles.ownMessageText]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={confirmEditMessage} style={styles.editBtn} disabled={!editingText.trim()} accessibilityRole="button" accessibilityLabel="Save edit">
                          <Text style={[styles.editBtnText, styles.editBtnSave, own && styles.ownMessageText]}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {msg.isUrgent && (
                        <View style={styles.urgentBadge}>
                          <Ionicons name="warning" size={12} color={Colors.danger} />
                          <Text style={styles.urgentText}>Urgent</Text>
                        </View>
                      )}
                      {isPhoto ? (
                        <Image
                          source={{ uri: msg.text.slice(7, -1) }}
                          style={{ width: 200, height: 150, borderRadius: BorderRadius.md, marginTop: 4 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={[styles.messageText, own && styles.ownMessageText]}>{msg.text}</Text>
                      )}
                    </>
                  )}
                  {!msg.deleted && !isEditing && (
                    <View style={styles.messageFooter}>
                      {msg.edited && (
                        <Text style={[styles.editedLabel, own && styles.ownMessageTime]}>(edited)</Text>
                      )}
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
                  )}
                </TouchableOpacity>
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
                  const daycareId = authProfile?.daycare_id;
                  // Demo/offline (no daycare): there's no backend, so send the
                  // local URI for the local-only demo experience.
                  if (!daycareId) {
                    sendMessage(`[photo:${uri}]`, false, activeConversationId || undefined);
                    setIsUploadingPhoto(false);
                    return;
                  }
                  try {
                    const ext = uri.split('.').pop() || 'jpg';
                    const filename = `msg_${Date.now()}.${ext}`;
                    const path = `${daycareId}/messages/${filename}`;
                    const uploadedUrl = await storageService.uploadImage('timelinePhotos', path, uri);
                    sendMessage(`[photo:${uploadedUrl}]`, false, activeConversationId || undefined);
                  } catch (err) {
                    // Do NOT send a local file:// URI — it's unviewable for the
                    // recipient. Surface the failure instead.
                    console.warn('[Messages] Photo upload failed:', err);
                    showAlert('Upload Failed', 'Your photo could not be sent. Please check your connection and try again.');
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
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.round, marginTop: Spacing.lg },
  emptyCtaText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },

  // Compose FAB + modal
  composeFab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  composeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  composeSheet: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl, maxHeight: '80%' },
  composeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  composeTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  composeSubtitle: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  composeList: { flexGrow: 0 },
  composeEmpty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  composeEmptyText: { fontSize: FontSizes.md, color: Colors.textMuted },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, borderWidth: 1, borderColor: 'transparent' },
  contactRowSelected: { borderColor: Colors.primary },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  contactAvatarText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  contactRole: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
  composeConfirm: { backgroundColor: Colors.primary, borderRadius: BorderRadius.round, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  composeConfirmDisabled: { backgroundColor: Colors.borderLight },
  composeConfirmText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },

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
  editedLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontStyle: 'italic', marginRight: 2 },

  // In-thread search
  threadSearchContainer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  threadSearchEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  threadSearchEmptyText: { fontSize: FontSizes.sm, color: Colors.textMuted },

  // Deleted (tombstone) + inline edit
  deletedBubble: { backgroundColor: Colors.borderLight, borderWidth: 0 },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  deletedText: { fontSize: FontSizes.md, color: Colors.textMuted, fontStyle: 'italic' },
  editContainer: { minWidth: 180 },
  editInput: { fontSize: FontSizes.md, color: Colors.textPrimary, lineHeight: 22, minWidth: 160, padding: 0 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.sm },
  editBtn: { paddingVertical: 2 },
  editBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  editBtnSave: { color: Colors.primary },

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
