import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useDriverStore } from '@/stores/driver';
import { PhotoCapture, type CapturedPhoto } from './PhotoCapture';
import { SignaturePad } from './SignaturePad';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';
import { hapticSuccess } from '@/services/haptics';

interface PODFlowProps {
  orderId: string;
  routeId: string;
  recipientName: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'photo' | 'signature' | 'notes' | 'confirm';
const STEPS: Step[] = ['photo', 'signature', 'notes', 'confirm'];

export function PODFlow({ orderId, routeId, recipientName, onComplete, onCancel }: PODFlowProps) {
  const [step, setStep] = useState<Step>('photo');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadPodFiles, createPod, completeStop } = useDriverStore();

  const stepIndex = STEPS.indexOf(step);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      let photoUrls: string[] = [];
      let signatureUrl: string | undefined;

      // Upload photos
      if (photos.length > 0) {
        const files = photos.map((p) => ({
          data: p.base64,
          filename: p.filename,
          contentType: 'image/jpeg',
        }));
        photoUrls = await uploadPodFiles(orderId, files);
      }

      // Upload signature
      if (signatureBase64) {
        const sigData = signatureBase64.split(',')[1] || signatureBase64;
        const sigUrls = await uploadPodFiles(orderId, [{
          data: sigData,
          filename: `signature-${Date.now()}.png`,
          contentType: 'image/png',
        }]);
        signatureUrl = sigUrls[0];
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

      // Create POD record
      await createPod(orderId, {
        signatureUrl,
        photoUrls,
        notes: notes || undefined,
        recipientNameSigned: recipientName,
        locationLat,
        locationLng,
      });

      // Complete the stop
      await completeStop(routeId, orderId, { status: 'delivered' });
      hapticSuccess();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit delivery proof');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <View style={[Base.screen, Base.center]}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Uploading delivery proof...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[Base.screen]} edges={['top']}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}
          />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {step === 'photo' && 'Take Photos'}
          {step === 'signature' && 'Get Signature'}
          {step === 'notes' && 'Add Notes'}
          {step === 'confirm' && 'Confirm Delivery'}
        </Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Step content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {step === 'photo' && (
          <View>
            <Text style={styles.hint}>
              Take photos of the delivered package at the doorstep
            </Text>
            <PhotoCapture photos={photos} onChange={setPhotos} />
          </View>
        )}

        {step === 'signature' && (
          <View>
            <Text style={styles.hint}>Have the recipient sign below</Text>
            <SignaturePad
              onAccept={(sig) => {
                setSignatureBase64(sig);
                goNext();
              }}
            />
            {signatureBase64 && (
              <Text style={styles.signatureCaptured}>Signature captured</Text>
            )}
          </View>
        )}

        {step === 'notes' && (
          <View>
            <Text style={styles.hint}>Add any delivery notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Left at front door, handed to neighbor..."
              placeholderTextColor={C.muted}
              maxLength={1000}
              multiline
              textAlignVertical="top"
              style={styles.notesInput}
            />
            <Text style={styles.charCount}>{notes.length}/1000</Text>
          </View>
        )}

        {step === 'confirm' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.hint}>Review delivery proof before submitting</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Recipient</Text>
              <Text style={styles.reviewValue}>{recipientName}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Photos</Text>
              <Text style={styles.reviewValue}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''} captured
              </Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Signature</Text>
              <Text style={styles.reviewValue}>
                {signatureBase64 ? 'Captured' : 'Not captured'}
              </Text>
            </View>

            {notes ? (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Notes</Text>
                <Text style={styles.reviewValueSmall}>{notes}</Text>
              </View>
            ) : null}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        {stepIndex > 0 && step !== 'signature' && (
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.btn, styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        )}

        {step === 'confirm' ? (
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [styles.btn, styles.confirmBtn, { flex: 2 }, pressed && styles.pressed]}
          >
            <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
          </Pressable>
        ) : step !== 'signature' ? (
          <Pressable
            onPress={goNext}
            style={({ pressed }) => [styles.btn, styles.nextBtn, pressed && styles.pressed]}
          >
            <Text style={styles.nextBtnText}>
              {step === 'photo' && photos.length === 0 ? 'Skip Photos' : 'Next'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stepBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: C.bg2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  stepDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.muted,
  },
  stepDotActive: {
    backgroundColor: C.accent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
  },
  cancelText: {
    fontSize: Size.md,
    color: C.dim,
    minWidth: 44,
    minHeight: 44,
    textAlignVertical: 'center',
    textAlign: 'right',
    lineHeight: 44,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
  },
  hint: {
    color: C.dim,
    fontSize: Size.sm,
    marginBottom: Spacing.lg,
  },
  signatureCaptured: {
    fontSize: Size.sm,
    color: C.green,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  notesInput: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
    borderRadius: Radius.md,
    padding: 12,
    color: C.text,
    fontSize: Size.md,
    minHeight: 120,
  },
  charCount: {
    fontSize: 11,
    color: C.dim,
    textAlign: 'right',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: C.bg3,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  reviewLabel: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  reviewValueSmall: {
    fontSize: Size.md,
    color: C.text,
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
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg2,
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
  backBtn: {
    borderWidth: 1,
    borderColor: C.muted,
  },
  backBtnText: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.dim,
  },
  nextBtn: {
    backgroundColor: C.accent,
  },
  nextBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#000',
  },
  confirmBtn: {
    backgroundColor: C.green,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  pressed: {
    opacity: 0.8,
  },
});
