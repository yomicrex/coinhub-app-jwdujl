
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
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { user, loading, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  console.log('AuthScreen: Rendered with user:', user?.email, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('AuthScreen: Auth state changed - loading:', loading, 'user:', user?.email, 'needsCompletion:', user?.needsProfileCompletion);
    
    // If user needs profile completion, redirect to complete-profile screen
    if (!loading && user && user.needsProfileCompletion) {
      console.log('AuthScreen: User needs profile completion, redirecting to complete-profile screen');
      router.replace('/complete-profile');
      return;
    }
    
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
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Authentication failed';
      
      // Handle specific error cases
      if (errorMessage.includes('User already exists')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (errorMessage.includes('Invalid credentials') || errorMessage.includes('Incorrect')) {
        errorMessage = 'Invalid email or password. Please try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground
        source={require('@/assets/images/26cac5f5-2d6c-4146-99c5-e453b78c1c46.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // Show login/signup form
  return (
    <ImageBackground
      source={require('@/assets/images/26cac5f5-2d6c-4146-99c5-e453b78c1c46.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topSpacer} />
            
            <View style={styles.header}>
              <Text style={styles.title}>CoinHub</Text>
              <Text style={styles.subtitle}>
                {isSignUp ? 'Create an account to get started' : 'Sign in to continue'}
              </Text>
            </View>

            <BlurView intensity={80} tint="dark" style={styles.formContainer}>
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={20} color="#FFD700" />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={20} color="#FFD700" />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
                    <ActivityIndicator color="#000" />
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
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topSpacer: {
    height: height * 0.25,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  formContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  form: {
    padding: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
});
