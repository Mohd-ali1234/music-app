import React from 'react';
import { View, StyleSheet, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/src/theme';

export interface AlbumCoverProps {
  source?: { uri: string } | string | null;
  /** Fallback used when `source` is empty: builds a 2x2 mosaic from up to 4 track artworks (e.g. a playlist with no cover of its own). */
  sources?: (string | null | undefined)[];
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
  sources,
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
  const mosaicSources = (sources ?? []).filter((s): s is string => !!s).slice(0, 4);

  let content: React.ReactNode;
  if (source) {
    content = (
      <Image
        source={typeof source === 'string' ? { uri: source } : source}
        style={[
          styles.image,
          { width: resolvedSize, height: resolvedSize, borderRadius: resolvedRadius },
        ]}
        contentFit={contentFit}
      />
    );
  } else if (mosaicSources.length > 0) {
    const half = resolvedSize / 2;
    // Always fill 4 quadrants, cycling through what's available so 1-3
    // tracks still produce a full mosaic instead of a partial grid.
    const quadrants = [0, 1, 2, 3].map((i) => mosaicSources[i % mosaicSources.length]);
    content = (
      <View style={{ width: resolvedSize, height: resolvedSize, borderRadius: resolvedRadius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
        {quadrants.map((uri, i) => (
          <Image key={i} source={{ uri }} style={{ width: half, height: half }} contentFit="cover" />
        ))}
      </View>
    );
  } else {
    content = (
      <View
        style={[
          styles.fallback,
          { width: resolvedSize, height: resolvedSize, borderRadius: resolvedRadius },
          { backgroundColor: fallbackColor || theme.colors.secondary },
        ]}
      >
        {fallbackIcon}
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.container, { width: resolvedSize, height: resolvedSize }, style]}>
      {content}
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