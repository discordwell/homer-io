import { View, Text, StyleSheet } from 'react-native';
import { C, Size, Spacing, Base } from '@/theme';

export default function DispatcherProfileScreen() {
  return (
    <View style={Base.screen}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>U</Text>
        </View>
        <Text style={styles.name}>User</Text>
        <Text style={styles.role}>Dispatcher</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 80,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: C.accent,
  },
  name: {
    fontSize: Size.xl,
    fontWeight: '700',
    color: C.text,
    marginTop: Spacing.lg,
  },
  role: {
    fontSize: Size.md,
    color: C.dim,
    marginTop: 4,
  },
});
