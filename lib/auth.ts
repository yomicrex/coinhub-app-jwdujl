
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";

export const BEARER_TOKEN_KEY = "coinhub_bearer_token";
export const SESSION_TOKEN_KEY = "coinhub_session_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "coinhub",
      storagePrefix: "coinhub",
      storage,
    }),
  ],
  // On web, use bearer token for authenticated requests
  ...(Platform.OS === "web" && {
    fetchOptions: {
      auth: {
        type: "Bearer" as const,
        token: () => localStorage.getItem(BEARER_TOKEN_KEY) || "",
      },
    },
  }),
});

export function storeWebBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  console.log("clearAuthTokens: Clearing all auth tokens and storage");
  
  if (Platform.OS === "web") {
    // Clear all auth-related items from localStorage
    localStorage.removeItem(BEARER_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    
    // Clear all Better Auth related items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('coinhub') || key.startsWith('better-auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log("clearAuthTokens: Cleared web storage items:", keysToRemove);
  } else {
    // Clear SecureStore items for native
    try {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
      await SecureStore.deleteItemAsync('coinhub_session');
      await SecureStore.deleteItemAsync('coinhub_token');
      console.log("clearAuthTokens: Cleared native secure storage");
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
