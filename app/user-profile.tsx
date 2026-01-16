
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
  avatarUrl?: string;
  bio?: string;
  location?: string;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
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
  const { userId, username } = useLocalSearchParams<{ userId?: string; username?: string }>();
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
    console.log('UserProfileScreen: Viewing user profile, userId:', userId, 'username:', username);
    if (userId || username) {
      fetchUserProfile();
    }
  }, [userId, username]);

  const fetchUserProfile = async () => {
    try {
      console.log('UserProfileScreen: Fetching profile');
      setLoading(true);
      
      // Try to fetch profile by username first if available
      if (username) {
        console.log('UserProfileScreen: Fetching by username:', username);
        try {
          const profileResponse = await fetch(`${API_URL}/api/users/${username}`, {
            credentials: 'include',
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log('UserProfileScreen: Profile fetched by username:', profileData);
            
            const userProfile: UserProfile = {
              id: profileData.id,
              username: profileData.username,
              displayName: profileData.displayName || profileData.display_name,
              avatar_url: profileData.avatar_url || profileData.avatarUrl,
              avatarUrl: profileData.avatar_url || profileData.avatarUrl,
              bio: profileData.bio,
              location: profileData.location,
              followerCount: profileData.followerCount,
              followingCount: profileData.followingCount,
              isFollowing: profileData.isFollowing,
            };
            
            setProfile(userProfile);
            
            // Update counts if available
            if (profileData.followerCount !== undefined) {
              setFollowerCount(profileData.followerCount);
            }
            if (profileData.followingCount !== undefined) {
              setFollowingCount(profileData.followingCount);
            }
            if (profileData.isFollowing !== undefined) {
              setIsFollowing(profileData.isFollowing);
            }
            
            // Fetch coins using the userId from the profile
            if (profileData.id) {
              await fetchUserCoinsById(profileData.id);
              
              // Fetch additional data if not included in profile response
              if (profileData.followerCount === undefined) {
                await fetchFollowCountsById(profileData.id);
              }
              if (profileData.isFollowing === undefined) {
                await checkFollowStatusById(profileData.id);
              }
            }
            
            setLoading(false);
            return;
          } else {
            console.error('UserProfileScreen: Failed to fetch profile by username, status:', profileResponse.status);
          }
        } catch (error) {
          console.error('UserProfileScreen: Error fetching by username:', error);
        }
      }
      
      // Fallback: Try to fetch using userId
      if (userId) {
        console.log('UserProfileScreen: Fetching by userId:', userId);
        
        // Fetch coins first to get user info
        const coinsData = await fetchUserCoinsById(userId);
        
        // If we got coins with user info, extract the profile
        if (coinsData && coinsData.length > 0) {
          // The coins endpoint should include user info in each coin
          // But we need to fetch the full profile separately
          console.log('UserProfileScreen: Coins fetched, now fetching full profile');
        }
        
        // Fetch follow counts
        await fetchFollowCountsById(userId);
        await checkFollowStatusById(userId);
        
        // If we still don't have a profile, show error
        if (!profile) {
          console.error('UserProfileScreen: Could not load profile');
          Alert.alert('Error', 'Unable to load user profile. Please try again.');
        }
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCoinsById = async (id: string): Promise<UserCoin[] | null> => {
    try {
      console.log('UserProfileScreen: Fetching coins for user:', id);
      const response = await fetch(`${API_URL}/api/users/${id}/coins?limit=20&offset=0`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('UserProfileScreen: Raw coins response:', data);
        
        // Handle different response formats
        let coinsArray: UserCoin[] = [];
        let userInfo: any = null;
        
        if (Array.isArray(data)) {
          // Response is directly an array
          coinsArray = data;
          console.log('UserProfileScreen: Response is array, length:', coinsArray.length);
          
          // Try to extract user info from first coin
          if (coinsArray.length > 0 && (coinsArray[0] as any).user) {
            userInfo = (coinsArray[0] as any).user;
          }
        } else if (data.coins && Array.isArray(data.coins)) {
          // Response has a coins property
          coinsArray = data.coins;
          console.log('UserProfileScreen: Response has coins property, length:', coinsArray.length);
          
          // Try to extract user info from first coin
          if (coinsArray.length > 0 && (coinsArray[0] as any).user) {
            userInfo = (coinsArray[0] as any).user;
          }
        } else if (data.data && Array.isArray(data.data)) {
          // Response has a data property
          coinsArray = data.data;
          console.log('UserProfileScreen: Response has data property, length:', coinsArray.length);
          
          // Try to extract user info from first coin
          if (coinsArray.length > 0 && (coinsArray[0] as any).user) {
            userInfo = (coinsArray[0] as any).user;
          }
        } else if (data.data && data.data.coins && Array.isArray(data.data.coins)) {
          // Response has nested data.coins
          coinsArray = data.data.coins;
          console.log('UserProfileScreen: Response has data.coins property, length:', coinsArray.length);
          
          // Try to extract user info from first coin
          if (coinsArray.length > 0 && (coinsArray[0] as any).user) {
            userInfo = (coinsArray[0] as any).user;
          }
        } else {
          console.warn('UserProfileScreen: Unexpected response format:', data);
        }
        
        console.log('UserProfileScreen: Fetched', coinsArray.length, 'coins');
        setCoins(coinsArray);
        
        // If we extracted user info and don't have a profile yet, set it
        if (userInfo && !profile) {
          console.log('UserProfileScreen: Extracted user info from coins:', userInfo);
          setProfile({
            id: userInfo.id,
            username: userInfo.username,
            displayName: userInfo.displayName || userInfo.display_name,
            avatar_url: userInfo.avatar_url || userInfo.avatarUrl,
            avatarUrl: userInfo.avatar_url || userInfo.avatarUrl,
            bio: userInfo.bio,
            location: userInfo.location,
          });
        }
        
        return coinsArray;
      } else {
        console.error('UserProfileScreen: Failed to fetch coins, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching coins:', error);
      return null;
    }
  };

  const fetchFollowCountsById = async (id: string) => {
    try {
      console.log('UserProfileScreen: Fetching follow counts for user:', id);
      
      const [followersResponse, followingResponse] = await Promise.all([
        fetch(`${API_URL}/api/users/${id}/followers?limit=1`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/api/users/${id}/following?limit=1`, {
          credentials: 'include',
        }),
      ]);
      
      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        console.log('UserProfileScreen: Followers count:', followersData.total);
        setFollowerCount(followersData.total || 0);
      }

      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        console.log('UserProfileScreen: Following count:', followingData.total);
        setFollowingCount(followingData.total || 0);
      }
    } catch (error) {
      console.error('UserProfileScreen: Error fetching follow counts:', error);
    }
  };

  const checkFollowStatusById = async (id: string) => {
    try {
      console.log('UserProfileScreen: Checking follow status for user:', id);
      const response = await fetch(`${API_URL}/api/users/${id}/is-following`, {
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
    if (followLoading || !profile) {
      console.log('UserProfileScreen: Follow action already in progress or no profile');
      return;
    }

    console.log('UserProfileScreen: User tapped', isFollowing ? 'Unfollow' : 'Follow');
    setFollowLoading(true);

    try {
      const endpoint = `${API_URL}/api/users/${profile.id}/follow`;

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
      
      // Don't show error if it's just "already following" - the state is already correct
      if (!error?.message?.includes('Already following')) {
        Alert.alert('Error', error.message || 'Failed to update follow status');
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleViewFollowers = () => {
    if (!profile) return;
    console.log('UserProfileScreen: User tapped Followers');
    router.push(`/user-list?userId=${profile.id}&type=followers`);
  };

  const handleViewFollowing = () => {
    if (!profile) return;
    console.log('UserProfileScreen: User tapped Following');
    router.push(`/user-list?userId=${profile.id}&type=following`);
  };

  const handleCoinPress = (coinId: string) => {
    console.log('UserProfileScreen: User tapped on coin:', coinId);
    router.push(`/coin-detail?coinId=${coinId}`);
  };

  if (loading) {
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

  if (!profile) {
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
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="error"
            size={60}
            color={colors.textSecondary}
          />
          <Text style={styles.errorText}>Unable to load profile</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchUserProfile();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

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
            {(profile.avatar_url || profile.avatarUrl) ? (
              <Image source={{ uri: profile.avatar_url || profile.avatarUrl }} style={styles.avatar} />
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
                  onPress={() => handleCoinPress(coin.id)}
                >
                  {coin.images && coin.images[0] && (
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
                  {coin.trade_status === 'open_to_trade' && (
                    <View style={styles.tradeBadge}>
                      <IconSymbol
                        ios_icon_name="arrow.left.arrow.right"
                        android_material_icon_name="swap-horiz"
                        size={12}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    position: 'relative',
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
  tradeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 6,
  },
});
