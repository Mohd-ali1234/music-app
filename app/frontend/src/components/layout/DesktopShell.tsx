import React from "react";
import { StyleSheet, View } from "react-native";

import { DJNarration } from "@/src/components/dj/DJNarration";
import { NowPlayingBar } from "@/src/components/layout/NowPlayingBar";
import { QueuePanel } from "@/src/components/layout/QueuePanel";
import { Sidebar } from "@/src/components/layout/Sidebar";
import { useBreakpoint } from "@/src/hooks/use-breakpoint";
import { useKeyboardShortcuts } from "@/src/hooks/use-keyboard-shortcuts";
import { usePlayer } from "@/src/lib/player";
import { useUI } from "@/src/lib/ui";
import { theme } from "@/src/theme";

/**
 * The desktop application frame: sidebar, content column, transport bar.
 *
 * This is the one structural change desktop needs. Everything inside
 * `children` is the same screen the mobile app renders — the shell only
 * replaces the *chrome* (bottom tabs and floating MiniPlayer) with layout that
 * suits a large landscape window.
 *
 * Below 1024px this component is never mounted, so the mobile experience is
 * bit-for-bit unchanged.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { contentMaxWidth, isWide } = useBreakpoint();
  const queuePanelOpen = useUI((s) => s.queuePanelOpen);
  const hasTrack = usePlayer((s) => s.current !== null);

  useKeyboardShortcuts(true);

  // The queue panel needs both the horizontal room and something to show.
  const showQueuePanel = isWide && queuePanelOpen && hasTrack;

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Sidebar />
        <View style={styles.main}>
          <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
            {children}
          </View>
          <DJNarration style={styles.narration} />
        </View>
        {showQueuePanel && <QueuePanel />}
      </View>
      <NowPlayingBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    // `minHeight: 0` lets the content column scroll instead of pushing the
    // transport bar off-screen in a flex row.
    minHeight: 0,
  },
  main: {
    flex: 1,
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
  },
  narration: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: theme.spacing.md,
  },
});
