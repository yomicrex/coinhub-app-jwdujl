
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';

export default function AuthScreen() {
  const router = useRouter();
  const { user, loading, signIn, signUp, completeProfile } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  console.log('AuthScreen: Rendered with user:', user?.email, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('AuthScreen: Auth state changed - loading:', loading, 'user:', user?.email, 'needsCompletion:', user?.needsProfileCompletion);
    
    // Only redirect if user is authenticated AND has a complete profile
    if (!loading && user && !user.needsProfileCompletion) {
      console.log('AuthScreen: User authenticated with complete profile, redirecting to home');
      router.replace('/(tabs)/(home)');
    }
  }, [loading, user, router]);

  const handleAuth = async () => {
    console.log('AuthScreen: User tapped', isSignUp ? 'Sign Up' : 'Sign In', 'button');
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        console.log('AuthScreen: Attempting sign up');
        await signUp(email, password);
        console.log('AuthScreen: Sign up successful');
      } else {
        console.log('AuthScreen: Attempting sign in');
        await signIn(email, password);
        console.log('AuthScreen: Sign in successful');
      }
      // Don't redirect here - let the useEffect handle it based on user state
    } catch (error: any) {
      console.error('AuthScreen: Auth error:', error);
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    console.log('AuthScreen: User tapped Complete Profile button');
    
    if (!username || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      console.log('AuthScreen: Completing profile with username:', username);
      await completeProfile(username, displayName);
      console.log('AuthScreen: Profile completion successful, redirecting to home');
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.error('AuthScreen: Profile completion error:', error);
      Alert.alert('Error', error.message || 'Profile completion failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show profile completion form if user exists but needs to complete profile
  const showProfileCompletion = user && user.needsProfileCompletion;

  if (showProfileCompletion) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.logo}>🪙</Text>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Choose a username and display name</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <IconSymbol ios_icon_name="at" android_material_icon_name="alternate-email" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Display Name"
                  placeholderTextColor={colors.textSecondary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleCompleteProfile}
                disabled={isLoading}
              >
                {isLoading ? (
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

  // Show login/signup form
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.logo}>🪙</Text>
            <Text style={styles.title}>Welcome to CoinHub</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Create an account to get started' : 'Sign in to continue'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                console.log('AuthScreen: User toggled between sign in and sign up');
                setIsSignUp(!isSignUp);
              }}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
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
    fontSize: 28,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
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
  switchButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
