import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Shadows } from '../theme/colors';
import { useApp } from '../context/AppContext';

import { TimelineScreen } from '../screens/parent/TimelineScreen';
import { MessagesScreen } from '../screens/shared/MessagesScreen';
import { DailyReportScreen } from '../screens/parent/DailyReportScreen';
import { GalleryScreen } from '../screens/parent/GalleryScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { CaregiverDashboard } from '../screens/caregiver/CaregiverDashboard';

const Tab = createBottomTabNavigator();

const tabIconMap: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Dashboard: { focused: 'grid', default: 'grid-outline' },
  Messages: { focused: 'chatbubbles', default: 'chatbubbles-outline' },
  Report: { focused: 'document-text', default: 'document-text-outline' },
  More: { focused: 'apps', default: 'apps-outline' },
  Profile: { focused: 'person-circle', default: 'person-circle-outline' },
};

export const AppNavigator = () => {
  const { currentRole, unreadCount } = useApp();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            const icons = tabIconMap[route.name] || tabIconMap.Home;
            const iconName = focused ? icons.focused : icons.default;
            return (
              <View>
                <Ionicons name={iconName} size={22} color={color} />
                {route.name === 'Messages' && unreadCount > 0 && (
                  <View style={{
                    position: 'absolute', top: -4, right: -8,
                    backgroundColor: Colors.secondary, width: 16, height: 16,
                    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 9, color: Colors.white, fontWeight: '700' }}>{unreadCount}</Text>
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
        {currentRole === 'parent' ? (
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
