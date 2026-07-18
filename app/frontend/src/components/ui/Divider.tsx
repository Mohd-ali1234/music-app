import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@/src/theme';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: 'thin' | 'medium' | 'thick' | 'heavy';
  color?: string;
  style?: any;
  testID?: string;
}

export function Divider({
  orientation = 'horizontal',
  thickness = 'thin',
  color,
  style,
  testID,
}: DividerProps) {
  const thicknessMap = {
    thin: theme.borderWidth.thin,
    medium: theme.borderWidth.medium,
    thick: theme.borderWidth.thick,
    heavy: theme.borderWidth.heavy,
  };

  return (
    <View
      testID={testID}
      style={[
        orientation === 'horizontal' ? styles.horizontal : styles.vertical,
        { borderColor: color || theme.colors.border },
        { borderWidth: thicknessMap[thickness] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    width: '100%',
    borderBottomWidth: 1,
  },
  vertical: {
    height: '100%',
    borderRightWidth: 1,
  },
});