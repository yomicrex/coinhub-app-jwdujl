
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async () => {
    console.log('AuthScreen: Submit button pressed, isLogin:', isLogin);
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && (!username || !displayName || !inviteCode)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        console.log('AuthScreen: Attempting login for:', email);
        await login(email, password);
        console.log('AuthScreen: Login successful, navigating to feed');
        router.replace('/(tabs)');
      } else {
        console.log('AuthScreen: Attempting registration for:', username);
        await register(email, password, username, displayName, inviteCode);
        console.log('AuthScreen: Registration successful, navigating to feed');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('AuthScreen: Authentication error:', error);
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <IconSymbol
                ios_icon_name="circle.fill"
                android_material_icon_name="circle"
                size={60}
                color={colors.primary}
              />
              <Text style={styles.title}>CoinHub</Text>
              <Text style={styles.subtitle}>
                {isLogin ? 'Welcome back!' : 'Join the community'}
              </Text>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="username"
                      autoCapitalize="none"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                      style={styles.input}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="John Doe"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Invite Code</Text>
                  <TextInput
                    style={styles.input}
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    placeholder="Enter invite code"
                    autoCapitalize="characters"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={styles.helperText}>
                    Beta invite code: BETA2026
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                  console.log('AuthScreen: Switching mode to:', !isLogin ? 'login' : 'register');
                  setIsLogin(!isLogin);
                }}
              >
                <Text style={styles.switchText}>
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
