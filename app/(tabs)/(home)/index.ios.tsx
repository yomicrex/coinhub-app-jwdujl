
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedFetch, API_URL } from '@/utils/api';
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
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';

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

const { width } = Dimensions.get('window');

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentImageIndices, setCurrentImageIndices] = useState<{ [key: string]: number }>({});
  const scrollViewRefs = useRef<{ [key: string]: ScrollView | null }>({});

  const fetchCoins = useCallback(async () => {
    console.log('FeedScreen: Fetching public coins feed');
    try {
      const response = await fetch(`${API_URL}/api/coins/feed`, {
        credentials: 'include',
      });

      console.log('FeedScreen: Feed response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch coins, status:', response.status);
        setCoins([]);
      }
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTradeCoins = useCallback(async () => {
    console.log('FeedScreen: Fetching coins up for trade');
    try {
      const response = await fetch(`${API_URL}/api/coins/feed/trade`, {
        credentials: 'include',
      });

      console.log('FeedScreen: Trade feed response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'trade coins');
        setTradeCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch trade coins, status:', response.status);
        setTradeCoins([]);
      }
    } catch (error) {
      console.error('FeedScreen: Error fetching trade coins:', error);
      setTradeCoins([]);
    }
  }, []);

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
    fetchTradeCoins();
  }, [fetchCoins, fetchTradeCoins, user?.username]);

  const onRefresh = useCallback(async () => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    await Promise.all([fetchCoins(), fetchTradeCoins()]);
    setRefreshing(false);
  }, [fetchCoins, fetchTradeCoins]);

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like button for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    // Find the coin in either list
    const coin = coins.find(c => c.id === coinId) || tradeCoins.find(c => c.id === coinId);
    if (!coin) return;
    
    const wasLiked = coin.isLiked || false;
    
    // Optimistically update UI in both lists
    setCoins(prevCoins => 
      prevCoins.map(c => 
        c.id === coinId 
          ? { 
              ...c, 
              isLiked: !wasLiked,
              likeCount: wasLiked ? (c.likeCount || c.like_count || 1) - 1 : (c.likeCount || c.like_count || 0) + 1,
              like_count: wasLiked ? (c.likeCount || c.like_count || 1) - 1 : (c.likeCount || c.like_count || 0) + 1
            }
          : c
      )
    );
    
    setTradeCoins(prevCoins => 
      prevCoins.map(c => 
        c.id === coinId 
          ? { 
              ...c, 
              isLiked: !wasLiked,
              likeCount: wasLiked ? (c.likeCount || c.like_count || 1) - 1 : (c.likeCount || c.like_count || 0) + 1,
              like_count: wasLiked ? (c.likeCount || c.like_count || 1) - 1 : (c.likeCount || c.like_count || 0) + 1
            }
          : c
      )
    );
    
    try {
      const method = wasLiked ? 'DELETE' : 'POST';
      console.log('FeedScreen: Sending', method, 'request to /api/coins/' + coinId + '/like');
      
      const response = await authenticatedFetch(`/api/coins/${coinId}/like`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify({}) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FeedScreen: Failed to like coin, status:', response.status, 'error:', errorText);
        throw new Error('Failed to toggle like');
      }
      
      console.log('FeedScreen: Like toggled successfully');
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
      
      // Revert optimistic update in both lists
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === coinId 
            ? { 
                ...c, 
                isLiked: wasLiked,
                likeCount: wasLiked ? (c.likeCount || c.like_count || 0) + 1 : (c.likeCount || c.like_count || 1) - 1,
                like_count: wasLiked ? (c.likeCount || c.like_count || 0) + 1 : (c.likeCount || c.like_count || 1) - 1
              }
            : c
        )
      );
      
      setTradeCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === coinId 
            ? { 
                ...c, 
                isLiked: wasLiked,
                likeCount: wasLiked ? (c.likeCount || c.like_count || 0) + 1 : (c.likeCount || c.like_count || 1) - 1,
                like_count: wasLiked ? (c.likeCount || c.like_count || 0) + 1 : (c.likeCount || c.like_count || 1) - 1
              }
            : c
        )
      );
      
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: User tapped Add Coin button');
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
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

  const handleProposeTrade = (coinId: string) => {
    console.log('FeedScreen: User tapped propose trade for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      Alert.alert('Sign In Required', 'Please sign in to propose a trade');
      router.push('/auth');
      return;
    }
    
    router.push(`/coin-detail?id=${coinId}`);
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentImageIndices(prev => ({ ...prev, [coinId]: index }));
  };

  const renderTradeCoinCard = (item: Coin) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const currentIndex = currentImageIndices[item.id] || 0;
    const avatarUrl = item.user.avatarUrl || item.user.avatar_url;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCoinCard}
        onPress={() => handleCoinPress(item.id)}
      >
        {/* User Info */}
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Images */}
        {item.images && item.images.length > 0 ? (
          <View>
            <ScrollView
              ref={(ref) => (scrollViewRefs.current[item.id] = ref)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => handleImageScroll(item.id, e)}
              scrollEventThrottle={16}
            >
              {item.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image.url }}
                  style={styles.tradeCoinImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {item.images.length > 1 && (
              <View style={styles.imageIndicatorContainer}>
                {item.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.imageIndicator,
                      index === currentIndex && styles.imageIndicatorActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.tradeCoinImage, styles.imagePlaceholder]}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={48}
              color={colors.textSecondary}
            />
          </View>
        )}

        {/* Coin Info */}
        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle}>{item.title}</Text>
          <Text style={styles.coinMeta}>
            {item.country} • {item.year}
          </Text>
        </View>

        {/* Actions */}
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
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol
              ios_icon_name="bubble.left"
              android_material_icon_name="chat-bubble-outline"
              size={24}
              color={colors.text}
            />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tradeButton}
            onPress={(e) => {
              e.stopPropagation();
              handleProposeTrade(item.id);
            }}
          >
            <IconSymbol
              ios_icon_name="arrow.2.squarepath"
              android_material_icon_name="swap-horiz"
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.tradeButtonText}>Propose Trade</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const tradeStatus = item.tradeStatus || item.trade_status;
    const currentIndex = currentImageIndices[item.id] || 0;
    const avatarUrl = item.user.avatarUrl || item.user.avatar_url;

    return (
      <TouchableOpacity style={styles.coinCard} onPress={() => handleCoinPress(item.id)}>
        {/* User Info */}
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Images */}
        {item.images && item.images.length > 0 ? (
          <View>
            <ScrollView
              ref={(ref) => (scrollViewRefs.current[item.id] = ref)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => handleImageScroll(item.id, e)}
              scrollEventThrottle={16}
            >
              {item.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image.url }}
                  style={styles.coinImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {item.images.length > 1 && (
              <View style={styles.imageIndicatorContainer}>
                {item.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.imageIndicator,
                      index === currentIndex && styles.imageIndicatorActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.coinImage, styles.imagePlaceholder]}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={48}
              color={colors.textSecondary}
            />
          </View>
        )}

        {/* Coin Info */}
        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle}>{item.title}</Text>
          <Text style={styles.coinMeta}>
            {item.country} • {item.year}
          </Text>
        </View>

        {/* Actions */}
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
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol
              ios_icon_name="bubble.left"
              android_material_icon_name="chat-bubble-outline"
              size={24}
              color={colors.text}
            />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>

          {tradeStatus === 'open_to_trade' && (
            <View style={styles.tradeBadge}>
              <IconSymbol
                ios_icon_name="arrow.2.squarepath"
                android_material_icon_name="swap-horiz"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.tradeBadgeText}>Open to Trade</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
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
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={28}
            color={colors.primary}
          />
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
              <Text style={styles.tradeSectionTitle}>🔄 Available for Trade</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tradeScrollContent}
              >
                {tradeCoins.map((coin) => renderTradeCoinCard(coin))}
              </ScrollView>
              <View style={styles.sectionDivider} />
              <Text style={styles.feedSectionTitle}>📰 Recent Coins</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="tray"
              android_material_icon_name="inbox"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a coin!</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCoin}>
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={coins.length === 0 && tradeCoins.length === 0 ? styles.emptyList : undefined}
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
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tradeScrollContent: {
    paddingHorizontal: 12,
  },
  tradeCoinCard: {
    width: 280,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeCoinImage: {
    width: 280,
    height: 280,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: colors.background,
    marginTop: 16,
  },
  feedSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
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
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  coinImage: {
    width: width,
    height: 400,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicatorContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageIndicatorActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
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
    alignItems: 'center',
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
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 'auto',
    gap: 6,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 'auto',
    gap: 6,
  },
  tradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
