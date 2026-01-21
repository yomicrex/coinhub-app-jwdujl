
import Constants from 'expo-constants';
import { authClient } from '@/lib/auth';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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
 * Make an authenticated API request with Better Auth session cookie
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
  
  console.log('API: Making authenticated request to:', url);
  
  // CRITICAL FIX: Use Authorization header for React Native (more reliable than cookies)
  // Backend's extractSessionToken supports both "Bearer <token>" and "session=<token>" cookie
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${sessionToken}`,
  };
  
  // Add Content-Type for JSON requests if not already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  console.log('API: Response status:', response.status);
  
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
  
  console.log('API: Uploading to:', url);
  
  // CRITICAL FIX: Use Authorization header for React Native (more reliable than cookies)
  // DO NOT set Content-Type for FormData - browser will set it with boundary
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
    credentials: 'include',
    body: formData,
  });
  
  console.log('API: Upload response status:', response.status);
  
  return response;
}

// Legacy functions for backward compatibility
export async function deleteCurrentUserAccount() {
  console.log('API: Deleting current user account');
  const response = await authenticatedFetch('/api/users/me', {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete account');
  }
  
  return response.json();
}

export async function deleteAllUsers() {
  console.log('API: Admin deleting all users');
  const response = await authenticatedFetch('/api/admin/delete-all-users', {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete all users');
  }
  
  return response.json();
}

export async function grantAdminAccess(email: string) {
  console.log('API: Granting admin access to:', email);
  const response = await authenticatedFetch('/api/admin/grant-admin-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to grant admin access');
  }
  
  return response.json();
}

export { API_URL };
