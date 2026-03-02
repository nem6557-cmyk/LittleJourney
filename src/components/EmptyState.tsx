import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSizes } from '../theme/colors';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <View style={styles.iconCircle}>
      <Ionicons name={icon} size={48} color={Colors.primary} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction && (
      <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong. Please try again.',
  onRetry,
}) => (
  <View style={styles.container}>
    <View style={[styles.iconCircle, styles.errorCircle]}>
      <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
    </View>
    <Text style={styles.title}>Oops!</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <TouchableOpacity style={[styles.actionBtn, styles.retryBtn]} onPress={onRetry}>
        <Ionicons name="refresh-outline" size={18} color={Colors.white} />
        <Text style={[styles.actionText, styles.retryText]}>Try Again</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorCircle: {
    backgroundColor: Colors.danger + '15',
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  actionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  retryText: {
    color: Colors.white,
  },
});
