import React from 'react';
import { View, StyleSheet, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/src/theme';

export interface AlbumCoverProps {
  source?: { uri: string } | string | null;
  size?: number | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'hero';
  shape?: 'square' | 'rounded' | 'circle';
  borderRadius?: number;
  fallbackColor?: string;
  fallbackIcon?: React.ReactNode;
  style?: ImageStyle;
  testID?: string;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

const sizeMap = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 140,
  xxl: 200,
  hero: 320,
};

export function AlbumCover({
  source,
  size = 'md',
  shape = 'square',
  borderRadius,
  fallbackColor,
  fallbackIcon,
  style,
  testID,
  contentFit = 'cover',
}: AlbumCoverProps) {
  const resolvedSize = typeof size === 'number' ? size : sizeMap[size];
  const resolvedRadius = borderRadius ?? (shape === 'circle' ? resolvedSize / 2 : shape === 'rounded' ? theme.radius.lg : theme.radius.md);

  return (
    <View testID={testID} style={[styles.container, { width: resolvedSize, height: resolvedSize }, style]}>
      {source ? (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={[
            styles.image,
            { width: resolvedSize, height: resolvedSize, borderRadius: resolvedRadius },
          ]}
          contentFit={contentFit}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: resolvedSize, height: resolvedSize, borderRadius: resolvedRadius },
            { backgroundColor: fallbackColor || theme.colors.secondary },
          ]}
        >
          {fallbackIcon}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  image: { borderRadius: 9999 },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});