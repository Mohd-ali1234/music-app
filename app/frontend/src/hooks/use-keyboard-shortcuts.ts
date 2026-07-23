import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

import { usePlayer } from "@/src/lib/player";
import { useUI } from "@/src/lib/ui";

/**
 * Desktop keyboard transport controls.
 *
 * Web-only, and mounted only by the desktop shell — a phone has no keyboard to
 * bind and native builds have no `document`.
 *
 * Shortcuts never fire while the user is typing. Anything inside an input,
 * textarea or `contenteditable` region is left alone, so search and playlist
 * naming keep working normally.
 */

/** How far the seek shortcuts jump, in seconds. */
const SEEK_STEP = 10;

export function useKeyboardShortcuts(enabled: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;
    if (typeof document === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;

      const player = usePlayer.getState();

      switch (event.key) {
        case " ":
          event.preventDefault();
          player.togglePlay();
          break;
        case "ArrowRight":
          event.preventDefault();
          void player.next();
          break;
        case "ArrowLeft":
          event.preventDefault();
          void player.prev();
          break;
        case "l":
        case "L":
          event.preventDefault();
          player.seek(Math.min(player.position + SEEK_STEP, player.duration));
          break;
        case "j":
        case "J":
          event.preventDefault();
          player.seek(Math.max(player.position - SEEK_STEP, 0));
          break;
        case "s":
        case "S":
          event.preventDefault();
          player.toggleShuffle();
          break;
        case "r":
        case "R":
          event.preventDefault();
          player.cycleRepeat();
          break;
        case "f":
        case "F": {
          // "Favourite" — the heart, not fullscreen.
          event.preventDefault();
          const id = player.current?.id;
          if (id) void player.toggleLike(id);
          break;
        }
        case "q":
        case "Q":
          event.preventDefault();
          useUI.getState().toggleQueuePanel();
          break;
        case "d":
        case "D":
          event.preventDefault();
          router.push("/dj" as never);
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, router]);
}

/** True when the event originated inside a text-entry surface. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toUpperCase();
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.isContentEditable === true
  );
}

/** Shortcut reference, for a help surface. */
export const KEYBOARD_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause" },
  { keys: "←  →", action: "Previous / next track" },
  { keys: "J  L", action: "Seek back / forward 10s" },
  { keys: "S", action: "Shuffle" },
  { keys: "R", action: "Repeat mode" },
  { keys: "F", action: "Like current track" },
  { keys: "Q", action: "Toggle queue panel" },
  { keys: "D", action: "Open AI DJ" },
];
