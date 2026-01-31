
import { authClient } from '@/lib/auth';
import ENV from '@/config/env';
import { addAuthDebugLog } from '@/components/AuthDebugPanel';

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
      
      // Debug log
      addAuthDebugLog({
        type: 'info',
        endpoint: 'getSessionToken',
        message: `Token extracted successfully (length: ${sessionToken.length})`,
      });
      
      return sessionToken;
    }
    
    console.log('API: No session token found');
    
    // Debug log
    addAuthDebugLog({
      type: 'error',
      endpoint: 'getSessionToken',
      error: 'No session token found',
    });
    
    return null;
  } catch (error) {
    console.error('API: Error getting token:', error);
    
    // Debug log
    addAuthDebugLog({
      type: 'error',
      endpoint: 'getSessionToken',
      error: error instanceof Error ? error.message : String(error),
    });
    
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
    
    // Debug log
    addAuthDebugLog({
      type: 'error',
      endpoint,
      method: options.method || 'GET',
      error: 'No session token available',
    });
    
    throw new Error('Not authenticated. Please sign in again.');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  console.log('API: Making authenticated request to:', url);
  console.log('API: Token length:', sessionToken.length);
  console.log('API: App Type:', ENV.APP_TYPE, '| Platform:', ENV.PLATFORM);
  
  // CRITICAL: Use Authorization header for mobile apps (more reliable than cookies)
  // Backend's extractSessionToken prioritizes Authorization header over cookies
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'Authorization': `Bearer ${sessionToken}`,
    // Add platform headers to help backend identify mobile requests
    'X-Platform': ENV.PLATFORM,
    'X-App-Type': ENV.APP_TYPE,
  };
  
  // CRITICAL: Verify headers are set correctly for mobile apps
  if (ENV.IS_STANDALONE && ENV.APP_TYPE !== 'standalone') {
    console.error('⚠️ WARNING: Running in standalone but X-App-Type is not "standalone"!');
  }
  if (ENV.IS_EXPO_GO && ENV.APP_TYPE !== 'expo-go') {
    console.error('⚠️ WARNING: Running in Expo Go but X-App-Type is not "expo-go"!');
  }
  
  // Add Content-Type for JSON requests if not already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Debug log - request
  addAuthDebugLog({
    type: 'request',
    endpoint: url,
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${sessionToken.substring(0, 20)}...`,
      'X-Platform': headers['X-Platform'],
      'X-App-Type': headers['X-App-Type'],
      'Content-Type': headers['Content-Type'] || 'none',
    },
    body: options.body ? String(options.body).substring(0, 300) : undefined,
  });
  
  // CRITICAL: Use "omit" for credentials to avoid cookie-based auth issues on mobile
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit',
  });
  
  console.log('API: Response status:', response.status, 'for', url);
  
  // Get response body for logging
  const responseClone = response.clone();
  let responseBody = '';
  try {
    responseBody = await responseClone.text();
  } catch (e) {
    responseBody = 'Unable to read response body';
  }
  
  // Debug log - response
  if (response.ok) {
    addAuthDebugLog({
      type: 'response',
      endpoint: url,
      method: options.method || 'GET',
      status: response.status,
      body: responseBody.substring(0, 300),
    });
  } else {
    addAuthDebugLog({
      type: 'error',
      endpoint: url,
      method: options.method || 'GET',
      status: response.status,
      error: `Request failed with status ${response.status}`,
      body: responseBody.substring(0, 300),
    });
  }
  
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
    
    // Debug log
    addAuthDebugLog({
      type: 'error',
      endpoint,
      method: 'POST',
      error: 'No session token available for upload',
    });
    
    throw new Error('Not authenticated. Please sign in again.');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  console.log('API: Uploading to:', url, 'with token length:', sessionToken.length);
  
  // CRITICAL: Use Authorization header for mobile apps (more reliable than cookies)
  // DO NOT set Content-Type for FormData - browser will set it with boundary
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${sessionToken}`,
    // Add platform headers to help backend identify mobile requests
    'X-Platform': ENV.PLATFORM,
    'X-App-Type': ENV.APP_TYPE,
  };
  
  // Debug log - upload request
  addAuthDebugLog({
    type: 'request',
    endpoint: url,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken.substring(0, 20)}...`,
      'X-Platform': headers['X-Platform'],
      'X-App-Type': headers['X-App-Type'],
    },
    message: 'File upload request',
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'omit',
    body: formData,
  });
  
  console.log('API: Upload response status:', response.status);
  
  // Get response body for logging
  const responseClone = response.clone();
  let responseBody = '';
  try {
    responseBody = await responseClone.text();
  } catch (e) {
    responseBody = 'Unable to read response body';
  }
  
  // Debug log - upload response
  if (response.ok) {
    addAuthDebugLog({
      type: 'response',
      endpoint: url,
      method: 'POST',
      status: response.status,
      message: 'File upload successful',
      body: responseBody.substring(0, 300),
    });
  } else {
    addAuthDebugLog({
      type: 'error',
      endpoint: url,
      method: 'POST',
      status: response.status,
      error: `Upload failed with status ${response.status}`,
      body: responseBody.substring(0, 300),
    });
  }
  
  if (!response.ok && response.status === 401) {
    console.error('API: Unauthorized (401) - session may have expired');
  }
  
  return response;
}

export { API_URL };
