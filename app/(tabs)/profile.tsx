
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { authClient } from '@/lib/auth';
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
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: { url: string }[];
  like_count?: number;
  likeCount?: number;
  comment_count?: number;
  commentCount?: number;
  trade_status?: string;
  tradeStatus?: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const fetchUserCoins = useCallback(async () => {
    if (!user?.id) {
      console.log('ProfileScreen: No user ID, skipping coin fetch');
      return;
    }

    console.log('ProfileScreen: Fetching coins for user:', {
      id: user.id,
      username: user.username,
      email: user.email
    });
    
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/coins`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both response formats: { coins: [] } or direct array
        const coinsArray = data.coins || data;
        console.log('ProfileScreen: Fetched', coinsArray.length, 'coins for user:', user.username);
        setCoins(coinsArray);
      } else {
        console.error('ProfileScreen: Failed to fetch coins, status:', response.status);
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.username, user?.email]);

  const fetchFollowCounts = useCallback(async () => {
    if (!user?.id) {
      console.log('ProfileScreen: No user ID, skipping follow counts fetch');
      return;
    }

    console.log('ProfileScreen: Fetching follow counts for user:', {
      id: user.id,
      username: user.username
    });
    
    try {
      const [followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/api/users/${user.id}/followers`, { credentials: 'include' }),
        fetch(`${API_URL}/api/users/${user.id}/following`, { credentials: 'include' }),
      ]);

      if (followersRes.ok) {
        const followersData = await followersRes.json();
        setFollowerCount(followersData.total || 0);
      }

      if (followingRes.ok) {
        const followingData = await followingRes.json();
        setFollowingCount(followingData.total || 0);
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching follow counts:', error);
    }
  }, [user?.id, user?.username]);

  useEffect(() => {
    console.log('ProfileScreen: Component mounted/updated, user:', {
      id: user?.id,
      username: user?.username,
      email: user?.email,
      displayName: user?.displayName
    });
    
    if (user) {
      fetchUserCoins();
      fetchFollowCounts();
    }
  }, [user, fetchUserCoins, fetchFollowCounts]);

  const handleLogout = async () => {
    console.log('ProfileScreen: User tapped logout button');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          console.log('ProfileScreen: Signing out user:', user?.username);
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleAddCoin = () => {
    console.log('ProfileScreen: User tapped Add Coin button');
    router.push('/add-coin');
  };

  const handleEditCoin = (coinId: string) => {
    console.log('ProfileScreen: User tapped edit coin:', coinId);
    router.push(`/edit-coin?id=${coinId}`);
  };

  const handleSettings = () => {
    console.log('ProfileScreen: User tapped settings button');
    router.push('/settings');
  };

  const handleEditProfile = () => {
    console.log('ProfileScreen: User tapped edit profile button');
    router.push('/edit-profile');
  };

  const handleViewFollowers = () => {
    console.log('ProfileScreen: User tapped view followers');
    router.push(`/user-list?userId=${user?.id}&type=followers`);
  };

  const handleViewFollowing = () => {
    console.log('ProfileScreen: User tapped view following');
    router.push(`/user-list?userId=${user?.id}&type=following`);
  };

  const handleMyTrades = () => {
    console.log('ProfileScreen: User tapped my trades');
    router.push('/(tabs)/trades');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
          <IconSymbol ios_icon_name="gearshape.fill" android_material_icon_name="settings" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View style={styles.profileHeader}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={48} color={colors.textSecondary} />
            </View>
          )}

          <Text style={styles.displayName}>{user.displayName || user.username}</Text>
          <Text style={styles.username}>@{user.username}</Text>

          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          <View style={styles.stats}>
            <TouchableOpacity style={styles.stat} onPress={handleViewFollowers}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stat} onPress={handleViewFollowing}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.text} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tradesButton} onPress={handleMyTrades}>
              <IconSymbol ios_icon_name="arrow.2.squarepath" android_material_icon_name="sync" size={18} color={colors.text} />
              <Text style={styles.tradesButtonText}>My Trades</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.coinsSection}>
          <View style={styles.coinsSectionHeader}>
            <Text style={styles.sectionTitle}>My Coins</Text>
            <TouchableOpacity onPress={handleAddCoin}>
              <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : coins.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol ios_icon_name="tray" android_material_icon_name="inbox" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No coins yet</Text>
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
                  onPress={() => router.push(`/coin-detail?id=${coin.id}`)}
                  onLongPress={() => handleEditCoin(coin.id)}
                >
                  {coin.images && coin.images.length > 0 ? (
                    <Image source={{ uri: coin.images[0].url }} style={styles.coinImage} />
                  ) : (
                    <View style={[styles.coinImage, styles.coinImagePlaceholder]}>
                      <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={32} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.coinCardInfo}>
                    <Text style={styles.coinCardTitle} numberOfLines={1}>
                      {coin.title}
                    </Text>
                    <Text style={styles.coinCardMeta} numberOfLines={1}>
                      {coin.country} • {coin.year}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <IconSymbol ios_icon_name="arrow.right.square" android_material_icon_name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  settingsButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
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
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  stats: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.border,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tradesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.border,
    borderRadius: 8,
    gap: 8,
  },
  tradesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  coinsSection: {
    padding: 16,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  addFirstButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  coinCard: {
    width: (Dimensions.get('window').width - 48) / 2,
    margin: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coinImage: {
    width: '100%',
    height: (Dimensions.get('window').width - 48) / 2,
  },
  coinImagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinCardInfo: {
    padding: 8,
  },
  coinCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  coinCardMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
});
