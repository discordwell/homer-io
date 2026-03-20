import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import { C, Size, Spacing, Radius } from '@/theme';

interface SignaturePadProps {
  onAccept: (base64Png: string) => void;
}

export function SignaturePad({ onAccept }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const handleOK = (signature: string) => {
    // signature is a data:image/png;base64,... string
    onAccept(signature);
  };

  const handleClear = () => {
    ref.current?.clearSignature();
    setHasDrawn(false);
  };

  const handleAccept = () => {
    ref.current?.readSignature();
  };

  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--body canvas {
      background-color: ${C.bg3};
      border-radius: 10px;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sign below</Text>

      <View style={styles.canvasWrapper}>
        <SignatureScreen
          ref={ref}
          onOK={handleOK}
          onBegin={() => setHasDrawn(true)}
          webStyle={webStyle}
          backgroundColor={C.bg3}
          penColor={C.text}
          dotSize={2.5}
          minWidth={2}
          maxWidth={3}
          trimWhitespace={false}
        />
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [styles.btn, styles.clearBtn, pressed && styles.pressed]}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>

        <Pressable
          onPress={handleAccept}
          disabled={!hasDrawn}
          style={({ pressed }) => [
            styles.btn,
            styles.acceptBtn,
            !hasDrawn && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: Size.md,
    color: C.dim,
    textAlign: 'center',
  },
  canvasWrapper: {
    height: 200,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.muted,
    overflow: 'hidden',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: C.muted,
  },
  acceptBtn: {
    backgroundColor: C.green,
  },
  disabled: {
    backgroundColor: C.muted,
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  clearText: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.dim,
  },
  acceptText: {
    fontSize: Size.md,
    fontWeight: '600',
    color: '#fff',
  },
});
