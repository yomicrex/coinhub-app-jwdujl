
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

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

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

  const handleDeleteAccount = () => {
    console.log('User tapped Delete Account');
    Alert.alert(
      'Delete Account',
      'This feature is coming soon. Please contact support to delete your account.',
      [{ text: 'OK' }]
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
