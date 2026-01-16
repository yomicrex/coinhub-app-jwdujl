
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
                  `Account "${username}" has been deleted successfully. You can now create a new account with this username.`,
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
                Alert.alert('Error', `User "${username}" not found`);
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
          <Text style={styles.warningTitle}>Admin Tool</Text>
          <Text style={styles.warningText}>
            This will permanently delete the user account and all associated data including coins, trades, comments, and likes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Username to Delete</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.deleteButtonDisabled]}
          onPress={handleDeleteUser}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="trash.fill"
                android_material_icon_name="delete"
                size={20}
                color="#fff"
              />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionDescription}>
            Tap to quickly select accounts that need to be deleted:
          </Text>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => handleQuickDelete('yomicrex')}
            disabled={loading}
          >
            <Text style={styles.quickButtonText}>Delete "yomicrex"</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => handleQuickDelete('JJ1981')}
            disabled={loading}
          >
            <Text style={styles.quickButtonText}>Delete "JJ1981"</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            After deleting an account, you can immediately create a new account with the same username.
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
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
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
  },
  quickButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
