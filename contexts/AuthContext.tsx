
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
        console.log('Failed to fetch user profile (status:', response.status, ') - user not authenticated');
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
    
    // Set a timeout to ensure loading doesn't hang forever
    const timeout = setTimeout(() => {
      console.log('Auth initialization timeout - forcing loading to false');
      setLoading(false);
    }, 3000); // 3 second timeout (reduced from 5)
    
    fetchUser().finally(() => {
      clearTimeout(timeout);
    });

    return () => {
      clearTimeout(timeout);
    };
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
</write file>

Now let me also add better logging to the index screen to see what's happening:

<write file="app/index.tsx">
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();

  console.log('Index screen - loading:', loading, 'user:', user?.username, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('Index screen mounted');
  }, []);

  useEffect(() => {
    console.log('Index screen - Auth state changed:', { loading, hasUser: !!user, username: user?.username });
  }, [loading, user]);

  if (loading) {
    console.log('Showing loading indicator');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 48, marginBottom: 24 }}>🪙</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16, fontSize: 16 }}>Loading CoinHub...</Text>
      </View>
    );
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (user.needsProfileCompletion) {
    console.log('User needs profile completion, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  console.log('User authenticated, redirecting to home');
  return <Redirect href="/(tabs)/(home)" />;
}
</write file>

Now let me check if there's an issue with the home screen that might be causing a blank screen:The code looks fine. The issue is that the preview screen is showing nothing. This could be because:

1. The app is stuck in loading state
2. The auth screen is not rendering properly
3. There's a navigation issue

Let me simplify the flow and add a test screen to see if anything renders at all. Let me create a simple test to see if the app is even loading:

<write file="app/index.tsx">
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();
  const [showDebug, setShowDebug] = useState(false);

  console.log('Index screen - loading:', loading, 'user:', user?.username, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('Index screen mounted');
    // Show debug info after 2 seconds if still loading
    const timer = setTimeout(() => {
      if (loading) {
        console.log('Still loading after 2 seconds, showing debug info');
        setShowDebug(true);
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log('Index screen - Auth state changed:', { loading, hasUser: !!user, username: user?.username });
  }, [loading, user]);

  if (loading) {
    console.log('Showing loading indicator');
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🪙</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading CoinHub...</Text>
        {showDebug && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>Loading: {loading ? 'true' : 'false'}</Text>
            <Text style={styles.debugText}>User: {user ? 'exists' : 'null'}</Text>
            <Text style={styles.debugText}>If stuck, check console logs</Text>
          </View>
        )}
      </View>
    );
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (user.needsProfileCompletion) {
    console.log('User needs profile completion, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  console.log('User authenticated, redirecting to home');
  return <Redirect href="/(tabs)/(home)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  logo: {
    fontSize: 48,
    marginBottom: 24,
  },
  loadingText: {
    color: colors.text,
    marginTop: 16,
    fontSize: 16,
  },
  debugContainer: {
    marginTop: 40,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugText: {
    color: colors.text,
    fontSize: 12,
    marginBottom: 4,
  },
});
</write file>

Now let me also ensure the auth screen has better visibility and error handling:

<write file="app/auth.tsx">
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'signin' | 'signup' | 'complete-profile';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, completeProfile } = useAuth();
  const router = useRouter();

  console.log('Auth screen - mode:', mode, 'user:', user?.username, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('Auth screen mounted');
    if (user && !user.needsProfileCompletion) {
      console.log('User authenticated and profile complete, navigating to home');
      router.replace('/(tabs)/(home)');
    } else if (user && user.needsProfileCompletion) {
      console.log('User needs profile completion');
      setMode('complete-profile');
    }
  }, [user]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    console.log('Attempting sign in with email:', email);
    setLoading(true);
    try {
      await signIn(email, password);
      console.log('Sign in successful');
    } catch (error: any) {
      console.error('Sign in error:', error);
      Alert.alert('Sign In Failed', error.message || 'Please check your credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    console.log('Attempting sign up with email:', email);
    setLoading(true);
    try {
      await signUp(email, password);
      console.log('Sign up successful');
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!username || !displayName) {
      Alert.alert('Error', 'Please enter username and display name');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    console.log('Completing profile with username:', username);
    setLoading(true);
    try {
      await completeProfile(username, displayName);
      console.log('Profile completion successful');
    } catch (error: any) {
      console.error('Profile completion error:', error);
      Alert.alert('Profile Completion Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'complete-profile') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Choose a username to get started</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  placeholderTextColor={colors.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleCompleteProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.buttonText}>Complete Profile</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.logo}>🪙</Text>
            <Text style={styles.title}>CoinHub</Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' ? 'Welcome back!' : 'Join the community'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                console.log('Switching mode from', mode, 'to', mode === 'signin' ? 'signup' : 'signin');
                setMode(mode === 'signin' ? 'signup' : 'signin');
              }}
            >
              <Text style={styles.switchText}>
                {mode === 'signin'
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              CoinHub - Community-driven coin collecting
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
  },
  footer: {
    marginTop: 48,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
