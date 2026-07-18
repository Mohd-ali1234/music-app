import React from 'react';
import { View, TextInput, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'visible-password';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  testID?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  variant?: 'default' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  helperText,
  disabled = false,
  secureTextEntry = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  leftIcon,
  rightIcon,
  onRightIconPress,
  testID,
  style,
  inputStyle,
  variant = 'outlined',
  size = 'md',
}: InputProps) {
  const hasError = !!error;
  const showHelper = helperText && !hasError;

  return (
    <View testID={testID} style={[styles.container, sizeStyles[size].container, style]}>
      {label && (
        <Text style={[styles.label, sizeStyles[size].label, hasError && styles.labelError]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputWrapper,
        variantStyles[variant],
        sizeStyles[size].inputWrapper,
        hasError && styles.inputWrapperError,
        disabled && styles.inputWrapperDisabled,
      ]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          disabled={disabled}
          style={[
            styles.input,
            sizeStyles[size].input,
            inputStyle,
            disabled && styles.inputDisabled,
          ]}
          selectionColor={theme.colors.accent}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.iconRight} hitSlop={12}>
            {rightIcon}
          </Pressable>
        )}
      </View>
      {(hasError || showHelper) && (
        <Text
          style={[
            styles.helperText,
            sizeStyles[size].helperText,
            hasError ? styles.helperError : styles.helperNormal,
          ]}
        >
          {hasError ? error : helperText}
        </Text>
      )}
    </View>
  );
}

import { Pressable } from 'react-native';

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  label: {
    fontSize: theme.font.small,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    letterSpacing: theme.letterSpacing.uppercase,
    textTransform: 'uppercase',
  },
  labelError: { color: theme.colors.danger },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.thin,
  },
  inputWrapperError: { borderColor: theme.colors.danger },
  inputWrapperDisabled: { opacity: theme.opacity.disabled },
  iconLeft: { paddingLeft: theme.spacing.md },
  iconRight: { paddingRight: theme.spacing.md },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.bodySmall,
    fontWeight: theme.fontWeight.regular,
  },
  inputDisabled: { color: theme.colors.textMuted },
  helperText: { fontSize: theme.font.tiny },
  helperError: { color: theme.colors.danger },
  helperNormal: { color: theme.colors.textMuted },
});

const variantStyles = {
  default: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.border,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  filled: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.border,
  },
};

const sizeStyles = {
  sm: {
    container: { gap: theme.spacing.xs },
    label: { fontSize: theme.font.tiny },
    inputWrapper: { paddingHorizontal: theme.spacing.sm, minHeight: 40 },
    input: { fontSize: theme.font.caption, paddingVertical: theme.spacing.xs },
    helperText: { fontSize: theme.font.tiny },
  },
  md: {
    container: { gap: theme.spacing.xs },
    label: { fontSize: theme.font.small },
    inputWrapper: { paddingHorizontal: theme.spacing.md, minHeight: 48 },
    input: { fontSize: theme.font.bodySmall, paddingVertical: theme.spacing.sm },
    helperText: { fontSize: theme.font.tiny },
  },
  lg: {
    container: { gap: theme.spacing.sm },
    label: { fontSize: theme.font.caption },
    inputWrapper: { paddingHorizontal: theme.spacing.lg, minHeight: 56 },
    input: { fontSize: theme.font.body, paddingVertical: theme.spacing.md },
    helperText: { fontSize: theme.font.small },
  },
};