import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { C, Base } from '@/theme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
}

export function LoadingSpinner({ size = 'large' }: LoadingSpinnerProps) {
  return (
    <View style={[Base.screen, Base.center]}>
      <ActivityIndicator size={size} color={C.accent} />
    </View>
  );
}
