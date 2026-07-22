import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "@/src/components/MiniPlayer";
import { theme } from "@/src/theme";

const TAB_HEIGHT = 60;

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 0) }]}
    >
      <View style={styles.tabBarDivider} />
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const iconName = TAB_ICONS[route.name] ?? "square";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented)
              navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              testID={options.tabBarButtonTestID ?? `tab-${route.name}`}
              onPress={onPress}
              style={styles.tabItem}
            >
              <View style={[styles.tabInner, focused && styles.tabInnerActive]}>
                <Ionicons
                  name={iconName as any}
                  size={20}
                  color={focused ? theme.colors.background : theme.colors.text}
                />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {String(label).toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TAB_ICONS: Record<string, string> = {
  home: "home-outline",
  search: "search-outline",
  library: "albums-outline",
  profile: "person-outline",
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarTotalHeight = TAB_HEIGHT + 10 + Math.max(insets.bottom, 6);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen
          name="home"
          options={{ title: "HOME", tabBarButtonTestID: "tab-home" } as any}
        />
        <Tabs.Screen
          name="search"
          options={{ title: "SEARCH", tabBarButtonTestID: "tab-search" } as any}
        />
        <Tabs.Screen
          name="library"
          options={
            { title: "LIBRARY", tabBarButtonTestID: "tab-library" } as any
          }
        />
        <Tabs.Screen
          name="profile"
          options={
            { title: "PROFILE", tabBarButtonTestID: "tab-profile" } as any
          }
        />
      </Tabs>
      <View
        pointerEvents="box-none"
        style={[styles.miniWrap, { bottom: tabBarTotalHeight }]}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    backgroundColor: theme.colors.background,
  },
  tabBarDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  tabBar: {
    flexDirection: "row",
    height: TAB_HEIGHT,
    paddingHorizontal: 8,
    paddingTop: 8,
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabInner: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabInnerActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  tabLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: theme.colors.text,
  },
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
