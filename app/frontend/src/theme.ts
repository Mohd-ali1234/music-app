export const theme = {
  colors: {
    bg: "#000000",
    surface: "#1A1A1A",
    surface2: "#262626",
    text: "#FFFFFF",
    textDim: "#A3A3A3",
    textSoft: "#EBEBEB",
    brand: "#8B5CF6",
    brandLight: "#A78BFA",
    brandDark: "#4C1D95",
    border: "#262626",
    divider: "#262626",
    borderStrong: "#404040",
    liked: "#F43F5E",
    success: "#10B981",
    danger: "#EF4444",
    overlay: "rgba(0,0,0,0.6)",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 16, pill: 999 },
  font: {
    h1: 28,
    h2: 22,
    h3: 18,
    body: 14,
    small: 12,
    tiny: 10,
  },
};

export type Theme = typeof theme;
