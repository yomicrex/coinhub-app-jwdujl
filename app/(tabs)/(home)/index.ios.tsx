
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { IconSymbol } from '@/components/IconSymbol';
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
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_URL } from '@/utils/api';

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
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageIndices, setImageIndices] = useState<{ [key: string]: number }>({});
  const scrollViewRefs = useRef<{ [key: string]: ScrollView | null }>({});

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted');
    fetchCoins();
    fetchTradeCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching public coins feed from', `${API_URL}/api/coins/feed`);
      const response = await fetch(`${API_URL}/api/coins/feed`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
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
  };

  const fetchTradeCoins = async () => {
    try {
      console.log('FeedScreen: Fetching trade coins from', `${API_URL}/api/coins/feed/trade`);
      const response = await fetch(`${API_URL}/api/coins/feed/trade`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
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
  };

  const onRefresh = useCallback(() => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    Promise.all([fetchCoins(), fetchTradeCoins()]).finally(() => {
      setRefreshing(false);
    });
  }, []);

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like button for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        console.log('FeedScreen: Like successful, refreshing feed');
        fetchCoins();
        fetchTradeCoins();
      } else {
        console.error('FeedScreen: Failed to like coin, status:', response.status);
      }
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
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
    console.log('FeedScreen: User tapped on profile:', username);
    router.push(`/user-profile?username=${username}`);
  };

  const handleCoinPress = (coinId: string) => {
    console.log('FeedScreen: User tapped on coin:', coinId);
    router.push(`/coin-detail?id=${coinId}`);
  };

  const handleProposeTrade = async (coinId: string) => {
    console.log('FeedScreen: User tapped propose trade button for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      Alert.alert('Sign In Required', 'Please sign in to propose a trade');
      router.push('/auth');
      return;
    }

    try {
      console.log('FeedScreen: Initiating trade for coin:', coinId);
      console.log('FeedScreen: User ID:', user.id);
      console.log('FeedScreen: User email:', user.email);
      console.log('FeedScreen: User username:', user.username);
      
      const response = await authenticatedFetch('/api/trades/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinId: coinId,
        }),
      });

      console.log('FeedScreen: Trade initiate response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FeedScreen: Failed to initiate trade, status:', response.status, 'error:', errorText);
        
        if (response.status === 401) {
          console.error('FeedScreen: 401 Unauthorized - Session may be invalid or expired');
          Alert.alert(
            'Authentication Error', 
            'Your session has expired. Please sign in again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => router.push('/auth') }
            ]
          );
          return;
        }
        
        let errorMessage = 'Failed to initiate trade';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('FeedScreen: Parsed error:', errorData);
        } catch (e) {
          errorMessage = errorText || errorMessage;
          console.error('FeedScreen: Raw error text:', errorText);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('FeedScreen: Trade initiated successfully:', data);

      const tradeId = data.trade?.id || data.id;
      if (tradeId) {
        Alert.alert(
          'Trade Initiated!',
          'Your trade request has been created.',
          [
            {
              text: 'View Trade',
              onPress: () => router.push(`/trade-detail?id=${tradeId}`),
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } catch (error: any) {
      console.error('FeedScreen: Error initiating trade:', error);
      Alert.alert('Error', error.message || 'Failed to initiate trade. Please try again.');
    }
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setImageIndices((prev) => ({ ...prev, [coinId]: index }));
  };

  const renderTradeCoinCard = (item: Coin) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const tradeStatus = item.tradeStatus ?? item.trade_status;
    const avatarUrl = item.user.avatarUrl ?? item.user.avatar_url;
    const currentImageIndex = imageIndices[item.id] || 0;
    const isOwner = user?.id === item.user.id;

    return (
      <View key={item.id} style={styles.tradeCoinCard}>
        <TouchableOpacity
          style={styles.tradeCoinContent}
          onPress={() => handleCoinPress(item.id)}
          activeOpacity={0.9}
        >
          {/* User Info */}
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => handleUserPress(item.user.id, item.user.username)}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <View style={styles.userDetails}>
              <Text style={styles.displayName}>{item.user.displayName}</Text>
              <Text style={styles.username}>@{item.user.username}</Text>
            </View>
          </TouchableOpacity>

          {/* Images */}
          {item.images && item.images.length > 0 ? (
            <View>
              <ScrollView
                ref={(ref) => {
                  scrollViewRefs.current[item.id] = ref;
                }}
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
                        index === currentImageIndex && styles.imageIndicatorActive,
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
          <View style={styles.tradeCoinInfo}>
            <Text style={styles.tradeCoinTitle}>{item.title}</Text>
            <Text style={styles.tradeCoinMeta}>
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
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.tradeBadgeText}>Open to Trade</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Propose Trade Button */}
        {tradeStatus === 'open_to_trade' && !isOwner && (
          <TouchableOpacity
            style={styles.proposeTradeButton}
            onPress={() => handleProposeTrade(item.id)}
          >
            <IconSymbol
              ios_icon_name="arrow.2.squarepath"
              android_material_icon_name="swap-horiz"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.proposeTradeButtonText}>Propose Trade</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const tradeStatus = item.tradeStatus ?? item.trade_status;
    const avatarUrl = item.user.avatarUrl ?? item.user.avatar_url;
    const currentImageIndex = imageIndices[item.id] || 0;

    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {/* User Info */}
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Images */}
        {item.images && item.images.length > 0 ? (
          <View>
            <ScrollView
              ref={(ref) => {
                scrollViewRefs.current[item.id] = ref;
              }}
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
                      index === currentImageIndex && styles.imageIndicatorActive,
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
                size={14}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          tradeCoins.length > 0 ? (
            <View style={styles.tradeSection}>
              <Text style={styles.tradeSectionTitle}>Available for Trade</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tradeScrollContent}
              >
                {tradeCoins.map((coin) => (
                  <React.Fragment key={coin.id}>{renderTradeCoinCard(coin)}</React.Fragment>
                ))}
              </ScrollView>
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
  addButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tradeSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tradeScrollContent: {
    paddingHorizontal: 16,
  },
  tradeCoinCard: {
    width: 280,
    marginHorizontal: 4,
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeCoinContent: {
    flex: 1,
  },
  tradeCoinImage: {
    width: 280,
    height: 280,
    backgroundColor: colors.border,
  },
  tradeCoinInfo: {
    padding: 12,
  },
  tradeCoinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  tradeCoinMeta: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  proposeTradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  proposeTradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    marginRight: 12,
  },
  avatarPlaceholder: {
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
    backgroundColor: colors.border,
  },
  imagePlaceholder: {
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
    gap: 4,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
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
});
