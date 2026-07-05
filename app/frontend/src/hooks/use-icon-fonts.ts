// /app/frontend/src/hooks/use-icon-fonts.ts
import { useFonts } from "expo-font";

export function useIconFonts() {
  return useFonts({
    // map font family names to their asset files, e.g.:
    // 'Ionicons': require('../../assets/fonts/Ionicons.ttf'),
  });
}
