import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@/src/theme";
import { api, Song } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { usePlayer } from "@/src/lib/player";
import { BrutalHeading, BrutalLabel } from "@/src/components/brutal/BrutalText";
import { DashboardFeed, PersonalizedSections } from "@/src/components/PersonalizedSections";
import { Skeleton } from "@/src/components/ui";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const playQueue = usePlayer((s) => s.playQueue);

  const [trending, setTrending] = useState<Song[]>([]);
  const [recent, setRecent] = useState<Song[]>([]);
  const [feed, setFeed] = useState<DashboardFeed>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const feed = await api.get<DashboardFeed>("/home/feed");
      setFeed(feed);
      setTrending(Array.isArray(feed.made_for_you) ? feed.made_for_you : []);
      setRecent(
        Array.isArray(feed.recently_played) ? feed.recently_played : [],
      );
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const featured = trending[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <BrutalHeading size="lg" testID="brand-title">
              BRUTAL.
            </BrutalHeading>
            <BrutalLabel style={styles.subtitle}>
              MUSIC WITHOUT{"n"}COMPROMISE
            </BrutalLabel>
          </View>
          <Pressable
            testID="notifications-btn"
            hitSlop={12}
            style={styles.iconBtn}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.featuredBlock}>
            <Skeleton width={120} height={11} style={{ marginBottom: theme.spacing.md }} />
            <Skeleton height={260} radius={theme.radius.md} />
            <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={52} radius={theme.radius.md} />
              ))}
            </View>
          </View>
        ) : (
          <>
            {featured && (
              <Animated.View entering={FadeInDown.duration(theme.motion.duration.slow)} style={styles.featuredBlock}>
                <BrutalLabel style={styles.section}>FEATURED</BrutalLabel>
                <Pressable
                  testID="featured-card"
                  onPress={() => playQueue(trending, 0, "home")}
                  style={styles.featured}
                >
                  <Image
                    source={
                      featured.artwork ? { uri: featured.artwork } : undefined
                    }
                    style={styles.featuredImage}
                    contentFit="cover"
                  />
                  <View style={styles.featuredOverlay} />
                  <View style={styles.featuredContent}>
                    <View style={{ flex: 1 }}>
                      <BrutalHeading size="md" numberOfLines={2}>
                        {featured.title.toUpperCase()}
                      </BrutalHeading>
                      <BrutalLabel style={styles.featuredMeta}>
                        CURATED · {featured.artist.toUpperCase()}
                      </BrutalLabel>
                    </View>
                    <View style={styles.featuredPlay}>
                      <Ionicons
                        name="play"
                        size={22}
                        color={theme.colors.background}
                      />
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            )}

            {recent.length > 0 && (
              <Animated.View
                entering={FadeInDown.duration(theme.motion.duration.slow).delay(60)}
                style={styles.section}
              >
                <View style={styles.sectionHead}>
                  <BrutalLabel>RECENTLY PLAYED</BrutalLabel>
                  <BrutalLabel color={theme.colors.text}>SEE ALL</BrutalLabel>
                </View>
                <View style={styles.list}>
                  {recent.slice(0, 4).map((s, i) => (
                    <Pressable
                      key={s.id}
                      testID={`recent-card-${s.id}`}
                      onPress={() => playQueue(recent, i, "recently_played")}
                      style={styles.listRow}
                    >
                      <Image
                        source={s.artwork ? { uri: s.artwork } : undefined}
                        style={styles.listArt}
                        contentFit="cover"
                      />
                      <View style={styles.listInfo}>
                        <Text style={styles.listTitle} numberOfLines={1}>
                          {s.title.toUpperCase()}
                        </Text>
                        <Text style={styles.listArtist} numberOfLines={1}>
                          {s.artist.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.listAction}>
                        <Ionicons
                          name="play"
                          size={16}
                          color={theme.colors.text}
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.duration(theme.motion.duration.slow).delay(120)}>
              <PersonalizedSections
                feed={feed}
                onPlay={(songs, index) => playQueue(songs, index, "recommendation")}
              />
            </Animated.View>

            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 180 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  subtitle: { marginTop: 10, lineHeight: 14 },
  iconBtn: { padding: 4 },
  featuredBlock: { paddingHorizontal: 20, marginBottom: 32 },
  section: { marginBottom: 32, paddingHorizontal: 20 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  featured: {
    marginTop: 12,
    aspectRatio: 1.35,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    position: "relative",
    backgroundColor: theme.colors.card,
  },
  featuredImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  featuredOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(9,9,9,0.55)",
  },
  featuredContent: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-end",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  featuredMeta: { marginTop: 10 },
  featuredPlay: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listArt: { width: 52, height: 52, backgroundColor: theme.colors.secondary },
  listInfo: { flex: 1, minWidth: 0 },
  listTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  listArtist: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  listAction: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSpacer: { height: 40 },
});
