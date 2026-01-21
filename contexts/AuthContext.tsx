
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '@/lib/auth';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

console.log('Auth: Using backend URL:', API_URL);

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
      // Get session from Better Auth
      const session = await authClient.getSession();
      
      // CRITICAL FIX: Better Auth returns session in different formats
      // Format 1: { data: { session: { token: "..." } } }
      // Format 2: { session: { token: "..." } }
      // Format 3: { token: "..." }
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

  const fetchUserProfile = async (forceRefresh = false) => {
    try {
      console.log('AuthContext: Fetching user profile from /me...', forceRefresh ? '(forced refresh)' : '');
      
      // Get the session token
      const sessionToken = await getToken();
      
      if (!sessionToken) {
        console.log('AuthContext: No valid session token found - user not authenticated');
        setUser(null);
        return null;
      }
      
      console.log('AuthContext: Making /me request with session token');
      
      // CRITICAL FIX: Backend expects session token in "session=<token>" cookie format
      // NOT "better-auth.session_token=<token>"
      const queryParams = forceRefresh ? `?_t=${Date.now()}` : '';
      const response = await fetch(`${API_URL}/api/auth/me${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // CRITICAL: Send token in the format the backend expects: "session=<token>"
          'Cookie': `session=${sessionToken}`,
        },
        credentials: 'include',
      });
      
      console.log('AuthContext: /me response status:', response.status);
      
      if (!response.ok) {
        console.error('AuthContext: /me request failed with status:', response.status);
        if (response.status === 401 || response.status === 404) {
          console.log('AuthContext: User not authenticated or profile not found - clearing user state');
          setUser(null);
          return null;
        }
        throw new Error(`Failed to fetch user profile: ${response.status}`);
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
      
      // CRITICAL FIX: Check for new format FIRST (data.id exists means new format)
      // New format: { id, email, username, displayName, hasProfile, avatarUrl, bio, location }
      const isNewFormat = !!data.id && data.hasProfile !== undefined;
      
      // Handle new backend response format: { id, email, username, displayName, hasProfile }
      if (isNewFormat) {
        if (data.hasProfile) {
          // User has complete profile
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
          // User exists but no profile - needs completion
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
      
      // Handle old backend response format: { user, profile }
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
        // User exists but no profile yet - needs profile completion
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
  };

  const fetchUser = async () => {
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
  };

  useEffect(() => {
    console.log('AuthContext: AuthProvider mounted, initializing...');
    
    // Set a timeout to ensure loading doesn't hang forever
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
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('AuthContext: SignIn - Attempting to sign in with email:', email);
    
    try {
      // CRITICAL: Clear any cached user data BEFORE signing in
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
      
      // Wait for the session to be stored by Better Auth client
      console.log('AuthContext: SignIn - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the full user profile directly from the backend with forced refresh
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
      // CRITICAL: Clear any cached user data BEFORE signing up
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
      
      // Wait for the session to be stored by Better Auth client
      console.log('AuthContext: SignUp - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the full user profile with forced refresh
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
      // Get the session token
      const sessionToken = await getToken();
      
      if (!sessionToken) {
        console.error('AuthContext: CompleteProfile - No valid session found');
        throw new Error('Not authenticated. Please sign in again.');
      }
      
      // CRITICAL FIX: Backend expects session token in "session=<token>" cookie format
      const response = await fetch(`${API_URL}/api/profiles/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ username, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AuthContext: CompleteProfile - Failed with status:', response.status, errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to complete profile');
      }

      const data = await response.json();

      console.log('AuthContext: CompleteProfile - Successful, profile created');
      
      // CRITICAL: Clear cached user data before refreshing
      setUser(null);
      
      // Wait a moment for the profile to be saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh user data to get the complete profile with forced refresh
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
      // CRITICAL: Clear user state FIRST before making any API calls
      console.log('AuthContext: SignOut - Clearing user state IMMEDIATELY');
      setUser(null);
      
      // Call Better Auth signOut
      await authClient.signOut();
      
      console.log('AuthContext: SignOut - Better Auth signOut complete');
    } catch (error) {
      console.error('AuthContext: SignOut - Error during signOut:', error);
      
      // Even if signOut fails, ensure user state is cleared
      setUser(null);
    }
    
    console.log('AuthContext: SignOut - User state cleared, user should be redirected to login');
  };

  const refreshUser = async () => {
    console.log('AuthContext: RefreshUser - Refreshing user data');
    
    // CRITICAL: Clear cached user data before refreshing
    setUser(null);
    
    // Wait a moment before fetching
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
