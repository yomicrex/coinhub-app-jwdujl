
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';
const { width } = Dimensions.get('window');
const imageSize = (width - 6) / 3; // 3 columns with 2px gaps

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: Array<{ url: string }>;
  like_count?: number;
  likeCount?: number;
  comment_count?: number;
  commentCount?: number;
  trade_status?: string;
  tradeStatus?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (user) {
      console.log('ProfileScreen: User loaded, fetching coins for:', user.username);
      fetchUserCoins();
      fetchFollowCounts();
    }
  }, [user]);

  const fetchUserCoins = async () => {
    if (!user) return;

    console.log('ProfileScreen: Fetching coins for user:', user.id);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/coins`, {
        credentials: 'include',
      });

      console.log('ProfileScreen: Coins response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to fetch coins');
      }

      const data = await response.json();
      console.log('ProfileScreen: Response data:', data);
      
      // Handle both response formats: { coins: [...] } or [...]
      const coinsArray = data.coins || data;
      console.log('ProfileScreen: Fetched', coinsArray.length, 'coins');
      setCoins(coinsArray);
    } catch (error) {
      console.error('ProfileScreen: Error fetching coins:', error);
      Alert.alert('Error', 'Failed to load your coins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowCounts = async () => {
    if (!user) return;

    try {
      const [followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/api/users/${user.id}/followers`, { credentials: 'include' }),
        fetch(`${API_URL}/api/users/${user.id}/following`, { credentials: 'include' }),
      ]);

      if (followersRes.ok && followingRes.ok) {
        const followers = await followersRes.json();
        const following = await followingRes.json();
        
        // Handle both response formats: { followers: [...], total: N } or [...]
        const followersCount = followers.total !== undefined ? followers.total : (followers.followers?.length || followers.length || 0);
        const followingCount = following.total !== undefined ? following.total : (following.following?.length || following.length || 0);
        
        console.log('ProfileScreen: Followers count:', followersCount, 'Following count:', followingCount);
        setFollowerCount(followersCount);
        setFollowingCount(followingCount);
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching follow counts:', error);
    }
  };

  const handleLogout = async () => {
    console.log('ProfileScreen: User tapped logout');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('ProfileScreen: User confirmed logout');
            await logout();
            console.log('ProfileScreen: Logout complete, navigating to auth');
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleAddCoin = () => {
    console.log('ProfileScreen: User tapped add coin');
    router.push('/add-coin');
  };

  const handleEditCoin = (coinId: string) => {
    console.log('ProfileScreen: User tapped edit coin:', coinId);
    router.push(`/edit-coin?coinId=${coinId}`);
  };

  const handleSettings = () => {
    console.log('ProfileScreen: User tapped settings');
    router.push('/settings');
  };

  const handleEditProfile = () => {
    console.log('ProfileScreen: User tapped edit profile');
    router.push('/edit-profile');
  };

  const handleViewFollowers = () => {
    console.log('ProfileScreen: User tapped view followers');
    router.push(`/user-list?userId=${user?.id}&type=followers&title=Followers`);
  };

  const handleViewFollowing = () => {
    console.log('ProfileScreen: User tapped view following');
    router.push(`/user-list?userId=${user?.id}&type=following&title=Following`);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{user.username}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleAddCoin} style={styles.headerButton}>
              <IconSymbol
                ios_icon_name="plus.app"
                android_material_icon_name="add-box"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSettings} style={styles.headerButton}>
              <IconSymbol
                ios_icon_name="line.3.horizontal"
                android_material_icon_name="menu"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol
                    ios_icon_name="person.circle"
                    android_material_icon_name="account-circle"
                    size={80}
                    color={colors.textSecondary}
                  />
                </View>
              )}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{coins.length}</Text>
                <Text style={styles.statLabel}>Coins</Text>
              </View>
              <TouchableOpacity style={styles.statItem} onPress={handleViewFollowers}>
                <Text style={styles.statNumber}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem} onPress={handleViewFollowing}>
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{user.displayName || user.username}</Text>
            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
            {user.location && (
              <View style={styles.locationRow}>
                <IconSymbol
                  ios_icon_name="location"
                  android_material_icon_name="location-on"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.location}>{user.location}</Text>
              </View>
            )}
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Coins Grid */}
        <View style={styles.coinsSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading coins...</Text>
            </View>
          ) : coins.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="photo.on.rectangle"
                android_material_icon_name="photo-library"
                size={80}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>No coins yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start building your collection by adding your first coin!
              </Text>
              <TouchableOpacity style={styles.addFirstButton} onPress={handleAddCoin}>
                <Text style={styles.addFirstButtonText}>Add Your First Coin</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.coinsGrid}>
              {coins.map((coin) => {
                const likeCount = coin.like_count ?? coin.likeCount ?? 0;
                const commentCount = coin.comment_count ?? coin.commentCount ?? 0;
                
                return (
                  <TouchableOpacity
                    key={coin.id}
                    style={styles.gridItem}
                    onPress={() => handleEditCoin(coin.id)}
                  >
                    {coin.images && coin.images.length > 0 && coin.images[0].url ? (
                      <Image source={{ uri: coin.images[0].url }} style={styles.gridImage} />
                    ) : (
                      <View style={styles.gridImagePlaceholder}>
                        <IconSymbol
                          ios_icon_name="photo"
                          android_material_icon_name="image"
                          size={32}
                          color={colors.textSecondary}
                        />
                      </View>
                    )}
                    {(likeCount > 0 || commentCount > 0) && (
                      <View style={styles.gridOverlay}>
                        <View style={styles.gridStats}>
                          {likeCount > 0 && (
                            <View style={styles.gridStat}>
                              <IconSymbol
                                ios_icon_name="heart.fill"
                                android_material_icon_name="favorite"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.gridStatText}>{likeCount}</Text>
                            </View>
                          )}
                          {commentCount > 0 && (
                            <View style={styles.gridStat}>
                              <IconSymbol
                                ios_icon_name="message.fill"
                                android_material_icon_name="chat-bubble"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.gridStatText}>{commentCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 24,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 43,
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
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileInfo: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  editButton: {
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  coinsSection: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridItem: {
    width: imageSize,
    height: imageSize,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundAlt,
  },
  gridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridStats: {
    flexDirection: 'row',
    gap: 16,
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
