
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8082';

export default function AdminFixPasswordsScreen() {
  const [loading, setLoading] = useState(false);
  const [fixedAccounts, setFixedAccounts] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();

  const handleFixAllPasswords = async () => {
    console.log('User tapped Fix All Passwords button');
    
    Alert.alert(
      'Fix All Broken Passwords',
      'This will reset all accounts with invalid password hashes to the temporary password "TempPass123!". You can then log in with this password and change it.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Fix Passwords',
          onPress: async () => {
            setLoading(true);
            setShowResults(false);
            console.log('Fixing all broken passwords...');

            try {
              const response = await fetch(`${API_URL}/api/admin/fix-all-passwords`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({}),
              });

              console.log('Fix passwords response status:', response.status);

              if (response.ok) {
                const data = await response.json();
                console.log('Passwords fixed successfully:', data);
                setFixedAccounts(data.fixed || []);
                setShowResults(true);
                
                Alert.alert(
                  'Success',
                  `Fixed ${data.count || 0} account(s).\n\nTemporary password: TempPass123!\n\nYou can now log in with any of the fixed accounts using this password.`,
                  [{ text: 'OK' }]
                );
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to fix passwords:', errorData);
                Alert.alert('Error', errorData.error || 'Failed to fix passwords');
              }
            } catch (error) {
              console.error('Error fixing passwords:', error);
              Alert.alert('Error', 'An error occurred while fixing passwords. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResetSpecificUser = async (username: string, newPassword: string) => {
    console.log('Resetting password for user:', username);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });

      console.log('Reset password response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Password reset successfully:', data);
        Alert.alert(
          'Success',
          `Password for "${username}" has been reset to: ${newPassword}\n\nYou can now log in with this password.`,
          [{ text: 'OK' }]
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to reset password:', errorData);
        Alert.alert('Error', errorData.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'An error occurred while resetting the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReset = (username: string) => {
    console.log('User tapped quick reset for:', username);
    
    Alert.alert(
      'Reset Password',
      `Reset password for "${username}" to "TempPass123!"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          onPress: () => handleResetSpecificUser(username, 'TempPass123!'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Fix Password Issues',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.warningBox}>
          <IconSymbol
            ios_icon_name="wrench.and.screwdriver.fill"
            android_material_icon_name="build"
            size={32}
            color={colors.primary}
          />
          <Text style={styles.warningTitle}>Password Fix Tool</Text>
          <Text style={styles.warningText}>
            This tool fixes accounts with broken password hashes. After fixing, all affected accounts will have the temporary password: TempPass123!
          </Text>
        </View>

        <View style={styles.instructionsBox}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={colors.primary}
          />
          <View style={styles.instructionsContent}>
            <Text style={styles.instructionsTitle}>What This Does:</Text>
            <Text style={styles.instructionsText}>
              - Finds all accounts with invalid password hashes{'\n'}
              - Resets them to a temporary password{'\n'}
              - Uses proper bcrypt hashing{'\n'}
              - Allows you to log in immediately
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fix All Broken Passwords</Text>
          <Text style={styles.sectionDescription}>
            This will automatically fix all accounts that have invalid password hashes (including yomicrex, JJ1981, and JJ1980).
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleFixAllPasswords}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="wrench.and.screwdriver.fill"
                  android_material_icon_name="build"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.buttonText}>Fix All Passwords</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        {showResults && fixedAccounts.length > 0 && (
          <View style={styles.resultsBox}>
            <View style={styles.resultsHeader}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color="#34c759"
              />
              <Text style={styles.resultsTitle}>Fixed Accounts</Text>
            </View>
            <Text style={styles.resultsDescription}>
              The following accounts have been fixed and can now log in with password: TempPass123!
            </Text>
            {fixedAccounts.map((username, index) => (
              <View key={index} style={styles.accountItem}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.accountText}>{username}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Reset Individual Accounts</Text>
          <Text style={styles.sectionDescription}>
            Reset specific accounts to the temporary password:
          </Text>

          <TouchableOpacity
            style={[styles.quickButton]}
            onPress={() => handleQuickReset('yomicrex')}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="key.fill"
              android_material_icon_name="vpn-key"
              size={20}
              color={colors.primary}
            />
            <View style={styles.quickButtonContent}>
              <Text style={styles.quickButtonText}>Reset "yomicrex"</Text>
              <Text style={styles.quickButtonSubtext}>yomicrex@gmail.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton]}
            onPress={() => handleQuickReset('JJ1981')}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="key.fill"
              android_material_icon_name="vpn-key"
              size={20}
              color={colors.primary}
            />
            <View style={styles.quickButtonContent}>
              <Text style={styles.quickButtonText}>Reset "JJ1981"</Text>
              <Text style={styles.quickButtonSubtext}>yomicrex@hotmail.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton]}
            onPress={() => handleQuickReset('JJ1980')}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="key.fill"
              android_material_icon_name="vpn-key"
              size={20}
              color={colors.primary}
            />
            <View style={styles.quickButtonContent}>
              <Text style={styles.quickButtonText}>Reset "JJ1980"</Text>
              <Text style={styles.quickButtonSubtext}>yomicrex@mail.com</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <IconSymbol
            ios_icon_name="lightbulb.fill"
            android_material_icon_name="lightbulb"
            size={20}
            color="#ff9500"
          />
          <Text style={styles.infoText}>
            <Text style={styles.infoTextBold}>Next Steps:{'\n'}</Text>
            1. Tap "Fix All Passwords" above{'\n'}
            2. Go back to the login screen{'\n'}
            3. Log in with username and password: TempPass123!{'\n'}
            4. Change your password in settings
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  warningBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionsBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsContent: {
    flex: 1,
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
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  quickButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickButtonContent: {
    flex: 1,
  },
  quickButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickButtonSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  resultsBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  resultsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 8,
  },
  accountText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  infoTextBold: {
    fontWeight: '600',
  },
});
