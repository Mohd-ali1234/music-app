import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MiniPlayer from "@/src/components/MiniPlayer";
import { theme } from "@/src/theme";

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: theme.colors.brand,
          tabBarInactiveTintColor: theme.colors.textDim,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
          sceneStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarButtonTestID: "tab-search",
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "library" : "library-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarButtonTestID: "tab-library",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
            tabBarButtonTestID: "tab-profile",
          }}
        />
      </Tabs>
      <View pointerEvents="box-none" style={styles.miniWrap}>
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0A0A0A",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 64,
  },
});
