
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

  const fetchUserProfile = async (forceRefresh = false) => {
    try {
      console.log('AuthContext: Fetching user profile from /me...', forceRefresh ? '(forced refresh)' : '');
      
      // CRITICAL FIX: Use Better Auth's built-in fetch method which automatically includes the session token
      // The authClient is already configured with baseURL '/api/auth', so we only need to specify '/me'
      // This is the correct way to make authenticated requests with Better Auth
      try {
        const response = await authClient.$fetch('/me', {
          method: 'GET',
          query: forceRefresh ? { _t: Date.now(), _: Date.now() } : { _: Date.now() },
        });
        
        console.log('AuthContext: Profile fetch response:', {
          hasData: !!response,
          hasUser: !!(response as any)?.id,
          hasProfile: !!(response as any)?.hasProfile
        });

        const data = response as any;
        
        // CRITICAL FIX: Check for new format FIRST (data.id exists means new format)
        // New format: { id, email, username, displayName, hasProfile, avatarUrl, bio, location }
        // Old format: { user: { id, email }, profile: { username, displayName, ... } }
        const isNewFormat = !!data.id && data.hasProfile !== undefined;
        
        console.log('AuthContext: Profile data received:', {
          isNewFormat,
          hasId: !!data.id,
          hasUser: !!data.user,
          hasProfile: !!data.profile,
          hasProfileField: data.hasProfile,
          userId: data.id || data.user?.id,
          email: data.email || data.user?.email,
          username: data.username || data.profile?.username,
          displayName: data.displayName || data.profile?.displayName
        });
        
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
            console.log('AuthContext: Setting user with complete profile (new format):', {
              id: combinedUser.id,
              email: combinedUser.email,
              username: combinedUser.username,
              displayName: combinedUser.displayName,
              needsProfileCompletion: false
            });
            setUser(combinedUser);
            return combinedUser;
          } else {
            // User exists but no profile - needs completion
            const userWithoutProfile: User = {
              id: data.id,
              email: data.email,
              needsProfileCompletion: true,
            };
            console.log('AuthContext: Setting user without profile (new format) - needs completion:', {
              id: userWithoutProfile.id,
              email: userWithoutProfile.email,
              needsProfileCompletion: true
            });
            setUser(userWithoutProfile);
            return userWithoutProfile;
          }
        }
        
        // Handle old backend response format: { user, profile }
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
          console.log('AuthContext: Setting user with profile (old format):', {
            id: combinedUser.id,
            email: combinedUser.email,
            username: combinedUser.username,
            displayName: combinedUser.displayName,
            needsProfileCompletion: combinedUser.needsProfileCompletion
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
          console.log('AuthContext: Setting user without profile (old format) - needs completion:', {
            id: userWithoutProfile.id,
            email: userWithoutProfile.email,
            needsProfileCompletion: true
          });
          setUser(userWithoutProfile);
          return userWithoutProfile;
        } else {
          console.log('AuthContext: No user data in response - clearing user state');
          setUser(null);
          return null;
        }
      } catch (fetchError: any) {
        console.error('AuthContext: Error fetching user profile:', fetchError);
        
        // Check if it's a 401/404 error
        if (fetchError?.status === 401 || fetchError?.status === 404) {
          console.log('AuthContext: User not authenticated or profile not found - clearing user state');
          setUser(null);
          return null;
        }
        
        // For other errors, also clear user state
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('AuthContext: Unexpected error fetching user profile:', error);
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

      console.log('AuthContext: SignIn - Better Auth sign-in successful, result:', {
        hasData: !!result.data,
        hasUser: !!result.data?.user,
        userId: result.data?.user?.id,
        hasSession: !!result.data?.session,
        sessionToken: result.data?.session?.token?.substring(0, 20)
      });
      
      // Wait for the session to be stored by Better Auth client
      console.log('AuthContext: SignIn - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify session is stored
      const storedSession = await authClient.getSession();
      console.log('AuthContext: SignIn - Stored session check:', {
        hasSession: !!storedSession,
        hasToken: !!storedSession?.session?.token,
        tokenLength: storedSession?.session?.token?.length,
        tokenMatches: storedSession?.session?.token === result.data?.session?.token
      });
      
      // Fetch the full user profile directly from the backend with forced refresh
      console.log('AuthContext: SignIn - Fetching fresh user profile with forced refresh');
      const userData = await fetchUserProfile(true);
      
      if (!userData) {
        console.error('AuthContext: SignIn - Failed to fetch user profile after sign in');
        // Don't throw error - the user might need to complete their profile
        // The auth screen will handle showing the profile completion form
        console.log('AuthContext: SignIn - User may need to complete profile, continuing...');
        return;
      }
      
      console.log('AuthContext: SignIn - User state updated successfully:', {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        needsProfileCompletion: userData.needsProfileCompletion
      });
    } catch (error: any) {
      console.error('AuthContext: SignIn - Error:', error);
      // Clear user state on error
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
        name: email.split('@')[0], // Use email prefix as default name
      });

      if (result.error) {
        console.error('AuthContext: SignUp - Failed with error:', result.error);
        throw new Error(result.error.message || 'Sign up failed');
      }

      console.log('AuthContext: SignUp - Better Auth sign-up successful, result:', {
        hasData: !!result.data,
        hasUser: !!result.data?.user,
        userId: result.data?.user?.id,
        hasSession: !!result.data?.session,
        sessionToken: result.data?.session?.token?.substring(0, 20)
      });
      
      // Wait for the session to be stored by Better Auth client
      console.log('AuthContext: SignUp - Waiting for session to be stored...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify session is stored
      const storedSession = await authClient.getSession();
      console.log('AuthContext: SignUp - Stored session check:', {
        hasSession: !!storedSession,
        hasToken: !!storedSession?.session?.token,
        tokenLength: storedSession?.session?.token?.length,
        tokenMatches: storedSession?.session?.token === result.data?.session?.token
      });
      
      // Fetch the full user profile with forced refresh
      console.log('AuthContext: SignUp - Fetching fresh user profile with forced refresh');
      const userData = await fetchUserProfile(true);
      
      if (!userData) {
        console.error('AuthContext: SignUp - Failed to fetch user profile after sign up');
        // Don't throw error - the user might need to complete their profile
        // The auth screen will handle showing the profile completion form
        console.log('AuthContext: SignUp - User may need to complete profile, continuing...');
        return;
      }
      
      console.log('AuthContext: SignUp - User state updated successfully:', {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        needsProfileCompletion: userData.needsProfileCompletion
      });
    } catch (error: any) {
      console.error('AuthContext: SignUp - Error:', error);
      // Clear user state on error
      setUser(null);
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const completeProfile = async (username: string, displayName: string) => {
    console.log('AuthContext: CompleteProfile - Completing profile with username:', username);
    
    try {
      // CRITICAL FIX: The authClient baseURL is '/api/auth', but profiles endpoint is at '/api/profiles'
      // So we need to use the full URL for this endpoint
      const response = await fetch(`${API_URL}/api/profiles/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ username, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to complete profile');
      }

      const data = await response.json();

      console.log('AuthContext: CompleteProfile - Successful, profile created:', {
        id: data.id,
        username: data.username,
        displayName: data.displayName
      });
      
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

  const getToken = async (): Promise<string | null> => {
    // Get session token from Better Auth
    const session = await authClient.getSession();
    return session?.session?.token || null;
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
