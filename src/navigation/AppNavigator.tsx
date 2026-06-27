import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Shadows, Spacing, BorderRadius } from '../theme/colors';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { DaycareOnboardingScreen } from '../screens/auth/DaycareOnboardingScreen';
import { InviteCodeScreen } from '../screens/auth/InviteCodeScreen';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';

// Legal screens
import { ConsentScreen } from '../screens/legal/ConsentScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';

// App screens
import { TimelineScreen } from '../screens/parent/TimelineScreen';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { DailyReportScreen } from '../screens/parent/DailyReportScreen';
import { GalleryScreen } from '../screens/parent/GalleryScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { CaregiverDashboard } from '../screens/caregiver/CaregiverDashboard';

// Admin screens
import { AdminDashboard } from '../screens/admin/AdminDashboard';
import { ManageChildrenScreen } from '../screens/admin/ManageChildrenScreen';
import { ManageStaffScreen } from '../screens/admin/ManageStaffScreen';
import { InviteCodesScreen } from '../screens/admin/InviteCodesScreen';

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const AdminStack = createStackNavigator();

const tabIconMap: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Dashboard: { focused: 'grid', default: 'grid-outline' },
  Admin: { focused: 'shield', default: 'shield-outline' },
  Messages: { focused: 'chatbubbles', default: 'chatbubbles-outline' },
  Report: { focused: 'document-text', default: 'document-text-outline' },
  More: { focused: 'apps', default: 'apps-outline' },
  Profile: { focused: 'person-circle', default: 'person-circle-outline' },
};

// ============================================================
// Auth Flow (not authenticated) — proper navigation stack
// ============================================================

const EmailVerificationWrapper = ({ route, navigation }: any) => (
  <EmailVerificationScreen
    email={route.params?.email || ''}
    onBackToLogin={() => navigation.navigate('Login')}
    // Once verified, return to Login; if a session was established the root
    // navigator switches to the authenticated app automatically.
    onVerified={() => navigation.navigate('Login')}
  />
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <AuthStack.Screen name="EmailVerification" component={EmailVerificationWrapper} />
  </AuthStack.Navigator>
);

const AdminNavigator = () => (
  <AdminStack.Navigator screenOptions={{ headerShown: false }}>
    <AdminStack.Screen name="AdminHome" component={AdminDashboard} />
    <AdminStack.Screen name="ManageChildren" component={ManageChildrenScreen} />
    <AdminStack.Screen name="ManageStaff" component={ManageStaffScreen} />
    <AdminStack.Screen name="InviteCodes" component={InviteCodesScreen} />
  </AdminStack.Navigator>
);

// ============================================================
// Main App (authenticated)
// ============================================================

const MainAppNavigator = () => {
  const { profile } = useAuth();
  const { unreadCount } = useApp();
  const currentRole = profile?.role || 'parent';

  return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            const icons = tabIconMap[route.name] || tabIconMap.Home;
            const iconName = focused ? icons.focused : icons.default;
            // The icon is decorative — React Navigation already labels the tab
            // from the route name, so we must NOT add another accessibilityLabel
            // here (it would stutter, e.g. "Dashboard tab Dashboard tab Dashboard").
            return (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name={iconName} size={22} color={color} />
                {route.name === 'Messages' && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            );
          },
          tabBarAccessibilityLabel: unreadCount > 0 && route.name === 'Messages'
            ? `Messages, ${unreadCount} unread`
            : route.name,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopWidth: 0,
            height: 85,
            paddingTop: 8,
            paddingBottom: 28,
            ...Shadows.medium,
          },
          tabBarLabelStyle: {
            fontSize: FontSizes.xs,
            fontWeight: '600' as const,
          },
        })}
      >
        {currentRole === 'pediatrician' ? (
          // Pediatricians get a scoped, read-only view: child timeline + profile
          // only — no billing, family network, or messaging.
          <>
            <Tab.Screen name="Home" component={TimelineScreen} />
            <Tab.Screen name="Report" component={DailyReportScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : currentRole === 'parent' || currentRole === 'family' ? (
          <>
            <Tab.Screen name="Home" component={TimelineScreen} />
            <Tab.Screen name="Messages" component={MessagesScreen} />
            <Tab.Screen name="Report" component={DailyReportScreen} />
            <Tab.Screen name="More" component={GalleryScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : currentRole === 'admin' ? (
          <>
            <Tab.Screen name="Admin" component={AdminNavigator} />
            <Tab.Screen name="Home" component={TimelineScreen} />
            <Tab.Screen name="Messages" component={MessagesScreen} />
            <Tab.Screen name="More" component={GalleryScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          <>
            <Tab.Screen name="Dashboard" component={CaregiverDashboard} />
            <Tab.Screen name="Home" component={TimelineScreen} />
            <Tab.Screen name="Messages" component={MessagesScreen} />
            <Tab.Screen name="More" component={GalleryScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Tab.Navigator>
  );
};

// ============================================================
// Root Navigator
// ============================================================

const linking: any = {
  prefixes: ['littlejourney://', 'https://littlejourney.app'],
  config: {
    screens: {
      Home: 'home',
      Messages: 'messages',
      Report: 'report',
      More: 'gallery',
      Profile: 'profile',
      Dashboard: 'dashboard',
      Admin: {
        screens: {
          AdminHome: 'admin',
          ManageChildren: 'admin/children',
          ManageStaff: 'admin/staff',
          InviteCodes: 'admin/invites',
        },
      },
    },
  },
};

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, profile, needsOnboarding, isDemoMode, updateProfile, refreshProfile, signOut, daycare, isPasswordRecovery, clearPasswordRecovery } = useAuth();

  // Safety: track how long we've been waiting for profile after authentication.
  // If profile never loads within 10s, show a "Sign Out" button so the user isn't stuck.
  const [profileTimeout, setProfileTimeout] = useState(false);
  const waitingForProfile = isAuthenticated && !isDemoMode && !profile && !isLoading;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (waitingForProfile) {
      timerRef.current = setTimeout(() => setProfileTimeout(true), 10000);
    } else {
      setProfileTimeout(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [waitingForProfile]);

  // Loading state while checking persisted auth
  // Also show loading if authenticated via Supabase but profile hasn't loaded yet
  if (isLoading || waitingForProfile) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="Loading app" accessibilityRole="none">
        <Text style={styles.loadingLogo}>🦋</Text>
        <Text style={styles.loadingTitle}>Little Journey</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        {profileTimeout && (
          <View style={styles.timeoutContainer}>
            <Text style={styles.timeoutText}>
              Having trouble loading your profile.
            </Text>
            <TouchableOpacity
              style={styles.timeoutBtn}
              onPress={() => signOut()}
              accessibilityLabel="Sign out and try again"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.white} />
              <Text style={styles.timeoutBtnText}>Sign Out & Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Password recovery flow (from email deep link)
  if (isPasswordRecovery) {
    return <ResetPasswordScreen onComplete={clearPasswordRecovery} />;
  }

  // Determine which navigator to show
  const renderContent = () => {
    if (!isAuthenticated) {
      return <AuthNavigator />;
    }
    if (isDemoMode) {
      return <MainAppNavigator />;
    }
    if (needsOnboarding) {
      return <DaycareOnboardingScreen />;
    }
    if (profile && !profile.daycare_id && (profile.role === 'parent' || profile.role === 'caregiver' || profile.role === 'family')) {
      return <InviteCodeScreen />;
    }
    if (profile && (profile.role === 'parent' || profile.role === 'family') && !profile.coppa_consent_at) {
      return (
        <ConsentScreen
          parentName={`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}
          childName=""
          daycareName={daycare?.name || 'Your Daycare'}
          onConsent={async () => {
            await updateProfile({ coppa_consent_at: new Date().toISOString() });
            await refreshProfile();
          }}
          onDecline={() => {
            signOut();
          }}
        />
      );
    }
    return <MainAppNavigator />;
  };

  return (
    <ErrorBoundary>
      <NavigationContainer linking={linking}>
        {renderContent()}
      </NavigationContainer>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: { fontSize: 64, marginBottom: Spacing.md },
  loadingTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.secondary,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 9, color: Colors.white, fontWeight: '700' },
  timeoutContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  timeoutText: {
    fontSize: FontSizes.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  timeoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  timeoutBtnText: {
    fontSize: FontSizes.md,
    color: Colors.white,
    fontWeight: '700',
  },
});
