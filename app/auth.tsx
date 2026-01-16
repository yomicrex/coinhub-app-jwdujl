
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import Constants from "expo-constants";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  Image,
} from "react-native";

type Mode = "signin" | "signup" | "complete-profile" | "forgot-password" | "reset-password";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";

export default function AuthScreen() {
  const router = useRouter();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGitHub, loading: authLoading, fetchUser } =
    useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Check if user needs to complete profile
  useEffect(() => {
    const checkProfile = async () => {
      console.log("AuthScreen: Checking user state, user:", user, "authLoading:", authLoading);
      
      // Don't do anything while auth is loading
      if (authLoading) {
        console.log("AuthScreen: Auth still loading, waiting...");
        return;
      }
      
      // No user - show sign in page
      if (!user) {
        console.log("AuthScreen: No user, showing sign in page");
        setMode("signin");
        return;
      }
      
      // User exists - check if profile is complete
      console.log("AuthScreen: User detected, hasCompletedProfile:", user.hasCompletedProfile, "username:", user.username, "email:", user.email);
      
      // If user has completed profile, redirect to home
      if (user.hasCompletedProfile && user.username) {
        console.log("AuthScreen: Profile complete, redirecting to home");
        router.replace("/(tabs)/(home)");
        return;
      }
      
      // User is authenticated but hasn't completed profile
      console.log("AuthScreen: Profile incomplete, showing profile completion");
      // Pre-fill email if available from OAuth or email signup
      if (user.email) {
        setProfileEmail(user.email);
      }
      setMode("complete-profile");
    };

    checkProfile();
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handleEmailAuth = async () => {
    console.log("AuthScreen: handleEmailAuth called, mode:", mode, "email:", email);
    
    if (!email || !password) {
      const msg = "Please enter email and password";
      console.log("AuthScreen: Validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = "Please enter a valid email address";
      console.log("AuthScreen: Email validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    if (password.length < 6) {
      const msg = "Password must be at least 6 characters";
      console.log("AuthScreen: Password validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      if (mode === "signin") {
        console.log("AuthScreen: Attempting sign in with email:", email);
        await signInWithEmail(email, password);
        console.log("AuthScreen: Sign in successful");
        Alert.alert("Success", "Signed in successfully!");
      } else {
        console.log("AuthScreen: Attempting sign up with email:", email);
        await signUpWithEmail(email, password, displayName || email.split('@')[0]);
        console.log("AuthScreen: Sign up successful");
        Alert.alert("Success", "Account created successfully! Please complete your profile.");
      }
      // fetchUser is called automatically in signInWithEmail/signUpWithEmail
      // The useEffect will handle navigation based on profile status
    } catch (error: any) {
      console.error("AuthScreen: Authentication error:", error);
      const errorMsg = error.message || "Authentication failed. Please try again.";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    console.log("AuthScreen: handleCompleteProfile called, username:", username, "displayName:", displayName, "email:", profileEmail, "inviteCode:", inviteCode);
    
    if (!username || !displayName || !inviteCode || !profileEmail) {
      const msg = "Please fill in all required fields";
      console.log("AuthScreen: Validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    if (username.length < 3) {
      const msg = "Username must be at least 3 characters";
      console.log("AuthScreen: Username validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileEmail)) {
      const msg = "Please enter a valid email address";
      console.log("AuthScreen: Email validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    console.log("AuthScreen: Completing profile with username:", username, "displayName:", displayName, "email:", profileEmail);
    
    try {
      // Use authClient.$fetch to ensure authentication cookies are sent
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: "POST",
        credentials: "include", // This is critical - ensures cookies are sent
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          displayName,
          email: profileEmail,
          inviteCode: inviteCode.toUpperCase(),
        }),
      });

      console.log("AuthScreen: Complete profile response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("AuthScreen: Profile completion error response:", errorData);
        throw new Error(errorData.error || errorData.message || "Failed to complete profile");
      }

      const data = await response.json();
      console.log("AuthScreen: Complete profile response data:", data);

      Alert.alert("Success", "Profile created successfully!");
      
      // Refresh user data to get the updated profile
      await fetchUser();
      
      // Navigate to home
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error("AuthScreen: Profile completion error:", error);
      const errorMsg = error.message || "Failed to complete profile. Please try again.";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    console.log("AuthScreen: handleForgotPassword called, email:", email);
    
    if (!email) {
      const msg = "Please enter your email address";
      console.log("AuthScreen: Validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = "Please enter a valid email address";
      console.log("AuthScreen: Email validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      console.log("AuthScreen: Sending password reset request for email:", email);
      const response = await fetch(`${API_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      console.log("AuthScreen: Forgot password response status:", response.status);

      const data = await response.json();
      console.log("AuthScreen: Forgot password response data:", data);

      if (!response.ok) {
        console.error("AuthScreen: Forgot password error response:", data);
        throw new Error(data.error || data.message || "Failed to send reset email");
      }

      // Check if the backend actually sent the email or just logged it
      if (data.success === false) {
        throw new Error(data.error || "Failed to send password reset email. Please try again later.");
      }

      const successMsg = data.message || "Password reset email sent! Please check your inbox and spam folder.";
      setSuccessMessage(successMsg);
      Alert.alert(
        "Email Sent", 
        successMsg + "\n\nIf you don't receive the email within a few minutes, please check your spam folder or try again.",
        [
          {
            text: "OK",
            onPress: () => {
              // Switch to reset password mode
              setMode("reset-password");
            }
          }
        ]
      );
    } catch (error: any) {
      console.error("AuthScreen: Forgot password error:", error);
      const errorMsg = error.message || "Failed to send reset email. The email service may be temporarily unavailable. Please try again later.";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    console.log("AuthScreen: handleResetPassword called");
    
    if (!resetToken || !newPassword || !confirmPassword) {
      const msg = "Please fill in all fields";
      console.log("AuthScreen: Validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    if (newPassword.length < 6) {
      const msg = "Password must be at least 6 characters";
      console.log("AuthScreen: Password validation error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = "Passwords do not match";
      console.log("AuthScreen: Password mismatch error:", msg);
      setErrorMessage(msg);
      Alert.alert("Error", msg);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      console.log("AuthScreen: Resetting password with token");
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          token: resetToken.trim(), 
          newPassword 
        }),
      });

      console.log("AuthScreen: Reset password response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("AuthScreen: Reset password error response:", errorData);
        throw new Error(errorData.error || errorData.message || "Failed to reset password");
      }

      const data = await response.json();
      console.log("AuthScreen: Reset password response data:", data);

      Alert.alert("Success", "Password reset successful! You can now sign in with your new password.");
      
      // Clear fields and switch to sign in mode
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("signin");
    } catch (error: any) {
      console.error("AuthScreen: Reset password error:", error);
      const errorMsg = error.message || "Failed to reset password. Please try again.";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple" | "github") => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    console.log("AuthScreen: Attempting social auth with:", provider);
    
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else if (provider === "apple") {
        await signInWithApple();
      } else if (provider === "github") {
        await signInWithGitHub();
      }
      console.log("AuthScreen: Social auth successful");
      Alert.alert("Success", "Signed in successfully!");
      // fetchUser is called automatically in the social auth methods
      // The useEffect will handle navigation based on profile status
    } catch (error: any) {
      console.error("AuthScreen: Social auth error:", error);
      const errorMsg = error.message || "Authentication failed. Please try again.";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Forgot password screen
  if (mode === "forgot-password") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                console.log("AuthScreen: Back to sign in");
                setMode("signin");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>

            {/* Logo/Icon */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <IconSymbol
                  ios_icon_name="lock.fill"
                  android_material_icon_name="lock"
                  size={80}
                  color={colors.primary}
                />
              </View>
            </View>

            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="envelope"
                android_material_icon_name="email"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                console.log("AuthScreen: Switching to reset password mode");
                setMode("reset-password");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <Text style={styles.switchModeText}>
                Already have a reset code? Enter it here
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Reset password screen
  if (mode === "reset-password") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                console.log("AuthScreen: Back to sign in");
                setMode("signin");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>

            {/* Logo/Icon */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <IconSymbol
                  ios_icon_name="key.fill"
                  android_material_icon_name="vpn-key"
                  size={80}
                  color={colors.primary}
                />
              </View>
            </View>

            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the reset code from your email and your new password.
            </Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="key.fill"
                android_material_icon_name="vpn-key"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Reset Code"
                placeholderTextColor={colors.textSecondary}
                value={resetToken}
                onChangeText={setResetToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="New Password (min 6 characters)"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                console.log("AuthScreen: Switching to forgot password mode");
                setMode("forgot-password");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <Text style={styles.switchModeText}>
                Need a new reset code? Request one here
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Profile completion screen (only shown when user is authenticated but has no username)
  if (mode === "complete-profile" && user && !user.hasCompletedProfile) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Logo/Icon */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <IconSymbol
                  ios_icon_name="circle.fill"
                  android_material_icon_name="album"
                  size={80}
                  color={colors.primary}
                />
              </View>
            </View>

            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Welcome to CoinHub! Set up your profile to start collecting.
            </Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="envelope"
                android_material_icon_name="email"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address (required)"
                placeholderTextColor={colors.textSecondary}
                value={profileEmail}
                onChangeText={setProfileEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!user?.email}
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="person"
                android_material_icon_name="person"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Username (required)"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="account-circle"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Display Name (required)"
                placeholderTextColor={colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="key.fill"
                android_material_icon_name="vpn-key"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Invite Code (required)"
                placeholderTextColor={colors.textSecondary}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeLabel}>Beta Invite Code:</Text>
              <Text style={styles.inviteCodeText}>BETA2026</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleCompleteProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Complete Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Sign in / Sign up screen (shown when no user is authenticated)
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <IconSymbol
                ios_icon_name="circle.fill"
                android_material_icon_name="album"
                size={80}
                color={colors.primary}
              />
            </View>
          </View>

          <Text style={styles.title}>CoinHub</Text>
          <Text style={styles.subtitle}>
            {mode === "signin"
              ? "Sign in to your account"
              : "Create your account"}
          </Text>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {/* Important note for sign in */}
          {mode === "signin" && (
            <View style={styles.infoBox}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.infoText}>
                Sign in with your <Text style={styles.boldText}>email address</Text>, not your username
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <IconSymbol
              ios_icon_name="envelope"
              android_material_icon_name="email"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(text) => {
                console.log("AuthScreen: Email input changed:", text);
                setEmail(text);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={(text) => {
                console.log("AuthScreen: Password input changed, length:", text.length);
                setPassword(text);
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {mode === "signup" && (
            <View style={styles.inputContainer}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="account-circle"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Display Name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={displayName}
                onChangeText={(text) => {
                  console.log("AuthScreen: Display name input changed:", text);
                  setDisplayName(text);
                }}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Forgot password link (only show on sign in) */}
          {mode === "signin" && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => {
                console.log("AuthScreen: Switching to forgot password mode");
                setMode("forgot-password");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => {
              console.log("AuthScreen: Primary button pressed, mode:", mode);
              handleEmailAuth();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "signin" ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              const newMode = mode === "signin" ? "signup" : "signin";
              console.log("AuthScreen: Switching mode from", mode, "to", newMode);
              setMode(newMode);
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            <Text style={styles.switchModeText}>
              {mode === "signin"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => {
              console.log("AuthScreen: Google button pressed");
              handleSocialAuth("google");
            }}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="g.circle.fill"
              android_material_icon_name="g-translate"
              size={20}
              color={colors.text}
            />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => {
                console.log("AuthScreen: Apple button pressed");
                handleSocialAuth("apple");
              }}
              disabled={loading}
            >
              <IconSymbol
                ios_icon_name="apple.logo"
                android_material_icon_name="apple"
                size={20}
                color="#FFFFFF"
              />
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.backgroundAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: "#fee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fcc",
  },
  errorText: {
    color: "#c00",
    fontSize: 14,
    textAlign: "center",
  },
  successContainer: {
    backgroundColor: "#efe",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#cfc",
  },
  successText: {
    color: "#0a0",
    fontSize: 14,
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "bold",
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.card,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inviteCodeBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  inviteCodeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  inviteCodeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 2,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  primaryButton: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: colors.card,
    flexDirection: "row",
    gap: 12,
  },
  socialButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
  },
});
