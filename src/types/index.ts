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
  daycareId?: string;        // maps to DB children.daycare_id
  classroomId?: string;      // maps to DB children.classroom_id
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  avatar?: string;
  classroom?: string;        // denormalized classroom name (from join)
  allergies: string[];
  medicalNotes?: string;     // maps to DB children.medical_notes
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
  daycareId?: string;        // maps to DB timeline_entries.daycare_id
  type: ActivityType;        // maps to DB timeline_entries.activity_type
  timestamp: string;         // maps to DB timeline_entries.created_at
  createdBy: User;           // joined from DB timeline_entries.author_id -> profiles
  title: string;
  description?: string;
  details?: Record<string, any>;  // maps to DB timeline_entries.metadata
  photos?: string[];         // maps to DB timeline_entries.photo_urls
  mood?: MoodType;
  reactions?: Reaction[];
  comments?: Comment[];
  isUrgent?: boolean;        // maps to DB timeline_entries.is_urgent
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
  daycareId?: string;        // maps to DB incidents.daycare_id
  childName: string;         // denormalized from join
  reportedBy: User;          // joined from DB incidents.reported_by -> profiles
  timestamp: string;         // maps to DB incidents.created_at
  type: 'fall' | 'bite' | 'scratch' | 'bump' | 'allergic_reaction' | 'illness' | 'other';
  severity: 'minor' | 'moderate' | 'serious';
  location?: string;         // maps to DB incidents.location (nullable)
  description: string;
  actionTaken: string;       // maps to DB incidents.action_taken
  parentNotified: boolean;   // derived from DB incidents.parent_notified_at
  witnessName?: string;      // maps to DB incidents.witness_name
  photos?: string[];         // maps to DB incidents.photo_urls
}

export interface AttendanceRecord {
  id?: string;               // maps to DB attendance.id
  childId: string;
  daycareId?: string;        // maps to DB attendance.daycare_id
  childName: string;         // denormalized from join
  date: string;
  checkInTime?: string;      // maps to DB attendance.check_in_at
  checkInBy?: string;        // maps to DB attendance.check_in_by
  checkOutTime?: string;     // maps to DB attendance.check_out_at
  checkOutBy?: string;       // maps to DB attendance.check_out_by
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;             // maps to DB attendance.notes
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
  daycareId?: string;        // maps to DB calendar_events.daycare_id
  classroomId?: string;      // maps to DB calendar_events.classroom_id
  title: string;
  date: string;              // maps to DB calendar_events.start_at
  endDate?: string;          // maps to DB calendar_events.end_at
  time?: string;             // legacy field for display
  allDay?: boolean;          // maps to DB calendar_events.all_day
  type: 'event' | 'holiday' | 'conference' | 'vaccination' | 'closure' | 'birthday';
  description?: string;
  location?: string;
  createdBy?: string;        // maps to DB calendar_events.created_by
}

export interface Milestone {
  id: string;
  childId: string;
  title: string;
  category: 'cognitive' | 'motor' | 'social' | 'language' | 'self_care';
  ageRange?: string;         // maps to DB milestones.age_range (nullable)
  achievedDate?: string;     // maps to DB milestones.achieved_at
  notes?: string;            // maps to DB milestones.description
  notedBy?: string;          // maps to DB milestones.noted_by
  photoUrl?: string;         // maps to DB milestones.photo_url
}

export interface Invoice {
  id: string;
  daycareId?: string;        // maps to DB invoices.daycare_id
  parentId?: string;         // maps to DB invoices.parent_id
  childId: string;
  stripeInvoiceId?: string;  // maps to DB invoices.stripe_invoice_id
  description: string;
  amount: number;            // maps to DB invoices.amount_cents (convert cents to dollars)
  dueDate: string;           // maps to DB invoices.due_date
  paidDate?: string;         // maps to DB invoices.paid_at
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'void'; // matches DB enum
  items: { description: string; amount: number }[]; // maps to DB invoices.line_items (Json)
}

export interface LearningPlan {
  id: string;
  classroomId?: string;      // maps to DB learning_plans.classroom_id
  daycareId?: string;        // maps to DB learning_plans.daycare_id
  title?: string;            // maps to DB learning_plans.theme (nullable)
  weekStart?: string;        // maps to DB learning_plans.week_start
  /** @deprecated use weekStart instead */
  week?: string;             // kept for backward compat with sample data
  goals?: string[];          // frontend-only (not in DB schema)
  activities: { name: string; description: string; completed: boolean }[]; // maps to DB learning_plans.activities (Json)
  createdBy?: string;        // maps to DB learning_plans.created_by
  /** @deprecated use createdBy instead */
  caregiverId?: string;      // kept for backward compat with sample data
}
