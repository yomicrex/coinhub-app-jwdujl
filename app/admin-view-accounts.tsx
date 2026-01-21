
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
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { colors } from '@/styles/commonStyles';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

interface Account {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  createdAt: string;
  hasProfile: boolean;
}

export default function AdminViewAccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    console.log('AdminViewAccountsScreen: Fetching all accounts');
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      console.log('AdminViewAccountsScreen: Calling GET /api/admin/users');
      const response = await fetch(`${API_URL}/api/admin/users`, {
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('AdminViewAccountsScreen: Failed to fetch users, status:', response.status);
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      console.log('AdminViewAccountsScreen: Fetched users:', data);
      
      // The new endpoint returns an array of users directly
      const accountsData = Array.isArray(data) ? data : (data?.users || []);
      console.log('AdminViewAccountsScreen: Processed', accountsData.length, 'user accounts');
      setAccounts(accountsData);
    } catch (error) {
      console.error('AdminViewAccountsScreen: Error fetching users:', error);
      Alert.alert('Error', 'Failed to load user accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountPress = (username: string | null) => {
    if (!username) {
      Alert.alert('No Profile', 'This user has not completed their profile yet.');
      return;
    }
    console.log('AdminViewAccountsScreen: User tapped account:', username);
    router.push(`/user-profile?username=${username}`);
  };

  const filteredAccounts = accounts.filter(
    (account) =>
      account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (account.username && account.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (account.displayName && account.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'All Accounts',
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
          title: 'All Accounts',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by email, username, or name..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.countText}>
          {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <ScrollView style={styles.scrollView}>
        {filteredAccounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="person.2.slash"
              android_material_icon_name="person-off"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No accounts found matching your search' : 'No accounts found'}
            </Text>
          </View>
        ) : (
          filteredAccounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={styles.accountCard}
              onPress={() => handleAccountPress(account.username)}
            >
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
                  <Text style={styles.displayName}>
                    {account.displayName || account.username || 'No Name'}
                  </Text>
                  {account.username && (
                    <Text style={styles.username}>@{account.username}</Text>
                  )}
                </View>
                <View style={[styles.roleBadge, !account.hasProfile && styles.incompleteProfileBadge]}>
                  <Text style={styles.roleText}>
                    {account.hasProfile ? 'Active' : 'Incomplete'}
                  </Text>
                </View>
              </View>
              <View style={styles.accountDetails}>
                <View style={styles.detailRow}>
                  <IconSymbol
                    ios_icon_name="envelope"
                    android_material_icon_name="email"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.detailText}>{account.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.detailText}>
                    Joined {new Date(account.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {!account.hasProfile && (
                  <View style={styles.detailRow}>
                    <IconSymbol
                      ios_icon_name="exclamationmark.triangle"
                      android_material_icon_name="warning"
                      size={16}
                      color="#FF9500"
                    />
                    <Text style={[styles.detailText, { color: '#FF9500' }]}>
                      Profile not completed
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.accountFooter}>
                <Text style={styles.userIdText}>ID: {account.id}</Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
  },
  countText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  accountCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#34C759',
  },
  incompleteProfileBadge: {
    backgroundColor: '#FF9500',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
    textTransform: 'uppercase',
  },
  accountDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  accountFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userIdText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});
