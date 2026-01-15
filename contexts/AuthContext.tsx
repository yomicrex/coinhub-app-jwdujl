
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  collection_privacy: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, displayName: string, inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Loading stored token');
    loadStoredToken();
  }, []);

  const loadStoredToken = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      if (storedToken) {
        console.log('AuthProvider: Found stored token, fetching user data');
        setToken(storedToken);
        await fetchUser(storedToken);
      }
    } catch (error) {
      console.error('AuthProvider: Error loading token:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async (authToken: string) => {
    try {
      console.log('AuthProvider: Fetching user data from /api/auth/me');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('AuthProvider: User data fetched successfully:', data.user.username);
        setUser(data.user);
      } else {
        console.log('AuthProvider: Failed to fetch user, clearing token');
        await SecureStore.deleteItemAsync('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('AuthProvider: Error fetching user:', error);
    }
  };

  const login = async (email: string, password: string) => {
    console.log('AuthProvider: Attempting login for:', email);
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('AuthProvider: Login failed:', error);
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    console.log('AuthProvider: Login successful for user:', data.user.username);
    await SecureStore.setItemAsync('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, username: string, displayName: string, inviteCode: string) => {
    console.log('AuthProvider: Attempting registration for:', username);
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, username, displayName, inviteCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('AuthProvider: Registration failed:', error);
      throw new Error(error.message || 'Registration failed');
    }

    const data = await response.json();
    console.log('AuthProvider: Registration successful for user:', data.user.username);
    await SecureStore.setItemAsync('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    console.log('AuthProvider: Logging out user');
    await SecureStore.deleteItemAsync('auth_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      console.log('AuthProvider: Refreshing user data');
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
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
