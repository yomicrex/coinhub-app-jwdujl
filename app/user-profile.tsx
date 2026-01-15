
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';
import { authClient } from '@/lib/auth';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
}

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: Array<{ url: string }>;
  like_count: number;
  comment_count: number;
  trade_status: string;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    console.log('UserProfileScreen: Viewing user profile:', userId);
    if (userId) {
      fetchUserProfile();
      fetchUserCoins();
      fetchFollowCounts();
      checkFollowStatus();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      console.log('UserProfileScreen: Fetching profile for user:', userId);
      // Fetch user coins first to get user info
      const coinsResponse = await fetch(`${API_URL}/api/users/${userId}/coins?limit=1`, {
        credentials: 'include',
      });

      if (coinsResponse.ok) {
        const coinsData = await coinsResponse.json();
        console.log('UserProfileScreen: Coins data:', coinsData);
        
        // Extract user profile from coins response
        if (coinsData.coins && coinsData.coins.length > 0 && coinsData.coins[0].user) {
          const userProfile = coinsData.coins[0].user;
          setProfile({
            id: userProfile.id,
            username: userProfile.username,
            displayName: userProfile.displayName || userProfile.display_name,
            avatar_url: userProfile.avatar_url || userProfile.avatarUrl,
            bio: userProfile.bio,
            location: userProfile.location,
          });
          console.log('UserProfileScreen: Profile extracted from coins:', userProfile);
        } else {
          // If no coins, create a minimal profile
          setProfile({
            id: userId,
            username: 'user',
            displayName: 'User',
          });
        }
      } else {
        console.error('UserProfileScreen: Failed to fetch profile, status:', coinsResponse.status);
        Alert.alert('Error', 'Failed to load user profile');
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    }
  };

  const fetchUserCoins = async () => {
    try {
      console.log('UserProfileScreen: Fetching coins for user:', userId);
      const response = await fetch(`${API_URL}/api/users/${userId}/coins?limit=20&offset=0`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('UserProfileScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowCounts = async () => {
    try {
      console.log('UserProfileScreen: Fetching follow counts for user:', userId);
      
      const followersResponse = await fetch(`${API_URL}/api/users/${userId}/followers?limit=1`, {
        credentials: 'include',
      });
      
      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        console.log('UserProfileScreen: Followers count:', followersData.total);
        setFollowerCount(followersData.total || 0);
      }

      const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following?limit=1`, {
        credentials: 'include',
      });
      
      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        console.log('UserProfileScreen: Following count:', followingData.total);
        setFollowingCount(followingData.total || 0);
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching follow counts:', error);
    }
  };

  const checkFollowStatus = async () => {
    try {
      console.log('UserProfileScreen: Checking follow status for user:', userId);
      const response = await fetch(`${API_URL}/api/users/${userId}/is-following`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('UserProfileScreen: Is following:', data.isFollowing);
        setIsFollowing(data.isFollowing);
      }
    } catch (error) {
      console.error('UserProfileScreen: Error checking follow status:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (followLoading) {
      console.log('UserProfileScreen: Follow action already in progress');
      return;
    }

    console.log('UserProfileScreen: User tapped', isFollowing ? 'Unfollow' : 'Follow');
    setFollowLoading(true);

    try {
      const endpoint = `${API_URL}/api/users/${userId}/follow`;

      if (isFollowing) {
        // Unfollow - use DELETE
        console.log('UserProfileScreen: Sending DELETE request to unfollow');
        const response = await authClient.$fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        console.log('UserProfileScreen: Unfollow response:', response);
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow - use POST
        console.log('UserProfileScreen: Sending POST request to follow');
        const response = await authClient.$fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        console.log('UserProfileScreen: Follow response:', response);
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
      
      console.log('UserProfileScreen: Follow status updated successfully');
    } catch (error: any) {
      console.error('UserProfileScreen: Error toggling follow:', error);
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleViewFollowers = () => {
    console.log('UserProfileScreen: User tapped Followers');
    router.push(`/user-list?userId=${userId}&type=followers`);
  };

  const handleViewFollowing = () => {
    console.log('UserProfileScreen: User tapped Following');
    router.push(`/user-list?userId=${userId}&type=following`);
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Profile',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: profile.displayName || profile.username,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>

          <Text style={styles.displayName}>{profile.displayName}</Text>
          <Text style={styles.username}>@{profile.username}</Text>

          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile.location && (
            <View style={styles.locationContainer}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.location}>{profile.location}</Text>
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={handleViewFollowers}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={handleViewFollowing}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
                followLoading && styles.followButtonDisabled,
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? colors.text : '#FFFFFF'} />
              ) : (
                <React.Fragment>
                  <IconSymbol
                    ios_icon_name={isFollowing ? 'person.fill.checkmark' : 'person.fill.badge.plus'}
                    android_material_icon_name={isFollowing ? 'person-remove' : 'person-add'}
                    size={20}
                    color={isFollowing ? colors.text : '#FFFFFF'}
                  />
                  <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collection</Text>
          
          {coins.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="circle.fill"
                android_material_icon_name="circle"
                size={48}
                color={colors.border}
              />
              <Text style={styles.emptyText}>No coins yet</Text>
            </View>
          ) : (
            <View style={styles.coinsGrid}>
              {coins.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={styles.coinCard}
                  onPress={() => {
                    console.log('UserProfileScreen: User tapped on coin:', coin.title);
                    Alert.alert(
                      coin.title,
                      `${coin.year} • ${coin.country}\n\n${coin.like_count} likes • ${coin.comment_count} comments`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  {coin.images[0] && (
                    <Image
                      source={{ uri: coin.images[0].url }}
                      style={styles.coinImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.coinOverlay}>
                    <Text style={styles.coinTitle} numberOfLines={1}>
                      {coin.title}
                    </Text>
                    <Text style={styles.coinYear}>{coin.year}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  location: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 140,
  },
  followingButton: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: colors.text,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coinCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coinImage: {
    width: '100%',
    height: '100%',
  },
  coinOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  coinTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  coinYear: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
  },
});
