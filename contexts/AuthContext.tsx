
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Platform } from "react-native";
import { authClient, clearAuthTokens, API_URL } from "@/lib/auth";
import * as SecureStore from "expo-secure-store";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  username?: string;
  displayName?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  hasCompletedProfile?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_DATA_KEY = "coinhub_user_data";
const SESSION_TOKEN_KEY = "coinhub_session_token";

async function storeUserData(userData: any) {
  console.log("AuthContext: Storing user data");
  try {
    const userDataString = JSON.stringify(userData);
    if (Platform.OS === "web") {
      localStorage.setItem(USER_DATA_KEY, userDataString);
    } else {
      await SecureStore.setItemAsync(USER_DATA_KEY, userDataString);
    }
    console.log("AuthContext: User data stored successfully");
  } catch (error) {
    console.error("AuthContext: Error storing user data:", error);
  }
}

async function getUserData(): Promise<any | null> {
  try {
    let userDataString: string | null = null;
    if (Platform.OS === "web") {
      userDataString = localStorage.getItem(USER_DATA_KEY);
    } else {
      userDataString = await SecureStore.getItemAsync(USER_DATA_KEY);
    }
    
    if (userDataString) {
      return JSON.parse(userDataString);
    }
    return null;
  } catch (error) {
    console.error("AuthContext: Error retrieving user data:", error);
    return null;
  }
}

async function clearUserData() {
  console.log("AuthContext: Clearing user data");
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(USER_DATA_KEY);
    } else {
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
    }
  } catch (error) {
    console.error("AuthContext: Error clearing user data:", error);
  }
}

async function storeSessionToken(token: string) {
  console.log("AuthContext: Storing session token");
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    }
    console.log("AuthContext: Session token stored successfully");
  } catch (error) {
    console.error("AuthContext: Error storing session token:", error);
  }
}

async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    }
  } catch (error) {
    console.error("AuthContext: Error retrieving session token:", error);
    return null;
  }
}

async function clearSessionToken() {
  console.log("AuthContext: Clearing session token");
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    }
  } catch (error) {
    console.error("AuthContext: Error clearing session token:", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      console.log("AuthContext: Fetching user session");
      
      // Get session token from storage
      const sessionToken = await getSessionToken();
      
      if (!sessionToken) {
        console.log("AuthContext: No session token found");
        setUser(null);
        await clearUserData();
        return;
      }
      
      console.log("AuthContext: Session token found, fetching user profile");
      
      // Create fetch options with Authorization header (React Native compatible)
      const fetchOptions: RequestInit = {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        credentials: 'include',
      };
      
      const response = await fetch(`${API_URL}/api/auth/me`, fetchOptions);
      
      console.log("AuthContext: /api/auth/me response status:", response.status);
      
      if (response.status === 401) {
        // Session expired or invalid
        console.log("AuthContext: Session invalid (401), clearing session");
        setUser(null);
        await clearUserData();
        await clearSessionToken();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("AuthContext: /api/auth/me response data:", data);
      
      if (data && data.user) {
        const sessionUser = data.user;
        const profileData = data.profile;
        
        // Check if user has completed their CoinHub profile
        const hasCompletedProfile = !!(profileData && profileData.username);
        
        if (hasCompletedProfile) {
          // User has completed profile
          const mergedUser = {
            ...sessionUser,
            username: profileData.username,
            displayName: profileData.displayName,
            avatar_url: profileData.avatarUrl,
            bio: profileData.bio,
            location: profileData.location,
            hasCompletedProfile: true,
          };
          console.log("AuthContext: Profile complete, user:", mergedUser);
          
          await storeUserData(mergedUser);
          setUser(mergedUser as User);
        } else {
          // User needs to complete profile
          const userWithFlag = {
            ...sessionUser,
            hasCompletedProfile: false,
          };
          console.log("AuthContext: Profile incomplete, user needs to complete profile");
          
          await storeUserData(userWithFlag);
          setUser(userWithFlag as User);
        }
      } else {
        console.log("AuthContext: No user in response");
        setUser(null);
        await clearUserData();
        await clearSessionToken();
      }
    } catch (error) {
      console.error("AuthContext: Failed to fetch user:", error);
      
      // Try to use stored user data as fallback
      const storedUserData = await getUserData();
      if (storedUserData) {
        console.log("AuthContext: Using stored user data after error");
        setUser(storedUserData);
      } else {
        setUser(null);
        await clearSessionToken();
      }
    }
  }, []);

  useEffect(() => {
    console.log("AuthContext: Initializing");
    let mounted = true;
    
    const initAuth = async () => {
      await fetchUser();
      if (mounted) {
        setLoading(false);
      }
    };
    
    initAuth();
    
    return () => {
      mounted = false;
    };
  }, [fetchUser]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("AuthContext: Starting email sign-in for:", email);
      
      // Use custom endpoint for email-only sign-in
      const response = await fetch(`${API_URL}/api/auth/email/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      console.log("AuthContext: Sign-in response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("AuthContext: Sign-in error:", errorData);
        
        if (response.status === 401 || response.status === 400) {
          throw new Error("Invalid email. Please check your email and try again.");
        } else if (response.status === 404) {
          throw new Error("Account not found. Please sign up first.");
        } else {
          throw new Error(errorData.message || "Sign in failed. Please try again.");
        }
      }

      const data = await response.json();
      console.log("AuthContext: Sign-in successful, response data:", data);
      
      // Extract session token from response body
      if (data.session && data.session.token) {
        console.log("AuthContext: Storing session token from response body");
        await storeSessionToken(data.session.token);
      } else {
        console.error("AuthContext: No session token in response body");
        throw new Error("Sign in failed: No session token received");
      }
      
      // Wait a moment for storage to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fetch user profile
      await fetchUser();
      console.log("AuthContext: User fetched after sign-in");
    } catch (error: any) {
      console.error("AuthContext: Email sign-in failed:", error);
      
      if (error.message?.includes("fetch") || error.message?.includes("network")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("AuthContext: Starting email sign-up");
      
      const result = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name || email.split('@')[0],
      });
      
      console.log("AuthContext: Sign-up result:", result);
      
      if (result.error) {
        console.error("AuthContext: Sign-up error:", result.error);
        
        const status = result.error.status;
        const message = result.error.message || "";
        
        if (status === 409 || message.includes("already exists") || message.includes("duplicate")) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        } else if (status === 400) {
          throw new Error("Invalid email or password format. Password must be at least 6 characters.");
        } else {
          throw new Error(message || "Sign up failed. Please try again.");
        }
      }
      
      console.log("AuthContext: Sign-up successful");
      
      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fetchUser();
      console.log("AuthContext: User fetched after sign-up");
    } catch (error: any) {
      console.error("AuthContext: Email sign-up failed:", error);
      
      if (error.message?.includes("fetch") || error.message?.includes("network")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("AuthContext: Starting sign-out");
      
      // Clear user state immediately
      setUser(null);
      
      // Call backend to invalidate session
      try {
        await authClient.signOut();
        console.log("AuthContext: Backend sign-out successful");
      } catch (signOutError) {
        console.error("AuthContext: Backend sign-out failed (continuing):", signOutError);
      }
      
      // Clear all local storage
      await clearAuthTokens();
      await clearSessionToken();
      await clearUserData();
      
      console.log("AuthContext: Sign-out complete");
    } catch (error) {
      console.error("AuthContext: Sign-out error:", error);
      
      // Ensure local state is cleared even if there's an error
      setUser(null);
      await clearAuthTokens();
      await clearSessionToken();
      await clearUserData();
    }
  };

  const logout = signOut;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        logout,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Export helper function to get session token for API calls
export async function getAuthSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    }
  } catch (error) {
    console.error("getAuthSessionToken: Error retrieving session token:", error);
    return null;
  }
}
