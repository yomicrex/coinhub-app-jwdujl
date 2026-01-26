
import React from 'react';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
} from 'react';
import { colors } from '@/styles/commonStyles';
import { authenticatedFetch } from '@/utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = React.useState(false);

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
    Linking.openURL('mailto:support@coinhub.app');
  };

  const handleRequestPasswordReset = async () => {
    console.log('User requested password reset');
    
    if (!user?.email) {
      Alert.alert('Error', 'No email address found. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${Constants.expoConfig?.extra?.backendUrl}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Password reset email sent successfully');
        setShowPasswordResetModal(false);
        Alert.alert(
          'Password Reset Email Sent',
          'Check your email for a link to reset your password. The link will expire in 1 hour.',
          [{ text: 'OK' }]
        );
      } else {
        console.error('Failed to send password reset email:', data);
        Alert.alert('Error', data.error || 'Failed to send password reset email. Please try again.');
      }
    } catch (error) {
      console.error('Error requesting password reset:', error);
      Alert.alert('Error', 'Failed to send password reset email. Please check your connection and try again.');
    }
  };

  const handleDeleteAccount = async () => {
    console.log('User tapped Delete Account');
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    console.log('User confirmed account deletion');
    
    try {
      const response = await authenticatedFetch('/api/users/me', {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Account deleted successfully');
        setShowDeleteModal(false);
        
        // Sign out the user
        await signOut();
        
        Alert.alert(
          'Account Deleted',
          'Your account has been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/auth');
              },
            },
          ]
        );
      } else {
        const data = await response.json();
        console.error('Failed to delete account:', data);
        Alert.alert('Error', data.error || 'Failed to delete account. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please check your connection and try again.');
    }
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
          
          <TouchableOpacity 
            style={styles.option} 
            onPress={() => setShowPasswordResetModal(true)}
          >
            <IconSymbol
              ios_icon_name="key"
              android_material_icon_name="vpn-key"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.optionText}>Reset Password</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

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

        <View style={styles.footer}>
          <Text style={styles.footerText}>CoinHub v1.0.0</Text>
          <Text style={styles.footerText}>© 2026 CoinHub. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Password Reset Modal */}
      <Modal
        visible={showPasswordResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalMessage}>
              We'll send a password reset link to your email address:
              {'\n\n'}
              <Text style={styles.modalEmail}>{user?.email}</Text>
              {'\n\n'}
              The link will expire in 1 hour.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPasswordResetModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleRequestPasswordReset}
              >
                <Text style={styles.modalButtonTextConfirm}>Send Reset Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your account? This action cannot be undone and will permanently delete:
              {'\n\n'}
              • All your coins{'\n'}
              • All your trades{'\n'}
              • All your comments and likes{'\n'}
              • Your profile and account data{'\n\n'}
              This action is permanent and irreversible.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDeleteAccount}
              >
                <Text style={styles.modalButtonTextDelete}>Delete Forever</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    lineHeight: 24,
  },
  modalEmail: {
    fontWeight: '600',
    color: colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonDelete: {
    backgroundColor: '#FF3B30',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextDelete: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
