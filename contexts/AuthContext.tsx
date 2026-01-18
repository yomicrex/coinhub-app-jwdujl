
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function storeToken(token: string) {
  console.log('Storing session token');
  if (Platform.OS === 'web') {
    localStorage.setItem('sessionToken', token);
  } else {
    await SecureStore.setItemAsync('sessionToken', token);
  }
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('sessionToken');
  } else {
    return await SecureStore.getItemAsync('sessionToken');
  }
}

async function removeToken() {
  console.log('Removing session token');
  if (Platform.OS === 'web') {
    localStorage.removeItem('sessionToken');
  } else {
    await SecureStore.deleteItemAsync('sessionToken');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const token = await getToken();
      if (!token) {
        console.log('No session token found');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('Fetching user with session token');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User fetched successfully:', data.user?.username);
        setUser(data.user);
      } else {
        console.log('Failed to fetch user, clearing token');
        await removeToken();
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Signing in with email:', email);
    const response = await fetch(`${API_URL}/api/auth/email/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sign in failed');
    }

    const data = await response.json();
    console.log('Sign in successful, storing token');
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    setUser(data.user);
  };

  const signUp = async (email: string, password: string) => {
    console.log('Signing up with email:', email);
    const response = await fetch(`${API_URL}/api/auth/email/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sign up failed');
    }

    const data = await response.json();
    console.log('Sign up successful, storing token');
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    setUser(data.user);
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('Completing profile with username:', username);
    const token = await getToken();
    
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
      throw new Error(error.message || 'Profile completion failed');
    }

    const data = await response.json();
    console.log('Profile completed successfully');
    setUser(data.user);
  };

  const signOut = async () => {
    console.log('Signing out');
    await removeToken();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, completeProfile, refreshUser }}>
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
