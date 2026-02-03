
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authClient } from '@/lib/auth';
import ENV from '@/config/env';
import { addAuthDebugLog } from '@/components/AuthDebugPanel';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = ENV.BACKEND_URL;
const STORAGE_KEY = `${ENV.APP_SCHEME}_session_token`;

console.log('AuthContext: Using backend URL:', API_URL);
console.log('AuthContext: Platform:', ENV.PLATFORM, 'Standalone:', ENV.IS_STANDALONE, 'Expo Go:', ENV.IS_EXPO_GO);

interface User {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  needsProfileCompletion?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (username: string, displayName: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for token storage
async function storeToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, token);
    }
    console.log('AuthContext: Token stored successfully');
  } catch (error) {
    console.error('AuthContext: Error storing token:', error);
  }
}

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(STORAGE_KEY);
    } else {
      return await SecureStore.getItemAsync(STORAGE_KEY);
    }
  } catch (error) {
    console.error('AuthContext: Error getting stored token:', error);
    return null;
  }
}

async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
    console.log('AuthContext: Token cleared successfully');
  } catch (error) {
    console.error('AuthContext: Error clearing token:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = async (): Promise<string | null> => {
    try {
      // First try to get the token from our custom storage
      const storedToken = await getStoredToken();
      
      if (storedToken) {
        console.log('AuthContext: Token found in storage, length:', storedToken.length);
        return storedToken;
      }
      
      // Fallback to Better Auth session (for OAuth flows)
      const session = await authClient.getSession();
      const sessionToken = session?.data?.session?.token || session?.session?.token || session?.token;
      
      if (sessionToken) {
        console.log('AuthContext: Token extracted from Better Auth session, length:', sessionToken.length);
        // Store it for future use
        await storeToken(sessionToken);
        return sessionToken;
      }
      
      console.log('AuthContext: No session token found');
      return null;
    } catch (error) {
      console.error('AuthContext: Error getting token:', error);
      return null;
    }
  };

  const fetchUserProfile = useCallback(async (forceRefresh = false) => {
    try {
      console.log('AuthContext: Fetching user profile from /me...', forceRefresh ? '(forced refresh)' : '');
      
      const sessionToken = await getToken();
      
      if (!sessionToken) {
        console.log('AuthContext: No valid session token found - user not authenticated');
        setUser(null);
        
        addAuthDebugLog({
          type: 'error',
          endpoint: '/api/auth/me',
          method: 'GET',
          error: 'No session token found',
        });
        
        return null;
      }
      
      console.log('AuthContext: Making /me request with session token, length:', sessionToken.length);
      
      const queryParams = forceRefresh ? `?_t=${Date.now()}` : '';
      const url = `${API_URL}/api/auth/me${queryParams}`;
      
      addAuthDebugLog({
        type: 'request',
        endpoint: url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken.substring(0, 20)}...`,
          'X-Platform': ENV.PLATFORM,
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
        },
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Platform': ENV.PLATFORM,
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
        },
        credentials: 'omit',
      });
      
      console.log('AuthContext: /me response status:', response.status);
      
      const responseClone = response.clone();
      let responseBody = '';
      try {
        responseBody = await responseClone.text();
      } catch (e) {
        responseBody = 'Unable to read response body';
      }
      
      if (!response.ok) {
        console.error('AuthContext: /me request failed with status:', response.status);
        
        addAuthDebugLog({
          type: 'error',
          endpoint: url,
          method: 'GET',
          status: response.status,
          error: `Request failed with status ${response.status}`,
          body: responseBody.substring(0, 300),
        });
        
        if (response.status === 401 || response.status === 404) {
          console.log('AuthContext: User not authenticated or profile not found - clearing user state and token');
          setUser(null);
          await clearStoredToken();
          return null;
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('AuthContext: /me error response:', errorText);
        throw new Error(`Failed to fetch user profile: ${response.status} - ${errorText}`);
      }
      
      addAuthDebugLog({
        type: 'response',
        endpoint: url,
        method: 'GET',
        status: response.status,
        body: responseBody.substring(0, 300),
      });
      
      const data = await response.json();
      console.log('AuthContext: /me response received successfully');
      
      console.log('AuthContext: Profile fetch response:', {
        hasData: !!data,
        hasId: !!data?.id,
        hasEmail: !!data?.email,
        hasUsername: !!data?.username,
        hasDisplayName: !!data?.displayName,
        hasProfile: data?.hasProfile,
        needsProfileCompletion: data?.needsProfileCompletion,
        message: data?.message,
      });
      
      if (data.hasProfile === false || data.needsProfileCompletion === true) {
        const userWithoutProfile: User = {
          id: data.id,
          email: data.email,
          needsProfileCompletion: true,
        };
        console.log('AuthContext: User authenticated but profile not completed - needs profile completion');
        setUser(userWithoutProfile);
        return userWithoutProfile;
      }
      
      if (data.hasProfile === true && data.username) {
        const combinedUser: User = {
          id: data.id,
          email: data.email,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          bio: data.bio,
          location: data.location,
          needsProfileCompletion: false,
        };
        console.log('AuthContext: User authenticated with complete profile');
        setUser(combinedUser);
        return combinedUser;
      }
      
      if (data.user && data.profile) {
        const combinedUser: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.profile.username,
          displayName: data.profile.displayName,
          avatarUrl: data.profile.avatarUrl,
          bio: data.profile.bio,
          location: data.profile.location,
          needsProfileCompletion: !data.profile.username,
        };
        console.log('AuthContext: Setting user with profile (legacy format)');
        setUser(combinedUser);
        return combinedUser;
      } else if (data.user) {
        const userWithoutProfile: User = {
          id: data.user.id,
          email: data.user.email,
          needsProfileCompletion: true,
        };
        console.log('AuthContext: Setting user without profile (legacy format) - needs completion');
        setUser(userWithoutProfile);
        return userWithoutProfile;
      }
      
      console.log('AuthContext: No valid user data in response - clearing user state');
      setUser(null);
      return null;
    } catch (error) {
      console.error('AuthContext: Error fetching user profile:', error);
      
      addAuthDebugLog({
        type: 'error',
        endpoint: '/api/auth/me',
        method: 'GET',
        error: error instanceof Error ? error.message : String(error),
      });
      
      setUser(null);
      return null;
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      console.log('AuthContext: Initializing auth - fetching user...');
      await fetchUserProfile();
    } catch (error) {
      console.error('AuthContext: Error in fetchUser:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('AuthContext: Auth initialization complete');
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    console.log('AuthContext: AuthProvider mounted, initializing...');
    
    const timeout = setTimeout(() => {
      console.log('AuthContext: Auth initialization timeout - forcing loading to false');
      setLoading(false);
    }, 5000);
    
    fetchUser()
      .catch((error) => {
        console.error('AuthContext: Critical error during initialization:', error);
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchUser]);

  const signIn = async (email: string, password: string) => {
    console.log('AuthContext: SignIn - Attempting to sign in with email:', email);
    
    addAuthDebugLog({
      type: 'info',
      endpoint: '/api/auth/sign-in',
      method: 'POST',
      message: `Sign in attempt for email: ${email}`,
    });
    
    try {
      console.log('AuthContext: SignIn - Clearing cached user data and token BEFORE sign in');
      setUser(null);
      await clearStoredToken();
      
      // Use our custom backend endpoint directly
      const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform': ENV.PLATFORM,
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
        },
        credentials: 'omit',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Sign in failed' }));
        console.error('AuthContext: SignIn - Failed with error:', errorData);
        
        addAuthDebugLog({
          type: 'error',
          endpoint: '/api/auth/sign-in/email',
          method: 'POST',
          status: response.status,
          error: errorData.error || errorData.message || 'Sign in failed',
        });
        
        throw new Error(errorData.error || errorData.message || 'Sign in failed');
      }

      const data = await response.json();
      console.log('AuthContext: SignIn - Backend sign-in successful');
      
      // Extract and store the session token
      const sessionToken = data.session?.token;
      if (!sessionToken) {
        console.error('AuthContext: SignIn - No session token in response');
        throw new Error('No session token received');
      }
      
      console.log('AuthContext: SignIn - Storing session token, length:', sessionToken.length);
      await storeToken(sessionToken);
      
      addAuthDebugLog({
        type: 'response',
        endpoint: '/api/auth/sign-in/email',
        method: 'POST',
        status: 200,
        message: 'Sign in successful, token stored',
      });
      
      console.log('AuthContext: SignIn - Waiting for token to be persisted...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('AuthContext: SignIn - Fetching fresh user profile with forced refresh');
      const userData = await fetchUserProfile(true);
      
      if (!userData || userData.needsProfileCompletion) {
        console.log('AuthContext: SignIn - User needs to complete profile, stopping here');
        return;
      }
      
      console.log('AuthContext: SignIn - User state updated successfully with complete profile');
    } catch (error: any) {
      console.error('AuthContext: SignIn - Error:', error);
      
      const errorMessage = error.message || 'Sign in failed';
      const errorName = error.name || 'Error';
      const errorStack = error.stack?.substring(0, 500) || 'No stack trace';
      
      console.error('AuthContext: Sign-in exception details:', {
        name: errorName,
        message: errorMessage,
        stack: errorStack,
      });
      
      addAuthDebugLog({
        type: 'error',
        endpoint: '/api/auth/sign-in',
        method: 'POST',
        error: `${errorName}: ${errorMessage}`,
        body: `Stack: ${errorStack}`,
      });
      
      setUser(null);
      await clearStoredToken();
      throw new Error(error.message || 'Sign in failed');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthContext: SignUp - Attempting to sign up with email:', email);
    
    addAuthDebugLog({
      type: 'info',
      endpoint: '/api/auth/sign-up',
      method: 'POST',
      message: `Sign up attempt for email: ${email}`,
    });
    
    try {
      console.log('AuthContext: SignUp - Clearing cached user data and token BEFORE sign up');
      setUser(null);
      await clearStoredToken();
      
      // Use our custom backend endpoint directly
      const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform': ENV.PLATFORM,
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
        },
        credentials: 'omit',
        body: JSON.stringify({ 
          email, 
          password,
          name: email.split('@')[0]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Sign up failed' }));
        console.error('AuthContext: SignUp - Failed with error:', errorData);
        
        addAuthDebugLog({
          type: 'error',
          endpoint: '/api/auth/sign-up/email',
          method: 'POST',
          status: response.status,
          error: errorData.error || errorData.details || 'Sign up failed',
        });
        
        throw new Error(errorData.error || errorData.details || 'Sign up failed');
      }

      const data = await response.json();
      console.log('AuthContext: SignUp - Backend sign-up successful');
      
      // Extract and store the session token
      const sessionToken = data.session?.token;
      if (!sessionToken) {
        console.error('AuthContext: SignUp - No session token in response');
        throw new Error('No session token received');
      }
      
      console.log('AuthContext: SignUp - Storing session token, length:', sessionToken.length);
      await storeToken(sessionToken);
      
      const userWithoutProfile: User = {
        id: data.user?.id,
        email: data.user?.email || email,
        needsProfileCompletion: true,
      };
      
      setUser(userWithoutProfile);
      
      addAuthDebugLog({
        type: 'response',
        endpoint: '/api/auth/sign-up/email',
        method: 'POST',
        status: 200,
        message: 'Sign up successful - profile completion needed',
      });
      
      console.log('AuthContext: SignUp - User needs to complete profile');
    } catch (error: any) {
      console.error('AuthContext: SignUp - Error:', error);
      
      addAuthDebugLog({
        type: 'error',
        endpoint: '/api/auth/sign-up',
        method: 'POST',
        error: error.message || 'Sign up failed',
      });
      
      setUser(null);
      await clearStoredToken();
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('AuthContext: CompleteProfile - Completing profile with username:', username);
    
    addAuthDebugLog({
      type: 'info',
      endpoint: '/api/profiles/complete',
      method: 'POST',
      message: `Complete profile for username: ${username}`,
    });
    
    try {
      const sessionToken = await getToken();
      
      if (!sessionToken) {
        console.error('AuthContext: CompleteProfile - No valid session found');
        
        addAuthDebugLog({
          type: 'error',
          endpoint: '/api/profiles/complete',
          method: 'POST',
          error: 'No session token available',
        });
        
        throw new Error('Not authenticated. Please sign in again.');
      }
      
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Platform': ENV.PLATFORM,
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
        },
        credentials: 'omit',
        body: JSON.stringify({ username, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AuthContext: CompleteProfile - Failed with status:', response.status, errorData);
        
        addAuthDebugLog({
          type: 'error',
          endpoint: '/api/auth/complete-profile',
          method: 'POST',
          status: response.status,
          error: errorData.message || errorData.error || 'Failed to complete profile',
        });
        
        throw new Error(errorData.message || errorData.error || 'Failed to complete profile');
      }

      const data = await response.json();

      console.log('AuthContext: CompleteProfile - Successful, profile created');
      
      addAuthDebugLog({
        type: 'response',
        endpoint: '/api/auth/complete-profile',
        method: 'POST',
        status: 200,
        message: 'Profile completed successfully',
      });
      
      setUser(null);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await fetchUserProfile(true);
      
      console.log('AuthContext: CompleteProfile - User data refreshed successfully');
    } catch (error: any) {
      console.error('AuthContext: CompleteProfile - Error:', error);
      
      addAuthDebugLog({
        type: 'error',
        endpoint: '/api/profiles/complete',
        method: 'POST',
        error: error.message || 'Failed to complete profile',
      });
      
      throw error;
    }
  };

  const signOut = async () => {
    console.log('AuthContext: SignOut - Signing out user');
    
    addAuthDebugLog({
      type: 'info',
      endpoint: '/api/auth/sign-out',
      method: 'POST',
      message: 'Sign out initiated',
    });
    
    try {
      console.log('AuthContext: SignOut - Clearing user state and token IMMEDIATELY');
      setUser(null);
      await clearStoredToken();
      
      // Try to sign out from Better Auth (for OAuth sessions)
      try {
        await authClient.signOut();
        console.log('AuthContext: SignOut - Better Auth signOut complete');
      } catch (authError) {
        console.log('AuthContext: SignOut - Better Auth signOut not needed or failed (expected for email/password)');
      }
      
      addAuthDebugLog({
        type: 'response',
        endpoint: '/api/auth/sign-out',
        method: 'POST',
        status: 200,
        message: 'Sign out successful',
      });
    } catch (error) {
      console.error('AuthContext: SignOut - Error during signOut:', error);
      
      addAuthDebugLog({
        type: 'error',
        endpoint: '/api/auth/sign-out',
        method: 'POST',
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Still clear local state even if backend call fails
      setUser(null);
      await clearStoredToken();
    }
    
    console.log('AuthContext: SignOut - User state cleared, user should be redirected to login');
  };

  const refreshUser = async () => {
    console.log('AuthContext: RefreshUser - Refreshing user data');
    
    addAuthDebugLog({
      type: 'info',
      endpoint: 'refreshUser',
      message: 'Refreshing user data',
    });
    
    setUser(null);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await fetchUserProfile(true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, completeProfile, refreshUser, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
