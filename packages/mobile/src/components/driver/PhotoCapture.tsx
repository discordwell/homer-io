import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { C, Size, Spacing, Radius } from '@/theme';

export interface CapturedPhoto {
  uri: string;
  base64: string;
  filename: string;
}

interface PhotoCaptureProps {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
}

export function PhotoCapture({ photos, onChange, maxPhotos = 4 }: PhotoCaptureProps) {
  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is needed to take delivery photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Compress and resize to max 1200px width for reasonable upload size
    const compressed = await manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.min(asset.width || 1200, 1200) } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true },
    );

    if (!compressed.base64) return;

    const newPhoto: CapturedPhoto = {
      uri: compressed.uri,
      base64: compressed.base64,
      filename: `photo-${Date.now()}.jpg`,
    };

    onChange([...photos, newPhoto]);
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {/* Photo grid */}
      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((photo, i) => (
            <View key={i} style={styles.photoContainer}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable
                onPress={() => removePhoto(i)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>{'\u00D7'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Take photo button */}
      {photos.length < maxPhotos && (
        <Pressable
          onPress={handleCapture}
          style={({ pressed }) => [styles.captureBtn, pressed && styles.pressed]}
        >
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.captureText}>
            Take Photo ({photos.length}/{maxPhotos})
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoContainer: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.muted,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: C.red,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.muted,
    borderRadius: Radius.lg,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  cameraIcon: {
    fontSize: 20,
  },
  captureText: {
    fontSize: Size.md,
    fontWeight: '500',
    color: C.dim,
  },
});
