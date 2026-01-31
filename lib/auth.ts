
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ENV from "@/config/env";
import { addAuthDebugLog } from "@/components/AuthDebugPanel";

const API_URL = ENV.BACKEND_URL;
const APP_SCHEME = ENV.APP_SCHEME;

console.log("Auth: Using backend URL:", API_URL);
console.log("Auth: Using app scheme:", APP_SCHEME);
console.log("Auth: Platform:", Platform.OS);
console.log("Auth: Is standalone:", ENV.IS_STANDALONE);
console.log("Auth: Is Expo Go:", ENV.IS_EXPO_GO);

// Debug log - initialization
addAuthDebugLog({
  type: 'info',
  endpoint: 'auth-initialization',
  message: `Auth client initializing - Backend: ${API_URL}, Platform: ${Platform.OS}, Standalone: ${ENV.IS_STANDALONE}`,
});

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
    // 3. Send X-App-Type header so backend can identify mobile apps and bypass CSRF
    credentials: "omit",
    headers: {
      // CRITICAL: X-App-Type header is REQUIRED for mobile apps
      // Backend uses this to bypass CSRF checks for native apps
      "X-App-Type": ENV.APP_TYPE,
      "X-Platform": Platform.OS,
      "X-Requested-With": "XMLHttpRequest",
    },
  },
  // CRITICAL: Use custom fetch to ensure headers are sent with EVERY request
  // Better Auth sometimes bypasses fetchOptions.headers for certain requests
  fetch: async (url: string | URL | Request, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    
    // CRITICAL: Always add X-App-Type header for mobile app identification
    // Backend requires this to bypass CSRF checks
    headers.set("X-App-Type", ENV.APP_TYPE);
    headers.set("X-Platform", Platform.OS);
    headers.set("X-Requested-With", "XMLHttpRequest");
    
    // Log the request for debugging
    const urlString = typeof url === 'string' ? url : url.toString();
    const xAppType = headers.get('X-App-Type');
    const xPlatform = headers.get('X-Platform');
    
    console.log('Auth: Custom fetch -', urlString);
    console.log('Auth: Headers -', {
      'X-App-Type': xAppType,
      'X-Platform': xPlatform,
      'X-Requested-With': headers.get('X-Requested-With'),
    });
    
    // CRITICAL: Verify headers are set correctly for mobile apps
    if (ENV.IS_STANDALONE && xAppType !== 'standalone') {
      console.error('⚠️ WARNING: Running in standalone but X-App-Type is not "standalone"!');
    }
    if (ENV.IS_EXPO_GO && xAppType !== 'expo-go') {
      console.error('⚠️ WARNING: Running in Expo Go but X-App-Type is not "expo-go"!');
    }
    
    addAuthDebugLog({
      type: 'request',
      endpoint: urlString,
      method: options?.method || 'GET',
      headers: {
        'X-App-Type': xAppType || 'none',
        'X-Platform': xPlatform || 'none',
        'X-Requested-With': headers.get('X-Requested-With') || 'none',
      },
      message: `Better Auth request with ${xAppType} app type`,
    });
    
    return fetch(url, {
      ...options,
      headers,
      credentials: "omit",
    });
  },
});

// Debug log - client created
addAuthDebugLog({
  type: 'info',
  endpoint: 'auth-initialization',
  message: 'Auth client created successfully with credentials: omit',
  headers: {
    'X-Platform': Platform.OS,
    'X-App-Type': ENV.APP_TYPE,
  },
});

export async function clearAuthTokens() {
  console.log("clearAuthTokens: Clearing all auth tokens");
  
  // Debug log
  addAuthDebugLog({
    type: 'info',
    endpoint: 'clearAuthTokens',
    message: 'Clearing all auth tokens',
  });
  
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
    
    // Debug log
    addAuthDebugLog({
      type: 'info',
      endpoint: 'clearAuthTokens',
      message: `Cleared ${keysToRemove.length} keys from web storage`,
    });
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
      
      // Debug log
      addAuthDebugLog({
        type: 'info',
        endpoint: 'clearAuthTokens',
        message: `Cleared ${keys.length} keys from native storage`,
      });
    } catch (error) {
      console.error("clearAuthTokens: Error clearing native storage:", error);
      
      // Debug log
      addAuthDebugLog({
        type: 'error',
        endpoint: 'clearAuthTokens',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export { API_URL };
