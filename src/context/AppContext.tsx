import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Alert, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserRole, User, TimelineEntry, Message, Child, MoodType, Conversation,
  Notification, IncidentReport, AttendanceRecord, Invoice, Comment, Reaction,
  LearningPlan, Milestone, CalendarEvent,
} from '../types';
import {
  parentUser, caregiverUser, layla, adam,
} from '../data/sampleData';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { timelineService } from '../services/timeline.service';
import { messagesService } from '../services/messages.service';
import { incidentsService } from '../services/incidents.service';
import { milestonesService } from '../services/milestones.service';
import { calendarService } from '../services/calendar.service';
import { registerForPushNotifications } from '../lib/notifications';

interface AppContextType {
  // Auth / role
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
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

  // Learning Plans
  learningPlans: LearningPlan[];

  // Milestones & Calendar
  milestones: Milestone[];
  calendarEvents: CalendarEvent[];

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
  const auth = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole>('parent');
  const [selectedChildId, setSelectedChildId] = useState('child1');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchedChildren, setFetchedChildren] = useState<Child[]>([]);
  const pushRegistered = useRef(false);
  const [supabaseDataLoaded, setSupabaseDataLoaded] = useState(false);

  // Sync role from AuthContext when profile is available
  useEffect(() => {
    if (auth.profile?.role) {
      setCurrentRole(auth.profile.role as UserRole);
    }
  }, [auth.profile?.role]);

  // Build currentUser from auth profile when available, fallback to sample data
  const currentUser = useMemo(() => {
    if (auth.profile) {
      const role = (auth.profile.role || 'parent') as UserRole;
      const base = role === 'parent' ? parentUser : caregiverUser;
      return {
        ...base,
        id: auth.profile.id,
        name: `${auth.profile.first_name || ''} ${auth.profile.last_name || ''}`.trim() || base.name,
        email: auth.profile.email || base.email,
        role,
      };
    }
    return currentRole === 'parent' ? parentUser : caregiverUser;
  }, [auth.profile, currentRole]);

  // ── Fetch real data from Supabase when authenticated (fixes #11, #28) ──
  useEffect(() => {
    if (!auth.profile) {
      // Not logged in — no data to fetch
      setSupabaseDataLoaded(false);
      return;
    }

    let cancelled = false;

    const fetchSupabaseData = async () => {
      try {
        const profile = auth.profile!;
        const role = (profile.role || 'parent') as UserRole;

        // ── Fetch children based on role ──
        let childrenData: any[] = [];
        if (role === 'parent') {
          // Parent: query parent_children joined with children
          const { data, error } = await supabase
            .from('parent_children')
            .select('child_id, children(*)')
            .eq('parent_id', profile.id);
          if (!error && data) {
            childrenData = data
              .map((pc: any) => pc.children)
              .filter(Boolean);
          }
        } else {
          // Caregiver / Admin: query all children at the daycare
          if (profile.daycare_id) {
            const { data, error } = await supabase
              .from('children')
              .select('*')
              .eq('daycare_id', profile.daycare_id);
            if (!error && data) {
              childrenData = data;
            }
          }
        }

        if (cancelled) return;

        // Map DB children to app Child type
        const mappedChildren: Child[] = childrenData.map((c: any) => ({
          id: c.id,
          firstName: c.first_name,
          lastName: c.last_name,
          dateOfBirth: c.date_of_birth,
          avatar: c.avatar_url || undefined,
          classroom: c.classroom_id || undefined,
          allergies: c.allergies || [],
          emergencyContacts: [],
          authorizedPickups: [],
        }));

        if (mappedChildren.length > 0) {
          setFetchedChildren(mappedChildren);
          setSupabaseDataLoaded(true);
          // Select the first child if current selection is invalid
          if (!mappedChildren.find((c) => c.id === selectedChildId)) {
            setSelectedChildId(mappedChildren[0].id);
          }
        }

        const childIds = mappedChildren.map((c) => c.id);
        if (childIds.length === 0) return;

        // ── Fetch timeline entries ──
        const { data: timelineData } = await supabase
          .from('timeline_entries')
          .select('*, profiles:author_id(id, first_name, last_name, email, role)')
          .in('child_id', childIds)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!cancelled && timelineData && timelineData.length > 0) {
          const mappedTimeline: TimelineEntry[] = timelineData.map((te: any) => {
            const authorProfile = te.profiles;
            return {
              id: te.id,
              childId: te.child_id,
              type: te.activity_type,
              timestamp: te.created_at,
              createdBy: {
                id: authorProfile?.id || te.author_id,
                name: authorProfile ? `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() : 'Unknown',
                role: (authorProfile?.role || 'caregiver') as UserRole,
                email: authorProfile?.email || '',
              },
              title: te.title,
              description: te.description || undefined,
              details: te.metadata && typeof te.metadata === 'object' ? te.metadata as Record<string, any> : undefined,
              photos: te.photo_urls || [],
              mood: te.mood || undefined,
              isUrgent: te.is_urgent,
              reactions: [],
              comments: [],
            };
          });
          setTimelineEntries(mappedTimeline);
        }

        // ── Fetch conversations and messages ──
        const { data: memberData } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', profile.id);

        if (!cancelled && memberData && memberData.length > 0) {
          const convIds = memberData.map((m: any) => m.conversation_id);

          const { data: convData } = await supabase
            .from('conversations')
            .select('*')
            .in('id', convIds);

          const { data: msgData } = await supabase
            .from('messages')
            .select('*, profiles:sender_id(id, first_name, last_name, role)')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: true });

          if (!cancelled && msgData && msgData.length > 0) {
            const mappedMessages: Message[] = msgData.map((m: any) => {
              const senderProfile = m.profiles;
              return {
                id: m.id,
                conversationId: m.conversation_id,
                senderId: m.sender_id,
                senderName: senderProfile ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() : 'Unknown',
                senderRole: (senderProfile?.role || 'parent') as UserRole,
                text: m.text,
                timestamp: m.created_at,
                read: false,
                isUrgent: m.is_urgent,
                attachments: m.attachments || [],
              };
            });
            setMessages(mappedMessages);
          }

          if (!cancelled && convData && convData.length > 0) {
            const allMsgs = msgData || [];
            const mappedConversations: Conversation[] = convData.map((c: any) => {
              const convMsgs = allMsgs.filter((m: any) => m.conversation_id === c.id);
              const lastMsg = convMsgs[convMsgs.length - 1];
              const senderProfile = lastMsg?.profiles;
              return {
                id: c.id,
                participants: [],
                type: c.type || 'direct',
                title: c.title || undefined,
                lastMessage: lastMsg ? {
                  id: lastMsg.id,
                  conversationId: lastMsg.conversation_id,
                  senderId: lastMsg.sender_id,
                  senderName: senderProfile ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() : 'Unknown',
                  senderRole: (senderProfile?.role || 'parent') as UserRole,
                  text: lastMsg.text,
                  timestamp: lastMsg.created_at,
                  read: false,
                  isUrgent: lastMsg.is_urgent,
                } : {
                  id: '', conversationId: c.id, senderId: '', senderName: '', senderRole: 'parent' as UserRole,
                  text: '', timestamp: c.created_at, read: true,
                },
                unreadCount: 0,
              };
            });
            setConversations(mappedConversations);
          }
        }

        // ── Fetch invoices (parent role only) ──
        if (role === 'parent') {
          const { data: invoiceData } = await supabase
            .from('invoices')
            .select('*')
            .eq('parent_id', profile.id);

          if (!cancelled && invoiceData && invoiceData.length > 0) {
            const mappedInvoices: Invoice[] = invoiceData.map((inv: any) => ({
              id: inv.id,
              childId: inv.child_id,
              description: inv.description,
              amount: inv.amount_cents / 100,
              dueDate: inv.due_date,
              paidDate: inv.paid_at || undefined,
              status: inv.status as Invoice['status'],
              items: Array.isArray(inv.line_items) ? inv.line_items : [],
            }));
            setInvoices(mappedInvoices);
          }
        }

        // ── Fetch attendance for today ──
        const today = new Date().toISOString().split('T')[0];
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*, children(first_name, last_name)')
          .in('child_id', childIds)
          .eq('date', today);

        if (!cancelled && attendanceData && attendanceData.length > 0) {
          const mappedAttendance: AttendanceRecord[] = attendanceData.map((a: any) => ({
            childId: a.child_id,
            childName: a.children ? `${a.children.first_name} ${a.children.last_name}` : '',
            date: a.date,
            checkInTime: a.check_in_at || undefined,
            checkOutTime: a.check_out_at || undefined,
            status: a.status,
            note: a.notes || undefined,
          }));
          setAttendance(mappedAttendance);
        }
        // ── Fetch learning plans (#41) ──
        if (profile.daycare_id) {
          const { data: lpData } = await supabase
            .from('learning_plans')
            .select('*')
            .eq('daycare_id', profile.daycare_id)
            .order('week_start', { ascending: false })
            .limit(20);

          if (!cancelled && lpData && lpData.length > 0) {
            const mappedPlans: LearningPlan[] = lpData.map((lp: any) => ({
              id: lp.id,
              classroomId: lp.classroom_id,
              daycareId: lp.daycare_id,
              title: lp.theme || undefined,
              weekStart: lp.week_start,
              activities: Array.isArray(lp.activities) ? lp.activities : [],
              createdBy: lp.created_by,
            }));
            setLearningPlans(mappedPlans);
          }
        }

        // ── Fetch milestones for each child ──
        if (childIds.length > 0) {
          const { data: msData } = await supabase
            .from('milestones')
            .select('*')
            .in('child_id', childIds)
            .order('created_at', { ascending: false });

          if (!cancelled && msData && msData.length > 0) {
            const mappedMilestones: Milestone[] = msData.map((m: any) => ({
              id: m.id,
              childId: m.child_id,
              category: m.category || 'cognitive',
              title: m.title,
              description: m.description || undefined,
              ageRange: m.age_range || '',
              achievedDate: m.achieved_at || undefined,
              notedBy: m.noted_by || undefined,
            }));
            setMilestones(mappedMilestones);
          }
        }

        // ── Fetch calendar events for the daycare ──
        if (profile.daycare_id) {
          const { data: evData } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('daycare_id', profile.daycare_id)
            .order('start_at', { ascending: true });

          if (!cancelled && evData && evData.length > 0) {
            const mappedEvents: CalendarEvent[] = evData.map((e: any) => ({
              id: e.id,
              daycareId: e.daycare_id,
              title: e.title,
              description: e.description || undefined,
              date: (e.start_at || '').split('T')[0],
              time: e.start_at ? new Date(e.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
              type: e.event_type || 'event',
              location: e.location || undefined,
            }));
            setCalendarEvents(mappedEvents);
          }
        }

        // ── Register push notification token (once per session) ──
        if (!pushRegistered.current && Platform.OS !== 'web') {
          pushRegistered.current = true;
          registerForPushNotifications(profile.id).catch((err) => {
            console.warn('[AppContext] Push registration failed:', err);
          });
        }

      } catch (err) {
        console.error('[AppContext] Error fetching Supabase data:', err);
        // On error, keep sample data as fallback
      }
    };

    fetchSupabaseData();

    return () => {
      cancelled = true;
    };
  }, [auth.profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription for timeline_entries (fixes #17) ──
  useEffect(() => {
    if (!auth.profile) return;

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel('timeline-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'timeline_entries' },
        (payload) => {
          const te = payload.new as any;
          const newEntry: TimelineEntry = {
            id: te.id,
            childId: te.child_id,
            type: te.activity_type,
            timestamp: te.created_at,
            createdBy: {
              id: te.author_id,
              name: 'Staff',
              role: 'caregiver',
              email: '',
            },
            title: te.title,
            description: te.description || undefined,
            details: te.metadata && typeof te.metadata === 'object' ? te.metadata as Record<string, any> : undefined,
            photos: te.photo_urls || [],
            mood: te.mood || undefined,
            isUrgent: te.is_urgent,
            reactions: [],
            comments: [],
          };
          setTimelineEntries((prev) => [newEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [auth.profile]);

  // ── Reset state when user logs out (fixes #29) ──
  useEffect(() => {
    if (!auth.isAuthenticated) {
      // Reset all state to empty
      setFetchedChildren([]);
      setSupabaseDataLoaded(false);
      setTimelineEntries([]);
      setMessages([]);
      setConversations([]);
      setNotifications([]);
      setIncidents([]);
      setAttendance([]);
      setInvoices([]);
      setLearningPlans([]);
      setMilestones([]);
      setCalendarEvents([]);
      setIsCheckedIn(true);
      pushRegistered.current = false;
      setSelectedChildId('child1');
      setActiveConversationId(null);
    }
  }, [auth.isAuthenticated]);

  // Use fetched children when Supabase data is available, otherwise fall back to sample data
  const allChildren = supabaseDataLoaded && fetchedChildren.length > 0
    ? fetchedChildren
    : (currentRole === 'parent' ? [layla, adam] : classroomChildren);
  const selectedChild = allChildren.find((c) => c.id === selectedChildId) || allChildren[0] || layla;

  const login = useCallback((role: UserRole) => {
    setCurrentRole(role === 'caregiver' ? 'caregiver' : 'parent');
    setSelectedChildId('child1');
    setIsAuthenticated(true);
    AsyncStorage.setItem('littlejourney_auth', JSON.stringify({ authenticated: true, role })).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    setIsAuthenticated(false);
    AsyncStorage.removeItem('littlejourney_auth').catch(() => {});
    // Also sign out from Supabase auth
    try {
      await auth.signOut();
    } catch {
      // Supabase signOut may fail if not configured — ignore
    }
  }, [auth]);

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
      const tempId = `t${Date.now()}`;
      const newEntry: TimelineEntry = {
        ...entry,
        id: tempId,
        timestamp: new Date().toISOString(),
        createdBy: currentUser,
        reactions: [],
        comments: [],
      };
      setTimelineEntries((prev) => [newEntry, ...prev]);

      // Persist to Supabase in the background
      if (auth.profile && auth.profile.daycare_id) {
        timelineService.addEntry({
          child_id: entry.childId,
          author_id: auth.profile.id,
          daycare_id: auth.profile.daycare_id,
          activity_type: entry.type as any,
          title: entry.title,
          description: entry.description || null,
          photo_urls: entry.photos || [],
          mood: (entry.mood as any) || null,
          metadata: entry.details || {},
          is_urgent: entry.isUrgent || false,
        }).then((data) => {
          // Replace temp id with real DB id
          if (data?.id) {
            setTimelineEntries((prev) => prev.map((e) => e.id === tempId ? { ...e, id: data.id } : e));
          }
        }).catch((err) => console.warn('[AppContext] Failed to persist timeline entry:', err));
      }
    },
    [currentUser, auth.profile]
  );

  // ── Comments ──
  const addComment = useCallback(
    (entryId: string, text: string) => {
      const tempId = `cm${Date.now()}`;
      const newComment: Comment = {
        id: tempId,
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

      // Persist to Supabase
      if (auth.profile) {
        timelineService.addComment(entryId, auth.profile.id, text).catch((err) =>
          console.warn('[AppContext] Failed to persist comment:', err)
        );
      }
    },
    [currentUser, auth.profile]
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

      // Persist to Supabase
      if (auth.profile) {
        timelineService.toggleReaction(entryId, auth.profile.id, emoji).catch((err) =>
          console.warn('[AppContext] Failed to persist reaction:', err)
        );
      }
    },
    [currentUser.id, auth.profile]
  );

  // ── Delete timeline entry ──
  const deleteTimelineEntry = useCallback((entryId: string) => {
    setTimelineEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (auth.profile) {
      timelineService.deleteEntry(entryId).catch((err) =>
        console.warn('[AppContext] Failed to delete timeline entry:', err)
      );
    }
  }, [auth.profile]);

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
    if (auth.profile) {
      timelineService.deleteComment(commentId).catch((err) =>
        console.warn('[AppContext] Failed to delete comment:', err)
      );
    }
  }, [auth.profile]);

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
      const tempId = `m${Date.now()}`;
      const newMsg: Message = {
        id: tempId,
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

      // Persist to Supabase
      if (auth.profile) {
        messagesService.sendMessage({
          conversation_id: convId,
          sender_id: auth.profile.id,
          text,
          is_urgent: isUrgent,
        }).catch((err) => console.warn('[AppContext] Failed to persist message:', err));
      }
    },
    [currentUser, activeConversationId, auth.profile]
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

      // Persist incident to Supabase
      if (auth.profile && auth.profile.daycare_id) {
        incidentsService.createIncident({
          child_id: incident.childId,
          daycare_id: auth.profile.daycare_id,
          reported_by: auth.profile.id,
          type: incident.type as any,
          severity: incident.severity as any,
          description: incident.description,
          location: incident.location || null,
          action_taken: incident.actionTaken || 'See description',
          parent_notified_at: null,
          witness_name: null,
        }).catch((err) => console.warn('[AppContext] Failed to persist incident:', err));
      }
    },
    [currentUser, addTimelineEntry, auth.profile]
  );

  // ── Attendance ──
  const updateAttendance = useCallback((childId: string, update: Partial<AttendanceRecord>) => {
    setAttendance((prev) =>
      prev.map((a) => (a.childId === childId ? { ...a, ...update } : a))
    );
  }, []);

  // ── Invoices ──
  const payInvoice = useCallback((invoiceId: string) => {
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: 'paid' as const, paidDate: now.split('T')[0] }
          : inv
      )
    );
    // Persist to Supabase
    if (auth.profile) {
      supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: now })
        .eq('id', invoiceId)
        .then(({ error }) => {
          if (error) console.warn('[AppContext] Failed to persist invoice payment:', error);
        });
    }
  }, [auth.profile]);

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

  // Load persisted state and auth on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth state
        const authRaw = await AsyncStorage.getItem('littlejourney_auth');
        if (authRaw) {
          const authData = JSON.parse(authRaw);
          if (authData.authenticated) {
            setIsAuthenticated(true);
            if (authData.role) setCurrentRole(authData.role);
          }
        }

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
      } finally {
        setIsLoading(false);
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
      isAuthenticated, isLoading, login, logout,
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
      learningPlans,
      milestones, calendarEvents,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
    }),
    [
      isAuthenticated, isLoading, login, logout,
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
      learningPlans,
      milestones, calendarEvents,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
