
import React, { useState } from 'react';
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
  ImageBackground,
  Modal,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import ENV from '@/config/env';

const { width, height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'token' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetToken, setResetToken] = useState('');

  console.log('ForgotPasswordScreen: Current step:', step);

  const handleRequestReset = async () => {
    console.log('ForgotPasswordScreen: User requested password reset for:', email);
    
    if (!email || !email.trim()) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please enter your email address');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${ENV.BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();
      console.log('ForgotPasswordScreen: Forgot password response:', data);

      if (response.ok) {
        // In development, the backend returns the token
        if (data.token) {
          setResetToken(data.token);
          console.log('ForgotPasswordScreen: Reset token received:', data.token);
        }
        setStep('token');
      } else {
        setErrorTitle('Request Failed');
        setErrorMessage(data.message || 'Failed to request password reset. Please try again.');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('ForgotPasswordScreen: Request reset error:', error);
      setErrorTitle('Connection Error');
      setErrorMessage('Unable to connect to the server. Please check your internet connection and try again.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    console.log('ForgotPasswordScreen: User attempting to reset password');
    
    if (!token || !token.trim()) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please enter the reset code');
      setShowErrorModal(true);
      return;
    }

    if (!newPassword || !newPassword.trim()) {
      setErrorTitle('Missing Information');
      setErrorMessage('Please enter a new password');
      setShowErrorModal(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorTitle('Password Mismatch');
      setErrorMessage('Passwords do not match. Please try again.');
      setShowErrorModal(true);
      return;
    }

    if (newPassword.length < 6) {
      setErrorTitle('Weak Password');
      setErrorMessage('Password must be at least 6 characters long');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${ENV.BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          newPassword: newPassword,
        }),
      });

      const data = await response.json();
      console.log('ForgotPasswordScreen: Reset password response:', data);

      if (response.ok) {
        setStep('success');
      } else {
        setErrorTitle('Reset Failed');
        setErrorMessage(data.message || 'Failed to reset password. Please check your code and try again.');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('ForgotPasswordScreen: Reset password error:', error);
      setErrorTitle('Connection Error');
      setErrorMessage('Unable to connect to the server. Please check your internet connection and try again.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    console.log('ForgotPasswordScreen: User navigating back to login');
    router.back();
  };

  const titleText = step === 'email' ? 'Forgot Password?' : step === 'token' ? 'Enter Reset Code' : 'Password Reset!';
  const subtitleText = step === 'email' 
    ? 'Enter your email address and we\'ll send you a reset code' 
    : step === 'token'
    ? 'Enter the 6-digit code and your new password'
    : 'Your password has been reset successfully';

  return (
    <ImageBackground
      source={require('@/assets/images/26cac5f5-2d6c-4146-99c5-e453b78c1c46.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />
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
              <Text style={styles.title}>{titleText}</Text>
              <Text style={styles.subtitle}>{subtitleText}</Text>
            </View>

            <BlurView intensity={80} tint="dark" style={styles.formContainer}>
              <View style={styles.form}>
                {step === 'email' && (
                  <React.Fragment>
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

                    <TouchableOpacity
                      style={[styles.button, isLoading && styles.buttonDisabled]}
                      onPress={handleRequestReset}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.buttonText}>Send Reset Code</Text>
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                )}

                {step === 'token' && (
                  <React.Fragment>
                    {resetToken && (
                      <View style={styles.devTokenContainer}>
                        <Text style={styles.devTokenLabel}>Development Mode - Your Reset Code:</Text>
                        <Text style={styles.devTokenText}>{resetToken}</Text>
                        <Text style={styles.devTokenNote}>(In production, this would be sent via email)</Text>
                      </View>
                    )}

                    <View style={styles.inputContainer}>
                      <IconSymbol ios_icon_name="number" android_material_icon_name="pin" size={20} color="#FFD700" />
                      <TextInput
                        style={styles.input}
                        placeholder="6-digit code"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={token}
                        onChangeText={setToken}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={20} color="#FFD700" />
                      <TextInput
                        style={styles.input}
                        placeholder="New Password"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={20} color="#FFD700" />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, isLoading && styles.buttonDisabled]}
                      onPress={handleResetPassword}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.buttonText}>Reset Password</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={() => setStep('email')}
                    >
                      <Text style={styles.resendButtonText}>Didn't receive code? Try again</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                )}

                {step === 'success' && (
                  <React.Fragment>
                    <View style={styles.successIcon}>
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={64}
                        color="#50C878"
                      />
                    </View>

                    <Text style={styles.successMessage}>
                      Your password has been reset successfully. You can now sign in with your new password.
                    </Text>

                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleBackToLogin}
                    >
                      <Text style={styles.buttonText}>Back to Sign In</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                )}

                {step !== 'success' && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackToLogin}
                  >
                    <Text style={styles.backButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Error Modal */}
        <Modal
          visible={showErrorModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowErrorModal(false)}
        >
          <View style={styles.errorModalOverlay}>
            <BlurView intensity={80} tint="dark" style={styles.errorModalBlur}>
              <View style={styles.errorModalContent}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="error"
                  size={48}
                  color="#FF3B30"
                />
                <Text style={styles.errorModalTitle}>{errorTitle}</Text>
                <Text style={styles.errorModalMessage}>{errorMessage}</Text>
                <TouchableOpacity
                  style={styles.errorModalButton}
                  onPress={() => setShowErrorModal(false)}
                >
                  <Text style={styles.errorModalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
    height: 200,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
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
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    color: 'rgba(255, 215, 0, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  devTokenContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  devTokenLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 8,
  },
  devTokenText: {
    fontSize: 32,
    color: '#FFD700',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 8,
  },
  devTokenNote: {
    fontSize: 11,
    color: 'rgba(255, 215, 0, 0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 24,
  },
  errorModalBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorModalContent: {
    padding: 32,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: 400,
  },
  errorModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorModalMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorModalButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  errorModalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
