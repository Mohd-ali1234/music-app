import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

export type AvatarCardProps = {
  name: string;
  color?: string;
  image?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AvatarCard({ name, color = theme.colors.secondary, image, selected, onPress, testID }: AvatarCardProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.85 }]}>
      <View style={[styles.circle, { backgroundColor: color }, selected && styles.selectedRing]}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.initials}>{initials(name)}</Text>
        )}
        {selected && (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={12} color={theme.colors.green} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

const AVATAR_SIZE = 84;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: AVATAR_SIZE + 16 },
  circle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  selectedRing: { borderColor: theme.colors.green },
  initials: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
});
