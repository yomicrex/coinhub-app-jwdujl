
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ENV from "@/config/env";

const API_URL = ENV.BACKEND_URL;
const APP_SCHEME = ENV.APP_SCHEME;

// CRITICAL: Only log in development mode - NEVER in production/TestFlight
if (__DEV__ || process.env.NODE_ENV === 'development') {
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

// CRITICAL: For native builds (iOS/Android/TestFlight), we must set Origin and Referer headers
// to the backend URL to prevent "Invalid origin" errors from Better Auth
const isNative = Platform.OS !== "web";
const authHeaders: Record<string, string> = {
  "X-App-Type": ENV.APP_TYPE,
  "X-Platform": Platform.OS,
};

// Add Origin and Referer headers for native builds ONLY
if (isNative) {
  authHeaders["Origin"] = API_URL;
  authHeaders["Referer"] = API_URL;
  
  if (__DEV__ || process.env.NODE_ENV === 'development') {
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
    // CRITICAL: For native mobile apps (iOS/Android/TestFlight), we must:
    // 1. Use "omit" for credentials to avoid cookie-based auth issues
    // 2. Use Authorization header (Bearer token) instead of cookies
    // 3. Send X-App-Type header so backend can identify mobile apps
    // 4. Send Origin and Referer headers for native builds to prevent "Invalid origin" errors
    credentials: "omit",
    headers: authHeaders,
  },
  // CRITICAL: Use custom fetch to ensure headers are sent with EVERY request
  // For native builds, we add Origin/Referer headers for ALL requests
  fetch: async (url: string | URL | Request, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Always add platform identification headers
    headers.set("X-App-Type", ENV.APP_TYPE);
    headers.set("X-Platform", Platform.OS);
    
    // CRITICAL FIX: For native builds (iOS/Android/TestFlight), add explicit Origin and Referer headers
    // to fix INVALID_ORIGIN errors. DO NOT add these on web - browsers handle Origin/Referer automatically
    if (isNative) {
      headers.set("Origin", API_URL);
      headers.set("Referer", API_URL);
    }
    
    // CRITICAL: Only log in development mode - NEVER in production/TestFlight
    if (__DEV__ || process.env.NODE_ENV === 'development') {
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
  // CRITICAL: Only log in development mode - NEVER in production/TestFlight
  if (__DEV__ || process.env.NODE_ENV === 'development') {
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
    
    if (__DEV__ || process.env.NODE_ENV === 'development') {
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
      
      if (__DEV__ || process.env.NODE_ENV === 'development') {
        console.log("clearAuthTokens: Cleared native storage");
      }
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
    }
  }
}

export { API_URL };
