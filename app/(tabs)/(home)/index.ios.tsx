
import React, { useState, useEffect, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { authClient } from '@/lib/auth';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';
const { width } = Dimensions.get('window');

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
  images: Array<{ url: string; order_index?: number; orderIndex?: number }>;
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

export default function FeedScreen() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTrade, setLoadingTrade] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imageIndices, setImageIndices] = useState<{ [key: string]: number }>({});
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
    fetchTradeCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching coins from /api/coins/feed');
      const response = await authClient.$fetch(`${API_URL}/api/coins/feed?limit=20&offset=0`);
      
      console.log('FeedScreen: Raw response:', JSON.stringify(response, null, 2));
      
      // Handle different response formats
      const coinsData = response?.data?.coins || response?.coins || response?.data || [];
      
      console.log('FeedScreen: Extracted coins data:', coinsData);
      console.log('FeedScreen: Fetched', coinsData.length, 'coins');
      
      // Log first coin to see structure
      if (coinsData && coinsData.length > 0) {
        console.log('FeedScreen: First coin structure:', JSON.stringify(coinsData[0], null, 2));
        console.log('FeedScreen: First coin images:', coinsData[0].images);
      }
      
      setCoins(coinsData);
      
      // Initialize image indices for all coins
      const indices: { [key: string]: number } = {};
      coinsData.forEach((coin: Coin) => {
        indices[coin.id] = 0;
      });
      setImageIndices(indices);
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTradeCoins = async () => {
    try {
      console.log('FeedScreen: Fetching trade coins from /api/coins/feed/trade');
      const response = await authClient.$fetch(`${API_URL}/api/coins/feed/trade?limit=20&offset=0`);
      
      console.log('FeedScreen: Trade feed raw response:', JSON.stringify(response, null, 2));
      
      // Handle different response formats
      const coinsData = response?.data?.coins || response?.coins || response?.data || [];
      
      console.log('FeedScreen: Extracted trade coins data:', coinsData);
      console.log('FeedScreen: Fetched', coinsData.length, 'trade coins');
      
      setTradeCoins(coinsData);
    } catch (error) {
      console.error('FeedScreen: Error fetching trade coins:', error);
    } finally {
      setLoadingTrade(false);
    }
  };

  const onRefresh = () => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    fetchCoins();
    fetchTradeCoins();
  };

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like/unlike on coin:', coinId);
    
    // Find the coin to check if it's already liked
    const coin = coins.find(c => c.id === coinId);
    const isCurrentlyLiked = coin?.isLiked || false;
    
    // Optimistic update
    setCoins(prevCoins =>
      prevCoins.map(c =>
        c.id === coinId 
          ? { 
              ...c, 
              like_count: isCurrentlyLiked ? (c.like_count || 1) - 1 : (c.like_count || 0) + 1, 
              likeCount: isCurrentlyLiked ? (c.likeCount || 1) - 1 : (c.likeCount || 0) + 1,
              isLiked: !isCurrentlyLiked
            } 
          : c
      )
    );
    
    try {
      let response;
      
      if (isCurrentlyLiked) {
        // Unlike the coin
        console.log('FeedScreen: Unliking coin');
        response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/like`, {
          method: 'DELETE',
        });
      } else {
        // Like the coin
        console.log('FeedScreen: Liking coin');
        response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      }

      console.log('FeedScreen: Like/unlike response:', response);
      
      // Handle different response formats
      const responseData = response?.data || response;
      const newLikeCount = responseData?.likeCount ?? responseData?.like_count ?? 0;
      const newLikedState = responseData?.liked ?? responseData?.isLiked ?? false;
      
      console.log('FeedScreen: New like count:', newLikeCount, 'Liked:', newLikedState);
      
      // Update with server response
      setCoins(prevCoins =>
        prevCoins.map(c =>
          c.id === coinId 
            ? { 
                ...c, 
                like_count: newLikeCount, 
                likeCount: newLikeCount,
                isLiked: newLikedState
              } 
            : c
        )
      );
    } catch (error) {
      console.error('FeedScreen: Error toggling like:', error);
      // Revert optimistic update on error
      setCoins(prevCoins =>
        prevCoins.map(c =>
          c.id === coinId 
            ? { 
                ...c, 
                like_count: isCurrentlyLiked ? (c.like_count || 0) + 1 : (c.like_count || 1) - 1, 
                likeCount: isCurrentlyLiked ? (c.likeCount || 0) + 1 : (c.likeCount || 1) - 1,
                isLiked: isCurrentlyLiked
              } 
            : c
        )
      );
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: User tapped add coin button');
    router.push('/add-coin');
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('FeedScreen: User tapped on profile:', username, 'userId:', userId);
    if (userId === user?.id) {
      console.log('FeedScreen: Navigating to own profile');
      router.push('/(tabs)/profile');
    } else {
      console.log('FeedScreen: Navigating to user profile with username:', username);
      // Pass username to user-profile screen
      router.push(`/user-profile?username=${encodeURIComponent(username)}`);
    }
  };

  const handleCoinPress = (coinId: string) => {
    console.log('FeedScreen: User tapped on coin:', coinId);
    router.push(`/coin-detail?coinId=${coinId}`);
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    console.log('FeedScreen: Image scrolled for coin', coinId, 'contentOffsetX:', contentOffsetX, 'calculated index:', index);
    setImageIndices(prev => {
      const newIndices = { ...prev, [coinId]: index };
      console.log('FeedScreen: Updated imageIndices:', newIndices);
      return newIndices;
    });
  };

  const renderTradeCoinCard = (item: Coin) => {
    const sortedImages = item.images?.sort((a, b) => {
      const aIndex = a.order_index ?? a.orderIndex ?? 0;
      const bIndex = b.order_index ?? b.orderIndex ?? 0;
      return aIndex - bIndex;
    }) || [];
    
    const mainImage = sortedImages[0];
    const avatarUrl = item.user.avatar_url ?? item.user.avatarUrl;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {mainImage && mainImage.url ? (
          <Image
            source={{ uri: mainImage.url }}
            style={styles.tradeCardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.tradeCardImagePlaceholder}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={32}
              color={colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.tradeCardOverlay}>
          <View style={styles.tradeCardHeader}>
            <View style={styles.tradeCardAvatar}>
              {avatarUrl ? (
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.tradeCardAvatarImage}
                />
              ) : (
                <View style={styles.tradeCardAvatarPlaceholder}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={12}
                    color={colors.textSecondary}
                  />
                </View>
              )}
            </View>
            <Text style={styles.tradeCardUsername} numberOfLines={1}>
              {item.user.username}
            </Text>
          </View>
          <View style={styles.tradeCardInfo}>
            <Text style={styles.tradeCardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.tradeCardDetails} numberOfLines={1}>
              {item.year} • {item.country}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    console.log('FeedScreen: Rendering coin:', item.title, 'with', item.images?.length || 0, 'images');
    
    // Handle both order_index and orderIndex
    const sortedImages = item.images?.sort((a, b) => {
      const aIndex = a.order_index ?? a.orderIndex ?? 0;
      const bIndex = b.order_index ?? b.orderIndex ?? 0;
      return aIndex - bIndex;
    }) || [];
    
    const currentIndex = imageIndices[item.id] || 0;
    console.log('FeedScreen: Current image index for coin', item.id, ':', currentIndex);
    
    const likeCount = item.like_count ?? item.likeCount ?? 0;
    const commentCount = item.comment_count ?? item.commentCount ?? 0;
    const tradeStatus = item.trade_status ?? item.tradeStatus ?? 'not_for_trade';
    const avatarUrl = item.user.avatar_url ?? item.user.avatarUrl;
    const isLiked = item.isLiked || false;
    
    return (
      <View style={styles.card}>
        {/* Header with user info */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          <View style={styles.userAvatar}>
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={styles.avatarImage}
                onError={(error) => {
                  console.error('FeedScreen: Avatar failed to load:', avatarUrl, error.nativeEvent.error);
                }}
              />
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
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.user.username}</Text>
            {tradeStatus === 'open_to_trade' && (
              <View style={styles.tradeIndicator}>
                <IconSymbol
                  ios_icon_name="arrow.2.squarepath"
                  android_material_icon_name="swap-horiz"
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.tradeIndicatorText}>Open to Trade</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Coin Image Gallery with Swipe */}
        {sortedImages.length > 0 ? (
          <View style={styles.imageGalleryContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => handleImageScroll(item.id, event)}
              scrollEventThrottle={16}
            >
              {sortedImages.map((image, index) => (
                <TouchableOpacity
                  key={`${item.id}-image-${index}`}
                  onPress={() => handleCoinPress(item.id)}
                  activeOpacity={0.95}
                >
                  <Image
                    source={{ uri: image.url }}
                    style={styles.coinImage}
                    resizeMode="cover"
                    onError={(error) => {
                      console.error('FeedScreen: Image failed to load:', image.url, error.nativeEvent.error);
                    }}
                    onLoad={() => {
                      console.log('FeedScreen: Image loaded successfully:', image.url);
                    }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Image Counter */}
            {sortedImages.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentIndex + 1} / {sortedImages.length}
                </Text>
              </View>
            )}
            
            {/* Image Indicator Dots */}
            {sortedImages.length > 1 && (
              <View style={styles.imageIndicatorContainer}>
                {sortedImages.map((_, index) => (
                  <View
                    key={`${item.id}-dot-${index}`}
                    style={[
                      styles.imageIndicatorDot,
                      index === currentIndex && styles.imageIndicatorDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={() => handleCoinPress(item.id)} activeOpacity={0.95}>
            <View style={styles.coinImagePlaceholder}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.noImageText}>No image available</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
            >
              <IconSymbol
                ios_icon_name={isLiked ? "heart.fill" : "heart"}
                android_material_icon_name={isLiked ? "favorite" : "favorite-border"}
                size={28}
                color={isLiked ? "#FF3B30" : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleCoinPress(item.id)}
            >
              <IconSymbol
                ios_icon_name="message"
                android_material_icon_name="chat-bubble-outline"
                size={28}
                color={colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleCoinPress(item.id)}
            >
              <IconSymbol
                ios_icon_name="paperplane"
                android_material_icon_name="send"
                size={28}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Likes and Caption */}
        <View style={styles.cardContent}>
          {likeCount > 0 && (
            <Text style={styles.likesText}>
              {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
            </Text>
          )}
          
          <TouchableOpacity onPress={() => handleCoinPress(item.id)}>
            <View style={styles.captionContainer}>
              <Text style={styles.captionUsername}>{item.user.username}</Text>
              <Text style={styles.captionText}>
                {' '}{item.title} • {item.year} • {item.country}
              </Text>
            </View>
          </TouchableOpacity>

          {commentCount > 0 && (
            <TouchableOpacity onPress={() => handleCoinPress(item.id)}>
              <Text style={styles.viewCommentsText}>
                View all {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CoinHub</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/search-users')} style={styles.headerButton}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={28}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddCoin} style={styles.addButton}>
            <IconSymbol
              ios_icon_name="plus.app"
              android_material_icon_name="add-box"
              size={28}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={coins}
        renderItem={renderCoinCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Coins Up for Trade Section */}
            <View style={styles.tradeFeedSection}>
              <View style={styles.tradeFeedHeader}>
                <View style={styles.tradeFeedTitleContainer}>
                  <IconSymbol
                    ios_icon_name="arrow.2.squarepath"
                    android_material_icon_name="swap-horiz"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.tradeFeedTitle}>Coins Up for Trade</Text>
                </View>
                <TouchableOpacity onPress={fetchTradeCoins}>
                  <IconSymbol
                    ios_icon_name="arrow.clockwise"
                    android_material_icon_name="refresh"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              
              {loadingTrade ? (
                <View style={styles.tradeFeedLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.tradeFeedLoadingText}>Loading trade coins...</Text>
                </View>
              ) : tradeCoins.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tradeFeedScroll}
                >
                  {tradeCoins.map((coin) => renderTradeCoinCard(coin))}
                </ScrollView>
              ) : (
                <View style={styles.tradeFeedEmpty}>
                  <IconSymbol
                    ios_icon_name="arrow.2.squarepath"
                    android_material_icon_name="swap-horiz"
                    size={40}
                    color={colors.border}
                  />
                  <Text style={styles.tradeFeedEmptyText}>No coins up for trade yet</Text>
                </View>
              )}
            </View>
            
            {/* Divider */}
            <View style={styles.divider} />
          </>
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
            <Text style={styles.emptySubtext}>
              Be the first to share your collection!
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleAddCoin}
            >
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: 'System',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
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
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tradeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tradeIndicatorText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  imageGalleryContainer: {
    width: width,
    height: width,
    backgroundColor: colors.backgroundAlt,
    position: 'relative',
  },
  coinImage: {
    width: width,
    height: width,
    backgroundColor: colors.backgroundAlt,
  },
  coinImagePlaceholder: {
    width: width,
    height: width,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageIndicatorContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageIndicatorDotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardActions: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  captionUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  captionText: {
    fontSize: 14,
    color: colors.text,
  },
  viewCommentsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Trade Feed Styles
  tradeFeedSection: {
    backgroundColor: colors.background,
    paddingVertical: 16,
  },
  tradeFeedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tradeFeedTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeFeedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  tradeFeedScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tradeFeedLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  tradeFeedLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tradeFeedEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  tradeFeedEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  tradeCard: {
    width: 160,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    marginRight: 12,
  },
  tradeCardImage: {
    width: '100%',
    height: '100%',
  },
  tradeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  tradeCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
  },
  tradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tradeCardAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    overflow: 'hidden',
  },
  tradeCardAvatarImage: {
    width: 20,
    height: 20,
  },
  tradeCardAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeCardUsername: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  tradeCardInfo: {
    gap: 2,
  },
  tradeCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tradeCardDetails: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  divider: {
    height: 8,
    backgroundColor: colors.backgroundAlt,
  },
});
