
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageScrollPositions, setImageScrollPositions] = useState<{ [key: string]: number }>({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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
    
    // Find the coin to get its current like state
    const coin = coins.find(c => c.id === coinId);
    if (!coin) return;
    
    const wasLiked = coin.isLiked || false;
    
    // Optimistically update UI
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
    
    try {
      const method = wasLiked ? 'DELETE' : 'POST';
      console.log('FeedScreen: Sending', method, 'request to /api/coins/' + coinId + '/like');
      
      // Don't set Content-Type for DELETE requests to avoid empty body error
      const fetchOptions: RequestInit = {
        method,
      };
      
      // Only add headers and body for POST requests
      if (method === 'POST') {
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
        fetchOptions.body = JSON.stringify({});
      }
      
      const response = await authenticatedFetch(`/api/coins/${coinId}/like`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FeedScreen: Failed to like coin, status:', response.status, 'error:', errorText);
        throw new Error('Failed to toggle like');
      }
      
      console.log('FeedScreen: Like toggled successfully');
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
      
      // Revert optimistic update
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
      
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  };

  const handleComment = (coinId: string) => {
    console.log('FeedScreen: User tapped comment button for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    // Open comment modal
    setSelectedCoinId(coinId);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedCoinId || submittingComment) {
      return;
    }

    console.log('FeedScreen: Submitting comment for coin:', selectedCoinId);
    setSubmittingComment(true);

    try {
      const response = await authenticatedFetch(`/api/coins/${selectedCoinId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FeedScreen: Failed to submit comment, status:', response.status, 'error:', errorText);
        throw new Error('Failed to submit comment');
      }

      console.log('FeedScreen: Comment submitted successfully');
      
      // Update comment count optimistically
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === selectedCoinId 
            ? { 
                ...c, 
                commentCount: (c.commentCount || c.comment_count || 0) + 1,
                comment_count: (c.commentCount || c.comment_count || 0) + 1
              }
            : c
        )
      );
      
      // Close modal and reset
      setShowCommentModal(false);
      setCommentText('');
      setSelectedCoinId(null);
      
      Alert.alert('Success', 'Comment posted!');
    } catch (error) {
      console.error('FeedScreen: Error submitting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(false);
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
    console.log('FeedScreen: User tapped Propose Trade for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    // Navigate to propose trade screen or show modal
    Alert.alert(
      'Propose Trade',
      'Would you like to propose a trade for this coin?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Propose Trade',
          onPress: () => {
            // TODO: Implement trade proposal flow
            console.log('FeedScreen: Navigating to trade proposal for coin:', coinId);
            Alert.alert('Coming Soon', 'Trade proposal feature is being implemented.');
          },
        },
      ]
    );
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imageIndex = Math.round(scrollPosition / SCREEN_WIDTH);
    setImageScrollPositions(prev => ({ ...prev, [coinId]: imageIndex }));
  };

  const renderTradeCoinCard = (item: Coin) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const avatarUrl = item.user.avatarUrl || item.user.avatar_url;
    const currentImageIndex = imageScrollPositions[item.id] || 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCoinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {/* Images */}
        {item.images && item.images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => handleImageScroll(item.id, e)}
              scrollEventThrottle={16}
            >
              {item.images.map((img, index) => (
                <Image
                  key={index}
                  source={{ uri: img.url }}
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
                      currentImageIndex === index && styles.imageIndicatorActive,
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
          <Text style={styles.tradeCoinTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.tradeCoinMeta}>
            {item.country} • {item.year}
          </Text>

          {/* User Info */}
          <TouchableOpacity
            style={styles.tradeCoinUser}
            onPress={(e) => {
              e.stopPropagation();
              handleUserPress(item.user.id, item.user.username);
            }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.tradeCoinAvatar} />
            ) : (
              <View style={[styles.tradeCoinAvatar, styles.avatarPlaceholder]}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={12}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <Text style={styles.tradeCoinUsername} numberOfLines={1}>
              @{item.user.username}
            </Text>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.tradeCoinActions}>
            <View style={styles.tradeCoinStats}>
              <View style={styles.tradeCoinStat}>
                <IconSymbol
                  ios_icon_name="heart.fill"
                  android_material_icon_name="favorite"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.tradeCoinStatText}>{likeCount}</Text>
              </View>
              <View style={styles.tradeCoinStat}>
                <IconSymbol
                  ios_icon_name="bubble.left.fill"
                  android_material_icon_name="chat-bubble"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.tradeCoinStatText}>{commentCount}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.tradeButton}
              onPress={(e) => {
                e.stopPropagation();
                handleProposeTrade(item.id);
              }}
            >
              <Text style={styles.tradeButtonText}>Trade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const likeCount = item.likeCount ?? item.like_count ?? 0;
    const commentCount = item.commentCount ?? item.comment_count ?? 0;
    const avatarUrl = item.user.avatarUrl || item.user.avatar_url;

    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {/* User Info */}
        <TouchableOpacity
          style={styles.userInfo}
          onPress={(e) => {
            e.stopPropagation();
            handleUserPress(item.user.id, item.user.username);
          }}
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
          <View>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Coin Image */}
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0].url }} style={styles.coinImage} resizeMode="cover" />
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

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleComment(item.id);
            }}
          >
            <IconSymbol
              ios_icon_name="bubble.left"
              android_material_icon_name="chat-bubble-outline"
              size={24}
              color={colors.text}
            />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>
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
                contentContainerStyle={styles.tradeCoinsContainer}
              >
                {tradeCoins.map((coin) => renderTradeCoinCard(coin))}
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
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCoin}>
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={coins.length === 0 ? styles.emptyList : undefined}
      />

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCommentModal(false);
          setCommentText('');
          setSelectedCoinId(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                  setSelectedCoinId(null);
                }}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder="Write your comment..."
              placeholderTextColor={colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!commentText.trim() || submittingComment) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Post Comment</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    backgroundColor: colors.surface,
  },
  tradeSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tradeCoinsContainer: {
    paddingHorizontal: 12,
  },
  tradeCoinCard: {
    width: 200,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tradeCoinImage: {
    width: 200,
    height: 200,
  },
  imageIndicatorContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  imageIndicatorActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tradeCoinUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeCoinAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  tradeCoinUsername: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  tradeCoinActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeCoinStats: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeCoinStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tradeCoinStatText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tradeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tradeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  commentInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
