
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function AdminResetAllPasswordsScreen() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [usersUpdated, setUsersUpdated] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const handleResetAllPasswords = () => {
    console.log('AdminResetAllPasswords: User tapped Reset All Passwords button');
    
    Alert.alert(
      'Reset All Passwords?',
      'This will reset ALL user account passwords to "123456". This action cannot be undone.\n\nAre you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('AdminResetAllPasswords: User cancelled'),
        },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: confirmResetAllPasswords,
        },
      ]
    );
  };

  const confirmResetAllPasswords = async () => {
    console.log('AdminResetAllPasswords: Confirming reset all passwords');
    setResetting(true);
    setSuccess(false);
    setErrorMessage('');

    try {
      console.log('AdminResetAllPasswords: Calling /api/admin/fix-all-passwords endpoint');
      console.log('AdminResetAllPasswords: API URL:', API_URL);
      
      const response = await fetch(`${API_URL}/api/admin/fix-all-passwords`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      console.log('AdminResetAllPasswords: Response status:', response.status);
      console.log('AdminResetAllPasswords: Response headers:', JSON.stringify(response.headers));

      const responseText = await response.text();
      console.log('AdminResetAllPasswords: Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('AdminResetAllPasswords: Failed to parse response as JSON:', parseError);
        throw new Error(`Server returned invalid JSON. Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error('AdminResetAllPasswords: Error response:', data);
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      console.log('AdminResetAllPasswords: Success response:', data);

      const updatedCount = data.usersUpdated || data.updated || data.count || 0;
      setUsersUpdated(updatedCount);
      setSuccess(true);

      Alert.alert(
        'Success!',
        `All ${updatedCount} account passwords have been reset to "123456".\n\nYou can now log in to any account using password: 123456`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('AdminResetAllPasswords: Error:', error);
      const errorMsg = error.message || 'Failed to reset passwords. Please try again.';
      setErrorMessage(errorMsg);
      Alert.alert(
        'Error',
        errorMsg
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reset All Passwords',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Warning Box */}
          <View style={styles.warningBox}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={48}
              color="#FF9500"
            />
            <Text style={styles.warningTitle}>Emergency Password Fix</Text>
            <Text style={styles.warningText}>
              This tool will fix corrupted password hashes and reset ALL user account passwords to "123456" for testing.
            </Text>
          </View>

          {/* Error Message */}
          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="error"
                size={32}
                color="#FF3B30"
              />
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="key.fill"
                android_material_icon_name="vpn-key"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Default Password</Text>
                <Text style={styles.infoText}>All accounts will be set to: 123456</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="person.2.fill"
                android_material_icon_name="group"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Affected Accounts</Text>
                <Text style={styles.infoText}>ALL registered user accounts</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="lock.shield.fill"
                android_material_icon_name="lock"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Security</Text>
                <Text style={styles.infoText}>
                  Passwords will be properly hashed with bcrypt (60 chars, starts with $2b$)
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="wrench.and.screwdriver.fill"
                android_material_icon_name="build"
                size={24}
                color="#FF3B30"
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>What This Fixes</Text>
                <Text style={styles.infoText}>
                  Corrupted password hashes (161 chars, invalid format) will be replaced with valid bcrypt hashes
                </Text>
              </View>
            </View>
          </View>

          {/* Success Message */}
          {success && (
            <View style={styles.successBox}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={48}
                color="#34c759"
              />
              <Text style={styles.successTitle}>Passwords Reset Successfully!</Text>
              <Text style={styles.successText}>
                {usersUpdated} account{usersUpdated !== 1 ? 's' : ''} updated
              </Text>
              <View style={styles.passwordBox}>
                <Text style={styles.passwordLabel}>All accounts can now log in with:</Text>
                <Text style={styles.passwordText}>123456</Text>
              </View>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How to use:</Text>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Tap the "Fix All Passwords" button below
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Confirm the action in the alert dialog
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Wait for the success message
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                Log in to any account using password: 123456
              </Text>
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetButton, resetting && styles.buttonDisabled]}
            onPress={handleResetAllPasswords}
            disabled={resetting}
          >
            {resetting ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.resetButtonText}>Fixing Passwords...</Text>
              </>
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.clockwise.circle.fill"
                  android_material_icon_name="refresh"
                  size={24}
                  color="#fff"
                />
                <Text style={styles.resetButtonText}>Fix All Passwords Now</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              ⚠️ This is a development/testing tool only. Do not use in production environments.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#856404',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: '#D4EDDA',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#34c759',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#155724',
    marginTop: 12,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#155724',
    marginBottom: 16,
  },
  passwordBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  passwordLabel: {
    fontSize: 13,
    color: '#155724',
    marginBottom: 8,
  },
  passwordText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#155724',
    letterSpacing: 2,
  },
  instructionsBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disclaimerBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
