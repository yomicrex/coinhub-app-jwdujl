
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { deleteCurrentUserAccount, deleteAllUsers } from '@/utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  console.log('Settings screen loaded');

  const handlePrivacyPolicy = () => {
    console.log('User tapped Privacy Policy');
    router.push('/privacy-policy');
  };

  const handleTermsOfUse = () => {
    console.log('User tapped Terms of Use');
    router.push('/terms-of-use');
  };

  const handleContactSupport = () => {
    console.log('User tapped Contact Support');
    Alert.alert(
      'Contact Support',
      'Email us at support@coinhub.app',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Email',
          onPress: () => Linking.openURL('mailto:support@coinhub.app'),
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    console.log('User tapped Delete Account');
    
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• All your coins\n• All your trades\n• All your comments and likes\n• Your profile and account data\n\nThis action is permanent and irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed account deletion');
            
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This is your last chance. Are you absolutely sure you want to permanently delete your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    console.log('User confirmed final deletion, calling API');
                    
                    // Call the delete account API
                    const result = await deleteCurrentUserAccount();
                    
                    if (result.success) {
                      console.log('Account deleted successfully');
                      
                      // Sign out the user FIRST to clear the session
                      console.log('Signing out user after account deletion');
                      await signOut();
                      
                      // Wait a moment for the sign out to complete
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // Show success message
                      Alert.alert(
                        'Account Deleted',
                        'Your account has been permanently deleted.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              // Force redirect to auth screen (login page)
                              console.log('Redirecting to login screen after account deletion');
                              router.replace('/auth');
                            },
                          },
                        ]
                      );
                    } else {
                      console.error('Failed to delete account:', result.message);
                      Alert.alert(
                        'Error',
                        result.message || 'Failed to delete account. Please try again or contact support.',
                        [{ text: 'OK' }]
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleAdminResetAllPasswords = () => {
    console.log('Admin navigating to Reset All Passwords screen');
    router.push('/admin-reset-all-passwords');
  };

  const handleAdminDeleteUser = () => {
    console.log('Admin navigating to Delete User screen');
    router.push('/admin-delete-user');
  };

  const handleAdminViewAccounts = () => {
    console.log('Admin navigating to View Accounts screen');
    router.push('/admin-view-accounts');
  };

  const handleAdminViewPasswords = () => {
    console.log('Admin navigating to View Passwords screen');
    router.push('/admin-view-passwords');
  };

  const handleAdminDeleteAllUsers = async () => {
    console.log('Admin tapped Delete All Users');
    
    Alert.alert(
      '⚠️ DANGER: Delete All Users',
      'This will PERMANENTLY DELETE ALL USER ACCOUNTS AND DATA from the system including:\n\n• All user profiles\n• All user accounts\n• All coins\n• All trades\n• All comments and likes\n• All follows and notifications\n• Everything!\n\nThis action is IRREVERSIBLE and will wipe the entire database.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Users',
          style: 'destructive',
          onPress: async () => {
            console.log('Admin confirmed first deletion warning');
            
            // Second confirmation with typing requirement
            Alert.alert(
              '🚨 FINAL WARNING',
              'This is your LAST CHANCE to cancel.\n\nThis will delete EVERYTHING and cannot be undone.\n\nType "DELETE ALL" to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'I Understand, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    console.log('Admin confirmed final deletion, calling API');
                    
                    // Show loading alert
                    Alert.alert('Deleting...', 'Please wait while all users are being deleted.');
                    
                    // Call the delete all users API
                    const result = await deleteAllUsers();
                    
                    if (result.success) {
                      console.log('All users deleted successfully:', result.deletedCount);
                      
                      Alert.alert(
                        '✅ All Users Deleted',
                        `Successfully deleted ${result.deletedCount || 'all'} user accounts and all associated data.\n\nThe database has been wiped clean.`,
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              console.log('Admin acknowledged deletion success');
                              // Optionally sign out the admin too
                              signOut();
                              router.replace('/auth');
                            },
                          },
                        ]
                      );
                    } else {
                      console.error('Failed to delete all users:', result.message);
                      Alert.alert(
                        '❌ Error',
                        result.message || 'Failed to delete all users. Please check your admin permissions and try again.',
                        [{ text: 'OK' }]
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.option} onPress={handleDeleteAccount}>
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={24}
              color="#FF3B30"
            />
            <Text style={[styles.optionText, { color: '#FF3B30' }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity style={styles.option} onPress={handlePrivacyPolicy}>
            <IconSymbol
              ios_icon_name="lock.shield"
              android_material_icon_name="lock"
              size={24}
              color={colors.text}
            />
            <Text style={styles.optionText}>Privacy Policy</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={handleTermsOfUse}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={24}
              color={colors.text}
            />
            <Text style={styles.optionText}>Terms of Use</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.option} onPress={handleContactSupport}>
            <IconSymbol
              ios_icon_name="envelope"
              android_material_icon_name="email"
              size={24}
              color={colors.text}
            />
            <Text style={styles.optionText}>Contact Support</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Tools</Text>
          <Text style={styles.sectionSubtitle}>
            Development/Testing Tools - Not for production use
          </Text>

          {/* PROMINENT: Reset All Passwords Button */}
          <TouchableOpacity
            style={[styles.option, styles.prominentOption]}
            onPress={handleAdminResetAllPasswords}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise.circle.fill"
              android_material_icon_name="refresh"
              size={28}
              color="#FF3B30"
            />
            <View style={styles.prominentTextContainer}>
              <Text style={[styles.optionText, { color: '#FF3B30', fontWeight: '700', fontSize: 17 }]}>
                Reset All Passwords to 123456
              </Text>
              <Text style={styles.prominentSubtext}>
                Fix login issues by resetting all account passwords
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color="#FF3B30"
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.option, styles.adminOption]}
            onPress={handleAdminViewPasswords}
          >
            <IconSymbol
              ios_icon_name="key.fill"
              android_material_icon_name="vpn-key"
              size={24}
              color="#FF9500"
            />
            <Text style={[styles.optionText, { color: '#FF9500', fontWeight: '600' }]}>
              View Test Account Passwords
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color="#FF9500"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, styles.adminOption]}
            onPress={handleAdminViewAccounts}
          >
            <IconSymbol
              ios_icon_name="person.2"
              android_material_icon_name="group"
              size={24}
              color="#007AFF"
            />
            <Text style={styles.optionText}>View All Accounts</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, styles.adminOption]}
            onPress={handleAdminDeleteUser}
          >
            <IconSymbol
              ios_icon_name="person.crop.circle.badge.minus"
              android_material_icon_name="person-remove"
              size={24}
              color="#FF3B30"
            />
            <Text style={[styles.optionText, { color: '#FF3B30' }]}>
              Delete User Account
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color="#FF3B30"
            />
          </TouchableOpacity>

          {/* EXTREMELY DANGEROUS: Delete All Users */}
          <TouchableOpacity
            style={[styles.option, styles.dangerOption]}
            onPress={handleAdminDeleteAllUsers}
          >
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={28}
              color="#FFFFFF"
            />
            <View style={styles.dangerTextContainer}>
              <Text style={[styles.optionText, { color: '#FFFFFF', fontWeight: '700', fontSize: 17 }]}>
                🚨 Delete ALL Users
              </Text>
              <Text style={styles.dangerSubtext}>
                DANGER: Wipes entire database - irreversible!
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>CoinHub v1.0.0</Text>
          <Text style={styles.footerText}>© 2026 CoinHub. All rights reserved.</Text>
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
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontStyle: 'italic',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  adminOption: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  prominentOption: {
    borderWidth: 2,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
    padding: 16,
    marginBottom: 16,
  },
  prominentTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  prominentSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dangerOption: {
    borderWidth: 3,
    borderColor: '#FF0000',
    backgroundColor: '#CC0000',
    padding: 16,
    marginTop: 16,
  },
  dangerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  dangerSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
    fontWeight: '600',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
