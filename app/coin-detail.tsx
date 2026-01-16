
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  FlatList,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authClient } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';
const { width } = Dimensions.get('window');

interface CoinImage {
  id: string;
  url: string;
  orderIndex: number;
}

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
  visibility: string;
  tradeStatus: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  images: CoinImage[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
}

export default function CoinDetailScreen() {
  const router = useRouter();
  const { coinId } = useLocalSearchParams<{ coinId: string }>();
  const { user } = useAuth();
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    console.log('CoinDetail: Loading coin:', coinId);
    if (coinId) {
      fetchCoinDetail();
    }
  }, [coinId]);

  const fetchCoinDetail = async () => {
    try {
      console.log('CoinDetail: Fetching coin details from /api/coins/' + coinId);
      const response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}`);
      
      console.log('CoinDetail: Response:', response);
      const coinData = response?.data || response;
      
      setCoin(coinData);
      console.log('CoinDetail: Coin loaded with', coinData.images?.length || 0, 'images');
    } catch (error) {
      console.error('CoinDetail: Error fetching coin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!coin) return;
    
    console.log('CoinDetail: User tapped like/unlike');
    const isCurrentlyLiked = coin.isLiked;
    
    try {
      let response;
      
      if (isCurrentlyLiked) {
        console.log('CoinDetail: Unliking coin');
        response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/like`, {
          method: 'DELETE',
        });
      } else {
        console.log('CoinDetail: Liking coin');
        response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      }

      const responseData = response?.data || response;
      const newLikeCount = responseData?.likeCount ?? responseData?.like_count ?? 0;
      const newLikedState = responseData?.liked ?? responseData?.isLiked ?? false;
      
      console.log('CoinDetail: New like count:', newLikeCount, 'Liked:', newLikedState);
      
      setCoin(prev => prev ? {
        ...prev,
        likeCount: newLikeCount,
        isLiked: newLikedState,
      } : null);
    } catch (error) {
      console.error('CoinDetail: Error toggling like:', error);
    }
  };

  const handleComments = () => {
    if (!coin) return;
    
    console.log('CoinDetail: User tapped comments button, navigating to comments screen');
    router.push(`/coin-comments?coinId=${coinId}&coinTitle=${encodeURIComponent(coin.title)}`);
  };

  const handleShare = async () => {
    if (!coin) return;
    
    console.log('CoinDetail: User tapped share button');
    
    try {
      const shareMessage = `Check out this coin: ${coin.title} (${coin.year}, ${coin.country})`;
      const shareUrl = `https://coinhub.app/coins/${coinId}`;
      const fullMessage = `${shareMessage}\n${shareUrl}`;
      
      // Check if we're on web
      if (Platform.OS === 'web') {
        console.log('CoinDetail: Running on web, attempting to share');
        
        // Try to use the Web Share API if available
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            console.log('CoinDetail: Using Web Share API');
            await navigator.share({
              title: `${coin.title} - CoinHub`,
              text: shareMessage,
              url: shareUrl,
            });
            console.log('CoinDetail: Shared successfully using Web Share API');
            return;
          } catch (shareError: any) {
            // User cancelled or share failed
            if (shareError.name === 'AbortError') {
              console.log('CoinDetail: Share cancelled by user');
              return;
            }
            console.log('CoinDetail: Web Share API failed, falling back to clipboard:', shareError);
          }
        } else {
          console.log('CoinDetail: Web Share API not available, using clipboard');
        }
        
        // Fallback to clipboard for web
        console.log('CoinDetail: Copying to clipboard as fallback');
        await Clipboard.setStringAsync(fullMessage);
        Alert.alert('Link Copied', 'The coin link has been copied to your clipboard!');
        console.log('CoinDetail: Link copied to clipboard successfully');
      } else {
        // Native platforms (iOS/Android)
        console.log('CoinDetail: Running on native platform, using React Native Share API');
        
        try {
          const result = await Share.share(
            {
              message: Platform.OS === 'ios' ? shareMessage : fullMessage,
              url: Platform.OS === 'ios' ? shareUrl : undefined,
              title: `${coin.title} - CoinHub`,
            },
            {
              dialogTitle: 'Share this coin',
              subject: `${coin.title} - CoinHub`,
            }
          );

          if (result.action === Share.sharedAction) {
            if (result.activityType) {
              console.log('CoinDetail: Shared with activity type:', result.activityType);
            } else {
              console.log('CoinDetail: Coin shared successfully');
            }
          } else if (result.action === Share.dismissedAction) {
            console.log('CoinDetail: Share dismissed');
          }
        } catch (error: any) {
          console.error('CoinDetail: Error sharing on native:', error);
          Alert.alert('Share Failed', 'Unable to share this coin. Please try again.');
        }
      }
    } catch (error) {
      console.error('CoinDetail: Error in share handler:', error);
      Alert.alert('Share Failed', 'Unable to share this coin. Please try again.');
    }
  };

  const handleUserPress = () => {
    if (!coin) return;
    
    console.log('CoinDetail: User tapped on profile:', coin.user.username);
    if (coin.user.id === user?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/user-profile?userId=${coin.user.id}`);
    }
  };

  const handleEdit = () => {
    console.log('CoinDetail: User tapped edit coin');
    router.push(`/edit-coin?coinId=${coinId}`);
  };

  const handleTrade = async () => {
    if (!coin) return;
    
    console.log('CoinDetail: User tapped Trade button for coin:', coinId);
    
    try {
      console.log('CoinDetail: Initiating trade via POST /api/trades/initiate');
      const response = await authClient.$fetch(`${API_URL}/api/trades/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coinId }),
      });

      console.log('CoinDetail: Trade initiation response:', response);
      const tradeData = response?.data || response;
      const tradeId = tradeData?.trade?.id || tradeData?.id;
      
      if (!tradeId) {
        console.error('CoinDetail: No trade ID in response:', tradeData);
        Alert.alert('Error', 'Failed to create trade request');
        return;
      }
      
      console.log('CoinDetail: Trade created successfully with ID:', tradeId);
      Alert.alert('Success', 'Trade request sent!', [
        {
          text: 'View Trade',
          onPress: () => {
            console.log('CoinDetail: Navigating to trade detail:', tradeId);
            router.push(`/trade-detail?id=${tradeId}`);
          },
        },
        { text: 'OK' },
      ]);
    } catch (error: any) {
      console.error('CoinDetail: Error creating trade:', error);
      Alert.alert('Error', error?.message || 'Failed to create trade request');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0;
      console.log('CoinDetail: Image changed to index:', newIndex);
      setCurrentImageIndex(newIndex);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading coin...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!coin) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Coin not found</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const sortedImages = coin.images?.sort((a, b) => a.orderIndex - b.orderIndex) || [];
  const isOwner = coin.user.id === user?.id;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: coin.title,
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () =>
            isOwner ? (
              <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Image Gallery with Swipe */}
          {sortedImages.length > 0 ? (
            <View style={styles.imageGalleryContainer}>
              <FlatList
                ref={flatListRef}
                data={sortedImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.imageSlide}>
                    <Image
                      source={{ uri: item.url }}
                      style={styles.coinImage}
                      resizeMode="cover"
                      onError={(error) => {
                        console.error('CoinDetail: Image failed to load:', item.url, error.nativeEvent.error);
                      }}
                      onLoad={() => {
                        console.log('CoinDetail: Image loaded successfully:', item.url);
                      }}
                    />
                  </View>
                )}
              />
              
              {/* Image Indicator Dots */}
              {sortedImages.length > 1 && (
                <View style={styles.imageIndicatorContainer}>
                  {sortedImages.map((_, index) => (
                    <View
                      key={`indicator-${index}`}
                      style={[
                        styles.imageIndicatorDot,
                        index === currentImageIndex && styles.imageIndicatorDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
              
              {/* Image Counter */}
              {sortedImages.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {sortedImages.length}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noImageContainer}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}

          {/* User Info */}
          <TouchableOpacity style={styles.userSection} onPress={handleUserPress}>
            <View style={styles.userAvatar}>
              {coin.user.avatarUrl ? (
                <Image
                  source={{ uri: coin.user.avatarUrl }}
                  style={styles.avatarImage}
                  onError={(error) => {
                    console.error('CoinDetail: Avatar failed to load:', coin.user.avatarUrl, error.nativeEvent.error);
                  }}
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
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{coin.user.displayName}</Text>
              <Text style={styles.username}>@{coin.user.username}</Text>
            </View>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <IconSymbol
                ios_icon_name={coin.isLiked ? "heart.fill" : "heart"}
                android_material_icon_name={coin.isLiked ? "favorite" : "favorite-border"}
                size={28}
                color={coin.isLiked ? colors.primary : colors.text}
              />
              <Text style={styles.actionText}>
                {coin.likeCount} {coin.likeCount === 1 ? 'like' : 'likes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleComments}>
              <IconSymbol
                ios_icon_name="message.fill"
                android_material_icon_name="chat-bubble"
                size={28}
                color={colors.text}
              />
              <Text style={styles.actionText}>
                {coin.commentCount} {coin.commentCount === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="share"
                size={28}
                color={colors.text}
              />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

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

            {coin.unit && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Unit/Service:</Text>
                <Text style={styles.detailValue}>{coin.unit}</Text>
              </View>
            )}

            {coin.organization && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Organization:</Text>
                <Text style={styles.detailValue}>{coin.organization}</Text>
              </View>
            )}

            {coin.agency && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Agency:</Text>
                <Text style={styles.detailValue}>{coin.agency}</Text>
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
                <Text style={styles.descriptionText}>{coin.description}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Trade Status:</Text>
              <View style={[
                styles.statusBadge,
                coin.tradeStatus === 'open_to_trade' && styles.statusBadgeActive
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  coin.tradeStatus === 'open_to_trade' && styles.statusBadgeTextActive
                ]}>
                  {coin.tradeStatus === 'open_to_trade' ? 'Open to Trade' : 'Not for Trade'}
                </Text>
              </View>
            </View>

            {/* Trade Button */}
            {!isOwner && coin.tradeStatus === 'open_to_trade' && (
              <TouchableOpacity style={styles.tradeButton} onPress={handleTrade}>
                <IconSymbol
                  ios_icon_name="arrow.left.arrow.right"
                  android_material_icon_name="swap-horiz"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.tradeButtonText}>Propose Trade</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
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
  errorText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageGalleryContainer: {
    width: width,
    height: width,
    backgroundColor: colors.backgroundAlt,
    position: 'relative',
  },
  imageSlide: {
    width: width,
    height: width,
  },
  coinImage: {
    width: '100%',
    height: '100%',
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
  noImageContainer: {
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
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
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
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  detailsSection: {
    padding: 16,
  },
  coinTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  descriptionSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusBadgeTextActive: {
    color: '#FFFFFF',
  },
  tradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  tradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
