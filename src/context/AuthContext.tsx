import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Alert, Platform, Linking } from 'react-native';
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

/**
 * Demo mode (fake local session, no backend) is ONLY allowed in development.
 * A misconfigured production build must never silently fall into a fake
 * admin/parent session — config.ts also throws in prod, but this is defense
 * in depth at the auth boundary.
 */
const isDemoModeAllowed = (): boolean => __DEV__ && !isSupabaseConfigured();

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

    // Safety timeout: never stay on the splash screen forever. We only stop the
    // loading spinner here — we do NOT force sign-out, because a slow profile
    // fetch on a poor connection is not the same as a missing profile. The
    // genuine "authenticated but no profile" case is handled (with a retry) in
    // the getSession + onAuthStateChange paths below, and AppNavigator shows a
    // "Sign Out & Try Again" affordance if profile never loads.
    const safetyTimer = setTimeout(() => {
      console.warn('[Auth] Safety timeout — leaving splash; profile may still be loading.');
      setIsLoading(false);
    }, 12000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).then((profileData) => {
          clearTimeout(safetyTimer);
          setIsLoading(false);
          // If profile fetch returned null, sign out to avoid being stuck
          if (!profileData) {
            console.warn('[Auth] Profile not found — signing out');
            supabase.auth.signOut().catch(() => {});
            setSession(null);
            setUser(null);
          }
        }).catch(() => {
          clearTimeout(safetyTimer);
          setIsLoading(false);
          console.warn('[Auth] Profile fetch failed — signing out');
          supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
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
          let profileData = await fetchProfile(newSession.user.id);

          // If profile not found (e.g. DB trigger hasn't finished), retry once after a short delay
          if (!profileData) {
            console.warn('[Auth] Profile not found on first attempt — retrying in 2s…');
            await new Promise((r) => setTimeout(r, 2000));
            profileData = await fetchProfile(newSession.user.id);
          }

          // If still null after retry, sign out to break the deadlock
          if (!profileData) {
            console.warn('[Auth] Profile still not found after retry — signing out');
            supabase.auth.signOut().catch(() => {});
            setSession(null);
            setUser(null);
            setDaycare(null);
          }
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
  // Deep-link handler: establish a session from auth redirect URLs
  // (password recovery + email confirmation). On native, detectSessionInUrl
  // is off, so we must parse the URL and exchange the code ourselves.
  // ----------------------------------------------------------
  useEffect(() => {
    if (Platform.OS === 'web' || !isSupabaseConfigured()) return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const isRecovery = url.includes('reset-password') || url.includes('type=recovery');
      try {
        // PKCE flow: ?code=... — exchange it for a session.
        const code = url.match(/[?&]code=([^&]+)/)?.[1];
        if (code) {
          await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
        } else {
          // Implicit flow: tokens in the URL fragment (#access_token=...&refresh_token=...).
          const hash = url.split('#')[1] ?? '';
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
        if (isRecovery) setIsPasswordRecovery(true);
      } catch (err) {
        console.warn('[Auth] Failed to handle auth deep link:', err);
      }
    };

    // Cold start (app opened directly from the link).
    Linking.getInitialURL().then(handleUrl);
    // Warm start (app already running).
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

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
    // In development only, fall back to demo mode when Supabase isn't configured.
    if (isDemoModeAllowed()) {
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
    // In development only, fall back to demo mode when Supabase isn't configured.
    if (isDemoModeAllowed()) {
      activateDemoMode(metadata.role);
      return { error: null };
    }
    setIsDemoMode(false);
    const emailRedirectTo = Platform.OS === 'web' ? window.location.origin : 'littlejourney://';
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Stored in raw_user_meta_data (only first/last name are trusted server-side)
        // Return the user to the app after they tap the confirmation link.
        emailRedirectTo,
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
    // Use web origin for web, deep link for native
    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}`
      : 'littlejourney://reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
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

    // Redemption runs server-side (SECURITY DEFINER RPC): it validates the
    // exact code, marks it used, and links the profile + role atomically.
    // The client can no longer enumerate codes or pick its own role.
    const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
      p_code: code.toUpperCase(),
    });

    if (rpcError) {
      return { error: 'Failed to redeem invite code' };
    }
    if (data?.error) {
      return { error: data.error as string };
    }

    // Refresh local profile to pick up the new daycare/role.
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
