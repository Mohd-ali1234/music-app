import { useWindowDimensions } from "react-native";

/**
 * Responsive breakpoints for the app shell.
 *
 * The mobile experience is the baseline and must not change: `isDesktop` is
 * the single switch that opts a surface into the desktop shell, and it is
 * false for every phone and small tablet. Everything below `DESKTOP` keeps
 * rendering exactly what it rendered before this hook existed.
 */

export const BREAKPOINTS = {
  /** Phones. */
  MOBILE: 0,
  /** Large phones in landscape, small tablets. */
  TABLET: 768,
  /** The point at which a persistent sidebar becomes worthwhile. */
  DESKTOP: 1024,
  /** Roomy enough for a third column (the queue panel). */
  WIDE: 1440,
  /** Very wide displays, where content needs a maximum width to stay readable. */
  ULTRAWIDE: 1920,
} as const;

export type BreakpointName = "mobile" | "tablet" | "desktop" | "wide" | "ultrawide";

export type Breakpoint = {
  width: number;
  height: number;
  name: BreakpointName;
  /** True from 1024px up — the desktop shell (sidebar + player bar). */
  isDesktop: boolean;
  /** True from 1440px up — there is room for the queue panel. */
  isWide: boolean;
  /** True from 1920px up. */
  isUltrawide: boolean;
  /** True below 768px. */
  isMobile: boolean;
  /** Content column cap, so text lines stay readable on huge displays. */
  contentMaxWidth: number;
  /** Columns for a responsive card grid at this size. */
  gridColumns: number;
};

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();

  const isUltrawide = width >= BREAKPOINTS.ULTRAWIDE;
  const isWide = width >= BREAKPOINTS.WIDE;
  const isDesktop = width >= BREAKPOINTS.DESKTOP;
  const isMobile = width < BREAKPOINTS.TABLET;

  const name: BreakpointName = isUltrawide
    ? "ultrawide"
    : isWide
      ? "wide"
      : isDesktop
        ? "desktop"
        : isMobile
          ? "mobile"
          : "tablet";

  return {
    width,
    height,
    name,
    isDesktop,
    isWide,
    isUltrawide,
    isMobile,
    contentMaxWidth: isUltrawide ? 1680 : isWide ? 1440 : 1180,
    gridColumns: gridColumnsFor(width),
  };
}

/** Card columns that keep tile width roughly constant as the window grows. */
function gridColumnsFor(width: number): number {
  if (width >= BREAKPOINTS.ULTRAWIDE) return 8;
  if (width >= BREAKPOINTS.WIDE) return 6;
  if (width >= BREAKPOINTS.DESKTOP) return 5;
  if (width >= BREAKPOINTS.TABLET) return 4;
  return 2;
}
