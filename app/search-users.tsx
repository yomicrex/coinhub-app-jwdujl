
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authClient } from '@/lib/auth';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isFollowing?: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export default function SearchUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followingStates, setFollowingStates] = useState<{ [key: string]: boolean }>({});
  const [processingFollow, setProcessingFollow] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    console.log('SearchUsersScreen: Component mounted');
  }, []);

  const searchUsers = useCallback(async () => {
    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('SearchUsersScreen: Fetching users from API');

    try {
      const response = await authClient.$fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(searchQuery)}`);
      console.log('SearchUsersScreen: Search results received:', response);

      if (Array.isArray(response)) {
        setUsers(response);
        
        // Check follow status for each user
        const followStates: { [key: string]: boolean } = {};
        await Promise.all(
          response.map(async (searchUser: SearchUser) => {
            try {
              const followStatus = await authClient.$fetch(`${API_URL}/api/users/${searchUser.id}/is-following`);
              followStates[searchUser.id] = followStatus.isFollowing;
            } catch (err) {
              console.error('SearchUsersScreen: Error checking follow status for user:', searchUser.id, err);
              followStates[searchUser.id] = false;
            }
          })
        );
        setFollowingStates(followStates);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error('SearchUsersScreen: Error searching users:', err);
      setError(err.message || 'Failed to search users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        console.log('SearchUsersScreen: Searching for users with query:', searchQuery);
        searchUsers();
      } else if (searchQuery.trim().length === 0) {
        setUsers([]);
        setError(null);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery, searchUsers]);

  const handleFollowToggle = async (userId: string) => {
    console.log('SearchUsersScreen: Toggle follow for user:', userId);
    
    if (processingFollow[userId]) {
      console.log('SearchUsersScreen: Already processing follow for user:', userId);
      return;
    }

    setProcessingFollow({ ...processingFollow, [userId]: true });
    const isCurrentlyFollowing = followingStates[userId];

    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        console.log('SearchUsersScreen: Unfollowing user:', userId);
        await authClient.$fetch(`${API_URL}/api/users/${userId}/follow`, {
          method: 'DELETE',
        });
        setFollowingStates({ ...followingStates, [userId]: false });
        console.log('SearchUsersScreen: Successfully unfollowed user:', userId);
      } else {
        // Follow
        console.log('SearchUsersScreen: Following user:', userId);
        await authClient.$fetch(`${API_URL}/api/users/${userId}/follow`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        setFollowingStates({ ...followingStates, [userId]: true });
        console.log('SearchUsersScreen: Successfully followed user:', userId);
      }
    } catch (err: any) {
      console.error('SearchUsersScreen: Error toggling follow:', err);
      Alert.alert('Error', err.message || 'Failed to update follow status');
    } finally {
      setProcessingFollow({ ...processingFollow, [userId]: false });
    }
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('SearchUsersScreen: Navigating to user profile:', username);
    if (userId === user?.id) {
      console.log('SearchUsersScreen: Navigating to own profile');
      router.push('/(tabs)/profile');
    } else {
      console.log('SearchUsersScreen: Navigating to user profile with username:', username);
      router.push(`/user-profile?username=${encodeURIComponent(username)}`);
    }
  };

  const handleClearSearch = () => {
    console.log('SearchUsersScreen: Clearing search');
    setSearchQuery('');
    setUsers([]);
    setError(null);
  };

  const renderUserCard = ({ item }: { item: SearchUser }) => {
    const isFollowing = followingStates[item.id] || false;
    const isProcessing = processingFollow[item.id] || false;
    const isOwnProfile = user?.id === item.id;

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => handleUserPress(item.id, item.username)}
        activeOpacity={0.7}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={30}
              color={colors.textSecondary}
              style={{ alignSelf: 'center', marginTop: 10 }}
            />
          </View>
        )}
        
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={() => handleFollowToggle(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={isFollowing ? colors.text : '#FFFFFF'} />
            ) : (
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (searchQuery.trim().length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={64}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Search for Users</Text>
          <Text style={styles.emptyText}>
            Find other coin collectors by searching for their username or display name
          </Text>
        </View>
      );
    }

    if (searchQuery.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Enter at least 2 characters to search</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <IconSymbol
          ios_icon_name="person.slash"
          android_material_icon_name="person-off"
          size={64}
          color={colors.textSecondary}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>No Users Found</Text>
        <Text style={styles.emptyText}>
          No users match your search. Try a different username or display name.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Search Users',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username or name..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={users}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={users.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.border,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 90,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: colors.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
});
