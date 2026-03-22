import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

interface ReconciliationFlowProps {
  kitId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

interface KitItem {
  id: string;
  productName: string;
  quantity: number;
  trackingTag: string;
  orderId: string;
  recipientName: string;
  status?: string;
}

interface Kit {
  id: string;
  status: string;
  items: KitItem[];
}

interface Discrepancy {
  itemId: string;
  productName: string;
  expected: number;
  returned: number;
  difference: number;
}

interface ReconcileResponse {
  success: boolean;
  discrepancies?: Discrepancy[];
}

export function ReconciliationFlow({
  kitId,
  onComplete,
  onDismiss,
}: ReconciliationFlowProps) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[] | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Map of item id -> returned quantity (as string for TextInput)
  const [returnedQtys, setReturnedQtys] = useState<Record<string, string>>({});

  const fetchKit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Kit>(`/cannabis/kits/${kitId}`);
      setKit(data);

      // Pre-fill returned quantities
      const qtys: Record<string, string> = {};
      for (const item of data.items) {
        if (item.status === 'delivered') {
          qtys[item.id] = '0';
        } else {
          qtys[item.id] = String(item.quantity);
        }
      }
      setReturnedQtys(qtys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kit');
    } finally {
      setLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    fetchKit();
  }, [fetchKit]);

  const updateReturnedQty = (itemId: string, value: string) => {
    // Allow only non-negative integers
    const cleaned = value.replace(/[^0-9]/g, '');
    setReturnedQtys((prev) => ({ ...prev, [itemId]: cleaned }));
  };

  const handleSubmit = async () => {
    if (!kit) return;
    setSubmitting(true);
    setError(null);

    const returnedItems = kit.items.map((item) => ({
      itemId: item.id,
      quantityReturned: parseInt(returnedQtys[item.id] || '0', 10),
    }));

    try {
      const res = await api.post<ReconcileResponse>(
        `/cannabis/kits/${kitId}/reconcile`,
        { returnedItems, notes: notes || undefined },
      );

      setSubmitted(true);
      if (res.discrepancies && res.discrepancies.length > 0) {
        setDiscrepancies(res.discrepancies);
      } else {
        setDiscrepancies(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!kit || kit.items.length === 0) {
    return (
      <SafeAreaView style={Base.screen} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reconciliation</Text>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text style={styles.dismissText}>Close</Text>
          </Pressable>
        </View>
        <EmptyState
          title="No items to reconcile"
          description="This kit has no items to reconcile."
        />
      </SafeAreaView>
    );
  }

  // Post-submission: show discrepancies or success
  if (submitted) {
    return (
      <SafeAreaView style={Base.screen} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reconciliation</Text>
          <Pressable onPress={onComplete} hitSlop={12}>
            <Text style={styles.dismissText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {discrepancies && discrepancies.length > 0 ? (
            <>
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Discrepancies Found</Text>
                <Text style={styles.warningDesc}>
                  The following items have quantity mismatches. These have been flagged for review.
                </Text>
              </View>

              {discrepancies.map((d) => (
                <View key={d.itemId} style={styles.discrepancyCard}>
                  <Text style={styles.discrepancyProduct}>{d.productName}</Text>
                  <View style={styles.discrepancyRow}>
                    <Text style={styles.discrepancyLabel}>Expected returned</Text>
                    <Text style={styles.discrepancyValue}>{d.expected}</Text>
                  </View>
                  <View style={styles.discrepancyRow}>
                    <Text style={styles.discrepancyLabel}>Actual returned</Text>
                    <Text style={styles.discrepancyValue}>{d.returned}</Text>
                  </View>
                  <View style={styles.discrepancyRow}>
                    <Text style={styles.discrepancyLabel}>Difference</Text>
                    <Text
                      style={[
                        styles.discrepancyValue,
                        { color: d.difference > 0 ? C.green : C.red },
                      ]}
                    >
                      {d.difference > 0 ? '+' : ''}{d.difference}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Reconciliation Complete</Text>
              <Text style={styles.successDesc}>
                All items accounted for. No discrepancies found.
              </Text>
            </View>
          )}

          <Pressable
            onPress={onComplete}
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reconciliation</Text>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text style={styles.dismissText}>Close</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Enter the quantity returned for each item. Delivered items default to 0,
          undelivered items default to their full quantity.
        </Text>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Item list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {kit.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.trackingTag} &middot; Order ...{item.orderId.slice(-6)}
                  </Text>
                </View>
                <Text style={styles.itemStatus}>
                  {item.status === 'delivered' ? 'Delivered' : 'Undelivered'}
                </Text>
              </View>

              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>
                  Loaded: {item.quantity}
                </Text>
                <View style={styles.qtyInputWrap}>
                  <Text style={styles.qtyInputLabel}>Returned:</Text>
                  <TextInput
                    value={returnedQtys[item.id] || '0'}
                    onChangeText={(v) => updateReturnedQty(item.id, v)}
                    keyboardType="number-pad"
                    style={styles.qtyInput}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes about the return..."
              placeholderTextColor={C.muted}
              maxLength={1000}
              multiline
              textAlignVertical="top"
              style={styles.notesInput}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.cancelBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.submitBtn,
              { flex: 2 },
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting...' : 'Submit Reconciliation'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg2,
  },
  headerTitle: {
    fontSize: Size.xl,
    fontWeight: '700',
    color: C.text,
  },
  dismissText: {
    fontSize: Size.md,
    color: C.dim,
    minWidth: 44,
    minHeight: 44,
    textAlignVertical: 'center',
    textAlign: 'right',
    lineHeight: 44,
  },
  hint: {
    color: C.dim,
    fontSize: Size.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    lineHeight: 18,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  errorBox: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: alpha(C.red, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.red, 0.19),
  },
  errorText: {
    color: C.red,
    fontSize: Size.sm,
  },
  itemCard: {
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  productName: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.text,
  },
  itemMeta: {
    fontSize: Size.xs,
    color: C.muted,
    marginTop: 2,
  },
  itemStatus: {
    fontSize: Size.xs,
    fontWeight: '600',
    color: C.dim,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  qtyLabel: {
    fontSize: Size.sm,
    color: C.dim,
  },
  qtyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyInputLabel: {
    fontSize: Size.sm,
    color: C.dim,
  },
  qtyInput: {
    width: 56,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    color: C.text,
    fontSize: Size.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  notesSection: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  notesLabel: {
    fontSize: Size.sm,
    color: C.dim,
  },
  notesInput: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: C.text,
    fontSize: Size.md,
    minHeight: 80,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg2,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
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
    backgroundColor: C.accent,
  },
  submitBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#000',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  // Post-submission styles
  warningBox: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: alpha(C.yellow, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.yellow, 0.25),
  },
  warningTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.yellow,
    marginBottom: Spacing.xs,
  },
  warningDesc: {
    fontSize: Size.sm,
    color: C.dim,
    lineHeight: 18,
  },
  discrepancyCard: {
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  discrepancyProduct: {
    fontSize: Size.md,
    fontWeight: '600',
    color: C.text,
    marginBottom: Spacing.xs,
  },
  discrepancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discrepancyLabel: {
    fontSize: Size.sm,
    color: C.dim,
  },
  discrepancyValue: {
    fontSize: Size.sm,
    fontWeight: '600',
    color: C.text,
  },
  successBox: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: alpha(C.green, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.green, 0.25),
    alignItems: 'center',
  },
  successTitle: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.green,
    marginBottom: Spacing.xs,
  },
  successDesc: {
    fontSize: Size.md,
    color: C.dim,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: Spacing.md,
  },
  doneBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#000',
  },
});
