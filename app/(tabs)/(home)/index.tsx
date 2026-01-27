
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { authenticatedFetch, API_URL } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  unit?: string;
  agency?: string;
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

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [tradeCoins, setTradeCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeImageIndices, setActiveImageIndices] = useState<{ [key: string]: number }>({});
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

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch coins');
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
    console.log('FeedScreen: Fetching trade coins');
    try {
      // If user is authenticated, use authenticated fetch to exclude own coins
      // If not authenticated, use regular fetch to show all trade coins
      let response;
      if (user) {
        console.log('FeedScreen: User authenticated, fetching trade coins with session');
        response = await authenticatedFetch(`/api/coins/trade-feed`);
      } else {
        console.log('FeedScreen: Guest user, fetching all trade coins');
        response = await fetch(`${API_URL}/api/coins/trade-feed`, {
          credentials: 'include',
        });
      }

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
  }, [user]);

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
    fetchTradeCoins();
  }, [fetchCoins, fetchTradeCoins, user?.username]);

  const onRefresh = async () => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    await Promise.all([fetchCoins(), fetchTradeCoins()]);
    setRefreshing(false);
  };

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like button for coin:', coinId);
    
    if (!user) {
      console.log('FeedScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    const coin = coins.find(c => c.id === coinId);
    if (!coin) return;
    
    const wasLiked = coin.isLiked || false;
    
    setCoins(prevCoins => 
      prevCoins.map(c => 
        c.id === coinId 
          ? { 
              ...c, 
              isLiked: !wasLiked,
              likeCount: wasLiked ? (c.likeCount || 1) - 1 : (c.likeCount || 0) + 1
            }
          : c
      )
    );
    
    try {
      const method = wasLiked ? 'DELETE' : 'POST';
      const fetchOptions: RequestInit = {
        method,
      };
      
      if (method === 'POST') {
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
        fetchOptions.body = JSON.stringify({});
      }
      
      const response = await authenticatedFetch(`/api/coins/${coinId}/like`, fetchOptions);

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
      
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === coinId 
            ? { 
                ...c, 
                isLiked: wasLiked,
                likeCount: wasLiked ? (c.likeCount || 0) + 1 : (c.likeCount || 1) - 1
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
        throw new Error('Failed to submit comment');
      }

      console.log('FeedScreen: Comment submitted successfully');
      
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === selectedCoinId 
            ? { ...c, commentCount: (c.commentCount || 0) + 1 }
            : c
        )
      );
      
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

  const handleSearchCoins = () => {
    console.log('FeedScreen: User tapped Search Coins button');
    router.push('/search-coins');
  };

  const handleSearchUsers = () => {
    console.log('FeedScreen: User tapped Search Users button');
    router.push('/search-users');
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
      router.push('/auth');
      return;
    }
    
    router.push(`/coin-detail?id=${coinId}`);
  };

  const handleImageScroll = (coinId: string, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imageWidth = Dimensions.get('window').width;
    const index = Math.round(scrollPosition / imageWidth);
    
    setActiveImageIndices(prev => ({
      ...prev,
      [coinId]: index,
    }));
  };

  const renderTradeCoinCard = (item: Coin) => {
    const images = item.images || [];
    const activeIndex = activeImageIndices[item.id] || 0;
    const agencyText = item.agency || '';
    const unitText = item.unit || '';
    const titleText = item.title || '';
    
    return (
      <TouchableOpacity
        style={styles.tradeCoinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {images.length > 0 ? (
          <View>
            <ScrollView
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
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.imageIndicators}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.imageIndicator,
                      idx === activeIndex && styles.imageIndicatorActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.tradeCoinImage, styles.imagePlaceholder]}>
            <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={48} color={colors.textSecondary} />
          </View>
        )}
        
        <View style={styles.tradeCoinInfo}>
          <Text style={styles.tradeCoinTitle} numberOfLines={1}>
            {titleText}
          </Text>
          
          <View style={styles.tradeCoinMetaRow}>
            {agencyText ? (
              <Text style={styles.tradeCoinMeta} numberOfLines={1}>
                {agencyText}
              </Text>
            ) : null}
            {agencyText && unitText ? (
              <Text style={styles.tradeCoinMetaSeparator}>•</Text>
            ) : null}
            {unitText ? (
              <Text style={styles.tradeCoinMeta} numberOfLines={1}>
                {unitText}
              </Text>
            ) : null}
          </View>
          
          <TouchableOpacity
            style={styles.tradeButton}
            onPress={(e) => {
              e.stopPropagation();
              handleProposeTrade(item.id);
            }}
          >
            <Text style={styles.tradeButtonText}>Propose Trade</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const agencyText = item.agency || '';
    const unitText = item.unit || '';
    const titleText = item.title || '';
    const userAvatarUrl = item.user.avatarUrl || item.user.avatar_url;
    const hasAvatar = !!userAvatarUrl;
    
    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => handleCoinPress(item.id)}
      >
        <TouchableOpacity
          style={styles.userInfo}
          onPress={(e) => {
            e.stopPropagation();
            handleUserPress(item.user.id, item.user.username);
          }}
        >
          <View style={styles.avatar}>
            {hasAvatar ? (
              <Image 
                source={{ uri: userAvatarUrl }} 
                style={styles.avatarImage}
              />
            ) : (
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
            )}
          </View>
          <View>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0].url }} style={styles.coinImage} />
        ) : (
          <View style={[styles.coinImage, styles.imagePlaceholder]}>
            <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={48} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle}>{titleText}</Text>
          
          <View style={styles.coinMetaRow}>
            {agencyText ? (
              <Text style={styles.coinMeta}>{agencyText}</Text>
            ) : null}
            {agencyText && unitText ? (
              <Text style={styles.coinMetaSeparator}>•</Text>
            ) : null}
            {unitText ? (
              <Text style={styles.coinMeta}>{unitText}</Text>
            ) : null}
          </View>
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

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleComment(item.id);
            }}
          >
            <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={24} color={colors.text} />
            <Text style={styles.actionText}>{item.commentCount || 0}</Text>
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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleSearchCoins} style={styles.searchButton}>
              <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={20} color="#000" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddCoin} style={styles.headerButton}>
              <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={30} color="#FFD700" />
            </TouchableOpacity>
          </View>
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSearchCoins} style={styles.searchButton}>
            <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={20} color="#000" />
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddCoin} style={styles.headerButton}>
            <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={30} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={coins}
        renderItem={renderCoinCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {tradeCoins.length > 0 ? (
              <View style={styles.tradeSection}>
                <Text style={styles.tradeSectionTitle}>Open to Trade</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tradeScrollContent}
                >
                  {tradeCoins.map((coin) => (
                    <React.Fragment key={coin.id}>
                      {renderTradeCoinCard(coin)}
                    </React.Fragment>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <View style={styles.feedDivider} />
          </>
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
              style={[styles.submitButton, (!commentText.trim() || submittingComment) && styles.submitButtonDisabled]}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 6,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
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
    backgroundColor: colors.surface,
  },
  tradeSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  feedDivider: {
    height: 8,
    backgroundColor: colors.background,
  },
  tradeScrollContent: {
    paddingHorizontal: 12,
  },
  tradeCoinCard: {
    width: 200,
    marginHorizontal: 4,
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tradeCoinImage: {
    width: 200,
    height: 200,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  imageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageIndicatorActive: {
    backgroundColor: '#FFD700',
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
  tradeCoinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  tradeCoinMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tradeCoinMetaSeparator: {
    fontSize: 12,
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  tradeButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  coinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  coinMeta: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  coinMetaSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 6,
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
