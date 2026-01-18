
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_COOKIE_KEY = "coinhub_session_cookie";

/**
 * Cookie Manager for React Native
 * 
 * React Native's fetch API doesn't automatically handle cookies like browsers do.
 * This module manually extracts, stores, and sends cookies with requests.
 */

// Platform-specific storage
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

/**
 * Extract session cookie from Set-Cookie header
 */
export function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    console.log("CookieManager: No Set-Cookie header found");
    return null;
  }

  console.log("CookieManager: Extracting cookie from Set-Cookie header:", setCookieHeader.substring(0, 100));

  // Parse Set-Cookie header to extract session token
  // Format: "session=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"
  const sessionMatch = setCookieHeader.match(/session=([^;]+)/);
  
  if (sessionMatch && sessionMatch[1]) {
    const sessionToken = sessionMatch[1];
    console.log("CookieManager: Extracted session token:", sessionToken.substring(0, 20) + "...");
    return sessionToken;
  }

  console.log("CookieManager: No session cookie found in Set-Cookie header");
  return null;
}

/**
 * Store session cookie
 */
export async function storeSessionCookie(sessionToken: string): Promise<void> {
  console.log("CookieManager: Storing session cookie:", sessionToken.substring(0, 20) + "...");
  
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(SESSION_COOKIE_KEY, sessionToken);
    } else {
      await SecureStore.setItemAsync(SESSION_COOKIE_KEY, sessionToken);
    }
    console.log("CookieManager: Session cookie stored successfully");
  } catch (error) {
    console.error("CookieManager: Error storing session cookie:", error);
    throw error;
  }
}

/**
 * Get stored session cookie
 */
export async function getSessionCookie(): Promise<string | null> {
  try {
    let sessionToken: string | null = null;
    
    if (Platform.OS === "web") {
      sessionToken = localStorage.getItem(SESSION_COOKIE_KEY);
    } else {
      sessionToken = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
    }
    
    if (sessionToken) {
      console.log("CookieManager: Retrieved session cookie:", sessionToken.substring(0, 20) + "...");
    } else {
      console.log("CookieManager: No session cookie found in storage");
    }
    
    return sessionToken;
  } catch (error) {
    console.error("CookieManager: Error retrieving session cookie:", error);
    return null;
  }
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  console.log("CookieManager: Clearing session cookie");
  
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(SESSION_COOKIE_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    }
    console.log("CookieManager: Session cookie cleared");
  } catch (error) {
    console.error("CookieManager: Error clearing session cookie:", error);
  }
}

/**
 * Create fetch options with session cookie
 */
export async function createAuthenticatedFetchOptions(options: RequestInit = {}): Promise<RequestInit> {
  const sessionToken = await getSessionCookie();
  
  const headers = new Headers(options.headers || {});
  
  if (sessionToken) {
    // Add Cookie header with session token
    headers.set("Cookie", `session=${sessionToken}`);
    console.log("CookieManager: Added session cookie to request headers");
  } else {
    console.log("CookieManager: No session cookie available for request");
  }
  
  return {
    ...options,
    headers,
    credentials: "include", // Always include credentials
  };
}
