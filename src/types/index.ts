export type UserRole = 'parent' | 'caregiver' | 'admin' | 'family' | 'pediatrician';

export type ActivityType =
  | 'meal'
  | 'nap'
  | 'diaper'
  | 'activity'
  | 'milestone'
  | 'photo'
  | 'note'
  | 'medication'
  | 'checkin'
  | 'checkout'
  | 'mood'
  | 'incident';

export type MoodType = 'happy' | 'calm' | 'sleepy' | 'fussy' | 'playful';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'bottle';

export type NapStatus = 'sleeping' | 'woke_up';

export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  email: string;
  phone?: string;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  avatar?: string;
  classroom?: string;
  allergies: string[];
  emergencyContacts: EmergencyContact[];
  authorizedPickups: AuthorizedPerson[];
  pediatrician?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface AuthorizedPerson {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  photoUrl?: string;
  verified: boolean;
}

export interface Comment {
  id: string;
  entryId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  text: string;
  timestamp: string;
}

export interface TimelineEntry {
  id: string;
  childId: string;
  type: ActivityType;
  timestamp: string;
  createdBy: User;
  title: string;
  description?: string;
  details?: Record<string, any>;
  photos?: string[];
  mood?: MoodType;
  reactions?: Reaction[];
  comments?: Comment[];
  isUrgent?: boolean;
}

export interface Reaction {
  userId: string;
  emoji: string;
  timestamp: string;
}

export interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  read: boolean;
  isUrgent?: boolean;
  attachments?: string[];
  replyTo?: string;
}

export interface Conversation {
  id: string;
  participants: User[];
  childId?: string;
  lastMessage: Message;
  unreadCount: number;
  type: 'direct' | 'group' | 'announcement';
  title?: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'activity' | 'milestone' | 'alert' | 'reminder' | 'announcement' | 'incident';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionRoute?: string;
  childId?: string;
  icon?: string;
}

export interface IncidentReport {
  id: string;
  childId: string;
  childName: string;
  reportedBy: User;
  timestamp: string;
  type: 'fall' | 'bite' | 'scratch' | 'bump' | 'allergic_reaction' | 'illness' | 'other';
  severity: 'minor' | 'moderate' | 'serious';
  location: string;
  description: string;
  actionTaken: string;
  parentNotified: boolean;
  witnessName?: string;
  photos?: string[];
}

export interface AttendanceRecord {
  childId: string;
  childName: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
}

export interface DailyReport {
  id: string;
  childId: string;
  date: string;
  narrative: string;
  summary: {
    meals: number;
    naps: number;
    napDuration: string;
    diaperChanges: number;
    activities: number;
    photos: number;
    mood: MoodType;
  };
  highlights: string[];
  entries: TimelineEntry[];
  caregiverNote?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'event' | 'holiday' | 'conference' | 'vaccination' | 'closure' | 'birthday';
  description?: string;
  location?: string;
}

export interface Milestone {
  id: string;
  childId: string;
  title: string;
  category: 'cognitive' | 'motor' | 'social' | 'language' | 'self_care';
  ageRange: string;
  achievedDate?: string;
  notes?: string;
  photoUrl?: string;
}

export interface Invoice {
  id: string;
  childId: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  items: { description: string; amount: number }[];
}

export interface LearningPlan {
  id: string;
  title: string;
  week: string;
  goals: string[];
  activities: { name: string; description: string; completed: boolean }[];
  caregiverId: string;
}
