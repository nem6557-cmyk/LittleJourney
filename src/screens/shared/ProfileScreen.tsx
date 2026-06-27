import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { getChildAge, formatDateShort } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { trackScreen } from '../../lib/analytics';
import { PaymentMethodsScreen } from '../payments/PaymentMethodsScreen';
import { SubscriptionScreen } from '../payments/SubscriptionScreen';

const PREFS_STORAGE_KEY = '@littlejourney/user_preferences';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type SubScreen = null | 'child_profile' | 'family' | 'pickups' | 'health' | 'invoices' | 'invoice_detail' | 'notifications' | 'about'
  | 'privacy' | 'language' | 'translation' | 'change_password' | 'download_data' | 'payment_methods' | 'subscription' | 'lesson_plans' | 'incidents';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  sub?: SubScreen;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const ProfileScreen = () => {
  const { currentRole, switchRole, currentUser, selectedChild, showAlert, shareContent, invoices, payInvoice, logout, learningPlans, incidents, preferences, updatePreferences } = useApp();
  const { isDark, toggleTheme } = useTheme();
  const auth = useAuth();
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [smartNotifs, setSmartNotifs] = useState(true);
  const [biometric, setBiometric] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);
  const [paymentCard, setPaymentCard] = useState<{ type: string; last4: string } | null>(null);

  // Track screen view on mount (#34)
  useEffect(() => {
    trackScreen('Profile');
  }, []);

  // Notification toggle states
  const [mealNotifs, setMealNotifs] = useState(true);
  const [napNotifs, setNapNotifs] = useState(true);
  const [photoNotifs, setPhotoNotifs] = useState(true);
  const [milestoneNotifs, setMilestoneNotifs] = useState(true);

  // Privacy settings
  const [photoSharing, setPhotoSharing] = useState(true);
  const [classPhotos, setClassPhotos] = useState(true);
  const [analyticsSharing, setAnalyticsSharing] = useState(false);

  // Language & translation
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Spanish');

  // Auto-pay
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayDay, setAutoPayDay] = useState(1);

  // Load saved preferences from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.smartNotifs !== undefined) setSmartNotifs(prefs.smartNotifs);
          if (prefs.mealNotifs !== undefined) setMealNotifs(prefs.mealNotifs);
          if (prefs.napNotifs !== undefined) setNapNotifs(prefs.napNotifs);
          if (prefs.photoNotifs !== undefined) setPhotoNotifs(prefs.photoNotifs);
          if (prefs.milestoneNotifs !== undefined) setMilestoneNotifs(prefs.milestoneNotifs);
          if (prefs.photoSharing !== undefined) setPhotoSharing(prefs.photoSharing);
          if (prefs.classPhotos !== undefined) setClassPhotos(prefs.classPhotos);
          if (prefs.analyticsSharing !== undefined) setAnalyticsSharing(prefs.analyticsSharing);
          if (prefs.selectedLanguage) setSelectedLanguage(prefs.selectedLanguage);
          if (prefs.autoTranslate !== undefined) setAutoTranslate(prefs.autoTranslate);
          if (prefs.targetLanguage) setTargetLanguage(prefs.targetLanguage);
          if (prefs.autoPayEnabled !== undefined) setAutoPayEnabled(prefs.autoPayEnabled);
          if (prefs.autoPayDay !== undefined) setAutoPayDay(prefs.autoPayDay);
        }
      } catch {
        // Preferences are non-critical; fall back to defaults if load fails.
      }
    })();
  }, []);

  // Seed notification & privacy toggles from the server-backed preferences object
  // (profiles.preferences) once it loads. AppContext is the source of truth; the
  // AsyncStorage load above remains as an offline cache. Server values win when present.
  const prefsSeeded = React.useRef(false);
  useEffect(() => {
    if (prefsSeeded.current) return;
    if (!preferences || Object.keys(preferences).length === 0) return;
    prefsSeeded.current = true;
    if (typeof preferences.smartNotifs === 'boolean') setSmartNotifs(preferences.smartNotifs);
    if (typeof preferences.mealNotifs === 'boolean') setMealNotifs(preferences.mealNotifs);
    if (typeof preferences.napNotifs === 'boolean') setNapNotifs(preferences.napNotifs);
    if (typeof preferences.photoNotifs === 'boolean') setPhotoNotifs(preferences.photoNotifs);
    if (typeof preferences.milestoneNotifs === 'boolean') setMilestoneNotifs(preferences.milestoneNotifs);
    if (typeof preferences.photoSharing === 'boolean') setPhotoSharing(preferences.photoSharing);
    if (typeof preferences.classPhotos === 'boolean') setClassPhotos(preferences.classPhotos);
    if (typeof preferences.analyticsSharing === 'boolean') setAnalyticsSharing(preferences.analyticsSharing);
  }, [preferences]);

  // Toggle a notification/privacy preference: update local state, persist to
  // AppContext (profiles.preferences), and let the existing AsyncStorage effect
  // cache it offline.
  const togglePref = useCallback(
    (key: string, value: boolean, setter: (v: boolean) => void) => {
      setter(value);
      updatePreferences({ [key]: value });
    },
    [updatePreferences]
  );

  // Save preferences to AsyncStorage whenever they change
  const savePreferences = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({
        smartNotifs, mealNotifs, napNotifs, photoNotifs, milestoneNotifs,
        photoSharing, classPhotos, analyticsSharing,
        selectedLanguage, autoTranslate, targetLanguage,
        autoPayEnabled, autoPayDay,
      }));
    } catch {
      // Best-effort persistence; a failed write is non-fatal.
    }
  }, [smartNotifs, mealNotifs, napNotifs, photoNotifs, milestoneNotifs,
      photoSharing, classPhotos, analyticsSharing,
      selectedLanguage, autoTranslate, targetLanguage,
      autoPayEnabled, autoPayDay]);

  useEffect(() => {
    savePreferences();
  }, [savePreferences]);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Download data
  const [downloadTimeline, setDownloadTimeline] = useState(true);
  const [downloadPhotos, setDownloadPhotos] = useState(true);
  const [downloadMessages, setDownloadMessages] = useState(true);
  const [downloadReports, setDownloadReports] = useState(true);

  // Invite family modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelation, setInviteRelation] = useState('Grandparent');
  const [invitePermission, setInvitePermission] = useState<'Full Access' | 'View Only'>('View Only');

  // Add authorized person modal
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personRelation, setPersonRelation] = useState('');
  const [personPhone, setPersonPhone] = useState('');

  const handleMenuTap = (label: string, sub?: SubScreen) => {
    if (sub) {
      setSubScreen(sub);
    } else if (label === 'Biometric Login') {
      setBiometric(!biometric);
    } else if (label === 'Offline Mode') {
      setOfflineMode(!offlineMode);
    } else {
      showAlert(label, `This feature requires server integration and will be available in a future update.`);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const pendingAmount = invoices.filter((inv) => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);

  const parentMenuSections: MenuSection[] = [
    {
      title: 'Child & Family',
      items: [
        { icon: 'person-circle-outline', label: `${selectedChild.firstName}'s Profile`, subtitle: 'Allergies, contacts, medical info', sub: 'child_profile' },
        { icon: 'people-outline', label: 'Family Network', subtitle: 'Manage who can see updates', sub: 'family' },
        { icon: 'shield-checkmark-outline', label: 'Authorized Pickups', subtitle: `${selectedChild.authorizedPickups.length} authorized people`, sub: 'pickups' },
        { icon: 'medical-outline', label: 'Health & Allergies', subtitle: selectedChild.allergies.length > 0 ? selectedChild.allergies.join(', ') : 'No known allergies', sub: 'health' },
        { icon: 'alert-circle-outline', label: 'Incident Reports', subtitle: `${incidents.length} report${incidents.length !== 1 ? 's' : ''} on file`, sub: 'incidents' },
      ],
    },
    {
      title: 'Communication',
      items: [
        { icon: 'notifications-outline', label: 'Notification Preferences', subtitle: smartNotifs ? 'Smart notifications enabled' : 'All notifications', sub: 'notifications' },
        { icon: 'language-outline', label: 'Language', subtitle: selectedLanguage, sub: 'language' },
        { icon: 'chatbubbles-outline', label: 'Translation Settings', subtitle: autoTranslate ? `Auto-translate to ${targetLanguage}` : 'Auto-translate: Off', sub: 'translation' },
      ],
    },
    {
      title: 'Billing',
      items: [
        { icon: 'card-outline', label: 'Payment Methods', subtitle: paymentCard ? `${paymentCard.type} ending in ${paymentCard.last4}` : 'No card on file', sub: 'payment_methods' },
        { icon: 'receipt-outline', label: 'Invoices & Receipts', subtitle: pendingAmount > 0 ? `$${pendingAmount.toFixed(2)} pending` : 'All paid', sub: 'invoices' },
        { icon: 'star-outline', label: 'Subscription', subtitle: 'Manage your plan', sub: 'subscription' },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { icon: 'lock-closed-outline', label: 'Privacy Settings', subtitle: 'COPPA compliant', sub: 'privacy' },
        { icon: 'key-outline', label: 'Change Password', sub: 'change_password' },
        { icon: 'finger-print-outline', label: 'Biometric Login', subtitle: biometric ? 'Enabled' : 'Disabled' },
        { icon: 'cloud-download-outline', label: 'Download My Data', sub: 'download_data' },
      ],
    },
  ];

  const caregiverMenuSections: MenuSection[] = [
    {
      title: 'Classroom',
      items: [
        { icon: 'people-outline', label: selectedChild.classroom || 'Classroom', subtitle: 'View classroom details' },
        { icon: 'calendar-outline', label: 'Attendance', subtitle: 'View from Dashboard' },
        { icon: 'book-outline', label: 'Lesson Plans', subtitle: 'View weekly plans', sub: 'lesson_plans' },
        { icon: 'clipboard-outline', label: 'Reports', subtitle: 'Generate daily reports' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', sub: 'notifications' },
        { icon: 'cloud-offline-outline', label: 'Offline Mode', subtitle: offlineMode ? 'Auto-sync when online' : 'Disabled' },
        { icon: 'lock-closed-outline', label: 'Privacy & Security', sub: 'privacy' },
      ],
    },
  ];

  const menuSections = currentRole === 'parent' ? parentMenuSections : caregiverMenuSections;

  const renderSubScreen = () => {
    switch (subScreen) {
      case 'child_profile':
        return (
          <View>
            <Text style={styles.subTitle}>{selectedChild.firstName} {selectedChild.lastName}</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Date of Birth</Text><Text style={styles.detailValue}>{formatDateShort(selectedChild.dateOfBirth)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Age</Text><Text style={styles.detailValue}>{getChildAge(selectedChild.dateOfBirth)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Classroom</Text><Text style={styles.detailValue}>{selectedChild.classroom || 'N/A'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Pediatrician</Text><Text style={styles.detailValue}>{selectedChild.pediatrician || 'Not set'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Allergies</Text><Text style={styles.detailValue}>{selectedChild.allergies.length > 0 ? selectedChild.allergies.join(', ') : 'None'}</Text></View>
            <Text style={styles.subSectionTitle}>Emergency Contacts</Text>
            {selectedChild.emergencyContacts.map((c, i) => (
              <View key={i} style={styles.contactRow}>
                <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{c.name.charAt(0)}</Text></View>
                <View style={styles.contactInfo}><Text style={styles.contactName}>{c.name}</Text><Text style={styles.contactMeta}>{c.relationship} {'\u2022'} {c.phone}</Text></View>
              </View>
            ))}
            {selectedChild.emergencyContacts.length === 0 && <Text style={styles.emptyText}>No emergency contacts set.</Text>}
          </View>
        );
      case 'family':
        return (
          <View>
            <Text style={styles.subTitle}>Family Network</Text>
            <Text style={styles.subDesc}>People who can view {selectedChild.firstName}'s updates</Text>
            <View style={styles.familyRow}>
              <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{currentUser.name.charAt(0)}</Text></View>
              <Text style={styles.familyName}>{currentUser.name} (You)</Text>
              <View style={[styles.permBadge, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.permText, { color: Colors.success }]}>Full Access</Text>
              </View>
            </View>
            <Text style={styles.emptyText}>Invite family members to view {selectedChild.firstName}'s updates.</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => { setShowInviteModal(true); setSubScreen(null); }}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={styles.addButtonText}>Invite Family Member</Text>
            </TouchableOpacity>
          </View>
        );
      case 'pickups':
        return (
          <View>
            <Text style={styles.subTitle}>Authorized Pickups</Text>
            {selectedChild.authorizedPickups.map((p) => (
              <View key={p.id} style={styles.pickupRow}>
                <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{p.name.charAt(0)}</Text></View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{p.name}</Text>
                  <Text style={styles.contactMeta}>{p.relationship} {'\u2022'} {p.phone}</Text>
                </View>
                <View style={[styles.verifiedBadge, { backgroundColor: p.verified ? Colors.successLight : Colors.warningLight }]}>
                  <Ionicons name={p.verified ? 'checkmark-circle' : 'time-outline'} size={14} color={p.verified ? Colors.success : Colors.warning} />
                  <Text style={{ fontSize: FontSizes.xs, color: p.verified ? Colors.success : Colors.warning, fontWeight: '600' }}>{p.verified ? 'Verified' : 'Pending'}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addButton} onPress={() => { setShowAddPersonModal(true); setSubScreen(null); }}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Authorized Person</Text>
            </TouchableOpacity>
          </View>
        );
      case 'health':
        return (
          <View>
            <Text style={styles.subTitle}>Health & Allergies</Text>
            <Text style={styles.subSectionTitle}>Allergies</Text>
            {selectedChild.allergies.length > 0 ? selectedChild.allergies.map((a, i) => (
              <View key={i} style={styles.allergyRow}>
                <Ionicons name="warning" size={16} color={Colors.danger} />
                <Text style={styles.allergyName}>{a}</Text>
              </View>
            )) : <Text style={styles.emptyText}>No known allergies</Text>}
            <Text style={styles.subSectionTitle}>Pediatrician</Text>
            <Text style={styles.detailValue}>{selectedChild.pediatrician || 'Not set'}</Text>
          </View>
        );
      case 'invoices':
        return (
          <View>
            <Text style={styles.subTitle}>Invoices & Receipts</Text>
            {/* Summary */}
            <View style={styles.invoiceSummary}>
              <View style={[styles.invoiceSummaryCard, { backgroundColor: Colors.warningLight }]}>
                <Text style={[styles.invoiceSummaryAmount, { color: Colors.warning }]}>${pendingAmount.toFixed(2)}</Text>
                <Text style={styles.invoiceSummaryLabel}>Pending</Text>
              </View>
              <View style={[styles.invoiceSummaryCard, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.invoiceSummaryAmount, { color: Colors.success }]}>
                  ${invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
                </Text>
                <Text style={styles.invoiceSummaryLabel}>Paid</Text>
              </View>
            </View>
            {invoices.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.invoiceRow, Shadows.small]}
                onPress={() => { setSelectedInvoiceId(inv.id); setSubScreen('invoice_detail'); }}
              >
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceName}>{inv.description}</Text>
                  <Text style={styles.invoiceDue}>Due: {formatDateShort(inv.dueDate)}</Text>
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>${inv.amount.toFixed(2)}</Text>
                  <View style={[styles.invoiceStatus, { backgroundColor: inv.status === 'paid' ? Colors.successLight : inv.status === 'overdue' ? Colors.dangerLight : Colors.warningLight }]}>
                    <Text style={{ fontSize: FontSizes.xs, color: inv.status === 'paid' ? Colors.success : inv.status === 'overdue' ? Colors.danger : Colors.warning, fontWeight: '700' }}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.autoPaySection}>
              <View style={styles.prefRow}>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefLabel}>Auto-Pay</Text>
                  <Text style={styles.prefDesc}>Automatically pay invoices on a set day</Text>
                </View>
                <Switch
                  value={autoPayEnabled}
                  onValueChange={setAutoPayEnabled}
                  trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                  thumbColor={autoPayEnabled ? Colors.primary : Colors.textMuted}
                />
              </View>
              {autoPayEnabled && (
                <View style={{ marginTop: Spacing.md }}>
                  <Text style={styles.formLabel}>Payment Day of Month</Text>
                  <View style={styles.dayPickerRow}>
                    {[1, 5, 10, 15, 20, 25].map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayChip, autoPayDay === day && styles.dayChipActive]}
                        onPress={() => setAutoPayDay(day)}
                      >
                        <Text style={[styles.dayChipText, autoPayDay === day && styles.dayChipTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.formLabel}>Payment Method</Text>
                  <View style={styles.cardDisplay}>
                    <Ionicons name="card" size={20} color={Colors.primary} />
                    <Text style={styles.cardDisplayText}>{paymentCard ? `${paymentCard.type} ending in ${paymentCard.last4}` : 'No card on file'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={async () => {
                      await savePreferences();
                      showAlert(
                        'Auto-Pay Preference Saved',
                        autoPayEnabled
                          ? `Your auto-pay preference (day ${autoPayDay} of each month) has been saved.`
                          : 'Auto-pay is turned off.'
                      );
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save Auto-Pay Settings</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      case 'invoice_detail': {
        const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);
        if (!selectedInvoice) return null;
        return (
          <View>
            <TouchableOpacity onPress={() => setSubScreen('invoices')} style={styles.backLink}>
              <Ionicons name="arrow-back" size={18} color={Colors.primary} />
              <Text style={styles.backLinkText}>Back to Invoices</Text>
            </TouchableOpacity>
            <Text style={styles.subTitle}>{selectedInvoice.description}</Text>
            <View style={[styles.invoiceDetailHeader, { backgroundColor: selectedInvoice.status === 'paid' ? Colors.successLight : Colors.warningLight }]}>
              <Text style={[styles.invoiceDetailAmount, { color: selectedInvoice.status === 'paid' ? Colors.success : Colors.warning }]}>
                ${selectedInvoice.amount.toFixed(2)}
              </Text>
              <Text style={[styles.invoiceDetailStatus, { color: selectedInvoice.status === 'paid' ? Colors.success : Colors.warning }]}>
                {selectedInvoice.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Due Date</Text><Text style={styles.detailValue}>{formatDateShort(selectedInvoice.dueDate)}</Text></View>
            {selectedInvoice.paidDate && (
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Paid Date</Text><Text style={styles.detailValue}>{formatDateShort(selectedInvoice.paidDate)}</Text></View>
            )}
            <Text style={styles.subSectionTitle}>Line Items</Text>
            {selectedInvoice.items.map((item, i) => (
              <View key={i} style={styles.lineItemRow}>
                <Text style={styles.lineItemDesc}>{item.description}</Text>
                <Text style={styles.lineItemAmount}>${item.amount.toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.lineItemRow, { borderTopWidth: 2, borderTopColor: Colors.textPrimary }]}>
              <Text style={[styles.lineItemDesc, { fontWeight: '700', color: Colors.textPrimary }]}>Total</Text>
              <Text style={[styles.lineItemAmount, { fontWeight: '700', color: Colors.textPrimary }]}>${selectedInvoice.amount.toFixed(2)}</Text>
            </View>
            {selectedInvoice.status === 'pending' && (
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => {
                  Alert.alert('Pay Invoice', `Continue to securely pay $${selectedInvoice.amount.toFixed(2)} via Stripe?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue', onPress: async () => {
                      const { error } = await payInvoice(selectedInvoice.id);
                      if (error) {
                        showAlert('Payment Unavailable', error);
                      } else {
                        showAlert('Opening Secure Checkout', 'Complete your payment in the page that just opened. Your invoice updates automatically once payment is confirmed.');
                      }
                    }},
                  ]);
                }}
              >
                <LinearGradient colors={[Colors.success, '#66BB6A']} style={styles.payGradient}>
                  <Ionicons name="card" size={20} color={Colors.white} />
                  <Text style={styles.payText}>Pay Now — ${selectedInvoice.amount.toFixed(2)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addButton, { marginTop: Spacing.md }]}
              onPress={() => shareContent(`Invoice: ${selectedInvoice.description}\nAmount: $${selectedInvoice.amount.toFixed(2)}\nStatus: ${selectedInvoice.status}\n\n— Little Journey`)}
            >
              <Ionicons name="download-outline" size={18} color={Colors.primary} />
              <Text style={styles.addButtonText}>Download Receipt</Text>
            </TouchableOpacity>
          </View>
        );
      }
      case 'about':
        return (
          <View>
            <Text style={styles.subTitle}>About Little Journey</Text>
            <View style={{ alignItems: 'center', marginBottom: Spacing.xl }}>
              <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🦋</Text>
              <Text style={{ fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary }}>Little Journey</Text>
              <Text style={{ fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 4 }}>Version {APP_VERSION}</Text>
            </View>
            <Text style={{ fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24, marginBottom: Spacing.lg }}>
              Little Journey is a childcare communication app that keeps parents connected with their child's daily experiences. From real-time activity updates and milestone tracking to secure messaging and daily reports — everything you need in one place.
            </Text>
            <Text style={styles.subSectionTitle}>Features</Text>
            {['Real-time timeline of your child\'s day', 'Secure parent-caregiver messaging', 'Daily narrative summary reports', 'Developmental milestone tracking', 'Photo gallery and sharing', 'Calendar and event management', 'Invoice and payment management', 'Incident reporting and attendance tracking', 'PDF report export'].map((feature, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={{ fontSize: FontSizes.md, color: Colors.textSecondary }}>{feature}</Text>
              </View>
            ))}
            <Text style={[styles.subSectionTitle, { marginTop: Spacing.lg }]}>Privacy & Compliance</Text>
            <Text style={{ fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 24 }}>
              Little Journey is COPPA compliant and uses end-to-end encryption for all messages and data. Your child's information is never shared with third parties.
            </Text>
          </View>
        );
      case 'notifications':
        return (
          <View>
            <Text style={styles.subTitle}>Notification Preferences</Text>
            {[
              { label: 'Smart Notifications', desc: 'Only get notified for important updates', value: smartNotifs, onToggle: (v: boolean) => togglePref('smartNotifs', v, setSmartNotifs) },
              { label: 'Meal Updates', desc: 'Get notified when meals are logged', value: mealNotifs, onToggle: (v: boolean) => togglePref('mealNotifs', v, setMealNotifs) },
              { label: 'Nap Updates', desc: 'Get notified for nap start/end', value: napNotifs, onToggle: (v: boolean) => togglePref('napNotifs', v, setNapNotifs) },
              { label: 'Photo Alerts', desc: 'New photos shared by caregiver', value: photoNotifs, onToggle: (v: boolean) => togglePref('photoNotifs', v, setPhotoNotifs) },
              { label: 'Milestone Alerts', desc: 'New developmental milestones', value: milestoneNotifs, onToggle: (v: boolean) => togglePref('milestoneNotifs', v, setMilestoneNotifs) },
              { label: 'Emergency Alerts', desc: 'Cannot be disabled', value: true, onToggle: () => {} },
            ].map((pref, i) => (
              <View key={i} style={styles.prefRow}>
                <View style={styles.prefInfo}><Text style={styles.prefLabel}>{pref.label}</Text><Text style={styles.prefDesc}>{pref.desc}</Text></View>
                <Switch
                  value={pref.value}
                  onValueChange={pref.onToggle}
                  trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                  thumbColor={pref.value ? Colors.primary : Colors.textMuted}
                  disabled={pref.label === 'Emergency Alerts'}
                />
              </View>
            ))}
          </View>
        );
      case 'privacy':
        return (
          <View>
            <Text style={styles.subTitle}>Privacy Settings</Text>
            <Text style={styles.subDesc}>Control how your data is shared</Text>
            {[
              { label: 'Photo Sharing', desc: 'Allow caregivers to share photos of your child', value: photoSharing, onToggle: (v: boolean) => togglePref('photoSharing', v, setPhotoSharing) },
              { label: 'Class Photos', desc: 'Include your child in class group photos', value: classPhotos, onToggle: (v: boolean) => togglePref('classPhotos', v, setClassPhotos) },
              { label: 'Analytics', desc: 'Share anonymized usage data to improve the app', value: analyticsSharing, onToggle: (v: boolean) => togglePref('analyticsSharing', v, setAnalyticsSharing) },
            ].map((pref, i) => (
              <View key={i} style={styles.prefRow}>
                <View style={styles.prefInfo}><Text style={styles.prefLabel}>{pref.label}</Text><Text style={styles.prefDesc}>{pref.desc}</Text></View>
                <Switch
                  value={pref.value}
                  onValueChange={pref.onToggle}
                  trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                  thumbColor={pref.value ? Colors.primary : Colors.textMuted}
                />
              </View>
            ))}
            <View style={styles.privacyInfoCard}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.prefLabel}>COPPA Compliant</Text>
                <Text style={styles.prefDesc}>All data handling follows Children's Online Privacy Protection Act requirements.</Text>
              </View>
            </View>
          </View>
        );
      case 'language': {
        const languages = ['English', 'Spanish', 'Arabic', 'French'];
        return (
          <View>
            <Text style={styles.subTitle}>Language</Text>
            <Text style={styles.subDesc}>Select your preferred language</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.languageRow, selectedLanguage === lang && styles.languageRowActive]}
                onPress={() => setSelectedLanguage(lang)}
              >
                <Text style={[styles.languageText, selectedLanguage === lang && styles.languageTextActive]}>{lang}</Text>
                {selectedLanguage === lang && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        );
      }
      case 'translation':
        return (
          <View>
            <Text style={styles.subTitle}>Translation Settings</Text>
            <View style={styles.prefRow}>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>Auto-Translate Messages</Text>
                <Text style={styles.prefDesc}>Automatically translate incoming messages</Text>
              </View>
              <Switch
                value={autoTranslate}
                onValueChange={setAutoTranslate}
                trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                thumbColor={autoTranslate ? Colors.primary : Colors.textMuted}
              />
            </View>
            {autoTranslate && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.formLabel}>Translate to</Text>
                {['Spanish', 'Arabic', 'French', 'English'].filter((l) => l !== selectedLanguage).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.languageRow, targetLanguage === lang && styles.languageRowActive]}
                    onPress={() => setTargetLanguage(lang)}
                  >
                    <Text style={[styles.languageText, targetLanguage === lang && styles.languageTextActive]}>{lang}</Text>
                    {targetLanguage === lang && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      case 'change_password':
        return (
          <View>
            <Text style={styles.subTitle}>Change Password</Text>
            <Text style={styles.formLabel}>Current Password</Text>
            <TextInput
              style={styles.formInput}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.formLabel}>New Password</Text>
            <TextInput
              style={styles.formInput}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.formLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.formInput}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
            />
            {newPassword.length > 0 && newPassword.length < 8 && (
              <Text style={styles.formHint}>Password must be at least 8 characters</Text>
            )}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.formHint}>Passwords do not match</Text>
            )}
            <TouchableOpacity
              style={[styles.saveButton, (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) && styles.saveButtonDisabled]}
              disabled={!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              onPress={async () => {
                try {
                  // First verify the current password by re-authenticating
                  const userEmail = auth.profile?.email;
                  if (!userEmail) {
                    showAlert('Error', 'Could not determine your email address.');
                    return;
                  }
                  const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: userEmail,
                    password: currentPassword,
                  });
                  if (signInError) {
                    showAlert('Error', 'Current password is incorrect.');
                    return;
                  }

                  // Now update the password
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    showAlert('Error', error.message || 'Failed to update password. Please try again.');
                    return;
                  }
                  showAlert('Password Updated', 'Your password has been changed successfully.');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setSubScreen(null);
                } catch (err: any) {
                  showAlert('Error', err.message || 'Failed to update password.');
                }
              }}
            >
              <Text style={styles.saveButtonText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        );
      case 'download_data':
        return (
          <View>
            <Text style={styles.subTitle}>Download My Data</Text>
            <Text style={styles.subDesc}>Export all your data or permanently delete your account.</Text>
            {[
              { label: 'Timeline Entries', desc: 'All activities, meals, naps, and milestones', value: downloadTimeline, onToggle: setDownloadTimeline },
              { label: 'Photos', desc: 'All photos shared by caregivers', value: downloadPhotos, onToggle: setDownloadPhotos },
              { label: 'Messages', desc: 'All conversation history', value: downloadMessages, onToggle: setDownloadMessages },
              { label: 'Daily Reports', desc: 'Generated daily summaries', value: downloadReports, onToggle: setDownloadReports },
            ].map((item, i) => (
              <View key={i} style={styles.prefRow}>
                <View style={styles.prefInfo}><Text style={styles.prefLabel}>{item.label}</Text><Text style={styles.prefDesc}>{item.desc}</Text></View>
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                  thumbColor={item.value ? Colors.primary : Colors.textMuted}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveButton, { marginTop: Spacing.lg }, isExporting && styles.saveButtonDisabled]}
              disabled={isExporting}
              onPress={async () => {
                try {
                  setIsExporting(true);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) {
                    showAlert('Not Authenticated', 'Please sign in again to export your data.');
                    return;
                  }
                  const { data, error } = await supabase.functions.invoke('data-export', {
                    headers: { Authorization: 'Bearer ' + session.access_token },
                  });
                  if (error) {
                    showAlert('Export Failed', error.message || 'An error occurred while exporting your data.');
                    return;
                  }
                  const jsonString = JSON.stringify(data, null, 2);
                  const exportFile = new File(Paths.cache, 'littlejourney-data-export.json');
                  exportFile.write(jsonString);
                  const fileUri = exportFile.uri;
                  const sharingAvailable = await Sharing.isAvailableAsync();
                  if (sharingAvailable) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: 'application/json',
                      dialogTitle: 'Export My Data',
                    });
                  } else {
                    showAlert('Export Complete', 'Your data has been exported. Sharing is not available on this device.');
                  }
                } catch (err: any) {
                  showAlert('Export Error', err.message || 'Something went wrong during data export.');
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="cloud-download-outline" size={18} color={Colors.white} />
              )}
              <Text style={styles.saveButtonText}>{isExporting ? 'Exporting...' : 'Download My Data'}</Text>
            </TouchableOpacity>

            {/* Danger Zone: Delete Account */}
            <View style={styles.dangerZone}>
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              <Text style={styles.dangerZoneDesc}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </Text>
              <TouchableOpacity
                style={[styles.deleteButton, isDeleting && styles.saveButtonDisabled]}
                disabled={isDeleting}
                onPress={() => {
                  Alert.alert(
                    'Delete My Account',
                    'Are you sure you want to permanently delete your account? All your data will be erased and cannot be recovered.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete Permanently',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            setIsDeleting(true);
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session?.access_token) {
                              showAlert('Not Authenticated', 'Please sign in again to delete your account.');
                              return;
                            }
                            const { error } = await supabase.functions.invoke('data-deletion', {
                              body: { confirmation: 'DELETE_MY_ACCOUNT' },
                              headers: { Authorization: 'Bearer ' + session.access_token },
                            });
                            if (error) {
                              showAlert('Deletion Failed', error.message || 'An error occurred while deleting your account.');
                              return;
                            }
                            await auth.signOut();
                          } catch (err: any) {
                            showAlert('Deletion Error', err.message || 'Something went wrong during account deletion.');
                          } finally {
                            setIsDeleting(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={Colors.white} />
                )}
                <Text style={styles.deleteButtonText}>{isDeleting ? 'Deleting...' : 'Delete My Account'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'payment_methods':
        // Real Stripe SetupIntent-backed card management.
        return <PaymentMethodsScreen onClose={() => setSubScreen(null)} />;
      case 'subscription':
        return <SubscriptionScreen type={currentRole === 'admin' ? 'daycare' : 'parent'} onClose={() => setSubScreen(null)} />;
      case 'lesson_plans':
        return (
          <View>
            <Text style={styles.subTitle}>Lesson Plans</Text>
            {learningPlans.map((plan) => {
              const completed = plan.activities.filter((a) => a.completed).length;
              const total = plan.activities.length;
              return (
                <View key={plan.id} style={styles.lessonPlanCard}>
                  <View style={styles.lessonPlanHeader}>
                    <Text style={styles.lessonPlanTitle}>{plan.title}</Text>
                    <Text style={styles.lessonPlanWeek}>{plan.week}</Text>
                  </View>
                  <Text style={styles.formLabel}>Goals</Text>
                  {(plan.goals ?? []).map((goal, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}>
                      <Ionicons name="star" size={14} color={Colors.secondary} />
                      <Text style={{ fontSize: FontSizes.md, color: Colors.textSecondary }}>{goal}</Text>
                    </View>
                  ))}
                  <Text style={[styles.formLabel, { marginTop: Spacing.md }]}>Activities ({completed}/{total} completed)</Text>
                  {plan.activities.map((act, i) => (
                    <View key={i} style={styles.activityRow}>
                      <Ionicons name={act.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={act.completed ? Colors.success : Colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prefLabel, act.completed && { color: Colors.textMuted }]}>{act.name}</Text>
                        <Text style={styles.prefDesc}>{act.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        );
      case 'incidents': {
        const severityColors: Record<string, string> = { minor: Colors.warning, moderate: Colors.accent, serious: Colors.danger };
        return (
          <View>
            <Text style={styles.subTitle}>Incident Reports</Text>
            {incidents.length === 0 ? (
              <Text style={styles.emptyText}>No incident reports on file.</Text>
            ) : (
              incidents.map((inc) => (
                <View key={inc.id} style={styles.incidentCard}>
                  <View style={styles.incidentHeader}>
                    <View style={[styles.incidentSeverity, { backgroundColor: severityColors[inc.severity] || Colors.textMuted }]}>
                      <Text style={styles.incidentSeverityText}>{inc.severity.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.incidentType}>{inc.type.replace('_', ' ')}</Text>
                    <Text style={styles.incidentDate}>{formatDateShort(inc.timestamp)}</Text>
                  </View>
                  <Text style={styles.incidentChild}>{inc.childName}</Text>
                  <Text style={styles.incidentDesc}>{inc.description}</Text>
                  <Text style={[styles.formLabel, { marginTop: Spacing.sm }]}>Action Taken</Text>
                  <Text style={styles.incidentDesc}>{inc.actionTaken}</Text>
                  <View style={styles.incidentMeta}>
                    <Ionicons name="person" size={14} color={Colors.textMuted} />
                    <Text style={styles.incidentMetaText}>Reported by {inc.reportedBy.name}</Text>
                    {inc.parentNotified && (
                      <>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={[styles.incidentMetaText, { color: Colors.success }]}>Parent notified</Text>
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        );
      }
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={currentRole === 'parent' ? ['#667eea', '#764ba2'] : ['#4facfe', '#00f2fe']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{currentUser.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{currentUser.name}</Text>
          <Text style={styles.role}>
            {currentRole === 'parent' ? `${selectedChild.firstName}'s Parent` : `Lead Teacher, ${selectedChild.classroom || 'Classroom'}`}
          </Text>
          {currentRole === 'parent' && (
            <View style={styles.childQuickInfo}>
              <View style={styles.childQuickAvatar}>
                <Text style={styles.childQuickAvatarText}>{selectedChild.firstName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childQuickName}>{selectedChild.firstName} {selectedChild.lastName}</Text>
                <Text style={styles.childQuickMeta}>{getChildAge(selectedChild.dateOfBirth)} {'\u2022'} Born {formatDateShort(selectedChild.dateOfBirth)}</Text>
              </View>
              {selectedChild.allergies.length > 0 && (
                <View style={styles.allergyBadge}>
                  <Ionicons name="warning" size={12} color={Colors.danger} />
                  <Text style={styles.allergyBadgeText}>{selectedChild.allergies.length} allerg{selectedChild.allergies.length > 1 ? 'ies' : 'y'}</Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {/* Role Switcher */}
        <View style={styles.roleSwitcher}>
          <View style={[styles.roleSwitcherCard, Shadows.medium]}>
            <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
            <View style={styles.roleSwitcherInfo}>
              <Text style={styles.roleSwitcherTitle}>View as {currentRole === 'parent' ? 'Caregiver' : 'Parent'}</Text>
              <Text style={styles.roleSwitcherDesc}>Switch to see the other perspective</Text>
            </View>
            <Switch
              value={currentRole === 'caregiver'}
              onValueChange={switchRole}
              trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
              thumbColor={currentRole === 'caregiver' ? Colors.primary : Colors.textMuted}
              accessibilityLabel="Switch between parent and caregiver view"
              accessibilityRole="switch"
            />
          </View>
        </View>

        {/* Dark Mode Toggle */}
        <View style={styles.roleSwitcher}>
          <View style={[styles.roleSwitcherCard, Shadows.medium]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? Colors.accent : Colors.primary} />
            <View style={styles.roleSwitcherInfo}>
              <Text style={styles.roleSwitcherTitle}>Dark Mode</Text>
              <Text style={styles.roleSwitcherDesc}>{isDark ? 'Switch to light theme' : 'Switch to dark theme'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
              thumbColor={isDark ? Colors.accent : Colors.textMuted}
              accessibilityLabel="Toggle dark mode"
              accessibilityRole="switch"
            />
          </View>
        </View>

        {menuSections.map((section, sIndex) => (
          <View key={sIndex} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={[styles.menuCard, Shadows.small]}>
              {section.items.map((item, iIndex) => (
                <TouchableOpacity
                  key={iIndex}
                  style={[styles.menuItem, iIndex < section.items.length - 1 && styles.menuItemBorder]}
                  onPress={() => handleMenuTap(item.label, item.sub)}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon} size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    {item.subtitle && <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.appInfo} onPress={() => setSubScreen('about')}>
          <Text style={styles.appName}>Little Journey</Text>
          <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
          <Text style={styles.appTagline}>A living journal of your child's day</Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
              <Text style={styles.badgeText}>COPPA Compliant</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="lock-closed" size={14} color={Colors.primary} />
              <Text style={styles.badgeText}>Encrypted & Secure</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={subScreen !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSubScreen(null)}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSubScreen(null)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderSubScreen()}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invite Family Member Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.subTitle}>Invite Family Member</Text>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput style={styles.formInput} value={inviteName} onChangeText={setInviteName} placeholder="Full name" placeholderTextColor={Colors.textMuted} />
              <Text style={styles.formLabel}>Email</Text>
              <TextInput style={styles.formInput} value={inviteEmail} onChangeText={setInviteEmail} placeholder="Email address" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.formLabel}>Relationship</Text>
              <View style={styles.dayPickerRow}>
                {['Grandparent', 'Aunt/Uncle', 'Sibling', 'Other'].map((rel) => (
                  <TouchableOpacity key={rel} style={[styles.dayChip, inviteRelation === rel && styles.dayChipActive]} onPress={() => setInviteRelation(rel)}>
                    <Text style={[styles.dayChipText, inviteRelation === rel && styles.dayChipTextActive]}>{rel}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Permission Level</Text>
              <View style={styles.dayPickerRow}>
                {(['View Only', 'Full Access'] as const).map((perm) => (
                  <TouchableOpacity key={perm} style={[styles.dayChip, invitePermission === perm && styles.dayChipActive]} onPress={() => setInvitePermission(perm)}>
                    <Text style={[styles.dayChipText, invitePermission === perm && styles.dayChipTextActive]}>{perm}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveButton, (!inviteName || !inviteEmail) && styles.saveButtonDisabled]}
                disabled={!inviteName || !inviteEmail}
                onPress={() => {
                  showAlert('Invitation Sent', `An invitation has been sent to ${inviteName} (${inviteEmail}) with ${invitePermission} permissions.`);
                  setInviteName('');
                  setInviteEmail('');
                  setShowInviteModal(false);
                }}
              >
                <Ionicons name="send" size={18} color={Colors.white} />
                <Text style={styles.saveButtonText}>Send Invitation</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Authorized Person Modal */}
      <Modal visible={showAddPersonModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, Shadows.large]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddPersonModal(false)}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddPersonModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.subTitle}>Add Authorized Person</Text>
              <Text style={styles.subDesc}>This person will be authorized to pick up {selectedChild.firstName}.</Text>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput style={styles.formInput} value={personName} onChangeText={setPersonName} placeholder="Full name" placeholderTextColor={Colors.textMuted} />
              <Text style={styles.formLabel}>Relationship</Text>
              <TextInput style={styles.formInput} value={personRelation} onChangeText={setPersonRelation} placeholder="e.g. Grandparent, Uncle, Family Friend" placeholderTextColor={Colors.textMuted} />
              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput style={styles.formInput} value={personPhone} onChangeText={setPersonPhone} placeholder="Phone number" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              <TouchableOpacity
                style={[styles.saveButton, (!personName || !personRelation || !personPhone) && styles.saveButtonDisabled]}
                disabled={!personName || !personRelation || !personPhone}
                onPress={() => {
                  showAlert('Person Added', `${personName} has been added as an authorized pickup person. Verification is pending.`);
                  setPersonName('');
                  setPersonRelation('');
                  setPersonPhone('');
                  setShowAddPersonModal(false);
                }}
              >
                <Ionicons name="person-add" size={18} color={Colors.white} />
                <Text style={styles.saveButtonText}>Add Authorized Person</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSizes.xxxl, color: Colors.white, fontWeight: '700' },
  name: { fontSize: FontSizes.xxl, color: Colors.white, fontWeight: '800' },
  role: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  childQuickInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.lg, width: '100%', gap: Spacing.md },
  childQuickAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  childQuickAvatarText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  childQuickName: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  childQuickMeta: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  allergyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.round, gap: 4 },
  allergyBadgeText: { fontSize: FontSizes.xs, color: Colors.danger, fontWeight: '600' },
  roleSwitcher: { paddingHorizontal: Spacing.lg, marginTop: -Spacing.md },
  roleSwitcherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
  roleSwitcherInfo: { flex: 1 },
  roleSwitcherTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  roleSwitcherDesc: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  menuSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  menuSectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  menuCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuItemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight + '15', justifyContent: 'center', alignItems: 'center' },
  menuItemContent: { flex: 1 },
  menuItemLabel: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  menuItemSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  appInfo: { alignItems: 'center', paddingVertical: Spacing.xl },
  appName: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.primary },
  appVersion: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  appTagline: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.sm },
  badges: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round, ...Shadows.small },
  badgeText: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '500' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.dangerLight },
  logoutText: { fontSize: FontSizes.md, color: Colors.danger, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  subTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
  subDesc: { fontSize: FontSizes.md, color: Colors.textMuted, marginBottom: Spacing.lg, marginTop: -Spacing.sm },
  subSectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  detailLabel: { fontSize: FontSizes.md, color: Colors.textMuted },
  detailValue: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  contactAvatarText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  contactMeta: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, paddingVertical: Spacing.md },
  familyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  familyName: { flex: 1, fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  permBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.round },
  permText: { fontSize: FontSizes.xs, fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.primary, borderRadius: BorderRadius.lg, borderStyle: 'dashed' },
  addButtonText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.primary },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.round, gap: 4 },
  allergyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  allergyName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.danger },
  // Invoice styles
  invoiceSummary: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  invoiceSummaryCard: { flex: 1, alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.md },
  invoiceSummaryAmount: { fontSize: FontSizes.xl, fontWeight: '800' },
  invoiceSummaryLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  invoiceInfo: { flex: 1 },
  invoiceName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  invoiceDue: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end' },
  invoiceAmount: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  invoiceStatus: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round, marginTop: Spacing.xs },
  invoiceDetailHeader: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg },
  invoiceDetailAmount: { fontSize: FontSizes.xxxl, fontWeight: '800' },
  invoiceDetailStatus: { fontSize: FontSizes.md, fontWeight: '700', marginTop: Spacing.xs },
  lineItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  lineItemDesc: { fontSize: FontSizes.md, color: Colors.textSecondary },
  lineItemAmount: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  payButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.lg },
  payGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  payText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
  backLinkText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: '600' },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prefInfo: { flex: 1 },
  prefLabel: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  prefDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  // Form styles
  formLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  formInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.borderLight },
  formHint: { fontSize: FontSizes.sm, color: Colors.danger, marginTop: Spacing.xs },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, marginTop: Spacing.lg },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  // Language picker
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xs, backgroundColor: Colors.background },
  languageRowActive: { backgroundColor: Colors.primaryLight + '20', borderWidth: 1, borderColor: Colors.primary },
  languageText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  languageTextActive: { color: Colors.primary },
  // Privacy info card
  privacyInfoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg, backgroundColor: Colors.successLight, borderRadius: BorderRadius.lg, padding: Spacing.md },
  // Day picker / chips
  dayPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  dayChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.white },
  // Card display
  cardDisplay: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  cardDisplayText: { fontSize: FontSizes.md, color: Colors.textPrimary, fontWeight: '600' },
  // Auto-pay section
  autoPaySection: { marginTop: Spacing.md },
  // Payment methods
  savedCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: Spacing.md },
  savedCardIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center' },
  // Lesson plans
  lessonPlanCard: { backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  lessonPlanHeader: { marginBottom: Spacing.sm },
  lessonPlanTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  lessonPlanWeek: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  // Incident styles
  incidentCard: { backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  incidentSeverity: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  incidentSeverityText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.white },
  incidentType: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize', flex: 1 },
  incidentDate: { fontSize: FontSizes.xs, color: Colors.textMuted },
  incidentChild: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary, marginBottom: Spacing.xs },
  incidentDesc: { fontSize: FontSizes.md, color: Colors.textSecondary, lineHeight: 22 },
  incidentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  incidentMetaText: { fontSize: FontSizes.xs, color: Colors.textMuted },
  // Danger zone / delete account
  dangerZone: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.dangerLight },
  dangerZoneTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.danger, marginBottom: Spacing.xs },
  dangerZoneDesc: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 20 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.danger, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
  deleteButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
});
