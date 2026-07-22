import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

export type SelectionCardProps = {
  label: string;
  color?: string;
  image?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export function SelectionCard({ label, color = theme.colors.secondary, image, selected, onPress, testID }: SelectionCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color },
        selected && styles.selected,
        pressed && { opacity: 0.85 },
      ]}
    >
      {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.scrim} />
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      {selected && (
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={14} color={theme.colors.green} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: { borderColor: theme.colors.green },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
