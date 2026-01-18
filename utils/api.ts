
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
const SESSION_TOKEN_KEY = "coinhub_session_token";

/**
 * Get the stored session token
 */
async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    }
  } catch (error) {
    console.error("getSessionToken: Error retrieving session token:", error);
    return null;
  }
}

/**
 * Create authenticated fetch options with Authorization header (React Native compatible)
 */
export async function createAuthenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const sessionToken = await getSessionToken();
  
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  };

  // Add Authorization header with session token (React Native compatible)
  if (sessionToken) {
    (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${sessionToken}`;
  }

  console.log(`API: ${options.method || 'GET'} ${url}`, sessionToken ? '(authenticated)' : '(unauthenticated)');
  
  return fetch(url, fetchOptions);
}

/**
 * Helper function for authenticated GET requests
 */
export async function authenticatedGet(endpoint: string): Promise<Response> {
  return createAuthenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
}

/**
 * Helper function for authenticated POST requests
 */
export async function authenticatedPost(endpoint: string, body: any): Promise<Response> {
  return createAuthenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Helper function for authenticated PUT requests
 */
export async function authenticatedPut(endpoint: string, body: any): Promise<Response> {
  return createAuthenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Helper function for authenticated DELETE requests
 */
export async function authenticatedDelete(endpoint: string): Promise<Response> {
  return createAuthenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });
}

/**
 * Helper function for authenticated PATCH requests
 */
export async function authenticatedPatch(endpoint: string, body: any): Promise<Response> {
  return createAuthenticatedFetch(`${API_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export { API_URL };
