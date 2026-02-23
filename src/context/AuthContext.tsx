import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Daycare } from '../types/database';
import type { UserRole } from '../types';

// ============================================================
// Types
// ============================================================

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  daycare: Daycare | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
}

interface AuthContextType extends AuthState {
  // Auth actions
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata: { first_name: string; last_name: string; role: UserRole }) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;

  // Profile actions
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Onboarding
  createDaycare: (data: { name: string; address?: string; city?: string; state?: string; zip?: string; phone?: string; email?: string }) => Promise<{ daycareId: string; error: string | null }>;
  redeemInviteCode: (code: string) => Promise<{ error: string | null }>;

  // Demo mode (for testing without Supabase)
  demoSignIn: (role: UserRole) => void;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ============================================================
// Provider
// ============================================================

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [daycare, setDaycare] = useState<Daycare | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isAuthenticated = isDemoMode || !!session;
  const needsOnboarding = isAuthenticated && !isDemoMode && profile?.role === 'admin' && !profile?.daycare_id;

  // ----------------------------------------------------------
  // Fetch profile from Supabase
  // ----------------------------------------------------------
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);

      // Fetch daycare if user belongs to one
      if (data.daycare_id) {
        const { data: daycareData } = await supabase
          .from('daycares')
          .select('*')
          .eq('id', data.daycare_id)
          .single();

        setDaycare(daycareData);
      }

      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  // ----------------------------------------------------------
  // Initialize: listen for auth state changes
  // ----------------------------------------------------------
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setDaycare(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ----------------------------------------------------------
  // Auth actions
  // ----------------------------------------------------------

  const signIn = useCallback(async (email: string, password: string) => {
    setIsDemoMode(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata: { first_name: string; last_name: string; role: UserRole }
  ) => {
    setIsDemoMode(false);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Stored in raw_user_meta_data, used by handle_new_user trigger
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setIsDemoMode(false);
    setProfile(null);
    setDaycare(null);
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'littlejourney://reset-password',
    });
    return { error };
  }, []);

  // ----------------------------------------------------------
  // Profile actions
  // ----------------------------------------------------------

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      Alert.alert('Error', 'Failed to update profile');
      throw error;
    }

    // Refresh profile
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ----------------------------------------------------------
  // Onboarding: Create daycare (for admins)
  // ----------------------------------------------------------

  const createDaycare = useCallback(async (data: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
  }) => {
    if (!user) return { daycareId: '', error: 'Not authenticated' };

    // Create daycare
    const { data: newDaycare, error: dcError } = await supabase
      .from('daycares')
      .insert(data)
      .select()
      .single();

    if (dcError || !newDaycare) {
      return { daycareId: '', error: dcError?.message || 'Failed to create daycare' };
    }

    // Link user to daycare
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ daycare_id: newDaycare.id, role: 'admin' })
      .eq('id', user.id);

    if (profileError) {
      return { daycareId: newDaycare.id, error: 'Daycare created but failed to link profile' };
    }

    // Create default subscription (trial)
    await supabase.from('subscriptions').insert({
      daycare_id: newDaycare.id,
      plan_tier: 'starter',
      status: 'trialing',
      current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Refresh profile to pick up daycare_id
    await fetchProfile(user.id);

    return { daycareId: newDaycare.id, error: null };
  }, [user, fetchProfile]);

  // ----------------------------------------------------------
  // Onboarding: Redeem invite code (for parents/caregivers)
  // ----------------------------------------------------------

  const redeemInviteCode = useCallback(async (code: string) => {
    if (!user) return { error: 'Not authenticated' };

    // Look up the invite code
    const { data: invite, error: lookupError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .is('used_by', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (lookupError || !invite) {
      return { error: 'Invalid or expired invite code' };
    }

    // Mark code as used
    const { error: redeemError } = await supabase
      .from('invite_codes')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (redeemError) {
      return { error: 'Failed to redeem invite code' };
    }

    // Link user to daycare with the specified role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        daycare_id: invite.daycare_id,
        role: invite.role as any,
      })
      .eq('id', user.id);

    if (profileError) {
      return { error: 'Failed to link to daycare' };
    }

    // If parent invite with a child_id, create parent-child link
    if (invite.role === 'parent' && invite.child_id) {
      await supabase.from('parent_children').insert({
        parent_id: user.id,
        child_id: invite.child_id,
        relationship: 'parent',
      });
    }

    // If caregiver invite with a classroom_id, create assignment
    if (invite.role === 'caregiver' && invite.classroom_id) {
      await supabase.from('caregiver_classrooms').insert({
        caregiver_id: user.id,
        classroom_id: invite.classroom_id,
      });
    }

    // Refresh
    await fetchProfile(user.id);

    return { error: null };
  }, [user, fetchProfile]);

  // ----------------------------------------------------------
  // Demo mode (bypasses Supabase for testing)
  // ----------------------------------------------------------

  const demoSignIn = useCallback((role: UserRole) => {
    setIsDemoMode(true);
    setProfile({
      id: 'demo-user',
      email: `demo-${role}@littlejourney.app`,
      first_name: role === 'parent' ? 'Noor' : role === 'caregiver' ? 'Sarah' : 'Admin',
      last_name: role === 'parent' ? 'Ahmed' : role === 'caregiver' ? 'Johnson' : 'Smith',
      phone: null,
      avatar_url: null,
      role: role as any,
      daycare_id: 'demo-daycare',
      push_token: null,
      coppa_consent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setDaycare({
      id: 'demo-daycare',
      name: 'Sunshine Academy',
      address: '123 Learning Lane',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      phone: '(512) 555-0100',
      email: 'admin@sunshineacademy.com',
      logo_url: null,
      stripe_account_id: null,
      stripe_onboarding_complete: false,
      subscription_tier: 'professional',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      max_children: 50,
      max_classrooms: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsLoading(false);
  }, []);

  // ----------------------------------------------------------
  // Context value
  // ----------------------------------------------------------

  const value = useMemo(() => ({
    session,
    user,
    profile,
    daycare,
    isLoading,
    isAuthenticated,
    needsOnboarding,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
    createDaycare,
    redeemInviteCode,
    demoSignIn,
    isDemoMode,
  }), [
    session, user, profile, daycare, isLoading, isAuthenticated, needsOnboarding,
    signIn, signUp, signOut, resetPassword, updateProfile, refreshProfile,
    createDaycare, redeemInviteCode, demoSignIn, isDemoMode,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
