
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Read backend URL from app.json configuration
const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
console.log("Auth: Using backend URL:", API_URL);

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
      scheme: "coinhub",
      storagePrefix: "coinhub",
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
      if (key && (key.startsWith('coinhub') || key.startsWith('better-auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log("clearAuthTokens: Cleared web storage");
  } else {
    // Clear SecureStore items for native
    try {
      const keys = ['coinhub_session', 'coinhub_token', 'coinhub_user_data', 'coinhub_session_cookie'];
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
