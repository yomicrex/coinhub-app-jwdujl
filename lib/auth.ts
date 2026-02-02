
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ENV from "@/config/env";

const API_URL = ENV.BACKEND_URL;
const APP_SCHEME = ENV.APP_SCHEME;

if (__DEV__) {
  console.log("Auth: Using backend URL:", API_URL);
  console.log("Auth: Using app scheme:", APP_SCHEME);
  console.log("Auth: Platform:", Platform.OS);
}

const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

const isNative = Platform.OS !== "web";
const authHeaders: Record<string, string> = {
  "X-App-Type": ENV.APP_TYPE,
  "X-Platform": Platform.OS,
};

if (isNative) {
  authHeaders["Origin"] = API_URL;
  authHeaders["Referer"] = API_URL;
  
  if (__DEV__) {
    console.log("Auth: Setting Origin and Referer headers for native build:", API_URL);
  }
}

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
    credentials: "omit",
    headers: authHeaders,
  },
  fetch: async (url: string | URL | Request, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    const urlString = typeof url === 'string' ? url : url.toString();
    
    headers.set("X-App-Type", ENV.APP_TYPE);
    headers.set("X-Platform", Platform.OS);
    
    if (isNative) {
      headers.set("Origin", API_URL);
      headers.set("Referer", API_URL);
    }
    
    if (__DEV__) {
      console.log('Auth: Request -', urlString);
      console.log('Auth: Headers -', {
        'X-App-Type': headers.get('X-App-Type'),
        'X-Platform': headers.get('X-Platform'),
        'Origin': headers.get('Origin') || 'not set',
        'Referer': headers.get('Referer') || 'not set',
      });
    }
    
    return fetch(url, {
      ...options,
      headers,
      credentials: "omit",
    });
  },
});

export async function clearAuthTokens() {
  if (__DEV__) {
    console.log("clearAuthTokens: Clearing all auth tokens");
  }
  
  if (Platform.OS === "web") {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(APP_SCHEME) || key.startsWith('better-auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (__DEV__) {
      console.log("clearAuthTokens: Cleared web storage");
    }
  } else {
    try {
      const keys = [`${APP_SCHEME}_session`, `${APP_SCHEME}_token`, `${APP_SCHEME}_user_data`, `${APP_SCHEME}_session_cookie`];
      for (const key of keys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // Key might not exist
        }
      }
      
      if (__DEV__) {
        console.log("clearAuthTokens: Cleared native storage");
      }
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
