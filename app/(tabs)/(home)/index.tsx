
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  images: Array<{ url: string }>;
  likeCount?: number;
  commentCount?: number;
  tradeStatus?: string;
  isLiked?: boolean;
}

export default function HomeScreen() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, getToken } = useAuth();
  const router = useRouter();

  const fetchCoins = async () => {
    try {
      console.log('HomeScreen: Fetching coins feed');
      const response = await fetch(`${API_URL}/api/coins/feed`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('HomeScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      } else {
        console.error('HomeScreen: Failed to fetch coins:', response.status);
      }
    } catch (error) {
      console.error('HomeScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('HomeScreen: Component mounted');
    fetchCoins();
  }, []);

  const onRefresh = () => {
    console.log('HomeScreen: User pulled to refresh');
    setRefreshing(true);
    fetchCoins();
  };

  const handleLike = async (coinId: string) => {
    console.log('HomeScreen: User tapped like/unlike on coin:', coinId);
    try {
      const coin = coins.find(c => c.id === coinId);
      const isLiked = coin?.isLiked;

      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        setCoins(coins.map(c => {
          if (c.id === coinId) {
            return {
              ...c,
              isLiked: !isLiked,
              likeCount: (c.likeCount || 0) + (isLiked ? -1 : 1),
            };
          }
          return c;
        }));
      }
    } catch (error) {
      console.error('HomeScreen: Error liking coin:', error);
    }
  };

  const renderCoin = ({ item }: { item: Coin }) => (
    <TouchableOpacity
      style={styles.coinCard}
      onPress={() => {
        console.log('HomeScreen: User tapped on coin:', item.id);
        router.push(`/coin-detail?coinId=${item.id}`);
      }}
    >
      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0].url }} style={styles.coinImage} />
      )}
      
      <View style={styles.coinInfo}>
        <Text style={styles.coinTitle}>{item.title}</Text>
        <Text style={styles.coinMeta}>
          {item.country} • {item.year}
        </Text>
        
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => {
            console.log('HomeScreen: User tapped on profile:', item.user.username);
            if (item.user.id === user?.id) {
              console.log('HomeScreen: Navigating to own profile');
              router.push('/(tabs)/profile');
            } else {
              console.log('HomeScreen: Navigating to user profile:', item.user.username);
              router.push(`/user-profile?userId=${item.user.username}`);
            }
          }}
        >
          {item.user.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={16} color={colors.textMuted} />
            </View>
          )}
          <Text style={styles.username}>{item.user.displayName || item.user.username}</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <IconSymbol
              ios_icon_name={item.isLiked ? "heart.fill" : "heart"}
              android_material_icon_name={item.isLiked ? "favorite" : "favorite-border"}
              size={20}
              color={item.isLiked ? colors.error : colors.textSecondary}
            />
            <Text style={styles.actionText}>{item.likeCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/coin-comments?coinId=${item.id}`)}
          >
            <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.actionText}>{item.commentCount || 0}</Text>
          </TouchableOpacity>

          {item.tradeStatus === 'open' && (
            <View style={styles.tradeBadge}>
              <Text style={styles.tradeBadgeText}>Open to Trade</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={coins}
        renderItem={renderCoin}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="photo.on.rectangle"
              android_material_icon_name="photo-library"
              size={80}
              color={colors.border}
            />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a coin!</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add-coin')}
            >
              <Text style={styles.addButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          console.log('HomeScreen: User tapped add coin button');
          router.push('/add-coin');
        }}
      >
        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={28} color={colors.background} />
      </TouchableOpacity>
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
  list: {
    padding: 16,
  },
  coinCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coinImage: {
    width: '100%',
    height: 250,
    backgroundColor: colors.surfaceLight,
  },
  coinInfo: {
    padding: 16,
  },
  coinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  coinMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  tradeBadge: {
    backgroundColor: colors.tradeOpen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  tradeBadgeText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
