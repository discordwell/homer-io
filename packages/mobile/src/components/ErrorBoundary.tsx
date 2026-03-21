import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, Size, Spacing, Radius, Base } from '@/theme';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={[Base.screen, Base.center]}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage || this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable onPress={this.handleRetry} style={Base.primaryBtn}>
            <Text style={Base.primaryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Size.xl,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  message: {
    fontSize: Size.md,
    color: C.muted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
});
