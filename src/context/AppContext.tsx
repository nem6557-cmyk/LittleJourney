import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Alert, Share, Platform, Linking } from 'react-native';
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
import { childrenService } from '../services/children.service';
import { incidentsService } from '../services/incidents.service';
import { milestonesService } from '../services/milestones.service';
import { calendarService } from '../services/calendar.service';
import { attendanceService } from '../services/attendance.service';
import { notificationsService } from '../services/notifications.service';
import { registerForPushNotifications, dispatchPushNotification } from '../lib/notifications';
import { onNetworkChange, processPendingMutations } from '../lib/offline';

interface AppContextType {
  // Auth / role
  isAuthenticated: boolean;
  isLoading: boolean;
  dataLoading: boolean;
  dataError: string | null;
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
  createConversation: (participantIds: string[], title?: string) => Promise<{ conversationId: string | null; error: string | null }>;
  listContacts: () => Promise<{ id: string; name: string; role: string }[]>;

  // Child management
  addChild: (data: { firstName: string; lastName: string; dateOfBirth: string }) => Promise<{ error: string | null }>;
  updateChildInfo: (childId: string, updates: Partial<Child>) => Promise<{ error: string | null }>;
  removeChild: (childId: string) => Promise<{ error: string | null }>;

  // Preferences
  preferences: Record<string, unknown>;
  updatePreferences: (updates: Record<string, unknown>) => Promise<void>;

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
  payInvoice: (invoiceId: string) => Promise<{ error: string | null }>;

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

  // Data refresh
  refreshData: () => Promise<void>;
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
  // Tracks the live Supabase fetch (distinct from the legacy AsyncStorage
  // isLoading) so screens show skeletons while real data loads and an error
  // state if the fetch fails, rather than a premature "No data yet".
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
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
  const conversationIdsRef = useRef<string[]>([]);
  const [supabaseDataLoaded, setSupabaseDataLoaded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Sync role from AuthContext when profile is available
  useEffect(() => {
    if (auth.profile?.role) {
      setCurrentRole(auth.profile.role as UserRole);
    }
  }, [auth.profile?.role]);

  // Build currentUser from auth profile when available
  const currentUser: User = useMemo(() => {
    if (auth.profile) {
      const role = (auth.profile.role || 'parent') as UserRole;
      return {
        id: auth.profile.id,
        name: `${auth.profile.first_name || ''} ${auth.profile.last_name || ''}`.trim() || 'User',
        email: auth.profile.email || '',
        role,
        phone: auth.profile.phone || '',
      };
    }
    // Fallback for demo mode (no Supabase configured)
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
    setDataLoading(true);
    setDataError(null);

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
            .select('child_id, children(*, classrooms(name, age_group))')
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
              .select('*, classrooms(name, age_group)')
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
          classroom: c.classrooms?.name || undefined,
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

        // ── Fetch timeline entries with comments and reactions ──
        const { data: timelineData } = await supabase
          .from('timeline_entries')
          .select('*, profiles:author_id(id, first_name, last_name, email, role), comments(*, author:profiles!author_id(id, first_name, last_name, role)), reactions(*)')
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
              reactions: (te.reactions || []).map((r: any) => ({
                userId: r.user_id,
                emoji: r.emoji,
                timestamp: r.created_at,
              })),
              comments: (te.comments || []).map((c: any) => {
                const commentAuthor = c.author;
                return {
                  id: c.id,
                  entryId: te.id,
                  userId: c.author_id,
                  userName: commentAuthor ? `${commentAuthor.first_name || ''} ${commentAuthor.last_name || ''}`.trim() : 'Unknown',
                  userRole: (commentAuthor?.role || 'parent') as UserRole,
                  text: c.text,
                  timestamp: c.created_at,
                };
              }),
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
            .select('*, conversation_members(user_id, profiles(id, first_name, last_name, email, role, avatar_url))')
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
            // Store conversation IDs for real-time subscriptions
            conversationIdsRef.current = convData.map((c: any) => c.id);

            const allMsgs = msgData || [];
            const mappedConversations: Conversation[] = convData.map((c: any) => {
              const convMsgs = allMsgs.filter((m: any) => m.conversation_id === c.id);
              const lastMsg = convMsgs[convMsgs.length - 1];
              const senderProfile = lastMsg?.profiles;
              return {
                id: c.id,
                participants: (c.conversation_members || []).map((m: any) => ({
                  id: m.profiles?.id || m.user_id,
                  name: m.profiles ? `${m.profiles.first_name || ''} ${m.profiles.last_name || ''}`.trim() : 'Unknown',
                  role: (m.profiles?.role || 'parent') as UserRole,
                  email: m.profiles?.email || '',
                })),
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

        // ── Fetch notifications for this user ──
        {
          const { data: notifData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(100);
          if (!cancelled && notifData) {
            const mappedNotifs: Notification[] = notifData.map((n: any) => ({
              id: n.id,
              type: n.type || 'alert',
              title: n.title,
              body: n.body,
              timestamp: n.created_at,
              read: !!n.read_at, // read state derived from DB, not hardcoded
              childId: n.data?.child_id || undefined,
              actionRoute: n.data?.route || undefined,
            }));
            setNotifications(mappedNotifs);
          }
        }

        // ── Fetch incidents (parent: their children; staff: whole daycare) ──
        if (profile.daycare_id) {
          const { data: incData } = await supabase
            .from('incidents')
            .select('*, child:children!child_id(first_name, last_name), reporter:profiles!reported_by(id, first_name, last_name, role)')
            .eq('daycare_id', profile.daycare_id)
            .order('created_at', { ascending: false })
            .limit(100);
          if (!cancelled && incData) {
            const mappedIncidents: IncidentReport[] = incData.map((i: any) => ({
              id: i.id,
              childId: i.child_id,
              daycareId: i.daycare_id,
              childName: i.child ? `${i.child.first_name || ''} ${i.child.last_name || ''}`.trim() : '',
              reportedBy: {
                id: i.reporter?.id || i.reported_by,
                name: i.reporter ? `${i.reporter.first_name || ''} ${i.reporter.last_name || ''}`.trim() : 'Staff',
                role: (i.reporter?.role || 'caregiver') as UserRole,
                email: '',
              },
              timestamp: i.created_at,
              type: i.type,
              severity: i.severity,
              location: i.location || undefined,
              description: i.description,
              actionTaken: i.action_taken || '',
              parentNotified: !!i.parent_notified_at,
              witnessName: i.witness_name || undefined,
              photos: i.photo_urls || undefined,
            }));
            setIncidents(mappedIncidents);
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
        if (!cancelled) {
          setDataError(err instanceof Error ? err.message : 'Could not load your data.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    fetchSupabaseData();

    return () => {
      cancelled = true;
    };
    // Intentionally re-runs only when the signed-in profile or the manual
    // refresh counter changes — not on every referenced setter/value.
  }, [auth.profile, refreshCounter]);

  // ── refreshData: re-trigger data fetch from Supabase ──
  const refreshData = useCallback(async () => {
    setRefreshCounter((c) => c + 1);
  }, []);

  // ── Real-time subscription for timeline_entries (fixes #17) ──
  useEffect(() => {
    if (!auth.profile?.daycare_id) return;
    const daycareId = auth.profile.daycare_id;

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel('timeline-realtime')
      .on(
        'postgres_changes',
        // Scope to the user's own daycare — don't receive every tenant's inserts.
        { event: 'INSERT', schema: 'public', table: 'timeline_entries', filter: `daycare_id=eq.${daycareId}` },
        async (payload) => {
          const te = payload.new as any;

          // Fetch the author profile to get real name/role
          let authorName = 'Staff';
          let authorRole: UserRole = 'caregiver';
          let authorEmail = '';
          try {
            const { data: authorProfile } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, role, email')
              .eq('id', te.author_id)
              .single();
            if (authorProfile) {
              authorName = `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Staff';
              authorRole = (authorProfile.role || 'caregiver') as UserRole;
              authorEmail = authorProfile.email || '';
            }
          } catch {
            // Use defaults if profile lookup fails
          }

          const newEntry: TimelineEntry = {
            id: te.id,
            childId: te.child_id,
            type: te.activity_type,
            timestamp: te.created_at,
            createdBy: {
              id: te.author_id,
              name: authorName,
              role: authorRole,
              email: authorEmail,
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

  // ── Real-time subscription for messages ──
  useEffect(() => {
    if (!auth.profile) return;

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const m = payload.new as any;

          // Only process messages for conversations we're part of
          if (!conversationIdsRef.current.includes(m.conversation_id)) return;

          // Don't duplicate messages we sent ourselves (already added optimistically)
          if (m.sender_id === auth.profile?.id) return;

          // Fetch sender profile
          let senderName = 'Unknown';
          let senderRole: UserRole = 'parent';
          try {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, role')
              .eq('id', m.sender_id)
              .single();
            if (senderProfile) {
              senderName = `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Unknown';
              senderRole = (senderProfile.role || 'parent') as UserRole;
            }
          } catch {
            // Use defaults
          }

          const newMsg: Message = {
            id: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            senderName,
            senderRole,
            text: m.text,
            timestamp: m.created_at,
            read: false,
            isUrgent: m.is_urgent,
            attachments: m.attachments || [],
          };

          setMessages((prev) => [...prev, newMsg]);
          // Update conversation's last message
          setConversations((prev) =>
            prev.map((c) =>
              c.id === m.conversation_id
                ? { ...c, lastMessage: newMsg, unreadCount: c.unreadCount + 1 }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [auth.profile]);

  // ── Offline sync: replay any queued mutations ──
  const flushPendingMutations = useCallback(async () => {
    try {
      const synced = await processPendingMutations(async (mutation) => {
        const { table, operation, data } = mutation;
        if (operation === 'insert') {
          // Remove offline-prefixed IDs before inserting
          const insertData = { ...data };
          if (typeof insertData.id === 'string' && insertData.id.startsWith('offline_')) {
            delete insertData.id;
          }
          const { error } = await supabase.from(table).insert(insertData as any);
          if (error) throw error;
        } else if (operation === 'update') {
          const id = data.id as string;
          if (!id) throw new Error('Missing id for update');
          const updateData = { ...data };
          delete updateData.id; // Don't update the primary key
          const { error } = await (supabase.from(table) as any).update(updateData).eq('id', id);
          if (error) throw error;
        } else if (operation === 'delete') {
          const id = data.id as string;
          if (!id) throw new Error('Missing id for delete');
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;
        }
      });
      if (synced > 0) {
        console.warn(`[Offline] Synced ${synced} pending mutation(s)`);
        setRefreshCounter((c) => c + 1); // Refresh data after sync
      }
    } catch (err) {
      console.warn('[Offline] Sync error:', err);
    }
  }, []);

  useEffect(() => {
    if (!auth.profile) return;
    // Flush once on startup — covers the case where the app was closed offline
    // and reopened while already online (no connectivity-change event fires).
    flushPendingMutations();
    // And flush whenever connectivity is (re)gained.
    const unsubscribe = onNetworkChange((connected) => {
      if (connected) flushPendingMutations();
    });
    return () => unsubscribe();
  }, [auth.profile, flushPendingMutations]);

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

  // Use fetched children when Supabase data is available.
  // Only fall back to sample data in demo mode (no auth profile = Supabase not configured).
  const allChildren = useMemo(() => {
    if (fetchedChildren.length > 0) return fetchedChildren;
    // Demo mode sets a fake profile, so check isDemoMode too (not just !profile)
    // — otherwise demo sessions showed an empty child ("Unknown" name).
    if (!auth.profile || auth.isDemoMode) {
      return currentRole === 'parent' ? [layla, adam] : classroomChildren;
    }
    // Supabase configured but no children yet — return empty
    return [];
  }, [fetchedChildren, auth.profile, auth.isDemoMode, currentRole]);

  // Graceful placeholder so screens never render a blank/"Unknown" name when no
  // child is loaded yet (e.g. a parent whose children haven't synced).
  const emptyChild: Child = { id: '', firstName: 'Your child', lastName: '', dateOfBirth: '', classroom: '', allergies: [], emergencyContacts: [], authorizedPickups: [] };
  const selectedChild = allChildren.find((c) => c.id === selectedChildId) || allChildren[0] || emptyChild;

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

      // Persist to Supabase and reconcile the temp id with the real DB id so a
      // later delete targets the correct row (and remove the optimistic comment
      // on failure rather than leaving a phantom).
      if (auth.profile) {
        timelineService
          .addComment(entryId, auth.profile.id, text)
          .then((row) => {
            const realId = (row as { id?: string } | null)?.id;
            if (!realId) return;
            setTimelineEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? { ...e, comments: (e.comments || []).map((c) => (c.id === tempId ? { ...c, id: realId } : c)) }
                  : e
              )
            );
          })
          .catch((err) => {
            console.warn('[AppContext] Failed to persist comment:', err);
            setTimelineEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? { ...e, comments: (e.comments || []).filter((c) => c.id !== tempId) }
                  : e
              )
            );
          });
      }
    },
    [currentUser, auth.profile]
  );

  // ── Reactions ──
  const toggleReaction = useCallback(
    (entryId: string, emoji: string) => {
      // Self-inverse toggle: applying it again reverts it (used for rollback).
      const applyToggle = () =>
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

      applyToggle();

      // Persist to Supabase; revert the optimistic toggle if it fails.
      if (auth.profile) {
        timelineService.toggleReaction(entryId, auth.profile.id, emoji).catch((err) => {
          console.warn('[AppContext] Failed to persist reaction, reverting:', err);
          applyToggle();
        });
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
    if (auth.profile) {
      // Map the editable app fields onto the DB columns.
      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.mood !== undefined) dbUpdates.mood = updates.mood;
      if (updates.details !== undefined) dbUpdates.metadata = updates.details;
      if (Object.keys(dbUpdates).length > 0) {
        timelineService.updateEntry(entryId, dbUpdates as any).catch((err) =>
          console.warn('[AppContext] Failed to persist timeline entry update:', err)
        );
      }
    }
  }, [auth.profile]);

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

  // ── Add notification (persists to DB and dispatches push) ──
  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...notif,
      id: `n${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Persist and dispatch. With a childId we notify that child's parents; with
    // no childId (e.g. an emergency alert) we fan out to the whole daycare.
    if (auth.profile?.daycare_id) {
      (async () => {
        try {
          let recipientIds: string[];
          if (notif.childId) {
            const { data: parents } = await supabase
              .from('parent_children')
              .select('parent_id')
              .eq('child_id', notif.childId);
            recipientIds = (parents || []).map((p) => p.parent_id);
          } else {
            // Daycare-wide fan-out (e.g. emergency alert / announcement).
            const { data: members } = await supabase
              .from('profiles')
              .select('id')
              .eq('daycare_id', auth.profile!.daycare_id!);
            recipientIds = (members || []).map((m) => m.id);
          }

          for (const recipientId of recipientIds) {
            if (recipientId === auth.profile?.id) continue; // don't notify the sender
            await supabase.from('notifications').insert({
              user_id: recipientId,
              daycare_id: auth.profile!.daycare_id!,
              type: notif.type as any,
              title: notif.title,
              body: notif.body,
              data: notif.childId ? { childId: notif.childId } : {},
            } as any);
            dispatchPushNotification({
              user_id: recipientId,
              title: notif.title,
              body: notif.body,
              type: notif.type,
              data: notif.childId ? { childId: notif.childId } : {},
            });
          }
        } catch (err) {
          console.warn('[AppContext] Failed to dispatch notification:', err);
        }
      })();
    }
  }, [auth.profile]);

  // ── Messages ──
  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.read && m.senderId !== currentUser.id).length;
  }, [messages, currentUser.id]);

  const sendMessage = useCallback(
    (text: string, isUrgent = false, conversationId?: string) => {
      const convId = conversationId || activeConversationId;
      // Without a real conversation the DB insert would fail the FK/UUID format
      // and the message would be silently lost. Require a valid conversation.
      if (!convId) {
        console.warn('[AppContext] sendMessage called with no active conversation; ignoring.');
        return;
      }
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
      // Persist so unread counts stay correct across refetch / other devices.
      if (auth.profile) {
        messagesService
          .markRead(convId, auth.profile.id)
          .catch((err) => console.warn('[AppContext] Failed to persist read state:', err));
      }
    }
  }, [currentUser.id, activeConversationId, auth.profile]);

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  // ── Create a new conversation (atomic RPC) and make it active ──
  const createConversation = useCallback(
    async (participantIds: string[], title?: string): Promise<{ conversationId: string | null; error: string | null }> => {
      if (!auth.profile) return { conversationId: null, error: 'Not signed in' };
      try {
        const type = participantIds.length > 1 ? 'group' : 'direct';
        const convId = await messagesService.createConversationRpc(participantIds, type, title ?? null);
        setActiveConversationId(convId);
        setRefreshCounter((c) => c + 1); // pull in the new conversation
        return { conversationId: convId, error: null };
      } catch (err) {
        console.warn('[AppContext] createConversation failed:', err);
        return { conversationId: null, error: 'Could not start the conversation.' };
      }
    },
    [auth.profile]
  );

  // ── List same-daycare contacts (for the compose recipient picker) ──
  const listContacts = useCallback(async (): Promise<{ id: string; name: string; role: string }[]> => {
    if (!auth.profile?.daycare_id) return [];
    try {
      const rows = await messagesService.listDaycareContacts(auth.profile.daycare_id, auth.profile.id);
      return rows.map((r) => ({
        id: r.id,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown',
        role: r.role,
      }));
    } catch (err) {
      console.warn('[AppContext] listContacts failed:', err);
      return [];
    }
  }, [auth.profile]);

  // ── Child management (admin) ──
  const addChild = useCallback(
    async (data: { firstName: string; lastName: string; dateOfBirth: string }): Promise<{ error: string | null }> => {
      if (!auth.profile?.daycare_id) return { error: 'No daycare associated with your account.' };
      try {
        await childrenService.createChild({
          first_name: data.firstName,
          last_name: data.lastName,
          daycare_id: auth.profile.daycare_id,
          date_of_birth: data.dateOfBirth,
          classroom_id: null,
          avatar_url: null,
          medical_notes: null,
        });
        setRefreshCounter((c) => c + 1);
        return { error: null };
      } catch (err) {
        console.warn('[AppContext] addChild failed:', err);
        return { error: (err as Error).message || 'Failed to add child.' };
      }
    },
    [auth.profile]
  );

  const updateChildInfo = useCallback(
    async (childId: string, updates: Partial<Child>): Promise<{ error: string | null }> => {
      if (!auth.profile) return { error: 'Not signed in' };
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
        if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
        if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = updates.dateOfBirth;
        if (updates.allergies !== undefined) dbUpdates.allergies = updates.allergies;
        await childrenService.updateChild(childId, dbUpdates as any);
        setRefreshCounter((c) => c + 1);
        return { error: null };
      } catch (err) {
        console.warn('[AppContext] updateChildInfo failed:', err);
        return { error: (err as Error).message || 'Failed to update child.' };
      }
    },
    [auth.profile]
  );

  const removeChild = useCallback(
    async (childId: string): Promise<{ error: string | null }> => {
      if (!auth.profile) return { error: 'Not signed in' };
      try {
        await childrenService.deleteChild(childId);
        setRefreshCounter((c) => c + 1);
        return { error: null };
      } catch (err) {
        console.warn('[AppContext] removeChild failed:', err);
        return { error: (err as Error).message || 'Failed to remove child.' };
      }
    },
    [auth.profile]
  );

  // ── User preferences (persisted to profiles.preferences) ──
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  useEffect(() => {
    const prefs = (auth.profile as { preferences?: Record<string, unknown> } | null)?.preferences;
    if (prefs && typeof prefs === 'object') setPreferences(prefs);
  }, [auth.profile]);

  const updatePreferences = useCallback(
    async (updates: Record<string, unknown>): Promise<void> => {
      setPreferences((prev) => ({ ...prev, ...updates }));
      if (auth.profile && !auth.isDemoMode) {
        try {
          const merged = { ...preferences, ...updates };
          await supabase.from('profiles').update({ preferences: merged }).eq('id', auth.profile.id);
        } catch (err) {
          console.warn('[AppContext] updatePreferences failed:', err);
        }
      }
    },
    [auth.profile, auth.isDemoMode, preferences]
  );

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
    // Update attendance (optimistic)
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

    // Persist to Supabase so attendance survives refetch and is visible to others.
    if (auth.profile?.daycare_id) {
      const today = now.toISOString().split('T')[0];
      const persist = isCheckedIn
        ? attendanceService.checkOut(selectedChild.id, today, auth.profile.id)
        : attendanceService.checkIn({
            child_id: selectedChild.id,
            daycare_id: auth.profile.daycare_id,
            date: today,
            status: 'present',
            check_in_at: now.toISOString(),
            check_in_by: auth.profile.id,
          });
      persist.catch((err) => console.warn('[AppContext] Failed to persist attendance:', err));
    }

    setIsCheckedIn((prev) => !prev);
  }, [isCheckedIn, selectedChild, addTimelineEntry, currentUser.name, auth.profile]);

  // ── Notifications ──
  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (auth.profile) {
      notificationsService.markRead(id).catch((err) =>
        console.warn('[AppContext] Failed to persist notification read:', err)
      );
    }
  }, [auth.profile]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (auth.profile) {
      notificationsService.markAllRead(auth.profile.id).catch((err) =>
        console.warn('[AppContext] Failed to persist mark-all-read:', err)
      );
    }
  }, [auth.profile]);

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

      // Notify the child's parents (addNotification fans out to parents + push
      // when childId is set), so "the parent will be notified" is actually true.
      addNotification({
        type: 'incident',
        title: `Incident Report — ${incident.childName}`,
        body: `${incident.type.replace('_', ' ')} (${incident.severity})${incident.location ? ` at ${incident.location}` : ''}`,
        read: false,
        childId: incident.childId,
        icon: '🚨',
      });

      // Persist incident to Supabase with witness + parent-notified timestamp.
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
          parent_notified_at: incident.parentNotified ? new Date().toISOString() : null,
          witness_name: incident.witnessName || null,
        }).catch((err) => console.warn('[AppContext] Failed to persist incident:', err));
      }
    },
    [currentUser, addTimelineEntry, addNotification, auth.profile]
  );

  // ── Attendance ──
  const updateAttendance = useCallback((childId: string, update: Partial<AttendanceRecord>) => {
    let merged: AttendanceRecord | undefined;
    setAttendance((prev) =>
      prev.map((a) => {
        if (a.childId !== childId) return a;
        merged = { ...a, ...update };
        return merged;
      })
    );
    // Persist the change (status / note / times) by upserting the child+date row.
    if (auth.profile?.daycare_id && merged) {
      const today = merged.date || new Date().toISOString().split('T')[0];
      attendanceService
        .checkIn({
          child_id: childId,
          daycare_id: auth.profile.daycare_id,
          date: today,
          status: merged.status,
          check_in_at: merged.checkInTime ?? null,
          check_in_by: merged.checkInBy ?? null,
          check_out_at: merged.checkOutTime ?? null,
          check_out_by: merged.checkOutBy ?? null,
          notes: merged.note ?? null,
        })
        .catch((err) => console.warn('[AppContext] Failed to persist attendance update:', err));
    }
  }, [auth.profile]);

  // ── Invoices ──
  // Payment goes through Stripe: the create-invoice edge function finalizes a
  // hosted Stripe invoice and returns its URL, which we open for the parent.
  // The invoice is marked 'paid' ONLY by the stripe-webhook (server-side) once
  // money actually moves — never client-side.
  const payInvoice = useCallback(async (invoiceId: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice', {
        body: { invoiceId },
      });
      if (error) {
        console.warn('[AppContext] create-invoice failed:', error);
        return { error: 'Could not start payment. Please try again.' };
      }
      const url = (data as { hostedInvoiceUrl?: string } | null)?.hostedInvoiceUrl;
      if (!url) {
        return { error: 'No payment link was returned for this invoice.' };
      }
      await Linking.openURL(url);
      return { error: null };
    } catch (err) {
      console.warn('[AppContext] payInvoice error:', err);
      return { error: 'Could not open the payment page.' };
    }
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
  // Namespace the offline cache per user so one account never loads another's
  // cached data. Falls back to a guest bucket when signed out.
  const CACHE_PREFIX = 'littlejourney_data_';
  const cacheUserId = auth.user?.id || (auth.isDemoMode ? `demo_${currentRole}` : 'guest');
  const STORAGE_KEY = `${CACHE_PREFIX}${cacheUserId}`;

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
  }, [STORAGE_KEY, timelineEntries, messages, conversations, notifications, incidents, attendance, invoices, isCheckedIn]);

  // One-time migration/cleanup: drop the old un-namespaced global cache key so a
  // previous user's data can't bleed in.
  useEffect(() => {
    AsyncStorage.removeItem('littlejourney_data').catch(() => {});
  }, []);

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

        // Load this user's namespaced cache (offline fallback).
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
    // Re-run when the namespaced key changes (user logs in/out) so we never show
    // a different account's cached data.
  }, [STORAGE_KEY]);



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
      isAuthenticated, isLoading, dataLoading, dataError, login, logout,
      currentRole, switchRole, currentUser,
      children: allChildren, selectedChild, selectChild,
      timelineEntries, addTimelineEntry, addComment, deleteComment, toggleReaction,
      deleteTimelineEntry, updateTimelineEntry,
      messages, conversations, activeConversationId, setActiveConversation,
      sendMessage, markMessagesRead, unreadCount,
      createConversation, listContacts,
      addChild, updateChildInfo, removeChild,
      preferences, updatePreferences,
      todayStats, isCheckedIn, toggleCheckIn,
      notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, addNotification,
      incidents, addIncident,
      attendance, updateAttendance,
      invoices, payInvoice,
      learningPlans,
      milestones, calendarEvents,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
      refreshData,
    }),
    [
      isAuthenticated, isLoading, dataLoading, dataError, login, logout,
      currentRole, switchRole, currentUser,
      allChildren, selectedChild, selectChild,
      timelineEntries, addTimelineEntry, addComment, deleteComment, toggleReaction,
      deleteTimelineEntry, updateTimelineEntry,
      messages, conversations, activeConversationId, setActiveConversation,
      sendMessage, markMessagesRead, unreadCount,
      createConversation, listContacts,
      addChild, updateChildInfo, removeChild,
      preferences, updatePreferences,
      todayStats, isCheckedIn, toggleCheckIn,
      notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, addNotification,
      incidents, addIncident,
      attendance, updateAttendance,
      invoices, payInvoice,
      learningPlans,
      milestones, calendarEvents,
      showAlert, shareContent,
      generateDailyNarrative, generateHighlights,
      refreshData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
