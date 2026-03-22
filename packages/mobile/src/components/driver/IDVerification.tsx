import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PhotoCapture, type CapturedPhoto } from './PhotoCapture';
import { C, Size, Spacing, Radius, alpha } from '@/theme';

export interface IDVerificationData {
  idPhoto: CapturedPhoto;
  idNumber: string;
  idDob: string;        // YYYY-MM-DD
  idExpirationDate: string; // YYYY-MM-DD
  idNameOnId: string;
  ageVerified: boolean;
  age: number;
  nameMatch: boolean;
}

interface IDVerificationProps {
  recipientName: string;
  minimumAge: number;
  onComplete: (data: IDVerificationData) => void;
}

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).sort().join(' ');
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const matching = wordsA.filter(w => wordsB.includes(w)).length;
  return matching / Math.max(wordsA.length, wordsB.length) >= 0.5;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function IDVerification({ recipientName, minimumAge, onComplete }: IDVerificationProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [idNumber, setIdNumber] = useState('');
  const [idNameOnId, setIdNameOnId] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [expiration, setExpiration] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showExpPicker, setShowExpPicker] = useState(false);

  const age = dob ? calculateAge(dob) : null;
  const ageOk = age !== null && age >= minimumAge;
  const nameOk = idNameOnId.length > 0 && fuzzyNameMatch(idNameOnId, recipientName);
  const idExpired = expiration ? expiration < new Date() : false;
  const canContinue = photos.length > 0 && idNumber.length >= 4 && idNameOnId.length > 0 && dob && expiration && ageOk && !idExpired;

  const handleContinue = () => {
    if (!canContinue || !dob || !expiration) return;
    onComplete({
      idPhoto: photos[0],
      idNumber: idNumber.slice(-4), // store only last 4
      idDob: formatDate(dob),
      idExpirationDate: formatDate(expiration),
      idNameOnId,
      ageVerified: ageOk,
      age: age!,
      nameMatch: nameOk,
    });
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.sectionTitle}>Scan / Photo Government ID</Text>
      <PhotoCapture photos={photos} onChange={setPhotos} maxPhotos={1} />

      <Text style={styles.sectionTitle}>ID Details</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Name on ID</Text>
        <TextInput
          value={idNameOnId}
          onChangeText={setIdNameOnId}
          placeholder="Full name as printed on ID"
          placeholderTextColor={C.muted}
          style={styles.input}
          autoCapitalize="words"
        />
        {idNameOnId.length > 0 && (
          <View style={[styles.badge, nameOk ? styles.badgeGreen : styles.badgeYellow]}>
            <Text style={styles.badgeText}>
              {nameOk ? 'Name matches order' : 'Name mismatch — verify carefully'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Date of Birth</Text>
        <Pressable onPress={() => setShowDobPicker(true)} style={styles.dateButton}>
          <Text style={[styles.dateText, !dob && { color: C.muted }]}>
            {dob ? formatDate(dob) : 'Tap to select DOB'}
          </Text>
        </Pressable>
        {(showDobPicker || Platform.OS === 'ios') && (
          <DateTimePicker
            value={dob ?? new Date(1990, 0, 1)}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, date) => {
              setShowDobPicker(false);
              if (date) setDob(date);
            }}
            themeVariant="dark"
          />
        )}
        {age !== null && (
          <View style={[styles.badge, ageOk ? styles.badgeGreen : styles.badgeRed]}>
            <Text style={styles.badgeText}>
              Age {age} — {ageOk ? `${minimumAge}+ verified` : `Under ${minimumAge} — CANNOT DELIVER`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ID Expiration Date</Text>
        <Pressable onPress={() => setShowExpPicker(true)} style={styles.dateButton}>
          <Text style={[styles.dateText, !expiration && { color: C.muted }]}>
            {expiration ? formatDate(expiration) : 'Tap to select expiration'}
          </Text>
        </Pressable>
        {(showExpPicker || Platform.OS === 'ios') && (
          <DateTimePicker
            value={expiration ?? new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowExpPicker(false);
              if (date) setExpiration(date);
            }}
            themeVariant="dark"
          />
        )}
        {idExpired && (
          <View style={[styles.badge, styles.badgeRed]}>
            <Text style={styles.badgeText}>ID is expired — CANNOT DELIVER</Text>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ID Number (last 4 digits)</Text>
        <TextInput
          value={idNumber}
          onChangeText={setIdNumber}
          placeholder="Last 4 digits"
          placeholderTextColor={C.muted}
          style={styles.input}
          maxLength={10}
          keyboardType="default"
        />
      </View>

      {!ageOk && age !== null && (
        <View style={[styles.badge, styles.badgeRed, { padding: 14 }]}>
          <Text style={[styles.badgeText, { fontSize: 14, fontWeight: '700' }]}>
            Customer is under {minimumAge}. Do not complete this delivery.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleContinue}
        disabled={!canContinue}
        style={({ pressed }) => [
          styles.continueBtn,
          !canContinue && styles.continueBtnDisabled,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.continueBtnText}>
          {!canContinue ? 'Complete all fields' : 'ID Verified — Continue'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  field: { gap: 6 },
  label: { fontSize: Size.sm, color: C.dim },
  input: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
    borderRadius: Radius.md,
    padding: 12,
    color: C.text,
    fontSize: Size.md,
  },
  dateButton: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
    borderRadius: Radius.md,
    padding: 12,
  },
  dateText: {
    color: C.text,
    fontSize: Size.md,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
  },
  badgeGreen: { backgroundColor: alpha(C.green, 0.12) },
  badgeYellow: { backgroundColor: alpha(C.yellow, 0.12) },
  badgeRed: { backgroundColor: alpha(C.red, 0.12) },
  badgeText: { fontSize: 12, fontWeight: '600', color: C.text },
  continueBtn: {
    backgroundColor: C.green,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  continueBtnDisabled: {
    backgroundColor: C.muted,
    opacity: 0.5,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
