
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

  const fetchUser = async () => {
    try {
      console.log('Fetching user session...');
      const session = await authClient.getSession();
      
      if (!session?.user) {
        console.log('No active session found');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('Session found, fetching full user profile...');
      
      // Fetch full user profile from /api/auth/me
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User fetched successfully:', data.user?.username || data.user?.email);
        setUser(data.user);
      } else {
        console.log('Failed to fetch user profile (status:', response.status, ')');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
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

      console.log('SignIn: Successful');
      
      // Fetch the full user profile
      await fetchUser();
      
      console.log('SignIn: User state updated');
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

      console.log('SignUp: Successful');
      
      // Fetch the full user profile
      await fetchUser();
      
      console.log('SignUp: User state updated');
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

    const data = await response.json();
    console.log('CompleteProfile: Successful');
    setUser(data.user);
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
    await fetchUser();
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
