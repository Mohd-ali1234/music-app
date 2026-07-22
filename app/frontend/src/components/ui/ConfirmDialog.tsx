import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '@/src/theme';
import { Button } from './Button';
import { Typography } from './Typography';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
  testID,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card} testID={testID}>
          <Typography variant="h4" weight="black" style={{ marginBottom: theme.spacing.sm }}>
            {title.toUpperCase()}
          </Typography>
          {message ? (
            <Typography variant="bodySmall" color={theme.colors.textMuted} style={{ marginBottom: theme.spacing.lg }}>
              {message}
            </Typography>
          ) : null}
          <View style={styles.actions}>
            <Button
              testID={testID ? `${testID}-cancel` : undefined}
              title={cancelLabel}
              variant="outline"
              onPress={onCancel}
              style={styles.action}
            />
            <Button
              testID={testID ? `${testID}-confirm` : undefined}
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.borderStrong,
    padding: theme.spacing.lg,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  action: { flex: 1 },
});
