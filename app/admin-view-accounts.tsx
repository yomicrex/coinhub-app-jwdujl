
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
}

export default function AdminViewAccountsScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    console.log('AdminViewAccounts: Fetching all users');
    try {
      const response = await fetch(`${API_URL}/api/admin/users/list`, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('AdminViewAccounts: Response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      console.log('AdminViewAccounts: Fetched users:', data.length);
      setUsers(data);
    } catch (error: any) {
      console.error('AdminViewAccounts: Error fetching users:', error);
      Alert.alert('Error', 'Failed to load user accounts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('AdminViewAccounts: User refreshing list');
    setRefreshing(true);
    fetchUsers();
  };

  const handleResetPassword = (user: User) => {
    console.log('AdminViewAccounts: User tapped reset password for:', user.username);
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setResetSuccess(null);
    setShowPasswordModal(true);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;

    console.log('AdminViewAccounts: Confirming password reset for:', selectedUser.username);

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
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

    setResettingPassword(true);

    try {
      console.log('AdminViewAccounts: Sending password reset request');
      
      const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(selectedUser.username)}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      });

      console.log('AdminViewAccounts: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AdminViewAccounts: Error response:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to reset password');
      }

      const data = await response.json();
      console.log('AdminViewAccounts: Success response:', data);

      // Show success with the password
      setResetSuccess({
        username: selectedUser.username,
        password: newPassword,
      });
    } catch (error: any) {
      console.error('AdminViewAccounts: Error:', error);
      Alert.alert('Error', error.message || 'Failed to reset password. Please try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  const closeModal = () => {
    setShowPasswordModal(false);
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetSuccess(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'View All Accounts',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'View All Accounts',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Info Box */}
          <View style={styles.infoBox}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={24}
              color={colors.primary}
            />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Account Management</Text>
              <Text style={styles.infoText}>
                View all registered accounts and reset passwords. Passwords cannot be displayed (they are hashed), but you can reset them to a new password.
              </Text>
            </View>
          </View>

          {/* User Count */}
          <View style={styles.statsBox}>
            <Text style={styles.statsText}>
              Total Accounts: <Text style={styles.statsNumber}>{users.length}</Text>
            </Text>
          </View>

          {/* Users List */}
          {users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="person.slash"
                android_material_icon_name="person-off"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No accounts found</Text>
            </View>
          ) : (
            users.map((user, index) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <IconSymbol
                      ios_icon_name="person.fill"
                      android_material_icon_name="person"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.displayName}</Text>
                    <Text style={styles.userUsername}>@{user.username}</Text>
                  </View>
                  {user.emailVerified && (
                    <View style={styles.verifiedBadge}>
                      <IconSymbol
                        ios_icon_name="checkmark.seal.fill"
                        android_material_icon_name="verified"
                        size={16}
                        color="#34c759"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.userDetails}>
                  <View style={styles.detailRow}>
                    <IconSymbol
                      ios_icon_name="envelope.fill"
                      android_material_icon_name="email"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.detailText}>{user.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.detailText}>Joined {formatDate(user.createdAt)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <IconSymbol
                      ios_icon_name="key.fill"
                      android_material_icon_name="vpn-key"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.detailText}>Password: ••••••••</Text>
                    <Text style={styles.detailSubtext}>(hashed, cannot be displayed)</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => handleResetPassword(user)}
                >
                  <IconSymbol
                    ios_icon_name="arrow.clockwise"
                    android_material_icon_name="refresh"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.resetButtonText}>Reset Password</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Password Reset Modal */}
        <Modal
          visible={showPasswordModal}
          transparent
          animationType="slide"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {resetSuccess ? (
                // Success View
                <>
                  <View style={styles.successIcon}>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={64}
                      color="#34c759"
                    />
                  </View>
                  <Text style={styles.modalTitle}>Password Reset Successful!</Text>
                  <Text style={styles.successText}>
                    The password for <Text style={styles.boldText}>@{resetSuccess.username}</Text> has been reset.
                  </Text>

                  <View style={styles.passwordDisplayBox}>
                    <Text style={styles.passwordDisplayLabel}>New Password:</Text>
                    <Text style={styles.passwordDisplayText}>{resetSuccess.password}</Text>
                    <Text style={styles.passwordDisplayHint}>
                      Save this password! The user can now log in with this password.
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
                    <Text style={styles.modalButtonText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Reset Form View
                <>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSubtitle}>
                    Setting new password for <Text style={styles.boldText}>@{selectedUser?.username}</Text>
                  </Text>

                  <View style={styles.modalInputContainer}>
                    <IconSymbol
                      ios_icon_name="lock.fill"
                      android_material_icon_name="lock"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="New Password (min 6 characters)"
                      placeholderTextColor={colors.textSecondary}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!resettingPassword}
                    />
                  </View>

                  <View style={styles.modalInputContainer}>
                    <IconSymbol
                      ios_icon_name="lock.fill"
                      android_material_icon_name="lock"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Confirm New Password"
                      placeholderTextColor={colors.textSecondary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!resettingPassword}
                    />
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSecondary]}
                      onPress={closeModal}
                      disabled={resettingPassword}
                    >
                      <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, resettingPassword && styles.buttonDisabled]}
                      onPress={confirmResetPassword}
                      disabled={resettingPassword}
                    >
                      {resettingPassword ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.modalButtonText}>Reset</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statsBox: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  userDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.text,
  },
  detailSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  resetButton: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
    color: colors.primary,
  },
  passwordDisplayBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#34c759',
  },
  passwordDisplayLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  passwordDisplayText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: 1,
  },
  passwordDisplayHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.backgroundAlt,
    gap: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
