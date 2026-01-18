
import { useAuth } from '@/contexts/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { authClient } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar_url?: string;
    avatarUrl?: string;
  };
  images: { url: string; order_index?: number; orderIndex?: number }[];
  like_count?: number;
  likeCount?: number;
  comment_count?: number;
  commentCount?: number;
  trade_status?: string;
  tradeStatus?: string;
  created_at?: string;
  createdAt?: string;
  isLiked?: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeImageIndices, setActiveImageIndices] = useState<{ [key: string]: number }>({});
  const scrollViewRefs = useRef<{ [key: string]: ScrollView | null }>({});

  const fetchCoins = useCallback(async () => {
    console.log('FeedScreen: Fetching public coins feed');
    try {
      const response = await fetch(`${API_URL}/api/feed/public`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'public coins');
        setCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch coins, status:', response.status);
      }
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTradeCoins = useCallback(async () => {
    console.log('FeedScreen: Fetching coins up for trade');
    try {
      const response = await fetch(`${API_URL}/api/feed/trade`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'trade coins');
        setTradeCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch trade coins, status:', response.status);
      }
    } catch (error) {
      console.error('FeedScreen: Error fetching trade coins:', error);
    }
  }, []);

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
    fetchTradeCoins();
  }, [fetchCoins, fetchTradeCoins, user?.username]);

  const onRefresh = async () => {
    console.log('FeedScreen: Refreshing feed');
    setRefreshing(true);
    await Promise.all([fetchCoins(), fetchTradeCoins()]);
    setRefreshing(false);
  };

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like button for coin:', coinId);
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
        console.log('FeedScreen: Like successful, refreshing feed');
        fetchCoins();
      } else {
        console.error('FeedScreen: Failed to like coin, status:', response.status);
      }
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: User tapped Add Coin button');
    router.push('/add-coin');
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('FeedScreen: User tapped on user profile:', username);
    router.push(`/user-profile?username=${username}`);
  };

  const handleCoinPress = (coinId: string) => {
    console.log('FeedScreen: User tapped on coin:', coinId);
    router.push(`/coin-detail?id=${coinId}`);
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imageWidth = Dimensions.get('window').width - 32;
    const index = Math.round(scrollPosition / imageWidth);
    setActiveImageIndices(prev => ({ ...prev, [coinId]: index }));
  };

  const renderTradeCoinCard = (item: Coin) => {
    const images = item.images || [];
    const activeIndex = activeImageIndices[item.id] || 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCoinCard}
        onPress={() => handleCoinPress(item.id)}
      >
        {images.length > 0 ? (
          <View style={styles.tradeCoinImageContainer}>
            <ScrollView
              ref={(ref) => { scrollViewRefs.current[item.id] = ref; }}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => handleImageScroll(item.id, e)}
              scrollEventThrottle={16}
            >
              {images.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: img.url }}
                  style={styles.tradeCoinImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.tradeCoinPaginationDots}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.tradeCoinDot,
                      idx === activeIndex && styles.tradeCoinDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.tradeCoinImage, styles.tradeCoinPlaceholder]}>
            <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={32} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.tradeCoinInfo}>
          <Text style={styles.tradeCoinTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.tradeCoinMeta} numberOfLines={1}>
            {item.country} • {item.year}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const images = item.images || [];
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const tradeStatus = item.tradeStatus ?? item.trade_status;
    const activeIndex = activeImageIndices[item.id] || 0;

    return (
      <View style={styles.coinCard}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          {(item.user.avatarUrl || item.user.avatar_url) ? (
            <Image
              source={{ uri: item.user.avatarUrl || item.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleCoinPress(item.id)}>
          {images.length > 0 ? (
            <View style={styles.imageContainer}>
              <ScrollView
                ref={(ref) => { scrollViewRefs.current[item.id] = ref; }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => handleImageScroll(item.id, e)}
                scrollEventThrottle={16}
              >
                {images.map((img, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: img.url }}
                    style={styles.coinImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {images.length > 1 && (
                <View style={styles.paginationDots}>
                  {images.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        idx === activeIndex && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
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
            {tradeStatus === 'open_to_trade' && (
              <View style={styles.tradeBadge}>
                <IconSymbol ios_icon_name="arrow.2.squarepath" android_material_icon_name="sync" size={14} color={colors.success} />
                <Text style={styles.tradeBadgeText}>Open to Trade</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <IconSymbol
              ios_icon_name={item.isLiked ? 'heart.fill' : 'heart'}
              android_material_icon_name={item.isLiked ? 'favorite' : 'favorite-border'}
              size={24}
              color={item.isLiked ? colors.error : colors.text}
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/coin-comments?id=${item.id}`)}
          >
            <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={24} color={colors.text} />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🪙 CoinHub</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪙 CoinHub</Text>
        <TouchableOpacity onPress={handleAddCoin} style={styles.addButton}>
          <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={coins}
        renderItem={renderCoinCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          tradeCoins.length > 0 ? (
            <View style={styles.tradeSection}>
              <Text style={styles.sectionTitle}>🔄 Open to Trade</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tradeCoinsContainer}
              >
                {tradeCoins.map((coin) => renderTradeCoinCard(coin))}
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol ios_icon_name="tray" android_material_icon_name="inbox" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a coin!</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCoin}>
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={coins.length === 0 ? styles.emptyList : undefined}
      />
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
  addButton: {
    padding: 4,
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
  tradeSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tradeCoinsContainer: {
    paddingHorizontal: 12,
  },
  tradeCoinCard: {
    width: 140,
    marginHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeCoinImageContainer: {
    position: 'relative',
  },
  tradeCoinImage: {
    width: 140,
    height: 140,
  },
  tradeCoinPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeCoinPaginationDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeCoinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  tradeCoinDotActive: {
    backgroundColor: colors.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tradeCoinInfo: {
    padding: 8,
  },
  tradeCoinTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  tradeCoinMeta: {
    fontSize: 12,
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
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
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
  imageContainer: {
    position: 'relative',
  },
  coinImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').width,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
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
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `${colors.success}20`,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tradeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginLeft: 4,
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
  emptyList: {
    flexGrow: 1,
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
  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
