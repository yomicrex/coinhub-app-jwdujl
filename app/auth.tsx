
import { colors } from "@/styles/commonStyles";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect } from "react";

type Mode = "signin" | "signup" | "complete-profile";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  switchModeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    gap: 4,
  },
  switchModeText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  switchModeButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  usernameCheckContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -8,
  },
  usernameCheckText: {
    fontSize: 14,
  },
  usernameAvailable: {
    color: colors.success,
  },
  usernameTaken: {
    color: colors.error,
  },
});

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const { user, signInWithEmail, signUpWithEmail, fetchUser } = useAuth();
  const router = useRouter();

  // Check if user needs to complete profile
  useEffect(() => {
    console.log("AuthScreen: Checking user state, user:", user);
    if (user && !user.hasCompletedProfile) {
      console.log("AuthScreen: User needs to complete profile");
      setMode("complete-profile");
    } else if (user && user.hasCompletedProfile) {
      console.log("AuthScreen: User has completed profile, redirecting to home");
      router.replace("/(tabs)/(home)");
    }
  }, [user, router]);

  // Check username availability
  useEffect(() => {
    if (mode !== "complete-profile" || !username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      try {
        const response = await fetch(`${API_URL}/api/auth/check-username/${encodeURIComponent(username)}`, {
          credentials: 'include',
        });
        const data = await response.json();
        setUsernameAvailable(data.available);
      } catch (error) {
        console.error("Error checking username:", error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username, mode]);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("AuthScreen: Attempting sign-in");
      await signInWithEmail(email, password);
      console.log("AuthScreen: Sign-in successful");
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("AuthScreen: Sign-in error:", err);
      setError(err.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("AuthScreen: Attempting sign-up");
      await signUpWithEmail(email, password, name || email.split('@')[0]);
      console.log("AuthScreen: Sign-up successful");
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("AuthScreen: Sign-up error:", err);
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!displayName) {
      setError("Please enter a display name");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is already taken");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("AuthScreen: Completing profile");
      
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to complete profile");
      }

      console.log("AuthScreen: Profile completed successfully");
      
      // Fetch updated user data
      await fetchUser();
      
      // Navigate to home
      router.replace("/(tabs)/(home)");
    } catch (err: any) {
      console.error("AuthScreen: Profile completion error:", err);
      setError(err.message || "Failed to complete profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === "complete-profile" ? "Complete Your Profile" : "CoinHub"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "complete-profile"
              ? "Choose your username and display name"
              : mode === "signin"
              ? "Sign in to your account"
              : "Create a new account"}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === "complete-profile" ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {username.length >= 3 && (
                <View style={styles.usernameCheckContainer}>
                  {checkingUsername ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : usernameAvailable === true ? (
                    <>
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color={colors.success}
                      />
                      <Text style={[styles.usernameCheckText, styles.usernameAvailable]}>
                        Username available
                      </Text>
                    </>
                  ) : usernameAvailable === false ? (
                    <>
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={20}
                        color={colors.error}
                      />
                      <Text style={[styles.usernameCheckText, styles.usernameTaken]}>
                        Username taken
                      </Text>
                    </>
                  ) : null}
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor={colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleCompleteProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Complete Profile</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {mode === "signup" && (
                <TextInput
                  style={styles.input}
                  placeholder="Name (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={mode === "signin" ? handleEmailSignIn : handleEmailSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    {mode === "signin" ? "Sign In" : "Sign Up"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.switchModeContainer}>
                <Text style={styles.switchModeText}>
                  {mode === "signin"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                  }}
                >
                  <Text style={styles.switchModeButton}>
                    {mode === "signin" ? "Sign Up" : "Sign In"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
