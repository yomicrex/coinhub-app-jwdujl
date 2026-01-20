
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

  const fetchUserProfile = async () => {
    try {
      console.log('AuthContext: Fetching user profile from /api/auth/me...');
      
      // Fetch full user profile from /api/auth/me
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('AuthContext: Profile fetch response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('AuthContext: Profile data received:', {
          hasUser: !!data.user,
          hasProfile: !!data.profile,
          userId: data.user?.id,
          email: data.user?.email,
          username: data.profile?.username,
          displayName: data.profile?.displayName
        });
        
        // Combine auth user and profile data
        if (data.user && data.profile) {
          const combinedUser: User = {
            id: data.user.id,
            email: data.user.email,
            username: data.profile.username,
            displayName: data.profile.displayName,
            avatarUrl: data.profile.avatarUrl,
            bio: data.profile.bio,
            location: data.profile.location,
            needsProfileCompletion: !data.profile.username, // If no username, needs completion
          };
          console.log('AuthContext: Setting user with profile:', {
            id: combinedUser.id,
            email: combinedUser.email,
            username: combinedUser.username,
            displayName: combinedUser.displayName
          });
          setUser(combinedUser);
          return combinedUser;
        } else if (data.user) {
          // User exists but no profile yet - needs profile completion
          const userWithoutProfile: User = {
            id: data.user.id,
            email: data.user.email,
            needsProfileCompletion: true,
          };
          console.log('AuthContext: Setting user without profile - needs completion:', {
            id: userWithoutProfile.id,
            email: userWithoutProfile.email
          });
          setUser(userWithoutProfile);
          return userWithoutProfile;
        } else {
          console.log('AuthContext: No user data in response');
          setUser(null);
          return null;
        }
      } else {
        console.log('AuthContext: Failed to fetch user profile (status:', response.status, ') - user not authenticated');
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
    }, 3000); // 3 second timeout
    
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
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        console.error('AuthContext: SignIn - Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign in failed');
      }

      console.log('AuthContext: SignIn - Better Auth sign-in successful');
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // CRITICAL: Clear any cached user data before fetching new profile
      console.log('AuthContext: SignIn - Clearing cached user data');
      setUser(null);
      
      // Fetch the full user profile directly from the backend
      console.log('AuthContext: SignIn - Fetching fresh user profile');
      const userData = await fetchUserProfile();
      
      if (!userData) {
        console.error('AuthContext: SignIn - Failed to fetch user profile after sign in');
        throw new Error('Failed to load user profile');
      }
      
      console.log('AuthContext: SignIn - User state updated successfully:', {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName
      });
    } catch (error: any) {
      console.error('AuthContext: SignIn - Error:', error);
      throw new Error(error.message || 'Sign in failed');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthContext: SignUp - Attempting to sign up with email:', email);
    
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: email.split('@')[0], // Use email prefix as default name
      });

      if (result.error) {
        console.error('AuthContext: SignUp - Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign up failed');
      }

      console.log('AuthContext: SignUp - Better Auth sign-up successful');
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // CRITICAL: Clear any cached user data before fetching new profile
      console.log('AuthContext: SignUp - Clearing cached user data');
      setUser(null);
      
      // Fetch the full user profile
      console.log('AuthContext: SignUp - Fetching fresh user profile');
      const userData = await fetchUserProfile();
      
      if (!userData) {
        console.error('AuthContext: SignUp - Failed to fetch user profile after sign up');
        throw new Error('Failed to load user profile');
      }
      
      console.log('AuthContext: SignUp - User state updated successfully:', {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName
      });
    } catch (error: any) {
      console.error('AuthContext: SignUp - Error:', error);
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('AuthContext: CompleteProfile - Completing profile with username:', username);
    
    const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, displayName }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('AuthContext: CompleteProfile - Failed with error:', error);
      throw new Error(error.message || 'Profile completion failed');
    }

    const profile = await response.json();
    console.log('AuthContext: CompleteProfile - Successful, refreshing user data');
    
    // CRITICAL: Clear cached user data before refreshing
    setUser(null);
    
    // Refresh user data to get the complete profile
    await fetchUserProfile();
  };

  const signOut = async () => {
    console.log('AuthContext: SignOut - Signing out user');
    
    try {
      await authClient.signOut();
      
      // CRITICAL: Clear user state immediately
      console.log('AuthContext: SignOut - Clearing user state');
      setUser(null);
      
      console.log('AuthContext: SignOut - Complete');
    } catch (error) {
      console.error('AuthContext: SignOut - Error:', error);
      
      // Even if signOut fails, clear the user state
      setUser(null);
    }
  };

  const refreshUser = async () => {
    console.log('AuthContext: RefreshUser - Refreshing user data');
    
    // CRITICAL: Clear cached user data before refreshing
    setUser(null);
    
    await fetchUserProfile();
  };

  const getToken = async (): Promise<string | null> => {
    // Better Auth uses session cookies, not tokens
    // Return null as we don't need tokens anymore
    return null;
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
