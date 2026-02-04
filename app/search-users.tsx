
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
  Platform,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [agencyFilter, setAgencyFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  useEffect(() => {
    console.log('SearchUsersScreen: Component mounted');
  }, []);

  const searchUsers = useCallback(async () => {
    if (searchQuery.trim().length < 2 && !agencyFilter.trim() && !countryFilter.trim() && !unitFilter.trim()) {
      setError('Please enter at least 2 characters or select a filter');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('SearchUsersScreen: Fetching users from API');

    try {
      const params = new URLSearchParams();
      
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      if (agencyFilter.trim()) {
        params.append('agency', agencyFilter.trim());
      }
      if (countryFilter.trim()) {
        params.append('country', countryFilter.trim());
      }
      if (unitFilter.trim()) {
        params.append('unit', unitFilter.trim());
      }

      const url = `${API_URL}/api/search/users?${params.toString()}`;
      console.log('SearchUsersScreen: Fetching from:', url);

      // Use regular fetch for public search endpoint
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to search users' }));
        throw new Error(errorData.message || 'Failed to search users');
      }

      const data = await response.json();
      console.log('SearchUsersScreen: Search results received:', data);

      if (Array.isArray(data)) {
        setUsers(data);
        
        // Check follow status for each user (only if logged in)
        if (user) {
          const followStates: { [key: string]: boolean } = {};
          await Promise.all(
            data.map(async (searchUser: SearchUser) => {
              try {
                const followResponse = await fetch(`${API_URL}/api/users/${searchUser.id}/is-following`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                });
                
                if (followResponse.ok) {
                  const followStatus = await followResponse.json();
                  followStates[searchUser.id] = followStatus.isFollowing;
                } else {
                  followStates[searchUser.id] = false;
                }
              } catch (err) {
                console.error('SearchUsersScreen: Error checking follow status for user:', searchUser.id, err);
                followStates[searchUser.id] = false;
              }
            })
          );
          setFollowingStates(followStates);
        }
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
  }, [searchQuery, agencyFilter, countryFilter, unitFilter, user]);

  const handleSearch = () => {
    console.log('SearchUsersScreen: User initiated search');
    searchUsers();
  };

  const handleClearFilters = () => {
    console.log('SearchUsersScreen: Clearing all filters');
    setSearchQuery('');
    setAgencyFilter('');
    setCountryFilter('');
    setUnitFilter('');
    setUsers([]);
    setError(null);
  };

  const handleFollowToggle = async (userId: string) => {
    console.log('SearchUsersScreen: Toggle follow for user:', userId);
    
    if (!user) {
      console.log('SearchUsersScreen: User not logged in, cannot follow');
      return;
    }
    
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
        const response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
          method: 'DELETE',
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to unfollow user');
        }
        
        setFollowingStates({ ...followingStates, [userId]: false });
        console.log('SearchUsersScreen: Successfully unfollowed user:', userId);
      } else {
        // Follow
        console.log('SearchUsersScreen: Following user:', userId);
        const response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to follow user');
        }
        
        setFollowingStates({ ...followingStates, [userId]: true });
        console.log('SearchUsersScreen: Successfully followed user:', userId);
      }
    } catch (err: any) {
      console.error('SearchUsersScreen: Error toggling follow:', err);
      setError('Failed to update follow status. Please try again.');
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

    const hasFilters = searchQuery.trim().length > 0 || agencyFilter.trim() || countryFilter.trim() || unitFilter.trim();

    if (!hasFilters) {
      return (
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>Search for Users</Text>
          <Text style={styles.emptyText}>
            Find collectors by username, name, or filter by their coin collections (agency, country, unit)
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <IconSymbol
          ios_icon_name="person.crop.circle.badge.xmark"
          android_material_icon_name="person-off"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>No Users Found</Text>
        <Text style={styles.emptyText}>
          No users match your search. Try different filters.
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
            onSubmitEditing={handleSearch}
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

        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <IconSymbol
            ios_icon_name="line.3.horizontal.decrease.circle"
            android_material_icon_name="filter-list"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.filterToggleText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <ScrollView style={styles.filtersContainer} horizontal={false}>
          <Text style={styles.filterSectionTitle}>Find users by their coin collections:</Text>
          
          <TextInput
            style={styles.filterInput}
            placeholder="Agency (e.g., FBI, CIA)"
            placeholderTextColor={colors.textSecondary}
            value={agencyFilter}
            onChangeText={setAgencyFilter}
          />
          
          <TextInput
            style={styles.filterInput}
            placeholder="Country (e.g., USA, UK)"
            placeholderTextColor={colors.textSecondary}
            value={countryFilter}
            onChangeText={setCountryFilter}
          />
          
          <TextInput
            style={styles.filterInput}
            placeholder="Unit (e.g., SWAT, Navy SEALs)"
            placeholderTextColor={colors.textSecondary}
            value={unitFilter}
            onChangeText={setUnitFilter}
          />
          
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  filtersContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 300,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  filterInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  searchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
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
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
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
