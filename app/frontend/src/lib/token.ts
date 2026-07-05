import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "auth_token";

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, token);
  } else {
    await SecureStore.setItemAsync(KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") return localStorage.getItem(KEY);
    return null;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function deleteToken() {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
