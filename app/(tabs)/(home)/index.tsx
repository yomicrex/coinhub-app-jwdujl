
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
  Platform,
  Dimensions,
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching coins from /api/coins/feed');
      const response = await authClient.$fetch(`${API_URL}/api/coins/feed?limit=20&offset=0`);
      
      console.log('FeedScreen: Fetched', response.coins?.length || 0, 'coins');
      
      // Log first coin to see structure
      if (response.coins && response.coins.length > 0) {
        console.log('FeedScreen: First coin structure:', JSON.stringify(response.coins[0], null, 2));
        console.log('FeedScreen: First coin images:', response.coins[0].images);
      }
      
      setCoins(response.coins || []);
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    fetchCoins();
  };

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: User tapped like/unlike on coin:', coinId);
    
    // Find the coin to check if it's already liked
    const coin = coins.find(c => c.id === coinId);
    const isCurrentlyLiked = coin?.isLiked || false;
    
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
      const newLikeCount = response.likeCount ?? response.like_count ?? 0;
      const newLikedState = response.liked ?? false;
      
      console.log('FeedScreen: New like count:', newLikeCount, 'Liked:', newLikedState);
      
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
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: User tapped add coin button');
    router.push('/add-coin');
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('FeedScreen: User tapped on profile:', username);
    if (userId === user?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/user-profile?userId=${userId}`);
    }
  };

  const handleCoinPress = (coinId: string) => {
    console.log('FeedScreen: User tapped on coin:', coinId);
    // Navigate to coin detail view (to be implemented)
    // For now, just log
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    console.log('FeedScreen: Rendering coin:', item.title, 'with', item.images?.length || 0, 'images');
    
    // Handle both order_index and orderIndex
    const sortedImages = item.images?.sort((a, b) => {
      const aIndex = a.order_index ?? a.orderIndex ?? 0;
      const bIndex = b.order_index ?? b.orderIndex ?? 0;
      return aIndex - bIndex;
    }) || [];
    
    const mainImage = sortedImages[0];
    const likeCount = item.like_count ?? item.likeCount ?? 0;
    const commentCount = item.comment_count ?? item.commentCount ?? 0;
    const tradeStatus = item.trade_status ?? item.tradeStatus ?? 'not_for_trade';
    const avatarUrl = item.user.avatar_url ?? item.user.avatarUrl;
    const isLiked = item.isLiked || false;
    
    if (mainImage) {
      console.log('FeedScreen: Main image URL for', item.title, ':', mainImage.url);
    } else {
      console.log('FeedScreen: No images found for coin:', item.title);
    }
    
    return (
      <View style={styles.card}>
        {/* Header with user info */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          <View style={styles.userAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
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
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Coin Image */}
        <TouchableOpacity onPress={() => handleCoinPress(item.id)} activeOpacity={0.95}>
          {mainImage && mainImage.url ? (
            <Image
              source={{ uri: mainImage.url }}
              style={styles.coinImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('FeedScreen: Image failed to load:', mainImage.url, error.nativeEvent.error);
              }}
              onLoad={() => {
                console.log('FeedScreen: Image loaded successfully:', mainImage.url);
              }}
            />
          ) : (
            <View style={styles.coinImagePlaceholder}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.noImageText}>No image available</Text>
            </View>
          )}
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
                size={26}
                color={isLiked ? colors.primary : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol
                ios_icon_name="message.fill"
                android_material_icon_name="chat-bubble"
                size={26}
                color={colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send"
                size={26}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Likes and Caption */}
        <View style={styles.cardContent}>
          {likeCount > 0 && (
            <Text style={styles.likesText}>
              {likeCount} {likeCount === 1 ? 'like' : 'likes'}
            </Text>
          )}
          
          <View style={styles.captionContainer}>
            <Text style={styles.captionUsername}>{item.user.displayName}</Text>
            <Text style={styles.captionText}>
              {' '}{item.title} • {item.year} • {item.country}
            </Text>
          </View>

          {commentCount > 0 && (
            <TouchableOpacity>
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
        <TouchableOpacity onPress={handleAddCoin} style={styles.addButton}>
          <IconSymbol
            ios_icon_name="plus.app"
            android_material_icon_name="add-box"
            size={28}
            color={colors.text}
          />
        </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? 48 : 0,
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
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 12,
    color: colors.textSecondary,
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
  tradeBadge: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)',
    elevation: 4,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
});
