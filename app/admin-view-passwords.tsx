
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import * as Clipboard from 'expo-clipboard';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export default function AdminViewPasswordsScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('Admin View Passwords screen loaded');
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    console.log('Fetching all users for password display');
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      console.log('Users fetched successfully:', data.length, 'users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('User triggered refresh');
    setRefreshing(true);
    fetchUsers();
  };

  const copyToClipboard = async (text: string, label: string) => {
    console.log(`User copying ${label} to clipboard`);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
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
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Test Account Passwords',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Test Account Passwords',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={32}
            color="#FF9500"
          />
          <Text style={styles.headerTitle}>Development/Testing Only</Text>
          <Text style={styles.headerSubtitle}>
            These are test account credentials for development purposes.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Default Test Password</Text>
          <Text style={styles.infoText}>
            All test accounts use the same password for easy testing:
          </Text>
          <View style={styles.passwordBox}>
            <Text style={styles.passwordText}>password123</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard('password123', 'Password')}
              style={styles.copyButton}
            >
              <IconSymbol
                ios_icon_name="doc.on.doc"
                android_material_icon_name="content-copy"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            All Test Accounts ({users.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Tap any field to copy to clipboard
          </Text>
        </View>

        {users.map((user, index) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <Text style={styles.userNumber}>Account #{index + 1}</Text>
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: user.emailVerified ? '#34C759' : '#FF3B30' },
                ]}
              >
                <Text style={styles.verifiedText}>
                  {user.emailVerified ? 'Verified' : 'Not Verified'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => copyToClipboard(user.username, 'Username')}
              style={styles.fieldContainer}
            >
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldText}>{user.username}</Text>
                <IconSymbol
                  ios_icon_name="doc.on.doc"
                  android_material_icon_name="content-copy"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => copyToClipboard(user.email, 'Email')}
              style={styles.fieldContainer}
            >
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldText}>{user.email}</Text>
                <IconSymbol
                  ios_icon_name="doc.on.doc"
                  android_material_icon_name="content-copy"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => copyToClipboard('password123', 'Password')}
              style={styles.fieldContainer}
            >
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldText}>password123</Text>
                <IconSymbol
                  ios_icon_name="doc.on.doc"
                  android_material_icon_name="content-copy"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <Text style={styles.fieldText}>{user.displayName}</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Created</Text>
              <Text style={styles.fieldTextSmall}>{formatDate(user.createdAt)}</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>User ID</Text>
              <Text style={styles.fieldTextSmall}>{user.id}</Text>
            </View>
          </View>
        ))}

        <View style={styles.quickLoginSection}>
          <Text style={styles.sectionTitle}>Quick Login Instructions</Text>
          <View style={styles.instructionBox}>
            <Text style={styles.instructionStep}>1. Go to the login screen</Text>
            <Text style={styles.instructionStep}>
              2. Enter any username or email from above
            </Text>
            <Text style={styles.instructionStep}>3. Enter password: password123</Text>
            <Text style={styles.instructionStep}>4. Tap "Sign In"</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ⚠️ These credentials are for testing only. Do not use in production.
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
  },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  passwordText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userCard: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  verifiedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  fieldTextSmall: {
    fontSize: 14,
    color: colors.text,
  },
  quickLoginSection: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionBox: {
    marginTop: 12,
  },
  instructionStep: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  footerText: {
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
    fontWeight: '500',
  },
});
