import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { config } from '../lib/config';
import type { Profile, Daycare } from '../types/database';
import type { UserRole } from '../types';

/**
 * Check if Supabase is properly configured (not using placeholder values).
 */
const isSupabaseConfigured = (): boolean => {
  const url = config.supabaseUrl;
  return !!url && !url.includes('YOUR_PROJECT_ID') && !url.includes('your-') && url.startsWith('https://');
};

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
  isPasswordRecovery: boolean;
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
  joinDemoDaycare: () => Promise<{ error: string | null }>;

  // Demo mode (for testing without Supabase)
  demoSignIn: (role: UserRole) => void;
  isDemoMode: boolean;

  // Password recovery
  clearPasswordRecovery: () => void;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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
    if (!isSupabaseConfigured()) {
      // Supabase not configured — skip initialization, go straight to login screen
      console.warn('[Auth] Supabase not configured — running in offline mode.');
      setIsLoading(false);
      return;
    }

    // Safety timeout: never stay on loading screen longer than 10s
    const safetyTimer = setTimeout(() => {
      setIsLoading((current) => {
        if (current) {
          console.warn('[Auth] Safety timeout — forcing loading to false');
        }
        return false;
      });
    }, 10000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).finally(() => {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        });
      } else {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err);
      clearTimeout(safetyTimer);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Handle password recovery deep link
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setDaycare(null);
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ----------------------------------------------------------
  // Auth actions
  // ----------------------------------------------------------

  // Helper to activate demo mode for a given role (used by signIn/signUp when Supabase is not configured)
  const activateDemoMode = useCallback((role: UserRole) => {
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
      coppa_consent_at: role === 'parent' ? new Date().toISOString() : null,
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

  const signIn = useCallback(async (email: string, password: string) => {
    // When Supabase isn't configured, fall back to demo mode
    if (!isSupabaseConfigured()) {
      const role: UserRole = email.toLowerCase().includes('caregiver') ? 'caregiver'
        : email.toLowerCase().includes('admin') ? 'admin'
        : 'parent';
      activateDemoMode(role);
      return { error: null };
    }
    setIsDemoMode(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [activateDemoMode]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata: { first_name: string; last_name: string; role: UserRole }
  ) => {
    // When Supabase isn't configured, fall back to demo mode
    if (!isSupabaseConfigured()) {
      activateDemoMode(metadata.role);
      return { error: null };
    }
    setIsDemoMode(false);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Stored in raw_user_meta_data, used by handle_new_user trigger
      },
    });
    return { error };
  }, [activateDemoMode]);

  const signOut = useCallback(async () => {
    setIsDemoMode(false);
    setProfile(null);
    setDaycare(null);
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured()) {
      Alert.alert('Offline Mode', 'Password reset is not available in offline mode. Use demo login instead.');
      return { error: null };
    }
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

    // Only admins (or new users signing up as admin) can create daycares
    if (profile && profile.role !== 'admin') {
      return { daycareId: '', error: 'Only admin users can create a daycare' };
    }

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
  // Pilot: Join the seeded demo daycare (Sunshine Academy)
  // ----------------------------------------------------------

  const joinDemoDaycare = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' };

    try {
      // Call server-side RPC that handles all linking with SECURITY DEFINER
      const { data, error: rpcError } = await supabase.rpc('join_demo_daycare');

      if (rpcError) {
        return { error: 'Failed to join demo daycare: ' + rpcError.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Refresh profile to pick up daycare_id
      await fetchProfile(user.id);

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to join demo daycare' };
    }
  }, [user, fetchProfile]);

  // ----------------------------------------------------------
  // Demo mode (bypasses Supabase for testing)
  // ----------------------------------------------------------

  const demoSignIn = useCallback((role: UserRole) => {
    activateDemoMode(role);
  }, [activateDemoMode]);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
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
    isPasswordRecovery,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
    createDaycare,
    redeemInviteCode,
    joinDemoDaycare,
    demoSignIn,
    isDemoMode,
    clearPasswordRecovery,
  }), [
    session, user, profile, daycare, isLoading, isAuthenticated, needsOnboarding,
    isPasswordRecovery,
    signIn, signUp, signOut, resetPassword, updateProfile, refreshProfile,
    createDaycare, redeemInviteCode, joinDemoDaycare, demoSignIn, isDemoMode,
    clearPasswordRecovery,
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
