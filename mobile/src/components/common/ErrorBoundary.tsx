import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Appearance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { darkColors, lightColors } from '../../theme/colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Dynamic colors based on system theme (class components can't use hooks)
const getColors = () => {
  const isDark = Appearance.getColorScheme() !== 'light';
  const source = isDark ? darkColors : lightColors;
  return {
    bgPrimary: source.bgPrimary,
    bgSecondary: source.bgSecondary,
    textPrimary: source.textPrimary,
    textSecondary: source.textSecondary,
    textTertiary: source.textTertiary,
    accentError: source.accentError,
    accentPrimary: source.accentSecondary, // violet
  };
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI - use dynamic colors for theme support
      const colors = getColors();
      return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.accentError}20` }]}>
              <Ionicons name="bug-outline" size={48} color={colors.accentError} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Oups ! Une erreur s'est produite
            </Text>

            <Text style={[styles.message, { color: colors.textSecondary }]}>
              L'application a rencontré un problème inattendu.
              Essayez de recharger ou de revenir en arrière.
            </Text>

            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.accentPrimary }]}
              onPress={this.handleRetry}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>

            {/* Error details for development */}
            {this.props.showDetails && this.state.error && (
              <ScrollView style={styles.detailsContainer}>
                <Text style={[styles.detailsTitle, { color: colors.textTertiary }]}>
                  Détails de l'erreur (développement)
                </Text>
                <View style={[styles.detailsBox, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailsText, { color: colors.accentError }]}>
                    {this.state.error.name}: {this.state.error.message}
                  </Text>
                  {this.state.errorInfo && (
                    <Text style={[styles.stackText, { color: colors.textTertiary }]}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier use with hooks
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
};

// Simple error fallback component (functional → can use hooks)
export const ErrorFallback: React.FC<{
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
}> = ({
  error,
  resetError,
  title = 'Une erreur s\'est produite',
  message = 'Veuillez réessayer ou revenir en arrière.',
}) => {
  const themeColors = getColors();
  return (
    <View style={styles.fallbackContainer}>
      <Ionicons name="alert-circle" size={48} color={themeColors.accentError} />
      <Text style={[styles.fallbackTitle, { color: themeColors.textPrimary }]}>
        {title}
      </Text>
      <Text style={[styles.fallbackMessage, { color: themeColors.textSecondary }]}>
        {message}
      </Text>
      {error && __DEV__ && (
        <Text style={[styles.fallbackError, { color: themeColors.textTertiary }]}>
          {error.message}
        </Text>
      )}
      {resetError && (
        <TouchableOpacity
          style={[styles.fallbackButton, { backgroundColor: themeColors.accentPrimary }]}
          onPress={resetError}
        >
          <Text style={styles.fallbackButtonText}>Réessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.5,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  detailsContainer: {
    marginTop: Spacing.xl,
    maxHeight: 200,
    width: '100%',
  },
  detailsTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },
  detailsBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detailsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.mono,
    marginBottom: Spacing.sm,
  },
  stackText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.mono,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  fallbackTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  fallbackMessage: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  fallbackError: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.mono,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  fallbackButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default ErrorBoundary;
