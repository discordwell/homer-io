import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { C, Size, Spacing, Radius, alpha, Base } from '@/theme';

interface CashCollectionProps {
  orderId: string;
  expectedAmount: number;
  onComplete: (collected: number) => void;
  onSkip: () => void;
}

export function CashCollection({
  orderId: _orderId,
  expectedAmount,
  onComplete,
  onSkip,
}: CashCollectionProps) {
  const [inputValue, setInputValue] = useState(expectedAmount.toFixed(2));

  const collectedAmount = parseFloat(inputValue) || 0;
  const difference = collectedAmount - expectedAmount;
  const hasMismatch = inputValue.length > 0 && Math.abs(difference) >= 0.01;

  const handleChangeText = (text: string) => {
    // Allow only digits and a single decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setInputValue(cleaned);
  };

  const handleCollected = () => {
    onComplete(collectedAmount);
  };

  return (
    <View style={styles.container}>
      {/* Expected amount */}
      <View style={styles.expectedSection}>
        <Text style={styles.expectedLabel}>Expected Amount</Text>
        <Text style={styles.expectedAmount}>${expectedAmount.toFixed(2)}</Text>
      </View>

      {/* Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Amount Collected</Text>
        <View style={styles.inputRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            value={inputValue}
            onChangeText={handleChangeText}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={C.muted}
            selectTextOnFocus
          />
        </View>
      </View>

      {/* Mismatch warning */}
      {hasMismatch && (
        <View style={styles.mismatchBadge}>
          <Text style={styles.mismatchText}>
            {difference > 0
              ? `+$${difference.toFixed(2)} over`
              : `-$${Math.abs(difference).toFixed(2)} short`}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttons}>
        <Pressable
          onPress={handleCollected}
          disabled={!inputValue || collectedAmount <= 0}
          style={({ pressed }) => [
            styles.btn,
            styles.collectBtn,
            pressed && styles.pressed,
            (!inputValue || collectedAmount <= 0) && styles.disabled,
          ]}
        >
          <Text style={styles.collectBtnText}>Collected</Text>
        </Pressable>

        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [
            styles.btn,
            styles.skipBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.skipBtnText}>No Cash (Prepaid)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  expectedSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: C.bg2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  expectedLabel: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: Spacing.xs,
  },
  expectedAmount: {
    fontSize: Size.xxxl,
    fontWeight: '700',
    color: C.text,
  },
  inputSection: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: Size.sm,
    color: C.dim,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  dollarSign: {
    fontSize: Size.xl,
    fontWeight: '600',
    color: C.dim,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: Size.xl,
    fontWeight: '600',
    color: C.text,
    paddingVertical: Spacing.md,
  },
  mismatchBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: alpha(C.yellow, 0.15),
    borderWidth: 1,
    borderColor: alpha(C.yellow, 0.3),
  },
  mismatchText: {
    fontSize: Size.sm,
    fontWeight: '600',
    color: C.yellow,
  },
  buttons: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  collectBtn: {
    backgroundColor: C.green,
  },
  collectBtnText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#fff',
  },
  skipBtn: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
  },
  skipBtnText: {
    fontSize: Size.md,
    color: C.dim,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
