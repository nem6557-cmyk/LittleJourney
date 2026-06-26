import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

type AdminNavigation = { navigate: (screen: string) => void; goBack: () => void };

export const AdminDashboard = ({ navigation }: { navigation?: AdminNavigation }) => {
  const { children, attendance, timelineEntries, currentUser } = useApp();
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  const daycareName = profile?.daycare_id ? 'Your Daycare' : 'Little Journey';
  const presentToday = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const totalChildren = children.length;
  const todayEntries = timelineEntries.filter(
    (e) => new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length;

  // Only screens that are actually registered in AdminNavigator carry a `screen`.
  // Items without one are not yet built and show a Coming Soon notice.
  const managementItems = [
    { icon: 'people' as const, label: 'Manage Children', desc: `${totalChildren} enrolled`, color: Colors.primary, screen: 'ManageChildren' },
    { icon: 'person-add' as const, label: 'Manage Staff', desc: 'Caregivers & teachers', color: Colors.info, screen: 'ManageStaff' },
    { icon: 'key' as const, label: 'Invite Codes', desc: 'Invite parents & staff', color: Colors.accent, screen: 'InviteCodes' },
    { icon: 'grid' as const, label: 'Classrooms', desc: 'Rooms & assignments', color: Colors.success, screen: null },
    { icon: 'calendar' as const, label: 'Calendar', desc: 'Events & closures', color: Colors.accent, screen: null },
  ];

  const quickActions = [
    { icon: 'person-add-outline' as const, label: 'Add Child', color: Colors.primary, screen: 'ManageChildren' },
    { icon: 'key-outline' as const, label: 'Invite Codes', color: Colors.accent, screen: 'InviteCodes' },
    { icon: 'mail-outline' as const, label: 'Send Announcement', color: Colors.secondary, screen: null },
    { icon: 'document-text-outline' as const, label: 'Generate Report', color: Colors.info, screen: null },
  ];

  const handleManagementTap = (screen: string | null) => {
    if (screen && navigation) {
      navigation.navigate(screen);
    } else {
      Alert.alert('Coming Soon', 'This management screen will be available in a future update.');
    }
  };

  const handleQuickAction = (action: { label: string; screen: string | null }) => {
    if (action.screen && navigation) {
      navigation.navigate(action.screen);
      return;
    }
    Alert.alert(action.label, 'This feature will be available in a future update.');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#6C63FF', '#3F3D9E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Admin Dashboard</Text>
              <Text style={styles.headerTitle}>{daycareName}</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              accessibilityLabel="Settings"
              accessibilityRole="button"
              onPress={() => navigation?.navigate('Profile')}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{presentToday}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalChildren - presentToday}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalChildren}</Text>
              <Text style={styles.statLabel}>Enrolled</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{todayEntries}</Text>
              <Text style={styles.statLabel}>Entries</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.quickAction, Shadows.small]}
                onPress={() => handleQuickAction(action)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Management Sections */}
          <Text style={styles.sectionTitle}>Management</Text>
          {managementItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.managementCard, Shadows.small]}
              onPress={() => handleManagementTap(item.screen)}
            >
              <View style={[styles.managementIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.managementInfo}>
                <Text style={styles.managementLabel}>{item.label}</Text>
                <Text style={styles.managementDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}

          {/* Attendance Overview */}
          <Text style={styles.sectionTitle}>Today's Attendance</Text>
          <View style={[styles.attendanceCard, Shadows.small]}>
            <View style={styles.attendanceBar}>
              <View
                style={[
                  styles.attendanceFill,
                  { width: totalChildren > 0 ? `${(presentToday / totalChildren) * 100}%` : '0%' },
                ]}
              />
            </View>
            <View style={styles.attendanceStats}>
              <View style={styles.attendanceStat}>
                <View style={[styles.attendanceDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.attendanceStatText}>Present: {presentToday}</Text>
              </View>
              <View style={styles.attendanceStat}>
                <View style={[styles.attendanceDot, { backgroundColor: Colors.danger }]} />
                <Text style={styles.attendanceStatText}>Absent: {totalChildren - presentToday}</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800', marginTop: Spacing.xs },
  settingsBtn: { padding: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.round },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center' },
  statValue: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  statLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  content: { padding: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.md },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickAction: { width: '48%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  managementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  managementIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  managementInfo: { flex: 1 },
  managementLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  managementDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  attendanceCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  attendanceBar: { height: 8, backgroundColor: Colors.danger + '30', borderRadius: 4, overflow: 'hidden' },
  attendanceFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  attendanceStats: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
  attendanceStat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  attendanceDot: { width: 8, height: 8, borderRadius: 4 },
  attendanceStatText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
});
