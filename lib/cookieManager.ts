
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
const SESSION_COOKIE_KEY = 'coinhub_session_cookie';

/**
 * Store session cookie from Set-Cookie header
 */
export async function storeSessionCookie(setCookieHeader: string | null): Promise<void> {
  if (!setCookieHeader) {
    console.log('cookieManager: No Set-Cookie header to store');
    return;
  }

  console.log('cookieManager: Storing session cookie from Set-Cookie header');
  
  try {
    if (Platform.OS === 'web') {
      // On web, cookies are handled automatically by the browser
      console.log('cookieManager: Web platform - cookies handled by browser');
      return;
    } else {
      // On native, store the cookie string
      await SecureStore.setItemAsync(SESSION_COOKIE_KEY, setCookieHeader);
      console.log('cookieManager: Session cookie stored in SecureStore');
    }
  } catch (error) {
    console.error('cookieManager: Error storing session cookie:', error);
  }
}

/**
 * Get stored session cookie
 */
export async function getSessionCookie(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // On web, cookies are sent automatically
      return null;
    } else {
      const cookie = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
      console.log('cookieManager: Retrieved session cookie:', cookie ? 'present' : 'not found');
      return cookie;
    }
  } catch (error) {
    console.error('cookieManager: Error retrieving session cookie:', error);
    return null;
  }
}

/**
 * Clear stored session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  console.log('cookieManager: Clearing session cookie');
  
  try {
    if (Platform.OS === 'web') {
      // On web, clear cookies by setting them to expire
      document.cookie = '__Secure-better-auth.session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      console.log('cookieManager: Web cookies cleared');
    } else {
      await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
      console.log('cookieManager: Native session cookie cleared');
    }
  } catch (error) {
    console.error('cookieManager: Error clearing session cookie:', error);
  }
}

/**
 * Create fetch options with authentication (session cookie)
 */
export async function createAuthenticatedFetchOptions(options: RequestInit = {}): Promise<RequestInit> {
  const sessionCookie = await getSessionCookie();
  
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include', // Always include credentials for cookies
    headers: {
      ...options.headers,
    },
  };

  // On native platforms, manually add the Cookie header
  if (Platform.OS !== 'web' && sessionCookie) {
    console.log('cookieManager: Adding Cookie header to request');
    (fetchOptions.headers as Record<string, string>)['Cookie'] = sessionCookie;
  }

  return fetchOptions;
}
