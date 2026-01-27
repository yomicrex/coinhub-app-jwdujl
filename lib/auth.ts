
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ENV from "@/config/env";

const API_URL = ENV.BACKEND_URL;
const APP_SCHEME = ENV.APP_SCHEME;

console.log("Auth: Using backend URL:", API_URL);
console.log("Auth: Using app scheme:", APP_SCHEME);

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage,
    }),
  ],
  fetchOptions: {
    credentials: "include",
  },
});

export async function clearAuthTokens() {
  console.log("clearAuthTokens: Clearing all auth tokens");
  
  if (Platform.OS === "web") {
    // Clear all auth-related items from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(APP_SCHEME) || key.startsWith('better-auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log("clearAuthTokens: Cleared web storage");
  } else {
    // Clear SecureStore items for native
    try {
      const keys = [`${APP_SCHEME}_session`, `${APP_SCHEME}_token`, `${APP_SCHEME}_user_data`, `${APP_SCHEME}_session_cookie`];
      for (const key of keys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // Key might not exist, ignore
        }
      }
      console.log("clearAuthTokens: Cleared native storage");
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
