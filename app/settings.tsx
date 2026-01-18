
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    console.log('Settings: User tapped logout');
    
    if (loggingOut) {
      console.log('Settings: Logout already in progress, ignoring tap');
      return;
    }
    
    try {
      console.log('Settings: Starting logout process immediately');
      setLoggingOut(true);
      
      await logout();
      
      console.log('Settings: Logout successful, redirecting to auth');
      router.replace('/auth');
    } catch (error) {
      console.error('Settings: Logout error:', error);
      // Even if logout fails, redirect to auth
      router.replace('/auth');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    console.log('Settings: User tapped delete account');
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your coins, likes, and comments will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Coming Soon',
              'Account deletion will be available in a future update.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Admin Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Tools</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped Admin Tools - View All Accounts');
                router.push('/admin-view-accounts');
              }}
            >
              <IconSymbol
                ios_icon_name="person.3.fill"
                android_material_icon_name="group"
                size={24}
                color="#34c759"
              />
              <Text style={[styles.menuItemText, { fontWeight: '600' }]}>View All Accounts</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped Admin Tools - Fix Passwords');
                router.push('/admin-fix-passwords');
              }}
            >
              <IconSymbol
                ios_icon_name="wrench.and.screwdriver.fill"
                android_material_icon_name="build"
                size={24}
                color="#ff9800"
              />
              <Text style={styles.menuItemText}>Fix Password Issues</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped Admin Tools - Reset Password');
                router.push('/admin-reset-password');
              }}
            >
              <IconSymbol
                ios_icon_name="key.fill"
                android_material_icon_name="vpn-key"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.menuItemText}>Reset User Password</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped Admin Tools - Delete User');
                router.push('/admin-delete-user');
              }}
            >
              <IconSymbol
                ios_icon_name="shield.fill"
                android_material_icon_name="admin-panel-settings"
                size={24}
                color={colors.error}
              />
              <Text style={styles.menuItemText}>Delete User Account</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped edit profile');
                router.push('/edit-profile');
              }}
            >
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="account-circle"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped change password');
                Alert.alert(
                  'Change Password',
                  'Password change will be available soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <IconSymbol
                ios_icon_name="lock"
                android_material_icon_name="lock"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Change Password</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            
            <View style={styles.menuItem}>
              <IconSymbol
                ios_icon_name="bell"
                android_material_icon_name="notifications"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Push Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => {
                  console.log('Settings: User toggled push notifications:', value);
                  setNotificationsEnabled(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.menuItem}>
              <IconSymbol
                ios_icon_name="envelope"
                android_material_icon_name="email"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Email Notifications</Text>
              <Switch
                value={emailNotifications}
                onValueChange={(value) => {
                  console.log('Settings: User toggled email notifications:', value);
                  setEmailNotifications(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Privacy Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped collection privacy');
                Alert.alert(
                  'Collection Privacy',
                  'Privacy settings will be available soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <IconSymbol
                ios_icon_name="eye"
                android_material_icon_name="visibility"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Collection Privacy</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped blocked users');
                Alert.alert(
                  'Blocked Users',
                  'User blocking will be available soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <IconSymbol
                ios_icon_name="person.slash"
                android_material_icon_name="block"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Blocked Users</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped privacy policy');
                router.push('/privacy-policy');
              }}
            >
              <IconSymbol
                ios_icon_name="lock.shield"
                android_material_icon_name="privacy-tip"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('Settings: User tapped terms of use');
                router.push('/terms-of-use');
              }}
            >
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Terms of Use</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={24}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Version</Text>
              <Text style={styles.versionText}>1.0.0</Text>
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, styles.logoutItem, loggingOut && styles.menuItemDisabled]} 
              onPress={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <IconSymbol
                  ios_icon_name="arrow.right.square"
                  android_material_icon_name="logout"
                  size={24}
                  color={colors.error}
                />
              )}
              <Text style={[styles.menuItemText, { color: colors.error }]}>
                {loggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
              <IconSymbol
                ios_icon_name="trash"
                android_material_icon_name="delete"
                size={24}
                color={colors.error}
              />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Account</Text>
            </TouchableOpacity>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoutItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  versionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
