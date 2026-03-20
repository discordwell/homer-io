import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { C, Size, Spacing, Base } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={[Base.screen, Base.center]}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.message}>Screen not found</Text>
      <Pressable style={Base.primaryBtn} onPress={() => router.replace('/')}>
        <Text style={Base.primaryBtnText}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    fontSize: 64,
    fontWeight: '800',
    color: C.accent,
  },
  message: {
    fontSize: Size.lg,
    color: C.dim,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
