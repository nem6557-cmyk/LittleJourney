import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserRole, User, TimelineEntry, Message, Child, MoodType, Conversation,
  Notification, IncidentReport, AttendanceRecord, Invoice, Comment, Reaction,
} from '../types';
import {
  parentUser, caregiverUser, layla, adam,
  todayTimeline as initialTimeline,
  sampleMessages as initialMessages,
  sampleConversations as initialConversations,
  sampleNotifications as initialNotifications,
  sampleIncidents as initialIncidents,
  sampleAttendance as initialAttendance,
  sampleInvoices as initialInvoices,
} from '../data/sampleData';

interface AppContextType {
  // Auth / role
  currentRole: UserRole;
  switchRole: () => void;
  currentUser: User;

  // Children
  children: Child[];
  selectedChild: Child;
  selectChild: (childId: string) => void;

  // Timeline
  timelineEntries: TimelineEntry[];
  addTimelineEntry: (entry: Omit<TimelineEntry, 'id' | 'timestamp' | 'createdBy'>) => void;
  addComment: (entryId: string, text: string) => void;
  deleteComment: (entryId: string, commentId: string) => void;
  toggleReaction: (entryId: string, emoji: string) => void;
  deleteTimelineEntry: (entryId: string) => void;
  updateTimelineEntry: (entryId: string, updates: Partial<TimelineEntry>) => void;

  // Messages & Conversations
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (text: string, isUrgent?: boolean, conversationId?: string) => void;
  markMessagesRead: (conversationId?: string) => void;
  unreadCount: number;

  // Stats
  todayStats: {
    meals: number;
    naps: number;
    napDuration: string;
    diaperChanges: number;
    activities: number;
    photos: number;
    currentMood: MoodType;
  };

  // Check-in/out
  isCheckedIn: boolean;
  toggleCheckIn: () => void;

  // Notifications
  notifications: Notification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp'>) => void;

  // Incidents
  incidents: IncidentReport[];
  addIncident: (incident: Omit<IncidentReport, 'id' | 'timestamp' | 'reportedBy'>) => void;

  // Attendance
  attendance: AttendanceRecord[];
  updateAttendance: (childId: string, update: Partial<AttendanceRecord>) => void;

  // Invoices
  invoices: Invoice[];
  payInvoice: (invoiceId: string) => void;

  // Utility
  showAlert: (title: string, message: string) => void;
  shareContent: (message: string) => void;

  // Dynamic report generation
  generateDailyNarrative: () => string;
  generateHighlights: () => string[];
}

const AppContext = createContext<AppContextType>({} as AppContextType);

const classroomChildren: Child[] = [
  layla,
  { ...layla, id: 'child2', firstName: 'Zain', lastName: 'Malik', allergies: [], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-03-22' },
  { ...layla, id: 'child3', firstName: 'Emma', lastName: 'Lopez', allergies: ['Dairy'], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-08-10' },
  { ...layla, id: 'child4', firstName: 'Noah', lastName: 'Kim', allergies: [], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-01-05' },
  { ...layla, id: 'child5', firstName: 'Aria', lastName: 'Singh', allergies: ['Gluten'], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-05-17' },
  { ...layla, id: 'child6', firstName: 'Liam', lastName: 'Brown', allergies: [], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-07-30' },
  { ...layla, id: 'child7', firstName: 'Mia', lastName: 'Chen', allergies: [], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-04-12' },
  { ...layla, id: 'child8', firstName: 'Ethan', lastName: 'Davis', allergies: ['Eggs'], emergencyContacts: [], authorizedPickups: [], dateOfBirth: '2023-09-25' },
];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('parent');
  const [selectedChildId, setSelectedChildId] = useState('child1');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>(initialTimeline);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [incidents, setIncidents] = useState<IncidentReport[]>(initialIncidents);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(initialAttendance);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUser = currentRole === 'parent' ? parentUser : caregiverUser;
  const allChildren = currentRole === 'parent' ? [layla, adam] : classroomChildren;
  const selectedChild = allChildren.find((c) => c.id === selectedChildId) || layla;

  const switchRole = useCallback(() => {
    setCurrentRole((prev) => (prev === 'parent' ? 'caregiver' : 'parent'));
    setSelectedChildId('child1');
    setActiveConversationId(null);
  }, []);

  const selectChild = useCallback((childId: string) => {
    setSelectedChildId(childId);
  }, []);

  // ── Timeline stats ──
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayEntries = timelineEntries.filter(
      (e) => e.childId === selectedChild.id && new Date(e.timestamp).toDateString() === today
    );
    const meals = todayEntries.filter((e) => e.type === 'meal').length;
    const napEntries = todayEntries.filter((e) => e.type === 'nap');
    const naps = napEntries.filter((e) => e.details?.status === 'woke_up').length || (napEntries.length > 0 ? 1 : 0);
    const napWithDuration = napEntries.find((e) => e.details?.duration);
    const napDuration = napWithDuration?.details?.duration || (naps > 0 ? 'In progress' : '0m');
    const diaperChanges = todayEntries.filter((e) => e.type === 'diaper').length;
    const activities = todayEntries.filter((e) => e.type === 'activity' || e.type === 'milestone').length;
    const photos = todayEntries.filter((e) => e.photos && e.photos.length > 0).length;
    const moodEntries = [...todayEntries].reverse();
    const lastMood = moodEntries.find((e) => e.mood)?.mood || 'happy';
    return { meals, naps, napDuration, diaperChanges, activities, photos, currentMood: lastMood as MoodType };
  }, [timelineEntries, selectedChild.id]);

  // ── Add timeline entry ──
  const addTimelineEntry = useCallback(
    (entry: Omit<TimelineEntry, 'id' | 'timestamp' | 'createdBy'>) => {
      const newEntry: TimelineEntry = {
        ...entry,
        id: `t${Date.now()}`,
        timestamp: new Date().toISOString(),
        createdBy: currentUser,
        reactions: [],
        comments: [],
      };
      setTimelineEntries((prev) => [...prev, newEntry]);
    },
    [currentUser]
  );

  // ── Comments ──
  const addComment = useCallback(
    (entryId: string, text: string) => {
      const newComment: Comment = {
        id: `cm${Date.now()}`,
        entryId,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        text,
        timestamp: new Date().toISOString(),
      };
      setTimelineEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, comments: [...(e.comments || []), newComment] }
            : e
        )
      );
    },
    [currentUser]
  );

  // ── Reactions ──
  const toggleReaction = useCallback(
    (entryId: string, emoji: string) => {
      setTimelineEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          const existing = (e.reactions || []).find(
            (r) => r.userId === currentUser.id && r.emoji === emoji
          );
          if (existing) {
            return { ...e, reactions: (e.reactions || []).filter((r) => r !== existing) };
          }
          return {
            ...e,
            reactions: [...(e.reactions || []), { userId: currentUser.id, emoji, timestamp: new Date().toISOString() }],
          };
        })
      );
    },
    [currentUser.id]
  );

  // ── Delete timeline entry ──
  const deleteTimelineEntry = useCallback((entryId: string) => {
    setTimelineEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  // ── Update timeline entry ──
  const updateTimelineEntry = useCallback((entryId: string, updates: Partial<TimelineEntry>) => {
    setTimelineEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, ...updates } : e));
  }, []);

  // ── Delete comment ──
  const deleteComment = useCallback((entryId: string, commentId: string) => {
    setTimelineEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, comments: (e.comments || []).filter((c) => c.id !== commentId) } : e
      )
    );
  }, []);

  // ── Add notification ──
  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...notif,
      id: `n${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  // ── Messages ──
  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.read && m.senderId !== currentUser.id).length;
  }, [messages, currentUser.id]);

  const sendMessage = useCallback(
    (text: string, isUrgent = false, conversationId?: string) => {
      const convId = conversationId || activeConversationId || 'conv1';
      const newMsg: Message = {
        id: `m${Date.now()}`,
        conversationId: convId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text,
        timestamp: new Date().toISOString(),
        read: false,
        isUrgent,
      };
      setMessages((prev) => [...prev, newMsg]);
      // Update conversation last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, lastMessage: newMsg } : c
        )
      );
    },
    [currentUser, activeConversationId]
  );

  const markMessagesRead = useCallback((conversationId?: string) => {
    const convId = conversationId || activeConversationId;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.senderId === currentUser.id || m.read) return m;
        if (convId && m.conversationId !== convId) return m;
        return { ...m, read: true };
      })
    );
    if (convId) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [currentUser.id, activeConversationId]);

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  // ── Check-in/out ──
  const toggleCheckIn = useCallback(() => {
    const action = isCheckedIn ? 'checkout' : 'checkin';
    const title = isCheckedIn ? 'Checked Out' : 'Checked In';
    const desc = isCheckedIn
      ? `${selectedChild.firstName} has been checked out by ${currentUser.name}.`
      : `${selectedChild.firstName} has been checked in by ${currentUser.name}.`;
    addTimelineEntry({
      childId: selectedChild.id,
      type: action,
      title,
      description: desc,
      details: { method: 'Manual', person: currentUser.name },
    });
    // Update attendance
    const now = new Date();
    setAttendance((prev) =>
      prev.map((a) => {
        if (a.childId !== selectedChild.id) return a;
        if (isCheckedIn) {
          return { ...a, checkOutTime: now.toISOString(), status: 'present' };
        }
        return { ...a, checkInTime: now.toISOString(), status: 'present' };
      })
    );
    setIsCheckedIn((prev) => !prev);
  }, [isCheckedIn, selectedChild, addTimelineEntry, currentUser.name]);

  // ── Notifications ──
  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // ── Incidents ──
  const addIncident = useCallback(
    (incident: Omit<IncidentReport, 'id' | 'timestamp' | 'reportedBy'>) => {
      const newIncident: IncidentReport = {
        ...incident,
        id: `ir${Date.now()}`,
        timestamp: new Date().toISOString(),
        reportedBy: currentUser,
      };
      setIncidents((prev) => [...prev, newIncident]);
      // Also add to timeline as urgent entry
      addTimelineEntry({
        childId: incident.childId,
        type: 'incident',
        title: `Incident Report: ${incident.type.replace('_', ' ')}`,
        description: incident.description,
        details: { severity: incident.severity, location: incident.location, actionTaken: incident.actionTaken },
        isUrgent: incident.severity !== 'minor',
      });
      // Add notification
      setNotifications((prev) => [
        {
          id: `n${Date.now()}`,
          type: 'incident',
          title: `Incident Report — ${incident.childName}`,
          body: `${incident.type.replace('_', ' ')} (${incident.severity}) at ${incident.location}`,
          timestamp: new Date().toISOString(),
          read: false,
          childId: incident.childId,
          icon: '🚨',
        },
        ...prev,
      ]);
    },
    [currentUser, addTimelineEntry]
  );

  // ── Attendance ──
  const updateAttendance = useCallback((childId: string, update: Partial<AttendanceRecord>) => {
    setAttendance((prev) =>
      prev.map((a) => (a.childId === childId ? { ...a, ...update } : a))
    );
  }, []);

  // ── Invoices ──
  const payInvoice = useCallback((invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: 'paid' as const, paidDate: new Date().toISOString().split('T')[0] }
          : inv
      )
    );
  }, []);

  // ── Dynamic report generation ──
  const generateDailyNarrative = useCallback(() => {
    const today = new Date().toDateString();
    const entries = timelineEntries
      .filter((e) => e.childId === selectedChild.id && new Date(e.timestamp).toDateString() === today)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (entries.length === 0) return `No activities recorded yet today for ${selectedChild.firstName}.`;

    const name = selectedChild.firstName;
    const parts: string[] = [];

    const checkin = entries.find((e) => e.type === 'checkin');
    if (checkin) {
      parts.push(`${name} arrived at ${selectedChild.classroom || 'school'}${checkin.description ? ` — ${checkin.description.toLowerCase()}` : ' and was ready for a great day!'}`);
    }

    const mealEntries = entries.filter((e) => e.type === 'meal');
    if (mealEntries.length > 0) {
      const mealDescs = mealEntries.map((m) => {
        const type = m.details?.mealType || m.title.toLowerCase();
        const amount = m.details?.amount;
        return `${type}${amount ? ` (ate ${amount})` : ''}`;
      });
      parts.push(`For meals today, ${name} had: ${mealDescs.join(', ')}.${mealEntries.some((m) => m.details?.amount === 'all') ? ` Great appetite!` : ''}`);
    }

    const activityEntries = entries.filter((e) => e.type === 'activity');
    if (activityEntries.length > 0) {
      const actDescs = activityEntries.map((a) => a.title).join(', ');
      parts.push(`Activities included ${actDescs}.${activityEntries[0].description ? ` ${activityEntries[0].description}` : ''}`);
    }

    const napEntries = entries.filter((e) => e.type === 'nap');
    const wokeUp = napEntries.find((e) => e.details?.status === 'woke_up');
    if (wokeUp && wokeUp.details?.duration) {
      parts.push(`${name} napped for ${wokeUp.details.duration} and woke up refreshed.`);
    } else if (napEntries.length > 0) {
      parts.push(`${name} went down for a nap today.`);
    }

    const milestoneEntries = entries.filter((e) => e.type === 'milestone');
    if (milestoneEntries.length > 0) {
      parts.push(`Exciting milestone${milestoneEntries.length > 1 ? 's' : ''}: ${milestoneEntries.map((m) => m.description || m.title).join('. ')}`);
    }

    const lastMood = [...entries].reverse().find((e) => e.mood);
    if (lastMood) {
      parts.push(`Overall, ${name} was feeling ${lastMood.mood} today.`);
    }

    parts.push(`What a wonderful day! We can't wait to see what tomorrow brings.`);

    return parts.join('\n\n');
  }, [timelineEntries, selectedChild]);

  const generateHighlights = useCallback(() => {
    const today = new Date().toDateString();
    const entries = timelineEntries
      .filter((e) => e.childId === selectedChild.id && new Date(e.timestamp).toDateString() === today)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const highlights: string[] = [];

    entries.filter((e) => e.type === 'milestone').forEach((e) => {
      highlights.push(e.description || e.title);
    });

    entries
      .filter((e) => e.type === 'activity' && e.description && e.description.length > 20)
      .slice(0, 2)
      .forEach((e) => {
        const desc = e.description!;
        highlights.push(desc.length > 60 ? desc.substring(0, 57) + '...' : desc);
      });

    const allMeals = entries.filter((e) => e.type === 'meal' && e.details?.amount === 'all');
    if (allMeals.length > 0) {
      highlights.push(`Ate all of ${allMeals[0].title.toLowerCase()}`);
    }

    entries.filter((e) => e.photos && e.photos.length > 0).slice(0, 1).forEach((e) => {
      highlights.push(`Photo captured: ${e.title}`);
    });

    return highlights.length > 0 ? highlights : ['No highlights yet — check back later!'];
  }, [timelineEntries, selectedChild]);

  // ── Data persistence ──
  const STORAGE_KEY = 'littlejourney_data';

  // Save state to AsyncStorage whenever key data changes
  useEffect(() => {
    const saveData = async () => {
      try {
        const data = {
          timelineEntries,
          messages,
          conversations,
          notifications,
          incidents,
          attendance,
          invoices,
          isCheckedIn,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Silently fail — persistence is best-effort
      }
    };
    // Debounce saves
    const timer = setTimeout(saveData, 500);
    return () => clearTimeout(timer);
  }, [timelineEntries, messages, conversations, notifications, incidents, attendance, invoices, isCheckedIn]);

  // Load persisted state on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.timelineEntries?.length > 0) setTimelineEntries(data.timelineEntries);
          if (data.messages?.length > 0) setMessages(data.messages);
          if (data.conversations?.length > 0) setConversations(data.conversations);
          if (data.notifications?.length > 0) setNotifications(data.notifications);
          if (data.incidents?.length > 0) setIncidents(data.incidents);
          if (data.attendance?.length > 0) setAttendance(data.attendance);
          if (data.invoices?.length > 0) setInvoices(data.invoices);
          if (typeof data.isCheckedIn === 'boolean') setIsCheckedIn(data.isCheckedIn);
        }
      } catch {
        // Use defaults on error
      }
    };
    loadData();
  }, []);



  const showAlert = useCallback((title: string, message: string) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }, []);

  const shareContent = useCallback(async (message: string) => {
    try {
      await Share.share({ message });
    } catch {
      // cancelled
    }
  }, []);

  const value = useMemo(
    () => ({
      currentRole, switchRole, currentUser,
      children: allChildren, selectedChild, selectChild,
      timelineEntries, addTimelineEntry, addComment, deleteComment, toggleReaction,
      deleteTimelineEntry, updateTimelineEntry,
      messages, conversations, activeConversationId, setActiveConversation,
      sendMessage, markMessagesRead, unreadCount,
      todayStats, isCheckedIn, toggleCheckIn,
      notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, addNotification,
      incidents, addIncident,
      attendance, updateAttendance,
      invoices, payInvoice,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
    }),
    [
      currentRole, switchRole, currentUser,
      allChildren, selectedChild, selectChild,
      timelineEntries, addTimelineEntry, addComment, deleteComment, toggleReaction,
      deleteTimelineEntry, updateTimelineEntry,
      messages, conversations, activeConversationId, setActiveConversation,
      sendMessage, markMessagesRead, unreadCount,
      todayStats, isCheckedIn, toggleCheckIn,
      notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, addNotification,
      incidents, addIncident,
      attendance, updateAttendance,
      invoices, payInvoice,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
