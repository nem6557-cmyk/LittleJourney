/**
 * Supabase Database type definitions.
 * Generated from the database schema — keep in sync with migrations.
 *
 * These types are used by the Supabase client for full type safety
 * on all queries, inserts, and updates.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      daycares: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          stripe_account_id: string | null;
          stripe_onboarding_complete: boolean;
          subscription_tier: 'trial' | 'starter' | 'professional' | 'enterprise';
          trial_ends_at: string | null;
          max_children: number;
          max_classrooms: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daycares']['Row'], 'id' | 'created_at' | 'updated_at' | 'stripe_onboarding_complete' | 'max_children' | 'max_classrooms'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          stripe_onboarding_complete?: boolean;
          max_children?: number;
          max_classrooms?: number;
        };
        Update: Partial<Database['public']['Tables']['daycares']['Insert']>;
      };

      classrooms: {
        Row: {
          id: string;
          daycare_id: string;
          name: string;
          age_group: string | null;
          capacity: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['classrooms']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['classrooms']['Insert']>;
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: 'parent' | 'caregiver' | 'admin' | 'family' | 'pediatrician';
          daycare_id: string | null;
          push_token: string | null;
          coppa_consent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };

      children: {
        Row: {
          id: string;
          daycare_id: string;
          classroom_id: string | null;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          avatar_url: string | null;
          allergies: string[];
          medical_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['children']['Row'], 'id' | 'created_at' | 'updated_at' | 'allergies'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          allergies?: string[];
        };
        Update: Partial<Database['public']['Tables']['children']['Insert']>;
      };

      parent_children: {
        Row: {
          id: string;
          parent_id: string;
          child_id: string;
          relationship: 'parent' | 'guardian' | 'family' | 'pediatrician';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['parent_children']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['parent_children']['Insert']>;
      };

      caregiver_classrooms: {
        Row: {
          id: string;
          caregiver_id: string;
          classroom_id: string;
          is_lead: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['caregiver_classrooms']['Row'], 'id' | 'created_at' | 'is_lead'> & {
          id?: string;
          created_at?: string;
          is_lead?: boolean;
        };
        Update: Partial<Database['public']['Tables']['caregiver_classrooms']['Insert']>;
      };

      timeline_entries: {
        Row: {
          id: string;
          child_id: string;
          author_id: string;
          daycare_id: string;
          activity_type: 'meal' | 'nap' | 'diaper' | 'activity' | 'milestone' | 'photo' | 'note' | 'medication' | 'checkin' | 'checkout' | 'mood' | 'incident';
          title: string;
          description: string | null;
          photo_urls: string[];
          mood: 'happy' | 'calm' | 'sleepy' | 'fussy' | 'playful' | null;
          metadata: Json;
          is_urgent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['timeline_entries']['Row'], 'id' | 'created_at' | 'updated_at' | 'photo_urls' | 'is_urgent' | 'metadata'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          photo_urls?: string[];
          is_urgent?: boolean;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['timeline_entries']['Insert']>;
      };

      comments: {
        Row: {
          id: string;
          timeline_entry_id: string;
          author_id: string;
          text: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
      };

      reactions: {
        Row: {
          id: string;
          timeline_entry_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reactions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reactions']['Insert']>;
      };

      conversations: {
        Row: {
          id: string;
          daycare_id: string;
          type: 'direct' | 'group' | 'announcement';
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };

      conversation_members: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          last_read_at: string | null;
          is_muted: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversation_members']['Row'], 'id' | 'created_at' | 'is_muted'> & {
          id?: string;
          created_at?: string;
          is_muted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['conversation_members']['Insert']>;
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          text: string;
          attachments: string[];
          is_urgent: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at' | 'attachments' | 'is_urgent'> & {
          id?: string;
          created_at?: string;
          attachments?: string[];
          is_urgent?: boolean;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          daycare_id: string | null;
          type: 'message' | 'activity' | 'milestone' | 'alert' | 'reminder' | 'announcement' | 'incident';
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at' | 'data'> & {
          id?: string;
          created_at?: string;
          data?: Json;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };

      attendance: {
        Row: {
          id: string;
          child_id: string;
          daycare_id: string;
          date: string;
          check_in_at: string | null;
          check_in_by: string | null;
          check_out_at: string | null;
          check_out_by: string | null;
          status: 'present' | 'absent' | 'late' | 'excused';
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
      };

      incidents: {
        Row: {
          id: string;
          child_id: string;
          daycare_id: string;
          reported_by: string;
          type: 'fall' | 'bite' | 'scratch' | 'bump' | 'allergic_reaction' | 'illness' | 'other';
          severity: 'minor' | 'moderate' | 'serious';
          location: string | null;
          description: string;
          action_taken: string;
          parent_notified_at: string | null;
          witness_name: string | null;
          photo_urls: string[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['incidents']['Row'], 'id' | 'created_at' | 'photo_urls'> & {
          id?: string;
          created_at?: string;
          photo_urls?: string[];
        };
        Update: Partial<Database['public']['Tables']['incidents']['Insert']>;
      };

      milestones: {
        Row: {
          id: string;
          child_id: string;
          category: 'cognitive' | 'motor' | 'social' | 'language' | 'self_care';
          title: string;
          description: string | null;
          age_range: string | null;
          achieved_at: string | null;
          noted_by: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['milestones']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>;
      };

      invoices: {
        Row: {
          id: string;
          daycare_id: string;
          parent_id: string;
          child_id: string;
          stripe_invoice_id: string | null;
          amount_cents: number;
          status: 'draft' | 'pending' | 'paid' | 'overdue' | 'void';
          due_date: string;
          paid_at: string | null;
          description: string;
          line_items: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };

      calendar_events: {
        Row: {
          id: string;
          daycare_id: string;
          classroom_id: string | null;
          type: 'event' | 'holiday' | 'conference' | 'vaccination' | 'closure' | 'birthday';
          title: string;
          description: string | null;
          start_at: string;
          end_at: string | null;
          all_day: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calendar_events']['Row'], 'id' | 'created_at' | 'all_day'> & {
          id?: string;
          created_at?: string;
          all_day?: boolean;
        };
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>;
      };

      learning_plans: {
        Row: {
          id: string;
          classroom_id: string;
          daycare_id: string;
          week_start: string;
          theme: string | null;
          activities: Json;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['learning_plans']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['learning_plans']['Insert']>;
      };

      subscriptions: {
        Row: {
          id: string;
          daycare_id: string;
          stripe_subscription_id: string | null;
          plan_tier: 'starter' | 'professional' | 'enterprise';
          status: 'active' | 'past_due' | 'canceled' | 'trialing';
          current_period_end: string | null;
          child_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at' | 'child_count'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          child_count?: number;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };

      parent_subscriptions: {
        Row: {
          id: string;
          parent_id: string;
          daycare_id: string;
          stripe_subscription_id: string | null;
          plan: 'free' | 'premium';
          status: 'active' | 'past_due' | 'canceled';
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['parent_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['parent_subscriptions']['Insert']>;
      };

      invite_codes: {
        Row: {
          id: string;
          daycare_id: string;
          code: string;
          role: 'parent' | 'caregiver' | 'family';
          child_id: string | null;
          classroom_id: string | null;
          created_by: string;
          used_by: string | null;
          used_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invite_codes']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invite_codes']['Insert']>;
      };
    };

    Functions: {
      get_user_daycare_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_user_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
  };
}

// Convenience type aliases for Row types
export type Daycare = Database['public']['Tables']['daycares']['Row'];
export type Classroom = Database['public']['Tables']['classrooms']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type DbChild = Database['public']['Tables']['children']['Row'];
export type ParentChild = Database['public']['Tables']['parent_children']['Row'];
export type CaregiverClassroom = Database['public']['Tables']['caregiver_classrooms']['Row'];
export type DbTimelineEntry = Database['public']['Tables']['timeline_entries']['Row'];
export type DbComment = Database['public']['Tables']['comments']['Row'];
export type DbReaction = Database['public']['Tables']['reactions']['Row'];
export type DbConversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationMember = Database['public']['Tables']['conversation_members']['Row'];
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbNotification = Database['public']['Tables']['notifications']['Row'];
export type DbAttendance = Database['public']['Tables']['attendance']['Row'];
export type DbIncident = Database['public']['Tables']['incidents']['Row'];
export type DbMilestone = Database['public']['Tables']['milestones']['Row'];
export type DbInvoice = Database['public']['Tables']['invoices']['Row'];
export type DbCalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
export type DbLearningPlan = Database['public']['Tables']['learning_plans']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type ParentSubscription = Database['public']['Tables']['parent_subscriptions']['Row'];
export type InviteCode = Database['public']['Tables']['invite_codes']['Row'];
