import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, BorderRadius, Spacing, FontSizes } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { daycareOnboardingSchema, classroomSchema } from '../../lib/validators';

export const DaycareOnboardingScreen: React.FC = () => {
  const { createDaycare, refreshProfile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Daycare info, 2: Classrooms, 3: Done
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Daycare info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [daycareEmail, setDaycareEmail] = useState('');

  // Step 2: Classrooms
  const [classrooms, setClassrooms] = useState<{ name: string; ageGroup: string }[]>([
    { name: '', ageGroup: '' },
  ]);
  const [daycareId, setDaycareId] = useState('');

  const handleCreateDaycare = async () => {
    setErrors({});
    const result = daycareOnboardingSchema.safeParse({ name, address, city, state, zip, phone, email: daycareEmail });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { daycareId: newId, error } = await createDaycare({
        name, address, city, state, zip, phone, email: daycareEmail,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setDaycareId(newId);
      setStep(2);
    } catch {
      Alert.alert('Error', 'Failed to create daycare. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    await refreshProfile();
    setStep(3);
    // The AppNavigator will automatically switch to the main app
    // once the profile has a daycare_id
  };

  const addClassroom = () => {
    setClassrooms([...classrooms, { name: '', ageGroup: '' }]);
  };

  const updateClassroom = (index: number, field: 'name' | 'ageGroup', value: string) => {
    const updated = [...classrooms];
    updated[index][field] = value;
    setClassrooms(updated);
  };

  const removeClassroom = (index: number) => {
    if (classrooms.length > 1) {
      setClassrooms(classrooms.filter((_, i) => i !== index));
    }
  };

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1 of 2</Text></View>
        <Text style={styles.stepTitle}>Tell us about your daycare</Text>
        <Text style={styles.stepDesc}>This information will be visible to parents and staff.</Text>
      </View>

      <Text style={styles.label}>Daycare Name *</Text>
      <View style={[styles.inputBox, errors.name && styles.inputBoxError]}>
        <Ionicons name="business-outline" size={18} color={Colors.textMuted} />
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Sunshine Academy" placeholderTextColor={Colors.textMuted} />
      </View>
      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

      <Text style={styles.label}>Address *</Text>
      <View style={[styles.inputBox, errors.address && styles.inputBoxError]}>
        <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street address" placeholderTextColor={Colors.textMuted} />
      </View>
      {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>City *</Text>
          <View style={[styles.inputBox, errors.city && styles.inputBoxError]}>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.textMuted} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>State *</Text>
          <View style={[styles.inputBox, errors.state && styles.inputBoxError]}>
            <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="TX" placeholderTextColor={Colors.textMuted} maxLength={2} autoCapitalize="characters" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>ZIP *</Text>
          <View style={[styles.inputBox, errors.zip && styles.inputBoxError]}>
            <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="78701" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={10} />
          </View>
        </View>
      </View>

      <Text style={styles.label}>Phone *</Text>
      <View style={[styles.inputBox, errors.phone && styles.inputBoxError]}>
        <Ionicons name="call-outline" size={18} color={Colors.textMuted} />
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 123-4567" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
      </View>
      {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

      <Text style={styles.label}>Email *</Text>
      <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
        <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
        <TextInput style={styles.input} value={daycareEmail} onChangeText={setDaycareEmail} placeholder="admin@yourdaycare.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
      </View>
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      {/* Trial info */}
      <View style={styles.trialCard}>
        <Ionicons name="gift-outline" size={24} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.trialTitle}>14-Day Free Trial</Text>
          <Text style={styles.trialDesc}>No credit card required. All features included.</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.nextBtn, isLoading && styles.btnDisabled]} onPress={handleCreateDaycare} disabled={isLoading}>
        <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
          {isLoading ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2 of 2</Text></View>
        <Text style={styles.stepTitle}>Add Classrooms</Text>
        <Text style={styles.stepDesc}>You can always add more later.</Text>
      </View>

      {classrooms.map((room, i) => (
        <View key={i} style={styles.classroomCard}>
          <View style={styles.classroomHeader}>
            <Text style={styles.classroomNum}>Classroom {i + 1}</Text>
            {classrooms.length > 1 && (
              <TouchableOpacity onPress={() => removeClassroom(i)}>
                <Ionicons name="close-circle" size={22} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.inputBox}>
            <TextInput style={styles.input} value={room.name} onChangeText={(v) => updateClassroom(i, 'name', v)} placeholder="e.g. Butterflies" placeholderTextColor={Colors.textMuted} />
          </View>
          <View style={[styles.inputBox, { marginTop: Spacing.sm }]}>
            <TextInput style={styles.input} value={room.ageGroup} onChangeText={(v) => updateClassroom(i, 'ageGroup', v)} placeholder="e.g. Toddlers (1-2)" placeholderTextColor={Colors.textMuted} />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addRoomBtn} onPress={addClassroom}>
        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        <Text style={styles.addRoomText}>Add Another Classroom</Text>
      </TouchableOpacity>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.skipStepBtn} onPress={handleFinish}>
          <Text style={styles.skipStepText}>Skip for Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
          <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.finishBtnGradient}>
            <Text style={styles.finishBtnText}>Finish Setup</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderStep3 = () => (
    <View style={styles.doneContainer}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={styles.doneTitle}>You're All Set!</Text>
      <Text style={styles.doneDesc}>Your daycare is ready. Start inviting caregivers and parents to join.</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      <Text style={styles.doneLoading}>Loading your dashboard...</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topBar}>
          <Text style={styles.topBarEmoji}>🏫</Text>
          <Text style={styles.topBarTitle}>Daycare Setup</Text>
        </LinearGradient>

        <View style={styles.formContainer}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  topBar: { paddingTop: 60, paddingBottom: Spacing.lg, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  topBarEmoji: { fontSize: 40 },
  topBarTitle: { fontSize: FontSizes.xl, color: Colors.white, fontWeight: '800', marginTop: Spacing.xs },
  formContainer: { padding: Spacing.lg },
  stepHeader: { marginBottom: Spacing.lg },
  stepBadge: { backgroundColor: Colors.primary + '20', alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round, marginBottom: Spacing.sm },
  stepBadgeText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary },
  stepTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  stepDesc: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  label: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight },
  inputBoxError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSizes.md, color: Colors.textPrimary },
  errorText: { fontSize: FontSizes.xs, color: Colors.danger, marginTop: 4 },
  trialCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary + '08', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.xl, borderWidth: 1, borderColor: Colors.primary + '20' },
  trialTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  trialDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  nextBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  btnDisabled: { opacity: 0.7 },
  nextBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  nextBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  // Step 2
  classroomCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.small },
  classroomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  classroomNum: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  addRoomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.primary + '40', borderStyle: 'dashed' },
  addRoomText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.primary },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  skipStepBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.borderLight },
  skipStepText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  finishBtn: { flex: 2, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  finishBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  finishBtnText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },
  // Step 3
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  doneEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  doneTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  doneDesc: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24 },
  doneLoading: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.md },
});
