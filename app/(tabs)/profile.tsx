
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
  const { user, logout } = useAuth();
  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('ProfileScreen: Component mounted, user:', user);
    if (!user) {
      console.log('ProfileScreen: No user found, redirecting to auth');
      router.replace('/auth');
    } else {
      fetchUserCoins();
    }
  }, [user]);

  const fetchUserCoins = async () => {
    if (!user) {
      console.log('ProfileScreen: No user, skipping coin fetch');
      return;
    }
    
    try {
      console.log('ProfileScreen: Fetching user coins for user ID:', user.id);
      const response = await fetch(`${API_URL}/api/users/${user.id}/coins?limit=20&offset=0`, {
        credentials: 'include',
      });
      
      console.log('ProfileScreen: Fetch coins response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('ProfileScreen: Fetched coins data:', data);
        setCoins(data.coins || []);
      } else {
        const errorText = await response.text();
        console.error('ProfileScreen: Failed to fetch coins, status:', response.status, 'error:', errorText);
        
        // If unauthorized, user might not have completed profile
        if (response.status === 401) {
          console.log('ProfileScreen: Unauthorized - user may need to complete profile');
        }
      }
    } catch (error) {
      console.error('ProfileScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('ProfileScreen: User tapped logout button');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('ProfileScreen: User confirmed logout, calling logout function');
              await logout();
              console.log('ProfileScreen: Logout successful, redirecting to auth');
              router.replace('/auth');
            } catch (error) {
              console.error('ProfileScreen: Logout error:', error);
              // Even if logout fails, redirect to auth
              router.replace('/auth');
            }
          },
        },
      ]
    );
  };

  const handleAddCoin = () => {
    console.log('ProfileScreen: User tapped Add Coin button');
    router.push('/add-coin');
  };

  const handleSettings = () => {
    console.log('ProfileScreen: User tapped Settings');
    router.push('/settings');
  };

  const handleEditProfile = () => {
    console.log('ProfileScreen: User tapped Edit Profile button');
    router.push('/edit-profile');
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user.avatar_url || user.image ? (
              <Image source={{ uri: user.avatar_url || user.image }} style={styles.avatar} />
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

          <Text style={styles.displayName}>
            {user.displayName || user.name || user.email?.split('@')[0] || 'User'}
          </Text>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}

          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          {user.location && (
            <View style={styles.locationContainer}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.location}>{user.location}</Text>
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{coins.length}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {coins.reduce((sum, coin) => sum + coin.like_count, 0)}
              </Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {coins.filter(c => c.trade_status === 'open_to_trade').length}
              </Text>
              <Text style={styles.statLabel}>For Trade</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditProfile}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addCoinButton}
              onPress={handleAddCoin}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.addCoinButtonText}>Add Coin</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Collection</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading coins...</Text>
            </View>
          ) : coins.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="circle.fill"
                android_material_icon_name="circle"
                size={48}
                color={colors.border}
              />
              <Text style={styles.emptyText}>No coins yet</Text>
              <Text style={styles.emptySubtext}>Start building your collection!</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleAddCoin}
              >
                <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.coinsGrid}>
              {coins.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={styles.coinCard}
                  onPress={() => {
                    console.log('ProfileScreen: User tapped on coin:', coin.title);
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

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSettings}
          >
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={24}
              color={colors.text}
            />
            <Text style={styles.menuItemText}>Settings</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('ProfileScreen: User tapped Privacy Policy');
              router.push('/privacy-policy');
            }}
          >
            <IconSymbol
              ios_icon_name="lock.shield"
              android_material_icon_name="privacy-tip"
              size={24}
              color={colors.text}
            />
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('ProfileScreen: User tapped Terms of Use');
              router.push('/terms-of-use');
            }}
          >
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={24}
              color={colors.text}
            />
            <Text style={styles.menuItemText}>Terms of Use</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <IconSymbol
              ios_icon_name="arrow.right.square"
              android_material_icon_name="logout"
              size={24}
              color={colors.error}
            />
            <Text style={[styles.menuItemText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  addCoinButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addCoinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
});
