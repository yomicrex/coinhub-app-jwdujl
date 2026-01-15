
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import { authClient, storeWebBearerToken, clearAuthTokens } from "@/lib/auth";

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

  useEffect(() => {
    console.log("AuthProvider: Initializing, fetching user");
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      console.log("AuthProvider: Fetching user session");
      setLoading(true);
      const session = await authClient.getSession();
      console.log("AuthProvider: Session data:", session);
      
      if (session?.data?.user) {
        console.log("AuthProvider: User found in session:", session.data.user);
        
        // Fetch the full profile from /me to get CoinHub profile data
        try {
          const response = await authClient.$fetch("/me");
          console.log("AuthProvider: Profile response:", response);
          
          if (response && !response.error) {
            // FIX: Access profile from response.data.profile, not response.profile
            const profileData = response.data?.profile;
            console.log("AuthProvider: Profile data:", profileData);
            
            // Check if user has completed their CoinHub profile
            const hasCompletedProfile = !!(profileData && profileData.username);
            
            if (hasCompletedProfile) {
              // User has completed profile - merge session user with profile
              const mergedUser = {
                ...session.data.user,
                username: profileData.username,
                displayName: profileData.displayName,
                avatar_url: profileData.avatarUrl,
                bio: profileData.bio,
                location: profileData.location,
                hasCompletedProfile: true,
              };
              console.log("AuthProvider: Profile complete, merged user:", mergedUser);
              setUser(mergedUser as User);
            } else {
              // User has NOT completed profile - set user with flag
              const userWithFlag = {
                ...session.data.user,
                hasCompletedProfile: false,
              };
              console.log("AuthProvider: Profile incomplete, user needs to complete profile:", userWithFlag);
              setUser(userWithFlag as User);
            }
          } else {
            console.log("AuthProvider: Profile fetch returned error or no data");
            // Profile doesn't exist - user needs to complete profile
            const userWithFlag = {
              ...session.data.user,
              hasCompletedProfile: false,
            };
            setUser(userWithFlag as User);
          }
        } catch (error) {
          console.error("AuthProvider: Error fetching profile:", error);
          // If profile fetch fails, assume profile is incomplete
          const userWithFlag = {
            ...session.data.user,
            hasCompletedProfile: false,
          };
          setUser(userWithFlag as User);
        }
      } else {
        console.log("AuthProvider: No user session found");
        setUser(null);
      }
    } catch (error) {
      console.error("AuthProvider: Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("AuthProvider: Signing in with email:", email);
      const result = await authClient.signIn.email({ email, password });
      console.log("AuthProvider: Sign in result:", result);
      
      if (result.error) {
        console.error("AuthProvider: Sign in error from Better Auth:", result.error);
        
        // Provide more specific error messages
        const status = result.error.status;
        if (status === 401 || status === 400) {
          throw new Error("Invalid email or password. Please check your credentials and try again.");
        } else if (status === 500) {
          throw new Error("Server error. Our team has been notified. Please try again in a few minutes.");
        } else if (status === 404) {
          throw new Error("Account not found. Please sign up first.");
        } else {
          throw new Error(result.error.message || "Sign in failed. Please try again.");
        }
      }
      
      console.log("AuthProvider: Sign in successful, fetching user");
      await fetchUser();
    } catch (error: any) {
      console.error("AuthProvider: Email sign in failed:", error);
      
      // Provide more helpful error messages
      if (error.message?.includes("fetch") || error.message?.includes("network")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      // Re-throw the error with the message we already set
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("AuthProvider: Signing up with email:", email);
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || email.split('@')[0],
      });
      console.log("AuthProvider: Sign up result:", result);
      
      if (result.error) {
        console.error("AuthProvider: Sign up error from Better Auth:", result.error);
        
        // Provide more specific error messages
        const status = result.error.status;
        const message = result.error.message || "";
        
        if (status === 409 || message.includes("already exists") || message.includes("duplicate")) {
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
      await fetchUser();
    } catch (error: any) {
      console.error("AuthProvider: Email sign up failed:", error);
      
      // Provide more helpful error messages
      if (error.message?.includes("fetch") || error.message?.includes("network")) {
        throw new Error("Cannot connect to server. Please check your internet connection and try again.");
      }
      
      // Re-throw the error with the message we already set
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log("AuthProvider: Signing in with social provider:", provider);
      if (Platform.OS === "web") {
        const token = await openOAuthPopup(provider);
        storeWebBearerToken(token);
        await fetchUser();
      } else {
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
        await authClient.signOut();
        console.log("AuthProvider: Better Auth signOut successful");
      } catch (signOutError) {
        console.error("AuthProvider: Better Auth signOut failed (continuing anyway):", signOutError);
        // Continue even if signOut fails - we still want to clear local state
      }
      
      // Clear all auth tokens and storage
      console.log("AuthProvider: Clearing auth tokens");
      await clearAuthTokens();
      console.log("AuthProvider: Auth tokens cleared");
      
      console.log("AuthProvider: Sign out complete");
    } catch (error) {
      console.error("AuthProvider: Sign out error:", error);
      
      // Even if there's an error, ensure local state is cleared
      setUser(null);
      await clearAuthTokens();
      
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
