
import { authClient } from '@/lib/auth';
import ENV from '@/config/env';

const API_URL = ENV.BACKEND_URL;

console.log('API: Using backend URL:', API_URL);

/**
 * Get the session token from Better Auth
 */
async function getSessionToken(): Promise<string | null> {
  try {
    const session = await authClient.getSession();
    
    // CRITICAL FIX: Better Auth returns session in different formats
    const sessionToken = session?.data?.session?.token || session?.session?.token || session?.token;
    
    if (sessionToken) {
      console.log('API: Token extracted successfully, length:', sessionToken.length);
      return sessionToken;
    }
    
    console.log('API: No session token found');
    return null;
  } catch (error) {
    console.error('API: Error getting token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request with Bearer token authentication
 * CRITICAL: Uses Authorization header instead of cookies for mobile app compatibility
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const sessionToken = await getSessionToken();
  
  if (!sessionToken) {
    console.error('API: No session token available for authenticated request');
    throw new Error('Not authenticated. Please sign in again.');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  console.log('API: Making authenticated request to:', url, 'with token length:', sessionToken.length);
  
  // CRITICAL: Use Authorization header for mobile apps (more reliable than cookies)
  // Backend's extractSessionToken prioritizes Authorization header over cookies
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'Authorization': `Bearer ${sessionToken}`,
    // Add platform headers to help backend identify mobile requests
    'X-Platform': ENV.PLATFORM,
    'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
  };
  
  // Add Content-Type for JSON requests if not already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // CRITICAL: Use "omit" for credentials to avoid cookie-based auth issues on mobile
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit',
  });
  
  console.log('API: Response status:', response.status, 'for', url);
  
  if (!response.ok && response.status === 401) {
    console.error('API: Unauthorized (401) - session may have expired');
  }
  
  return response;
}

/**
 * Make an authenticated JSON API request
 */
export async function authenticatedFetchJSON<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(endpoint, options);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('API: Request failed:', response.status, errorText);
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

/**
 * Upload a file with authentication
 * CRITICAL: Uses Authorization header instead of cookies for mobile app compatibility
 */
export async function authenticatedUpload(
  endpoint: string,
  formData: FormData
): Promise<Response> {
  const sessionToken = await getSessionToken();
  
  if (!sessionToken) {
    console.error('API: No session token available for upload');
    throw new Error('Not authenticated. Please sign in again.');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  console.log('API: Uploading to:', url, 'with token length:', sessionToken.length);
  
  // CRITICAL: Use Authorization header for mobile apps (more reliable than cookies)
  // DO NOT set Content-Type for FormData - browser will set it with boundary
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      // Add platform headers to help backend identify mobile requests
      'X-Platform': ENV.PLATFORM,
      'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
    },
    credentials: 'omit',
    body: formData,
  });
  
  console.log('API: Upload response status:', response.status);
  
  if (!response.ok && response.status === 401) {
    console.error('API: Unauthorized (401) - session may have expired');
  }
  
  return response;
}

export { API_URL };
