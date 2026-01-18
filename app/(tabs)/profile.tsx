
import { useAuth } from '@/contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { createAuthenticatedFetchOptions } from '@/lib/cookieManager';

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: Array<{ url: string }>;
  like_count?: number;
  comment_count?: number;
  trade_status?: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
const { width } = Dimensions.get('window');
const coinSize = (width - 48) / 3;

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
  header: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: colors.text,
  },
  coinsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coinItem: {
    width: coinSize,
    height: coinSize,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  coinImage: {
    width: '100%',
    height: '100%',
  },
  emptyCoins: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default function ProfileScreen() {
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('ProfileScreen: Component mounted, user:', user);
    if (user) {
      fetchUserCoins();
      fetchFollowCounts();
    }
  }, [user]);

  const fetchUserCoins = async () => {
    if (!user) return;
    
    try {
      console.log('ProfileScreen: Fetching user coins');
      
      const fetchOptions = await createAuthenticatedFetchOptions({
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const response = await fetch(`${API_URL}/api/users/${user.id}/coins`, fetchOptions);
      
      if (response.ok) {
        const data = await response.json();
        console.log('ProfileScreen: Fetched', data.length, 'coins');
        setCoins(data);
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowCounts = async () => {
    if (!user) return;
    
    try {
      const fetchOptions = await createAuthenticatedFetchOptions({
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const [followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/api/users/${user.id}/followers`, fetchOptions),
        fetch(`${API_URL}/api/users/${user.id}/following`, fetchOptions),
      ]);
      
      if (followersRes.ok) {
        const followers = await followersRes.json();
        setFollowerCount(followers.length);
      }
      
      if (followingRes.ok) {
        const following = await followingRes.json();
        setFollowingCount(following.length);
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching follow counts:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            console.log('ProfileScreen: User confirmed logout');
            await logout();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleAddCoin = () => {
    console.log('ProfileScreen: Navigating to add coin');
    router.push('/add-coin');
  };

  const handleEditProfile = () => {
    console.log('ProfileScreen: Navigating to edit profile');
    router.push('/edit-profile');
  };

  const handleCoinPress = (coinId: string) => {
    console.log('ProfileScreen: Navigating to coin detail:', coinId);
    router.push(`/coin-detail?coinId=${coinId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Please sign in to view your profile</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <Text style={styles.displayName}>{user.displayName || user.name}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleEditProfile}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color={colors.text}
              />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleLogout}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={20}
                color={colors.text}
              />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Coins Grid */}
        <View style={styles.coinsSection}>
          <Text style={styles.sectionTitle}>My Collection</Text>
          
          {coins.length === 0 ? (
            <View style={styles.emptyCoins}>
              <IconSymbol
                ios_icon_name="photo.stack"
                android_material_icon_name="photo-library"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                You haven't added any coins yet.{'\n'}Start building your collection!
              </Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleAddCoin}>
                <IconSymbol
                  ios_icon_name="plus"
                  android_material_icon_name="add"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Add Coin</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.coinsGrid}>
              {coins.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={styles.coinItem}
                  onPress={() => handleCoinPress(coin.id)}
                >
                  {coin.images?.[0] ? (
                    <Image
                      source={{ uri: coin.images[0].url }}
                      style={styles.coinImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.coinImage}>
                      <IconSymbol
                        ios_icon_name="photo"
                        android_material_icon_name="image"
                        size={32}
                        color={colors.textSecondary}
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
