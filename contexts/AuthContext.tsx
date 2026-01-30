
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authClient } from '@/lib/auth';
import ENV from '@/config/env';

const API_URL = ENV.BACKEND_URL;

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = async (): Promise<string | null> => {
    try {
      const session = await authClient.getSession();
      const sessionToken = session?.data?.session?.token || session?.session?.token || session?.token;
      
      if (sessionToken) {
        console.log('AuthContext: Token extracted successfully, length:', sessionToken.length);
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
        return null;
      }
      
      console.log('AuthContext: Making /me request with session token, length:', sessionToken.length);
      
      const queryParams = forceRefresh ? `?_t=${Date.now()}` : '';
      const response = await fetch(`${API_URL}/api/auth/me${queryParams}`, {
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
      
      if (!response.ok) {
        console.error('AuthContext: /me request failed with status:', response.status);
        if (response.status === 401 || response.status === 404) {
          console.log('AuthContext: User not authenticated or profile not found - clearing user state');
          setUser(null);
          return null;
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('AuthContext: /me error response:', errorText);
        throw new Error(`Failed to fetch user profile: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('AuthContext: /me response received successfully');
      
      console.log('AuthContext: Profile fetch response:', {
        hasData: !!data,
        hasId: !!data?.id,
        hasEmail: !!data?.email,
        hasUsername: !!data?.username,
        hasDisplayName: !!data?.displayName,
        hasProfile: !!data?.hasProfile,
      });
      
      const isNewFormat = !!data.id && data.hasProfile !== undefined;
      
      if (isNewFormat) {
        if (data.hasProfile) {
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
          console.log('AuthContext: Setting user with complete profile (new format)');
          setUser(combinedUser);
          return combinedUser;
        } else {
          const userWithoutProfile: User = {
            id: data.id,
            email: data.email,
            needsProfileCompletion: true,
          };
          console.log('AuthContext: Setting user without profile (new format) - needs completion');
          setUser(userWithoutProfile);
          return userWithoutProfile;
        }
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
        console.log('AuthContext: Setting user with profile (old format)');
        setUser(combinedUser);
        return combinedUser;
      } else if (data.user) {
        const userWithoutProfile: User = {
          id: data.user.id,
          email: data.user.email,
          needsProfileCompletion: true,
        };
        console.log('AuthContext: Setting user without profile (old format) - needs completion');
        setUser(userWithoutProfile);
        return userWithoutProfile;
      } else {
        console.log('AuthContext: No user data in response - clearing user state');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('AuthContext: Error fetching user profile:', error);
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
    }, 3000);
    
    fetchUser().finally(() => {
      clearTimeout(timeout);
    });

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchUser]);

  const signIn = async (email: string, password: string) => {
    console.log('AuthContext: SignIn - Attempting to sign in with email:', email);
    
    try {
      console.log('AuthContext: SignIn - Clearing cached user data BEFORE sign in');
      setUser(null);
      
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        console.error('AuthContext: SignIn - Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign in failed');
      }

      console.log('AuthContext: SignIn - Better Auth sign-in successful');
      
      console.log('AuthContext: SignIn - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('AuthContext: SignIn - Fetching fresh user profile with forced refresh');
      const userData = await fetchUserProfile(true);
      
      if (!userData) {
        console.log('AuthContext: SignIn - User may need to complete profile, continuing...');
        return;
      }
      
      console.log('AuthContext: SignIn - User state updated successfully');
    } catch (error: any) {
      console.error('AuthContext: SignIn - Error:', error);
      setUser(null);
      throw new Error(error.message || 'Sign in failed');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthContext: SignUp - Attempting to sign up with email:', email);
    
    try {
      console.log('AuthContext: SignUp - Clearing cached user data BEFORE sign up');
      setUser(null);
      
      const result = await authClient.signUp.email({
        email,
        password,
        name: email.split('@')[0],
      });

      if (result.error) {
        console.error('AuthContext: SignUp - Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign up failed');
      }

      console.log('AuthContext: SignUp - Better Auth sign-up successful');
      
      console.log('AuthContext: SignUp - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('AuthContext: SignUp - Fetching fresh user profile with forced refresh');
      const userData = await fetchUserProfile(true);
      
      if (!userData) {
        console.log('AuthContext: SignUp - User may need to complete profile, continuing...');
        return;
      }
      
      console.log('AuthContext: SignUp - User state updated successfully');
    } catch (error: any) {
      console.error('AuthContext: SignUp - Error:', error);
      setUser(null);
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('AuthContext: CompleteProfile - Completing profile with username:', username);
    
    try {
      const sessionToken = await getToken();
      
      if (!sessionToken) {
        console.error('AuthContext: CompleteProfile - No valid session found');
        throw new Error('Not authenticated. Please sign in again.');
      }
      
      const response = await fetch(`${API_URL}/api/profiles/complete`, {
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
        throw new Error(errorData.message || errorData.error || 'Failed to complete profile');
      }

      const data = await response.json();

      console.log('AuthContext: CompleteProfile - Successful, profile created');
      
      setUser(null);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await fetchUserProfile(true);
      
      console.log('AuthContext: CompleteProfile - User data refreshed successfully');
    } catch (error: any) {
      console.error('AuthContext: CompleteProfile - Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log('AuthContext: SignOut - Signing out user');
    
    try {
      console.log('AuthContext: SignOut - Clearing user state IMMEDIATELY');
      setUser(null);
      
      await authClient.signOut();
      
      console.log('AuthContext: SignOut - Better Auth signOut complete');
    } catch (error) {
      console.error('AuthContext: SignOut - Error during signOut:', error);
      
      setUser(null);
    }
    
    console.log('AuthContext: SignOut - User state cleared, user should be redirected to login');
  };

  const refreshUser = async () => {
    console.log('AuthContext: RefreshUser - Refreshing user data');
    
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
