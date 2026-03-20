import { Platform } from 'react-native';
import { C, Size } from '@/theme';

export const tabScreenOptions = {
  headerShown: false as const,
  tabBarStyle: {
    backgroundColor: C.bg2,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tabBarActiveTintColor: C.accent,
  tabBarInactiveTintColor: C.muted,
  tabBarLabelStyle: {
    fontSize: Size.xs,
    fontWeight: '600' as const,
  },
};
