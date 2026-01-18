
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

async function storeToken(token: string) {
  console.log('Storing session token');
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem('sessionToken', token);
    } else {
      await SecureStore.setItemAsync('sessionToken', token);
    }
    console.log('Session token stored successfully');
  } catch (error) {
    console.error('Error storing token:', error);
  }
}

async function getTokenFromStorage(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('sessionToken');
    } else {
      return await SecureStore.getItemAsync('sessionToken');
    }
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

async function removeToken() {
  console.log('Removing session token');
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('sessionToken');
    } else {
      await SecureStore.deleteItemAsync('sessionToken');
    }
    console.log('Session token removed successfully');
  } catch (error) {
    console.error('Error removing token:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      console.log('Fetching user from storage...');
      const token = await getTokenFromStorage();
      if (!token) {
        console.log('No session token found');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('Session token found, fetching user profile...');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User fetched successfully:', data.user?.username || data.user?.email);
        setUser(data.user);
      } else {
        console.log('Failed to fetch user (status:', response.status, '), clearing token');
        await removeToken();
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
    const response = await fetch(`${API_URL}/api/auth/email/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('SignIn: Failed with error:', error);
      throw new Error(error.message || 'Sign in failed');
    }

    const data = await response.json();
    console.log('SignIn: Successful, received token');
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    setUser(data.user);
    console.log('SignIn: User state updated');
  };

  const signUp = async (email: string, password: string) => {
    console.log('SignUp: Attempting to sign up with email:', email);
    const response = await fetch(`${API_URL}/api/auth/email/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('SignUp: Failed with error:', error);
      throw new Error(error.message || 'Sign up failed');
    }

    const data = await response.json();
    console.log('SignUp: Successful, received token');
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    setUser(data.user);
    console.log('SignUp: User state updated');
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('CompleteProfile: Completing profile with username:', username);
    const token = await getTokenFromStorage();
    
    const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
    await removeToken();
    setUser(null);
    console.log('SignOut: Complete');
  };

  const refreshUser = async () => {
    console.log('RefreshUser: Refreshing user data');
    await fetchUser();
  };

  const getToken = async (): Promise<string | null> => {
    return await getTokenFromStorage();
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
