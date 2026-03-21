import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useDriverStore } from '@/stores/driver';
import { PhotoCapture, type CapturedPhoto } from './PhotoCapture';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';
import { hapticError } from '@/services/haptics';

interface DeliveryFailureFlowProps {
  orderId: string;
  routeId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const FAILURE_REASONS = [
  { value: 'not_home', label: 'Recipient Not Home' },
  { value: 'refused', label: 'Delivery Refused' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'damaged', label: 'Package Damaged' },
  { value: 'other', label: 'Other' },
];

export function DeliveryFailureFlow({ orderId, routeId, onComplete, onCancel }: DeliveryFailureFlowProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadPodFiles, createPod, completeStop } = useDriverStore();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);

    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const files = photos.map((p) => ({
          data: p.base64,
          filename: p.filename,
          contentType: 'image/jpeg',
        }));
        photoUrls = await uploadPodFiles(orderId, files);
      }

      // Get current position
      let locationLat: number | undefined;
      let locationLng: number | undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        locationLat = loc.coords.latitude;
        locationLng = loc.coords.longitude;
      } catch {
        // GPS not available
      }

      // Create POD record if we have photos
      if (photoUrls.length > 0) {
        await createPod(orderId, {
          photoUrls,
          notes: `FAILED: ${FAILURE_REASONS.find((r) => r.value === reason)?.label}${notes ? ` - ${notes}` : ''}`,
          locationLat,
          locationLng,
        });
      }

      // Complete the stop as failed
      const failureReason = `${FAILURE_REASONS.find((r) => r.value === reason)?.label}${notes ? `: ${notes}` : ''}`;
      await completeStop(routeId, orderId, { status: 'failed', failureReason });
      hapticError();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report delivery failure');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <View style={[Base.screen, Base.center]}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Submitting failure report...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report Failed Delivery</Text>

      {/* Failure reason selector */}
      <View>
        <Text style={styles.label}>Reason for failure *</Text>
        <View style={styles.reasonList}>
          {FAILURE_REASONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              style={[
                styles.reasonBtn,
                reason === r.value && styles.reasonBtnActive,
              ]}
            >
              <View style={[styles.radio, reason === r.value && styles.radioActive]}>
                {reason === r.value && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Optional photo */}
      <View>
        <Text style={styles.label}>Photo evidence (optional)</Text>
        <PhotoCapture photos={photos} onChange={setPhotos} maxPhotos={2} />
      </View>

      {/* Notes */}
      <View>
        <Text style={styles.label}>Additional notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the situation..."
          placeholderTextColor={C.muted}
          maxLength={500}
          multiline
          textAlignVertical="top"
          style={styles.notesInput}
        />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={!reason}
          style={({ pressed }) => [
            styles.btn,
            styles.submitBtn,
            !reason && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.submitBtnText}>Report Failure</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    paddingTop: 16,
    gap: 16,
  },
  title: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.red,
  },
  label: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 8,
  },
  reasonList: {
    gap: 6,
  },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  reasonBtnActive: {
    backgroundColor: alpha(C.red, 0.08),
    borderColor: C.red,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: C.red,
    backgroundColor: C.red,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  reasonText: {
    fontSize: Size.md,
    color: C.text,
  },
  reasonTextActive: {
    color: C.red,
  },
  notesInput: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
    borderRadius: Radius.md,
    padding: 12,
    color: C.text,
    fontSize: Size.md,
    minHeight: 80,
  },
  errorBox: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: alpha(C.red, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.red, 0.19),
  },
  errorText: {
    color: C.red,
    fontSize: Size.sm,
  },
  loadingText: {
    color: C.dim,
    marginTop: Spacing.lg,
    fontSize: Size.md,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: C.muted,
  },
  cancelBtnText: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.dim,
  },
  submitBtn: {
    backgroundColor: C.red,
  },
  submitBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#fff',
  },
  disabled: {
    backgroundColor: C.muted,
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
