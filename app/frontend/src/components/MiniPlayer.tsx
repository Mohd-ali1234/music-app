import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { usePlayer } from "@/src/lib/player";
import { theme } from "@/src/theme";

const glassAvailable = isLiquidGlassAvailable();

export default function MiniPlayer() {
  const router = useRouter();
  const current = usePlayer((s) => s.current);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const togglePlay = usePlayer((s) => s.togglePlay);

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const progressValue = useSharedValue(progress);
  useEffect(() => {
    progressValue.value = withTiming(progress, {
      duration: theme.motion.duration.base,
    });
  }, [progress, progressValue]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  if (!current) return null;

  const Container = glassAvailable ? GlassView : View;

  return (
    <Pressable
      testID="mini-player"
      onPress={() => router.push("/player")}
      style={styles.pressableWrap}
    >
      <Container
        style={styles.wrap}
        {...(glassAvailable
          ? { glassEffectStyle: "regular", tintColor: theme.glass.tint }
          : {})}
      >
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <View style={styles.row}>
          <Image
            source={current.artwork ? { uri: current.artwork } : undefined}
            style={styles.art}
            contentFit="cover"
          />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {(current.title || "Unknown title").toUpperCase()}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {(current.artist || "Unknown artist").toUpperCase()}
            </Text>
          </View>
          <Pressable
            testID="mini-player-play-pause"
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              togglePlay();
            }}
            hitSlop={12}
            style={styles.playBtn}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      </Container>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWrap: { marginHorizontal: 12 },
  wrap: {
    backgroundColor: glassAvailable ? undefined : theme.glass.fallback,
    borderWidth: theme.borderWidth.thin,
    borderColor: glassAvailable ? theme.glass.border : theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.secondary,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 12,
  },
  art: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.md,
  },
  info: { flex: 1 },
  title: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  artist: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1.5,
  },
  playBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
});
