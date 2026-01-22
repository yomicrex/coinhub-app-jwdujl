
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_URL } from '@/utils/api';

const { width } = Dimensions.get('window');
const COIN_SIZE = (width - 48) / 3; // 3 columns with padding

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  averageRating?: number | null;
  completedTradesCount?: number;
}

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: { url: string; orderIndex?: number }[];
  likeCount?: number;
  commentCount?: number;
  tradeStatus?: string;
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('UserProfileScreen: Component mounted, username:', username);
    
    if (!username) {
      console.error('UserProfileScreen: No username provided');
      setLoading(false);
      return;
    }

    const fetchProfileAndCoins = async () => {
      try {
        console.log('UserProfileScreen: Fetching profile for username:', username);
        
        // Fetch profile
        const profileResponse = await fetch(`${API_URL}/api/users/${username}`, {
          credentials: 'include',
        });

        if (!profileResponse.ok) {
          console.error('UserProfileScreen: Failed to fetch profile, status:', profileResponse.status);
          throw new Error('Failed to fetch profile');
        }

        const profileData = await profileResponse.json();
        console.log('UserProfileScreen: Profile data received:', profileData);
        setProfile(profileData);
        setIsFollowing(profileData.isFollowing || false);
        setLoading(false);

        // Fetch coins for this user
        console.log('UserProfileScreen: Fetching coins for user ID:', profileData.id);
        const coinsResponse = await fetch(`${API_URL}/api/users/${profileData.id}/coins`, {
          credentials: 'include',
        });

        if (!coinsResponse.ok) {
          console.error('UserProfileScreen: Failed to fetch coins, status:', coinsResponse.status);
          throw new Error('Failed to fetch coins');
        }

        const coinsData = await coinsResponse.json();
        // Handle both response formats: { coins: [] } or direct array
        const coinsArray = coinsData.coins || coinsData;
        console.log('UserProfileScreen: Fetched', coinsArray.length, 'coins');
        setCoins(coinsArray);
        setLoadingCoins(false);
      } catch (error) {
        console.error('UserProfileScreen: Error fetching profile or coins:', error);
        Alert.alert('Error', 'Failed to load user profile');
        setLoading(false);
        setLoadingCoins(false);
      }
    };

    fetchProfileAndCoins();
  }, [username]);

  const handleFollowToggle = async () => {
    if (!profile) {
      console.error('UserProfileScreen: No profile loaded');
      return;
    }

    if (!user) {
      console.log('UserProfileScreen: User not logged in, redirecting to auth');
      Alert.alert('Sign In Required', 'Please sign in to follow users');
      router.push('/auth');
      return;
    }

    console.log('UserProfileScreen: User tapped follow/unfollow button');
    console.log('UserProfileScreen: Current follow state:', isFollowing);
    console.log('UserProfileScreen: Profile ID:', profile.id);
    
    const previousState = isFollowing;
    const previousCount = profile.followerCount;
    
    // Optimistically update UI
    setIsFollowing(!isFollowing);
    setProfile({
      ...profile,
      followerCount: previousState ? profile.followerCount - 1 : profile.followerCount + 1,
    });

    try {
      const method = previousState ? 'DELETE' : 'POST';
      console.log('UserProfileScreen: Sending', method, 'request to /api/users/' + profile.id + '/follow');
      
      const response = await authenticatedFetch(`/api/users/${profile.id}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify({}) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('UserProfileScreen: Follow toggle failed, status:', response.status, 'error:', errorText);
        throw new Error('Failed to toggle follow');
      }

      const data = await response.json();
      console.log('UserProfileScreen: Follow toggled successfully:', data);
    } catch (error) {
      console.error('UserProfileScreen: Error toggling follow:', error);
      // Revert optimistic update
      setIsFollowing(previousState);
      setProfile({
        ...profile,
        followerCount: previousCount,
      });
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const handleCoinPress = (coinId: string) => {
    console.log('UserProfileScreen: User tapped on coin:', coinId);
    router.push(`/coin-detail?coinId=${coinId}`);
  };

  const handleBack = () => {
    console.log('UserProfileScreen: User tapped back button');
    router.back();
  };

  const renderCoinItem = ({ item }: { item: UserCoin }) => {
    const mainImage = item.images?.[0];
    
    return (
      <TouchableOpacity
        style={styles.coinItem}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.8}
      >
        {mainImage?.url ? (
          <Image
            source={{ uri: mainImage.url }}
            style={styles.coinImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coinImagePlaceholder}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={32}
              color={colors.textSecondary}
            />
          </View>
        )}
        
        {item.tradeStatus === 'open_to_trade' && (
          <View style={styles.tradeBadge}>
            <IconSymbol
              ios_icon_name="arrow.2.squarepath"
              android_material_icon_name="swap-horiz"
              size={12}
              color="#FFFFFF"
            />
          </View>
        )}
      </TouchableOpacity>
    );
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
        <View style={styles.errorContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.errorText}>Profile not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasRating = profile.averageRating !== null && profile.averageRating !== undefined;
  const ratingDisplay = hasRating ? profile.averageRating!.toFixed(1) : 'N/A';
  const tradesCount = profile.completedTradesCount || 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: profile.username,
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={48}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile.location && (
            <View style={styles.locationContainer}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.location}>{profile.location}</Text>
            </View>
          )}
        </View>

        {/* Trade Rating Section */}
        <View style={styles.tradeRatingSection}>
          <View style={styles.tradeRatingCard}>
            <View style={styles.ratingItem}>
              <View style={styles.ratingIconContainer}>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={20}
                  color="#FFB800"
                />
              </View>
              <View style={styles.ratingTextContainer}>
                <Text style={styles.ratingValue}>{ratingDisplay}</Text>
                <Text style={styles.ratingLabel}>Rating</Text>
              </View>
            </View>
            
            <View style={styles.ratingDivider} />
            
            <View style={styles.ratingItem}>
              <View style={styles.ratingIconContainer}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.ratingTextContainer}>
                <Text style={styles.ratingValue}>{tradesCount}</Text>
                <Text style={styles.ratingLabel}>Trades</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Follow Button */}
        {user?.id !== profile.id && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollowToggle}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Coins Grid */}
        <View style={styles.coinsSection}>
          <View style={styles.coinsSectionHeader}>
            <IconSymbol
              ios_icon_name="photo.on.rectangle"
              android_material_icon_name="photo-library"
              size={20}
              color={colors.text}
            />
            <Text style={styles.coinsSectionTitle}>Coins</Text>
          </View>

          {loadingCoins ? (
            <View style={styles.coinsLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.coinsLoadingText}>Loading coins...</Text>
            </View>
          ) : coins.length > 0 ? (
            <FlatList
              data={coins}
              renderItem={renderCoinItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.coinRow}
              contentContainerStyle={styles.coinsGrid}
            />
          ) : (
            <View style={styles.emptyCoinsContainer}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={48}
                color={colors.border}
              />
              <Text style={styles.emptyCoinsText}>No coins yet</Text>
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
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileInfo: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginTop: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tradeRatingSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tradeRatingCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingTextContainer: {
    flex: 1,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  ratingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  followingButtonText: {
    color: colors.text,
  },
  coinsSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  coinsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coinsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  coinsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  coinsLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  coinsGrid: {
    paddingHorizontal: 16,
  },
  coinRow: {
    justifyContent: 'flex-start',
    gap: 4,
  },
  coinItem: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    marginBottom: 4,
    position: 'relative',
  },
  coinImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundAlt,
  },
  coinImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCoinsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCoinsText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
});
