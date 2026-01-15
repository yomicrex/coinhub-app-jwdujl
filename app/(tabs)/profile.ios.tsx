
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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
      console.log('ProfileScreen: Fetched', data.length, 'coins');
      setCoins(data);
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
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
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
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
            <IconSymbol
              ios_icon_name="gearshape"
              android_material_icon_name="settings"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
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

          <Text style={styles.displayName}>{user.displayName || user.username}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          {user.location && (
            <View style={styles.locationRow}>
              <IconSymbol
                ios_icon_name="location"
                android_material_icon_name="location-on"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.location}>{user.location}</Text>
            </View>
          )}

          {/* Follow Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={handleViewFollowers}>
              <Text style={styles.statNumber}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={handleViewFollowing}>
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Coins Section */}
        <View style={styles.coinsSection}>
          <View style={styles.coinsSectionHeader}>
            <Text style={styles.sectionTitle}>My Collection</Text>
            <TouchableOpacity onPress={handleAddCoin} style={styles.addButton}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

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
                size={64}
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
              {coins.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={styles.coinCard}
                  onPress={() => handleEditCoin(coin.id)}
                >
                  {coin.images && coin.images.length > 0 ? (
                    <Image source={{ uri: coin.images[0].url }} style={styles.coinImage} />
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
                  <View style={styles.coinInfo}>
                    <Text style={styles.coinTitle} numberOfLines={1}>
                      {coin.title}
                    </Text>
                    <Text style={styles.coinDetails} numberOfLines={1}>
                      {coin.country} • {coin.year}
                    </Text>
                    <View style={styles.coinStats}>
                      <View style={styles.coinStat}>
                        <IconSymbol
                          ios_icon_name="heart"
                          android_material_icon_name="favorite"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.coinStatText}>{coin.like_count || 0}</Text>
                      </View>
                      <View style={styles.coinStat}>
                        <IconSymbol
                          ios_icon_name="message"
                          android_material_icon_name="chat"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.coinStatText}>{coin.comment_count || 0}</Text>
                      </View>
                    </View>
                    {coin.trade_status === 'open_to_trade' && (
                      <View style={styles.tradeBadge}>
                        <Text style={styles.tradeBadgeText}>Open to Trade</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.editIconButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditCoin(coin.id);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="pencil.circle.fill"
                      android_material_icon_name="edit"
                      size={24}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  settingsButton: {
    padding: 8,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
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
    backgroundColor: colors.card,
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
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  location: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editButton: {
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  coinsSection: {
    padding: 20,
  },
  coinsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  coinCard: {
    width: '50%',
    padding: 8,
  },
  coinImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  coinImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinInfo: {
    marginTop: 8,
  },
  coinTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  coinDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  coinStats: {
    flexDirection: 'row',
    gap: 12,
  },
  coinStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinStatText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tradeBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  tradeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
});
