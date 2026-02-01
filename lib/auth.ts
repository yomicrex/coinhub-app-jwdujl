
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ENV from "@/config/env";

const API_URL = ENV.BACKEND_URL;
const APP_SCHEME = ENV.APP_SCHEME;

// Only log in development
if (ENV.IS_DEV) {
  console.log("Auth: Using backend URL:", API_URL);
  console.log("Auth: Using app scheme:", APP_SCHEME);
  console.log("Auth: Platform:", Platform.OS);
}

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
    // CRITICAL: For native mobile apps (iOS/Android/TestFlight), we must:
    // 1. Use "omit" for credentials to avoid cookie-based auth issues
    // 2. Use Authorization header (Bearer token) instead of cookies
    // 3. Send X-App-Type header so backend can identify mobile apps
    credentials: "omit",
    headers: {
      "X-App-Type": ENV.APP_TYPE,
      "X-Platform": Platform.OS,
    },
  },
  // CRITICAL: Use custom fetch to ensure headers are sent with EVERY request
  // For native builds, we add Origin/Referer headers ONLY for /api/auth/* requests
  fetch: async (url: string | URL | Request, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Always add platform identification headers
    headers.set("X-App-Type", ENV.APP_TYPE);
    headers.set("X-Platform", Platform.OS);
    
    // CRITICAL FIX: For native builds (iOS/Android/TestFlight), add explicit Origin and Referer headers
    // ONLY for /api/auth/* requests to fix INVALID_ORIGIN errors
    // DO NOT add these on web - browsers handle Origin/Referer automatically
    const isAuthRequest = urlString.includes('/api/auth/');
    if (Platform.OS !== "web" && isAuthRequest) {
      headers.set("Origin", API_URL);
      headers.set("Referer", API_URL);
    }
    
    // Only log in development
    if (ENV.IS_DEV) {
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
  if (ENV.IS_DEV) {
    console.log("clearAuthTokens: Clearing all auth tokens");
  }
  
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
    
    if (ENV.IS_DEV) {
      console.log("clearAuthTokens: Cleared web storage");
    }
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
      
      if (ENV.IS_DEV) {
        console.log("clearAuthTokens: Cleared native storage");
      }
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
