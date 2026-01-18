
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Platform } from "react-native";
import { authClient, storeWebBearerToken, clearAuthTokens, API_URL, storeUserData, getUserData } from "@/lib/auth";
import { createAuthenticatedFetchOptions, clearSessionCookie } from "@/lib/cookieManager";

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
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      console.log("AuthProvider: Fetching user session");
      
      // First, try to get stored user data as a fallback
      const storedUserData = await getUserData();
      console.log("AuthProvider: Stored user data:", storedUserData);
      
      // Use authenticated fetch with stored session cookie
      // Retry up to 3 times with exponential backoff
      let lastError: any = null;
      let retries = 3;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`AuthProvider: Profile fetch attempt ${attempt}/${retries}`);
          
          // Create fetch options with session cookie
          const fetchOptions = await createAuthenticatedFetchOptions({
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
          });
          
          const response = await fetch(`${API_URL}/api/auth/me`, fetchOptions);
          
          console.log("AuthProvider: Profile fetch response status:", response.status);
          
          if (response.status === 401) {
            // 401 is not a retryable error - session is invalid
            console.log("AuthProvider: Session invalid (401), no active session");
            setUser(null);
            return;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log("AuthProvider: Profile fetch response data:", data);
          
          if (data) {
            // The /api/auth/me endpoint returns { user: {...}, profile: {...} }
            const sessionUser = data.user;
            const profileData = data.profile;
            
            console.log("AuthProvider: Session user:", sessionUser);
            console.log("AuthProvider: Profile data:", profileData);
            
            // Check if user has completed their CoinHub profile
            const hasCompletedProfile = !!(profileData && profileData.username);
            
            if (hasCompletedProfile) {
              // User has completed profile - merge session user with profile
              const mergedUser = {
                ...sessionUser,
                username: profileData.username,
                displayName: profileData.displayName,
                avatar_url: profileData.avatarUrl,
                bio: profileData.bio,
                location: profileData.location,
                hasCompletedProfile: true,
              };
              console.log("AuthProvider: Profile complete, merged user:", mergedUser);
              
              // Store user data for future use
              await storeUserData(mergedUser);
              
              setUser(mergedUser as User);
              return; // Success - exit the retry loop
            } else if (sessionUser) {
              // User has NOT completed profile - set user with flag
              const userWithFlag = {
                ...sessionUser,
                hasCompletedProfile: false,
              };
              console.log("AuthProvider: Profile incomplete, user needs to complete profile:", userWithFlag);
              
              // Store user data for future use
              await storeUserData(userWithFlag);
              
              setUser(userWithFlag as User);
              return; // Success - exit the retry loop
            } else {
              console.log("AuthProvider: No user in response");
              setUser(null);
              return; // No user - exit the retry loop
            }
          } else {
            // No response or null response - session invalid
            console.log("AuthProvider: No response from /api/auth/me, session invalid");
            setUser(null);
            return;
          }
        } catch (error: any) {
          lastError = error;
          
          // Check if it's a 401 error (session invalid)
          if (error?.status === 401 || error?.message?.includes("401")) {
            console.log("AuthProvider: Session invalid (401), no active session");
            setUser(null);
            return; // 401 is not a retryable error - exit the retry loop
          }
          
          console.error(`AuthProvider: Error fetching profile (attempt ${attempt}/${retries}):`, error);
          
          if (attempt < retries) {
            // Wait before retrying (exponential backoff: 500ms, 1000ms, 2000ms)
            const delay = 500 * Math.pow(2, attempt - 1);
            console.log(`AuthProvider: Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All retries exhausted - use stored data as fallback
      console.log("AuthProvider: All profile fetch attempts failed, using stored data as fallback");
      if (storedUserData) {
        console.log("AuthProvider: Using stored user data as fallback");
        setUser(storedUserData);
      } else {
        console.log("AuthProvider: No stored user data available, setting user to null");
        setUser(null);
      }
    } catch (error) {
      console.error("AuthProvider: Failed to fetch user:", error);
      
      // Try to use stored user data as a fallback
      const storedUserData = await getUserData();
      if (storedUserData) {
        console.log("AuthProvider: Using stored user data after error");
        setUser(storedUserData);
      } else {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    console.log("AuthProvider: Initializing, fetching user");
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
      console.log("AuthProvider: Starting signInWithEmail, email:", email);
      console.log("AuthProvider: Calling authClient.signIn.email with baseURL:", API_URL);
      
      const result = await authClient.signIn.email({ 
        email: email.trim().toLowerCase(), 
        password 
      });
      
      console.log("AuthProvider: Sign in result:", result);
      
      if (result.error) {
        console.error("AuthProvider: Sign in error from Better Auth:", result.error);
        
        // Provide more specific error messages
        const status = result.error.status;
        const message = result.error.message || "";
        
        if (status === 401 || status === 400 || message.includes("Invalid") || message.includes("credentials")) {
          throw new Error("Invalid email or password. Please check your credentials and try again.");
        } else if (status === 500) {
          throw new Error("Server error. Our team has been notified. Please try again in a few minutes.");
        } else if (status === 404 || message.includes("not found")) {
          throw new Error("Account not found. Please sign up first.");
        } else {
          throw new Error(message || "Sign in failed. Please try again.");
        }
      }
      
      console.log("AuthProvider: Sign in successful, fetching user");
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fetchUser();
      console.log("AuthProvider: User fetched after sign in");
    } catch (error: any) {
      console.error("AuthProvider: Email sign in failed:", error);
      
      // Provide more helpful error messages
      if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      // Re-throw the error with the message we already set
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("AuthProvider: Starting signUpWithEmail, email:", email);
      console.log("AuthProvider: Calling authClient.signUp.email with baseURL:", API_URL);
      
      const result = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name || email.split('@')[0],
      });
      
      console.log("AuthProvider: Sign up result:", result);
      
      if (result.error) {
        console.error("AuthProvider: Sign up error from Better Auth:", result.error);
        
        // Provide more specific error messages
        const status = result.error.status;
        const message = result.error.message || "";
        
        if (status === 409 || message.includes("already exists") || message.includes("duplicate") || message.includes("unique")) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        } else if (status === 400) {
          throw new Error("Invalid email or password format. Password must be at least 6 characters.");
        } else if (status === 500) {
          throw new Error("Server error. Our team has been notified. Please try again in a few minutes.");
        } else {
          throw new Error(message || "Sign up failed. Please try again.");
        }
      }
      
      console.log("AuthProvider: Sign up successful, fetching user");
      
      // Wait a moment for the session cookie to be set
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fetchUser();
      console.log("AuthProvider: User fetched after sign up");
    } catch (error: any) {
      console.error("AuthProvider: Email sign up failed:", error);
      
      // Provide more helpful error messages
      if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      // Re-throw the error with the message we already set
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log("AuthProvider: Starting signInWithSocial, provider:", provider);
      if (Platform.OS === "web") {
        console.log("AuthProvider: Opening OAuth popup for", provider);
        const token = await openOAuthPopup(provider);
        console.log("AuthProvider: OAuth popup returned token");
        storeWebBearerToken(token);
        await fetchUser();
      } else {
        console.log("AuthProvider: Using native OAuth for", provider);
        await authClient.signIn.social({
          provider,
          callbackURL: "/(tabs)/(home)",
        });
        await fetchUser();
      }
      console.log("AuthProvider: Social sign in successful");
    } catch (error: any) {
      console.error(`AuthProvider: ${provider} sign in failed:`, error);
      throw new Error(error.message || `${provider} sign in failed. Please try again.`);
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    try {
      console.log("AuthProvider: Starting sign out process");
      
      // First, clear the user state immediately to prevent UI issues
      setUser(null);
      console.log("AuthProvider: User state cleared");
      
      // Call Better Auth signOut to invalidate the session on the server
      try {
        console.log("AuthProvider: Calling Better Auth signOut");
        const result = await authClient.signOut();
        console.log("AuthProvider: Better Auth signOut result:", result);
      } catch (signOutError) {
        console.error("AuthProvider: Better Auth signOut failed (continuing anyway):", signOutError);
        // Continue even if signOut fails - we still want to clear local state
      }
      
      // Clear all auth tokens and storage
      console.log("AuthProvider: Clearing auth tokens and session cookie");
      await clearAuthTokens();
      await clearSessionCookie();
      console.log("AuthProvider: Auth tokens and session cookie cleared");
      
      console.log("AuthProvider: Sign out complete");
    } catch (error) {
      console.error("AuthProvider: Sign out error:", error);
      
      // Even if there's an error, ensure local state is cleared
      setUser(null);
      await clearAuthTokens();
      await clearSessionCookie();
      
      // Don't throw the error - logout should always succeed from the user's perspective
      console.log("AuthProvider: Sign out completed with errors (local state cleared)");
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
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
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
