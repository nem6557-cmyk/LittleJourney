import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Shadows, Spacing } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { DaycareOnboardingScreen } from '../screens/auth/DaycareOnboardingScreen';
import { InviteCodeScreen } from '../screens/auth/InviteCodeScreen';

// App screens
import { TimelineScreen } from '../screens/parent/TimelineScreen';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { DailyReportScreen } from '../screens/parent/DailyReportScreen';
import { GalleryScreen } from '../screens/parent/GalleryScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { CaregiverDashboard } from '../screens/caregiver/CaregiverDashboard';

const Tab = createBottomTabNavigator();

type AuthScreen = 'login' | 'signup' | 'forgot-password';

const tabIconMap: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Dashboard: { focused: 'grid', default: 'grid-outline' },
  Messages: { focused: 'chatbubbles', default: 'chatbubbles-outline' },
  Report: { focused: 'document-text', default: 'document-text-outline' },
  More: { focused: 'apps', default: 'apps-outline' },
  Profile: { focused: 'person-circle', default: 'person-circle-outline' },
};

// ============================================================
// Auth Flow (not authenticated)
// ============================================================

const AuthNavigator = () => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');

  switch (currentScreen) {
    case 'signup':
      return <SignUpScreen onNavigateToLogin={() => setCurrentScreen('login')} />;
    case 'forgot-password':
      return <ForgotPasswordScreen onNavigateToLogin={() => setCurrentScreen('login')} />;
    case 'login':
    default:
      return (
        <LoginScreen
          onNavigateToSignUp={() => setCurrentScreen('signup')}
          onNavigateToForgotPassword={() => setCurrentScreen('forgot-password')}
        />
      );
  }
};

// ============================================================
// Main App (authenticated)
// ============================================================

const MainAppNavigator = () => {
  const { profile } = useAuth();
  const { unreadCount } = useApp();
  const currentRole = profile?.role || 'parent';

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            const icons = tabIconMap[route.name] || tabIconMap.Home;
            const iconName = focused ? icons.focused : icons.default;
            return (
              <View accessibilityLabel={`${route.name} tab`} accessibilityRole="tab">
                <Ionicons name={iconName} size={22} color={color} />
                {route.name === 'Messages' && unreadCount > 0 && (
                  <View style={styles.badge} accessibilityLabel={`${unreadCount} unread messages`}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            );
          },
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
        {currentRole === 'parent' || currentRole === 'family' || currentRole === 'pediatrician' ? (
          <>
            <Tab.Screen name="Home" component={TimelineScreen} />
            <Tab.Screen name="Messages" component={MessagesScreen} />
            <Tab.Screen name="Report" component={DailyReportScreen} />
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
    </NavigationContainer>
  );
};

// ============================================================
// Root Navigator
// ============================================================

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, profile, needsOnboarding, isDemoMode } = useAuth();

  // Loading state while checking persisted auth
  // Also show loading if authenticated via Supabase but profile hasn't loaded yet
  if (isLoading || (isAuthenticated && !isDemoMode && !profile)) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="Loading app" accessibilityRole="none">
        <Text style={styles.loadingLogo}>🦋</Text>
        <Text style={styles.loadingTitle}>Little Journey</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  // Not authenticated → show auth flow
  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // Demo mode → skip onboarding checks, go straight to app
  if (isDemoMode) {
    return <MainAppNavigator />;
  }

  // Authenticated but admin without daycare → onboarding
  if (needsOnboarding) {
    return <DaycareOnboardingScreen />;
  }

  // Authenticated but no daycare (parent/caregiver) → invite code
  if (profile && !profile.daycare_id && (profile.role === 'parent' || profile.role === 'caregiver' || profile.role === 'family')) {
    return <InviteCodeScreen />;
  }

  // Fully authenticated and onboarded → main app
  return <MainAppNavigator />;
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
});
