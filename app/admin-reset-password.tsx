
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function AdminResetPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    console.log('AdminResetPassword: User tapped reset password for username:', username);

    if (!username || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log('AdminResetPassword: Sending password reset request for username:', username);
      
      const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username.trim())}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      });

      console.log('AdminResetPassword: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AdminResetPassword: Error response:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to reset password');
      }

      const data = await response.json();
      console.log('AdminResetPassword: Success response:', data);

      Alert.alert(
        'Success',
        `Password has been reset for user "${username}". The user can now log in with the new password.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setUsername('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('AdminResetPassword: Error:', error);
      Alert.alert('Error', error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reset User Password',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {/* Warning Box */}
              <View style={styles.warningBox}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={24}
                  color="#ff9800"
                />
                <Text style={styles.warningText}>
                  Admin Tool: This will reset the password for any user account. Use with caution.
                </Text>
              </View>

              {/* Instructions */}
              <View style={styles.instructionsBox}>
                <Text style={styles.instructionsTitle}>How to use:</Text>
                <Text style={styles.instructionsText}>
                  1. Enter the user&apos;s username{'\n'}
                  2. Set a new password (min 6 characters){'\n'}
                  3. Confirm the new password{'\n'}
                  4. The user can immediately log in with the new password
                </Text>
              </View>

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <IconSymbol
                  ios_icon_name="person"
                  android_material_icon_name="person"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* New Password Input */}
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
                  editable={!loading}
                />
              </View>

              {/* Confirm Password Input */}
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
                  editable={!loading}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.resetButton, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="key.fill"
                      android_material_icon_name="vpn-key"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.resetButtonText}>Reset Password</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Quick Access for Known Issues */}
              <View style={styles.quickAccessBox}>
                <Text style={styles.quickAccessTitle}>Quick Access - Known Accounts:</Text>
                <Text style={styles.quickAccessSubtitle}>
                  Note: You need to know the username. Common usernames for the reported issues:
                </Text>
                <TouchableOpacity
                  style={styles.quickAccessButton}
                  onPress={() => setUsername('yomicrex')}
                  disabled={loading}
                >
                  <Text style={styles.quickAccessButtonText}>yomicrex</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAccessButton}
                  onPress={() => setUsername('JJ1981')}
                  disabled={loading}
                >
                  <Text style={styles.quickAccessButtonText}>JJ1981</Text>
                </TouchableOpacity>
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <IconSymbol
                  ios_icon_name="info.circle"
                  android_material_icon_name="info"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={styles.infoText}>
                  This tool bypasses normal password reset flows and directly updates the user&apos;s password in the database.
                </Text>
              </View>
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
    padding: 20,
  },
  content: {
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff9800',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#e65100',
    lineHeight: 20,
    fontWeight: '500',
  },
  instructionsBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  resetButton: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  quickAccessBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAccessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  quickAccessSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  quickAccessButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAccessButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
