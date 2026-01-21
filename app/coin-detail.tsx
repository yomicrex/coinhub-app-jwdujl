
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_URL } from '@/utils/api';

const { width } = Dimensions.get('window');

interface CoinDetail {
  id: string;
  title: string;
  country: string;
  year: number;
  unit?: string;
  organization?: string;
  agency?: string;
  deployment?: string;
  coinNumber?: string;
  mintMark?: string;
  condition?: string;
  description?: string;
  version?: string;
  manufacturer?: string;
  visibility: string;
  tradeStatus: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  images: { url: string; orderIndex?: number }[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  createdAt: string;
}

export default function CoinDetailScreen() {
  const { id, coinId } = useLocalSearchParams<{ id?: string; coinId?: string }>();
  const actualId = id || coinId;
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [proposingTrade, setProposingTrade] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const { user } = useAuth();
  const router = useRouter();

  const fetchCoinDetail = useCallback(async () => {
    if (!actualId) return;

    try {
      console.log('CoinDetailScreen: Fetching coin detail for coinId:', actualId);
      console.log('CoinDetailScreen: API URL:', API_URL);
      
      const response = await fetch(`${API_URL}/api/coins/${actualId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('CoinDetailScreen: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CoinDetailScreen: Failed to fetch coin, status:', response.status, 'error:', errorText);
        throw new Error(`Failed to fetch coin: ${response.status}`);
      }

      const data = await response.json();
      console.log('CoinDetailScreen: Coin data received, images count:', data.images?.length || 0);
      
      setCoin(data);
      setIsLiked(data.isLiked || false);
      setImageErrors({});
      setLoading(false);
    } catch (error) {
      console.error('CoinDetailScreen: Error fetching coin detail:', error);
      Alert.alert('Error', 'Failed to load coin details');
      setLoading(false);
    }
  }, [actualId]);

  useEffect(() => {
    console.log('CoinDetailScreen: Component mounted, coinId:', actualId);
    
    if (!actualId) {
      console.error('CoinDetailScreen: No coin ID provided');
      setLoading(false);
      return;
    }

    fetchCoinDetail();
  }, [fetchCoinDetail]);

  const onRefresh = async () => {
    console.log('CoinDetailScreen: User pulled to refresh');
    setRefreshing(true);
    await fetchCoinDetail();
    setRefreshing(false);
  };

  const handleLike = async () => {
    if (!user) {
      console.log('CoinDetailScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }

    if (!coin) return;

    console.log('CoinDetailScreen: User tapped like button, current state:', isLiked);
    
    const previousState = isLiked;
    const previousCount = coin.likeCount;
    
    // Optimistically update UI
    setIsLiked(!isLiked);
    setCoin({
      ...coin,
      likeCount: previousState ? coin.likeCount - 1 : coin.likeCount + 1,
    });

    try {
      const method = previousState ? 'DELETE' : 'POST';
      console.log('CoinDetailScreen: Sending', method, 'request to /api/coins/' + coin.id + '/like');
      
      // FIXED: Don't set Content-Type for DELETE requests to avoid empty body error
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
      
      const response = await authenticatedFetch(`/api/coins/${coin.id}/like`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CoinDetailScreen: Failed to toggle like, status:', response.status, 'error:', errorText);
        throw new Error('Failed to toggle like');
      }

      console.log('CoinDetailScreen: Like toggled successfully');
    } catch (error) {
      console.error('CoinDetailScreen: Error toggling like:', error);
      // Revert optimistic update
      setIsLiked(previousState);
      setCoin({
        ...coin,
        likeCount: previousCount,
      });
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  };

  const handleComment = () => {
    if (!user) {
      console.log('CoinDetailScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }

    if (!coin) return;

    console.log('CoinDetailScreen: User tapped comment button');
    router.push(`/coin-comments?coinId=${coin.id}`);
  };

  const handleProposeTrade = async () => {
    if (!user) {
      console.log('CoinDetailScreen: User not logged in, redirecting to auth');
      Alert.alert('Sign In Required', 'Please sign in to propose a trade');
      router.push('/auth');
      return;
    }

    if (!coin) return;

    console.log('CoinDetailScreen: User tapped propose trade button for coin:', coin.id);
    console.log('CoinDetailScreen: User ID:', user.id);
    console.log('CoinDetailScreen: User email:', user.email);
    console.log('CoinDetailScreen: User username:', user.username);
    setProposingTrade(true);

    try {
      console.log('CoinDetailScreen: Sending trade initiate request using authenticatedFetch');
      
      const response = await authenticatedFetch('/api/trades/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinId: coin.id,
        }),
      });

      console.log('CoinDetailScreen: Trade initiate response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CoinDetailScreen: Failed to initiate trade, status:', response.status, 'error:', errorText);
        
        if (response.status === 401) {
          console.error('CoinDetailScreen: 401 Unauthorized - Session may be invalid or expired');
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
          console.error('CoinDetailScreen: Parsed error:', errorData);
        } catch (e) {
          errorMessage = errorText || errorMessage;
          console.error('CoinDetailScreen: Raw error text:', errorText);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('CoinDetailScreen: Trade initiated successfully:', data);

      Alert.alert(
        'Trade Initiated!',
        'Your trade request has been created. You can now offer coins to the owner.',
        [
          {
            text: 'View Trade',
            onPress: () => {
              const tradeId = data.trade?.id || data.id;
              if (tradeId) {
                router.push(`/trade-detail?id=${tradeId}`);
              }
            },
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error: any) {
      console.error('CoinDetailScreen: Error initiating trade:', error);
      Alert.alert('Error', error.message || 'Failed to initiate trade. Please try again.');
    } finally {
      setProposingTrade(false);
    }
  };

  const handleUserPress = () => {
    if (!coin) return;
    console.log('CoinDetailScreen: User tapped on user profile:', coin.user.username);
    router.push(`/user-profile?username=${coin.user.username}`);
  };

  const handleEdit = () => {
    if (!coin) return;
    console.log('CoinDetailScreen: User tapped edit button');
    router.push(`/edit-coin?id=${coin.id}`);
  };

  const handleDelete = () => {
    if (!coin) return;

    Alert.alert(
      'Delete Coin',
      'Are you sure you want to delete this coin? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('CoinDetailScreen: Deleting coin:', coin.id);
              const response = await authenticatedFetch(`/api/coins/${coin.id}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('Failed to delete coin');
              }

              console.log('CoinDetailScreen: Coin deleted successfully');
              Alert.alert('Success', 'Coin deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('CoinDetailScreen: Error deleting coin:', error);
              Alert.alert('Error', 'Failed to delete coin');
            }
          },
        },
      ]
    );
  };

  const handleImageError = (index: number) => {
    console.error('CoinDetailScreen: Image failed to load at index:', index);
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading coin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!coin) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.errorContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.errorText}>Coin not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === coin.user.id;
  const canProposeTrade = !isOwner && coin.tradeStatus === 'open_to_trade' && user;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: coin.title,
          headerBackTitle: 'Back',
          headerRight: isOwner
            ? () => (
                <View style={styles.headerButtons}>
                  <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                    <IconSymbol
                      ios_icon_name="pencil"
                      android_material_icon_name="edit"
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={20}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
              )
            : undefined,
        }}
      />

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* User Info */}
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <View style={styles.avatarContainer}>
            {coin.user.avatarUrl ? (
              <Image
                source={{ uri: coin.user.avatarUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{coin.user.displayName}</Text>
            <Text style={styles.username}>@{coin.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Images */}
        {coin.images && coin.images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroller}
          >
            {coin.images.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                {!imageErrors[index] ? (
                  <Image
                    source={{ uri: image.url }}
                    style={styles.coinImage}
                    resizeMode="cover"
                    onError={() => handleImageError(index)}
                  />
                ) : (
                  <View style={[styles.coinImage, styles.imagePlaceholder]}>
                    <IconSymbol
                      ios_icon_name="photo"
                      android_material_icon_name="image"
                      size={64}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.imageErrorText}>Image unavailable</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.imagePlaceholder}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.imagePlaceholderText}>No images available</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <IconSymbol
              ios_icon_name={isLiked ? 'heart.fill' : 'heart'}
              android_material_icon_name={isLiked ? 'favorite' : 'favorite-border'}
              size={28}
              color={isLiked ? colors.error : colors.text}
            />
            <Text style={styles.actionText}>{coin.likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
            <IconSymbol
              ios_icon_name="bubble.left"
              android_material_icon_name="chat-bubble-outline"
              size={28}
              color={colors.text}
            />
            <Text style={styles.actionText}>{coin.commentCount}</Text>
          </TouchableOpacity>

          {coin.tradeStatus === 'open_to_trade' && (
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

        {/* Propose Trade Button */}
        {canProposeTrade && (
          <View style={styles.tradeButtonContainer}>
            <TouchableOpacity
              style={[styles.proposeTradeButton, proposingTrade && styles.proposeTradeButtonDisabled]}
              onPress={handleProposeTrade}
              disabled={proposingTrade}
            >
              {proposingTrade ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="arrow.2.squarepath"
                    android_material_icon_name="swap-horiz"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.proposeTradeButtonText}>Propose Trade</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Coin Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.coinTitle}>{coin.title}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Country:</Text>
            <Text style={styles.detailValue}>{coin.country}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Year:</Text>
            <Text style={styles.detailValue}>{coin.year}</Text>
          </View>

          {coin.agency && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Agency:</Text>
              <Text style={styles.detailValue}>{coin.agency}</Text>
            </View>
          )}

          {coin.unit && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Unit:</Text>
              <Text style={styles.detailValue}>{coin.unit}</Text>
            </View>
          )}

          {coin.organization && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Organization:</Text>
              <Text style={styles.detailValue}>{coin.organization}</Text>
            </View>
          )}

          {coin.deployment && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Deployment:</Text>
              <Text style={styles.detailValue}>{coin.deployment}</Text>
            </View>
          )}

          {coin.coinNumber && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Coin Number:</Text>
              <Text style={styles.detailValue}>{coin.coinNumber}</Text>
            </View>
          )}

          {coin.version && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Version:</Text>
              <Text style={styles.detailValue}>{coin.version}</Text>
            </View>
          )}

          {coin.manufacturer && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Manufacturer:</Text>
              <Text style={styles.detailValue}>{coin.manufacturer}</Text>
            </View>
          )}

          {coin.mintMark && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mint Mark:</Text>
              <Text style={styles.detailValue}>{coin.mintMark}</Text>
            </View>
          )}

          {coin.condition && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Condition:</Text>
              <Text style={styles.detailValue}>{coin.condition}</Text>
            </View>
          )}

          {coin.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.detailLabel}>Description:</Text>
              <Text style={styles.description}>{coin.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundAlt,
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
    marginTop: 2,
  },
  imageScroller: {
    height: 400,
  },
  imageContainer: {
    width: width,
    height: 400,
  },
  coinImage: {
    width: width,
    height: 400,
    backgroundColor: colors.backgroundAlt,
  },
  imagePlaceholder: {
    width: width,
    height: 400,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  imageErrorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
    fontWeight: '600',
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
  tradeButtonContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  proposeTradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  proposeTradeButtonDisabled: {
    opacity: 0.6,
  },
  proposeTradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsSection: {
    padding: 16,
  },
  coinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 120,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  descriptionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginTop: 8,
  },
});
