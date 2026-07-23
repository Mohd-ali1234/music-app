import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Typography } from "@/src/components/ui";
import { useDJ } from "@/src/lib/dj";
import { theme } from "@/src/theme";

/**
 * The DJ's spoken line, surfaced as a quiet, self-dismissing banner.
 *
 * Deliberately non-modal and non-blocking: it never covers transport controls
 * and never interrupts playback. The store clears it on a timer; tapping
 * dismisses it early. Renders nothing when the DJ has nothing to say, which is
 * most of the time by design.
 */
export function DJNarration({ style }: { style?: any }) {
  const narration = useDJ((s) => s.narration);
  const dismiss = useDJ((s) => s.dismissNarration);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: narration ? 1 : 0,
        duration: theme.motion.duration.base,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: narration ? 0 : 8,
        duration: theme.motion.duration.base,
        useNativeDriver: true,
      }),
    ]).start();
  }, [narration, opacity, translateY]);

  if (!narration) return null;

  return (
    <Animated.View
      style={[styles.wrap, { opacity, transform: [{ translateY }] }, style]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`DJ says: ${narration.text}. Tap to dismiss.`}
        style={styles.banner}
      >
        <View style={styles.iconBox}>
          <Ionicons name="mic-outline" size={14} color={theme.colors.background} />
        </View>
        <Typography variant="bodySmall" style={styles.text} numberOfLines={2}>
          {narration.text}
        </Typography>
        <Ionicons
          name="close"
          size={14}
          color={theme.colors.textMuted}
          style={styles.close}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.md,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.borderStrong,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.text,
  },
  text: {
    flex: 1,
    color: theme.colors.text,
  },
  close: {
    opacity: 0.7,
  },
});
