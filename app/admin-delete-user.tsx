
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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

export default function AdminDeleteUserScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDeleteUser = async () => {
    console.log('User tapped Delete User button for username:', username);
    
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete the account "${username}" and all associated data? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            console.log('Deleting user account:', username);

            try {
              const response = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username)}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              console.log('Delete user response status:', response.status);

              if (response.ok) {
                const data = await response.json();
                console.log('User deleted successfully:', data);
                Alert.alert(
                  'Success',
                  `Account "${username}" has been deleted successfully.\n\nYou can now create a new account with this username and email address.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setUsername('');
                      },
                    },
                  ]
                );
              } else if (response.status === 404) {
                console.log('User not found:', username);
                Alert.alert('Not Found', `User "${username}" does not exist or has already been deleted.`);
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to delete user:', errorData);
                Alert.alert('Error', errorData.error || 'Failed to delete user account');
              }
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'An error occurred while deleting the account. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleQuickDelete = (quickUsername: string) => {
    console.log('User tapped quick delete for:', quickUsername);
    setUsername(quickUsername);
    // Auto-trigger delete after setting username
    setTimeout(() => {
      handleDeleteUser();
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Delete User Account',
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
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={32}
            color="#ff9500"
          />
          <Text style={styles.warningTitle}>Admin Tool - Delete Accounts</Text>
          <Text style={styles.warningText}>
            This will permanently delete the user account and all associated data including coins, trades, comments, and likes. This action cannot be undone.
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
            <Text style={styles.instructionsTitle}>How to Use:</Text>
            <Text style={styles.instructionsText}>
              1. Tap one of the Quick Action buttons below{'\n'}
              2. Confirm the deletion{'\n'}
              3. After deletion, you can create a new account with the same username
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions - Tap to Delete</Text>
          <Text style={styles.sectionDescription}>
            These are the accounts you mentioned that need to be deleted:
          </Text>

          <TouchableOpacity
            style={[styles.quickButton, styles.quickButtonDanger]}
            onPress={() => handleQuickDelete('yomicrex')}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#fff"
            />
            <View style={styles.quickButtonContent}>
              <Text style={styles.quickButtonTextWhite}>Delete "yomicrex"</Text>
              <Text style={styles.quickButtonSubtext}>Associated with yomicrex@gmail.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton, styles.quickButtonDanger]}
            onPress={() => handleQuickDelete('JJ1981')}
            disabled={loading}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#fff"
            />
            <View style={styles.quickButtonContent}>
              <Text style={styles.quickButtonTextWhite}>Delete "JJ1981"</Text>
              <Text style={styles.quickButtonSubtext}>Associated with yomicrex@hotmail.com</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Or Enter Username Manually</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username to delete"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.deleteButton, loading && styles.deleteButtonDisabled]}
            onPress={handleDeleteUser}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="trash.fill"
                  android_material_icon_name="delete"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.successBox}>
          <IconSymbol
            ios_icon_name="checkmark.circle.fill"
            android_material_icon_name="check-circle"
            size={20}
            color="#34c759"
          />
          <Text style={styles.successText}>
            After deleting an account, you can immediately create a new account with the same username and email address. The password reset issue will be resolved.
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
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff9500',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: colors.text,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
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
  quickButtonDanger: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  quickButtonContent: {
    flex: 1,
  },
  quickButtonTextWhite: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  quickButtonSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  successBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
