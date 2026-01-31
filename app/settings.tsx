
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
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { authenticatedFetch } from '@/utils/api';
import { AuthDebugPanel } from '@/components/AuthDebugPanel';
import ENV from '@/config/env';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = React.useState(false);
  const [showEmailUpdateModal, setShowEmailUpdateModal] = React.useState(false);
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);

  // Show debug panel in dev mode or TestFlight builds
  const showDebugButton = ENV.IS_DEV || ENV.IS_STANDALONE;

  console.log('Settings screen loaded', { userEmail: user?.email });

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
      showErrorModal('Error', 'No email address found. Please log in again.');
      return;
    }

    setIsResettingPassword(true);

    try {
      const response = await fetch(`${ENV.BACKEND_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Type': ENV.IS_STANDALONE ? 'standalone' : ENV.IS_EXPO_GO ? 'expo-go' : 'unknown',
          'X-Platform': ENV.PLATFORM,
        },
        credentials: 'omit',
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Password reset email sent successfully');
        setShowPasswordResetModal(false);
        showSuccessModal(
          'Password Reset Email Sent',
          `Check your email (${user.email}) for a link to reset your password. The link will expire in 1 hour.`
        );
      } else {
        console.error('Failed to send password reset email:', data);
        showErrorModal('Error', data.error || 'Failed to send password reset email. Please try again.');
      }
    } catch (error) {
      console.error('Error requesting password reset:', error);
      showErrorModal('Error', 'Failed to send password reset email. Please check your connection and try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleUpdateEmail = async () => {
    console.log('User requested email update', { newEmail });

    if (!newEmail || !newEmail.trim()) {
      showErrorModal('Error', 'Please enter a valid email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showErrorModal('Error', 'Please enter a valid email address.');
      return;
    }

    if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      showErrorModal('Error', 'This is already your current email address.');
      return;
    }

    setIsUpdatingEmail(true);

    try {
      const response = await authenticatedFetch('/api/users/me/email', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Email updated successfully', { newEmail: data.email });
        setShowEmailUpdateModal(false);
        setNewEmail('');
        
        // Refresh user data to update the email in the UI
        try {
          await refreshUser();
          console.log('User data refreshed after email update');
        } catch (refreshError) {
          console.error('Failed to refresh user data:', refreshError);
          // Continue anyway - the email was updated successfully
        }
        
        showSuccessModal(
          'Email Updated',
          `Your email has been successfully updated to ${data.email}. Please use this email for future logins.`
        );
      } else {
        console.error('Failed to update email:', data);
        showErrorModal('Error', data.error || data.message || 'Failed to update email. Please try again.');
      }
    } catch (error) {
      console.error('Error updating email:', error);
      showErrorModal('Error', 'Failed to update email. Please check your connection and try again.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleDeleteAccount = () => {
    console.log('User tapped Delete Account');
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    console.log('User confirmed account deletion');
    
    setIsDeletingAccount(true);

    try {
      const response = await authenticatedFetch('/api/users/me', {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Account deleted successfully');
        setShowDeleteModal(false);
        
        // Sign out the user
        await signOut();
        
        showSuccessModal(
          'Account Deleted',
          'Your account has been permanently deleted.',
          () => {
            router.replace('/auth');
          }
        );
      } else {
        const data = await response.json();
        console.error('Failed to delete account:', data);
        showErrorModal('Error', data.error || 'Failed to delete account. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      showErrorModal('Error', 'Failed to delete account. Please check your connection and try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Helper functions for showing modals
  const [modalState, setModalState] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
    onClose?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });

  const showSuccessModal = (title: string, message: string, onClose?: () => void) => {
    setModalState({ visible: true, title, message, type: 'success', onClose });
  };

  const showErrorModal = (title: string, message: string, onClose?: () => void) => {
    setModalState({ visible: true, title, message, type: 'error', onClose });
  };

  const closeModal = () => {
    if (modalState.onClose) {
      modalState.onClose();
    }
    setModalState({ ...modalState, visible: false });
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
        {/* Debug Section (only in dev/TestFlight) */}
        {showDebugButton && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
            
            <TouchableOpacity
              style={styles.option}
              onPress={() => setShowDebugPanel(true)}
            >
              <IconSymbol
                ios_icon_name="ladybug"
                android_material_icon_name="bug-report"
                size={24}
                color="#FFD700"
              />
              <Text style={styles.optionText}>Auth Debug Panel</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          
          <TouchableOpacity
            style={styles.option}
            onPress={() => {
              console.log('SettingsScreen: User tapped Manage Subscription');
              router.push('/subscription');
            }}
          >
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={24}
              color="#FFB800"
            />
            <Text style={styles.optionText}>Manage Subscription</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.option} 
            onPress={() => setShowEmailUpdateModal(true)}
          >
            <IconSymbol
              ios_icon_name="envelope"
              android_material_icon_name="email"
              size={24}
              color={colors.primary}
            />
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>Update Email</Text>
              <Text style={styles.optionSubtext}>{user?.email || 'No email set'}</Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

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

      {/* Auth Debug Panel */}
      <AuthDebugPanel
        visible={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />

      {/* Email Update Modal */}
      <Modal
        visible={showEmailUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isUpdatingEmail && setShowEmailUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Email Address</Text>
            <Text style={styles.modalMessage}>
              Current email: <Text style={styles.modalEmail}>{user?.email}</Text>
              {'\n\n'}
              Enter your new email address:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="new.email@example.com"
              placeholderTextColor={colors.textSecondary}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isUpdatingEmail}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEmailUpdateModal(false);
                  setNewEmail('');
                }}
                disabled={isUpdatingEmail}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleUpdateEmail}
                disabled={isUpdatingEmail}
              >
                {isUpdatingEmail ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Update Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        visible={showPasswordResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isResettingPassword && setShowPasswordResetModal(false)}
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
                disabled={isResettingPassword}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleRequestPasswordReset}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Send Reset Link</Text>
                )}
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
        onRequestClose={() => !isDeletingAccount && setShowDeleteModal(false)}
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
                disabled={isDeletingAccount}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextDelete}>Delete Forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success/Error Modal */}
      <Modal
        visible={modalState.visible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalState.title}</Text>
            <Text style={styles.modalMessage}>{modalState.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm, { width: '100%' }]}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
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
  optionContent: {
    flex: 1,
    marginLeft: 12,
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  optionSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
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
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
