
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  images: { url: string }[];
  likeCount?: number;
  commentCount?: number;
  tradeStatus?: string;
  isLiked?: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCoins = useCallback(async () => {
    console.log('HomeScreen: Fetching public coins feed');
    try {
      const response = await fetch(`${API_URL}/api/feed/public`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('HomeScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      } else {
        console.error('HomeScreen: Failed to fetch coins, status:', response.status);
      }
    } catch (error) {
      console.error('HomeScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('HomeScreen: Component mounted, user:', user?.username);
    fetchCoins();
  }, [fetchCoins]);

  const onRefresh = async () => {
    console.log('HomeScreen: Refreshing feed');
    setRefreshing(true);
    await fetchCoins();
    setRefreshing(false);
  };

  const handleLike = async (coinId: string) => {
    console.log('HomeScreen: User tapped like button for coin:', coinId);
    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        console.log('HomeScreen: Like successful, refreshing feed');
        fetchCoins();
      } else {
        console.error('HomeScreen: Failed to like coin, status:', response.status);
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
        router.push(`/coin-detail?id=${item.id}`);
      }}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
        </View>
        <View>
          <Text style={styles.displayName}>{item.user.displayName}</Text>
          <Text style={styles.username}>@{item.user.username}</Text>
        </View>
      </View>

      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0].url }} style={styles.coinImage} />
      ) : (
        <View style={[styles.coinImage, styles.imagePlaceholder]}>
          <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={48} color={colors.textSecondary} />
        </View>
      )}

      <View style={styles.coinInfo}>
        <Text style={styles.coinTitle}>{item.title}</Text>
        <Text style={styles.coinMeta}>
          {item.country} • {item.year}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleLike(item.id);
          }}
        >
          <IconSymbol
            ios_icon_name={item.isLiked ? 'heart.fill' : 'heart'}
            android_material_icon_name={item.isLiked ? 'favorite' : 'favorite-border'}
            size={24}
            color={item.isLiked ? colors.error : colors.text}
          />
          <Text style={styles.actionText}>{item.likeCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={24} color={colors.text} />
          <Text style={styles.actionText}>{item.commentCount || 0}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={coins}
        renderItem={renderCoin}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol ios_icon_name="tray" android_material_icon_name="inbox" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a coin!</Text>
          </View>
        }
      />
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
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  coinCard: {
    backgroundColor: colors.surface,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  coinImage: {
    width: '100%',
    height: 300,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinInfo: {
    padding: 12,
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
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
