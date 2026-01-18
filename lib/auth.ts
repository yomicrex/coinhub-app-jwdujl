
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Read backend URL from app.json configuration
const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
console.log("Auth: Using backend URL:", API_URL);

export const BEARER_TOKEN_KEY = "coinhub_bearer_token";
export const SESSION_TOKEN_KEY = "coinhub_session_token";
export const USER_DATA_KEY = "coinhub_user_data";

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
  // CRITICAL: Always include credentials (cookies) in requests
  fetchOptions: {
    credentials: "include",
  },
});

export function storeWebBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  }
}

export async function storeUserData(userData: any) {
  console.log("storeUserData: Storing user data");
  try {
    const userDataString = JSON.stringify(userData);
    if (Platform.OS === "web") {
      localStorage.setItem(USER_DATA_KEY, userDataString);
    } else {
      await SecureStore.setItemAsync(USER_DATA_KEY, userDataString);
    }
    console.log("storeUserData: User data stored successfully");
  } catch (error) {
    console.error("storeUserData: Error storing user data:", error);
  }
}

export async function getUserData(): Promise<any | null> {
  try {
    let userDataString: string | null = null;
    if (Platform.OS === "web") {
      userDataString = localStorage.getItem(USER_DATA_KEY);
    } else {
      userDataString = await SecureStore.getItemAsync(USER_DATA_KEY);
    }
    
    if (userDataString) {
      return JSON.parse(userDataString);
    }
    return null;
  } catch (error) {
    console.error("getUserData: Error retrieving user data:", error);
    return null;
  }
}

export async function clearAuthTokens() {
  console.log("clearAuthTokens: Clearing all auth tokens and storage");
  
  if (Platform.OS === "web") {
    // Clear all auth-related items from localStorage
    localStorage.removeItem(BEARER_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    
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
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      await SecureStore.deleteItemAsync('coinhub_session');
      await SecureStore.deleteItemAsync('coinhub_token');
      console.log("clearAuthTokens: Cleared native secure storage");
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
