
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
} from "react-native";

type Mode = "signin" | "complete-profile" | "create-new-profile";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";

export default function AuthScreen() {
  const router = useRouter();
  const { user, loading: authLoading, fetchUser } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
      // Pre-fill email if available
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

  const handleEmailSignIn = async () => {
    console.log("AuthScreen: handleEmailSignIn called, email:", email);
    
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
      console.log("AuthScreen: Attempting email-only sign in with:", email);
      
      const response = await fetch(`${API_URL}/api/auth/email/signin`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      console.log("AuthScreen: Sign in response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("AuthScreen: Sign in error response:", errorData);
        
        // Provide helpful error messages
        let errorMsg = errorData.error || errorData.message || "Sign in failed";
        
        if (response.status === 404) {
          errorMsg = `No account found with email "${email}". Please check your email address or create a new profile.`;
        }
        
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("AuthScreen: Sign in successful, response data:", data);
      
      // Wait a moment for the cookie to be set
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh user data - this will fetch the session with the new cookie
      console.log("AuthScreen: Fetching user session after login");
      await fetchUser();
      
      console.log("AuthScreen: Login complete, user should be set");
      
      // The useEffect will handle navigation once user is set
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
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: "POST",
        credentials: "include",
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

  // Create new profile screen (for creating additional test accounts)
  if (mode === "create-new-profile") {
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

            <Text style={styles.title}>Create New Profile</Text>
            <Text style={styles.subtitle}>
              Create a new test profile for CoinHub beta testing
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
                <Text style={styles.primaryButtonText}>Create Profile</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                console.log("AuthScreen: Switching to sign in mode");
                setMode("signin");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
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

  // Email-only sign in screen
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
            Enter your email to access your account
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

          <View style={styles.infoBox}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.infoText}>
              This is a beta test app. Simply enter your email address to access your profile.
            </Text>
          </View>

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
                setErrorMessage(""); // Clear error when user types
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleEmailSignIn}
              returnKeyType="go"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => {
              console.log("AuthScreen: Login button pressed");
              handleEmailSignIn();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Login
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              console.log("AuthScreen: Create New Profile button pressed");
              setMode("create-new-profile");
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            <Text style={styles.secondaryButtonText}>Create New Profile</Text>
          </TouchableOpacity>

          <View style={styles.betaInfoBox}>
            <IconSymbol
              ios_icon_name="checkmark.shield.fill"
              android_material_icon_name="verified-user"
              size={24}
              color={colors.primary}
            />
            <View style={styles.betaInfoContent}>
              <Text style={styles.betaInfoTitle}>Beta Test Access</Text>
              <Text style={styles.betaInfoText}>
                No password required. Just enter your email to access your account or create a new profile for testing.
              </Text>
            </View>
          </View>
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
    lineHeight: 20,
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
  secondaryButton: {
    height: 50,
    backgroundColor: "transparent",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  betaInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 12,
  },
  betaInfoContent: {
    flex: 1,
  },
  betaInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  betaInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
