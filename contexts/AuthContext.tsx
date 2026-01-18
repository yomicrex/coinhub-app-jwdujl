
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
      console.log('Fetching user profile from /api/auth/me...');
      
      // Fetch full user profile from /api/auth/me
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      });

      console.log('Profile fetch response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Profile data received:', {
          hasUser: !!data.user,
          hasProfile: !!data.profile,
          email: data.user?.email,
          username: data.profile?.username
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
          console.log('Setting user with profile:', combinedUser.username || 'no username');
          setUser(combinedUser);
          return combinedUser;
        } else if (data.user) {
          // User exists but no profile yet - needs profile completion
          const userWithoutProfile: User = {
            id: data.user.id,
            email: data.user.email,
            needsProfileCompletion: true,
          };
          console.log('Setting user without profile - needs completion');
          setUser(userWithoutProfile);
          return userWithoutProfile;
        } else {
          console.log('No user data in response');
          setUser(null);
          return null;
        }
      } else {
        console.log('Failed to fetch user profile (status:', response.status, ')');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      return null;
    }
  };

  const fetchUser = async () => {
    try {
      console.log('Initializing auth - fetching user...');
      await fetchUserProfile();
    } catch (error) {
      console.error('Error in fetchUser:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('Auth initialization complete');
    }
  };

  useEffect(() => {
    console.log('AuthProvider mounted, initializing...');
    fetchUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('SignIn: Attempting to sign in with email:', email);
    
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        console.error('SignIn: Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign in failed');
      }

      console.log('SignIn: Better Auth sign-in successful');
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the full user profile directly from the backend
      const userData = await fetchUserProfile();
      
      if (!userData) {
        console.error('SignIn: Failed to fetch user profile after sign in');
        throw new Error('Failed to load user profile');
      }
      
      console.log('SignIn: User state updated successfully');
    } catch (error: any) {
      console.error('SignIn: Error:', error);
      throw new Error(error.message || 'Sign in failed');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('SignUp: Attempting to sign up with email:', email);
    
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: email.split('@')[0], // Use email prefix as default name
      });

      if (result.error) {
        console.error('SignUp: Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign up failed');
      }

      console.log('SignUp: Better Auth sign-up successful');
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the full user profile
      const userData = await fetchUserProfile();
      
      if (!userData) {
        console.error('SignUp: Failed to fetch user profile after sign up');
        throw new Error('Failed to load user profile');
      }
      
      console.log('SignUp: User state updated successfully');
    } catch (error: any) {
      console.error('SignUp: Error:', error);
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('CompleteProfile: Completing profile with username:', username);
    
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
      console.error('CompleteProfile: Failed with error:', error);
      throw new Error(error.message || 'Profile completion failed');
    }

    const profile = await response.json();
    console.log('CompleteProfile: Successful, refreshing user data');
    
    // Refresh user data to get the complete profile
    await fetchUserProfile();
  };

  const signOut = async () => {
    console.log('SignOut: Signing out user');
    
    try {
      await authClient.signOut();
      setUser(null);
      console.log('SignOut: Complete');
    } catch (error) {
      console.error('SignOut: Error:', error);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    console.log('RefreshUser: Refreshing user data');
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
