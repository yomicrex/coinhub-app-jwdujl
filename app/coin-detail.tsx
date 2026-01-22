
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
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_URL } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface UserCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: { url: string }[];
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

  // Trade proposal modal state
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [showUploadCoin, setShowUploadCoin] = useState(false);
  const [userCoins, setUserCoins] = useState<UserCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');

  // Upload coin form state
  const [uploadImages, setUploadImages] = useState<string[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCountry, setUploadCountry] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

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
  }, [actualId, fetchCoinDetail]);

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
      
      const fetchOptions: RequestInit = {
        method,
      };
      
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

    console.log('CoinDetailScreen: User tapped propose trade button - showing coin selection modal');
    setShowTradeModal(true);
  };

  const fetchUserCoins = async () => {
    try {
      console.log('CoinDetailScreen: Fetching user coins for trade offer');
      if (!user?.id) {
        console.log('CoinDetailScreen: No user ID available');
        Alert.alert('Error', 'User not logged in');
        return;
      }

      setLoadingCoins(true);
      const response = await authenticatedFetch(`/api/users/${user.id}/coins`);

      if (!response.ok) {
        console.error('CoinDetailScreen: Failed to fetch coins, status:', response.status);
        throw new Error('Failed to fetch coins');
      }

      const data = await response.json();
      const coinsData = data?.coins || data || [];
      
      console.log('CoinDetailScreen: Fetched', coinsData.length, 'user coins');
      setUserCoins(coinsData);
    } catch (error) {
      console.error('CoinDetailScreen: Error fetching user coins:', error);
      Alert.alert('Error', 'Failed to load your coins');
    } finally {
      setLoadingCoins(false);
    }
  };

  const handleSelectFromMyCoins = async () => {
    console.log('CoinDetailScreen: User chose to select from their coins');
    setShowTradeModal(false);
    setShowCoinPicker(true);
    await fetchUserCoins();
  };

  const handleUploadNewCoin = () => {
    console.log('CoinDetailScreen: User chose to upload a new coin');
    setShowTradeModal(false);
    setShowUploadCoin(true);
  };

  const handleOfferCoin = async (offeredCoinId: string) => {
    if (!coin) return;

    console.log('CoinDetailScreen: User selected coin to offer:', offeredCoinId);
    setShowCoinPicker(false);
    setProposingTrade(true);

    try {
      console.log('CoinDetailScreen: Creating trade with initial offer');
      
      // Step 1: Create the trade
      const tradeResponse = await authenticatedFetch('/api/trades/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinId: coin.id,
        }),
      });

      if (!tradeResponse.ok) {
        const errorText = await tradeResponse.text();
        console.error('CoinDetailScreen: Failed to initiate trade:', errorText);
        throw new Error('Failed to initiate trade');
      }

      const tradeData = await tradeResponse.json();
      const tradeId = tradeData.trade?.id || tradeData.id;
      console.log('CoinDetailScreen: Trade created with ID:', tradeId);

      // Step 2: Add the coin offer to the trade
      const offerResponse = await authenticatedFetch(`/api/trades/${tradeId}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          offeredCoinId,
          message: offerMessage.trim() || undefined,
        }),
      });

      if (!offerResponse.ok) {
        const errorText = await offerResponse.text();
        console.error('CoinDetailScreen: Failed to add offer:', errorText);
        throw new Error('Failed to add coin offer');
      }

      console.log('CoinDetailScreen: Trade created successfully with initial offer');
      setOfferMessage('');

      Alert.alert(
        'Trade Proposed!',
        'Your trade request has been sent with your coin offer.',
        [
          {
            text: 'View Trade',
            onPress: () => router.push(`/trade-detail?id=${tradeId}`),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error: any) {
      console.error('CoinDetailScreen: Error creating trade:', error);
      Alert.alert('Error', error.message || 'Failed to propose trade. Please try again.');
    } finally {
      setProposingTrade(false);
    }
  };

  const pickImages = async () => {
    console.log('CoinDetailScreen: User tapped pick images for upload');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - uploadImages.length,
    });

    if (!result.canceled && result.assets) {
      console.log('CoinDetailScreen: User selected', result.assets.length, 'images');
      const newImages = result.assets.map((asset) => asset.uri);
      setUploadImages([...uploadImages, ...newImages].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    console.log('CoinDetailScreen: User tapped take photo for upload');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      console.log('CoinDetailScreen: User took a photo');
      setUploadImages([...uploadImages, result.assets[0].uri].slice(0, 5));
    }
  };

  const removeUploadImage = (index: number) => {
    console.log('CoinDetailScreen: User removed upload image at index:', index);
    setUploadImages(uploadImages.filter((_, i) => i !== index));
  };

  const handleUploadCoinOffer = async () => {
    if (!coin) return;

    console.log('CoinDetailScreen: User submitting uploaded coin for trade');

    if (uploadImages.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    if (!uploadTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!uploadCountry.trim()) {
      Alert.alert('Error', 'Please enter a country');
      return;
    }

    if (!uploadYear.trim() || isNaN(parseInt(uploadYear))) {
      Alert.alert('Error', 'Please enter a valid year');
      return;
    }

    setUploading(true);

    try {
      console.log('CoinDetailScreen: Step 1 - Creating trade');
      
      // Step 1: Create the trade
      const tradeResponse = await authenticatedFetch('/api/trades/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinId: coin.id,
        }),
      });

      if (!tradeResponse.ok) {
        const errorText = await tradeResponse.text();
        console.error('CoinDetailScreen: Failed to initiate trade:', errorText);
        throw new Error('Failed to initiate trade');
      }

      const tradeData = await tradeResponse.json();
      const tradeId = tradeData.trade?.id || tradeData.id;
      console.log('CoinDetailScreen: Trade created with ID:', tradeId);

      // Step 2: Upload the coin as an offer
      console.log('CoinDetailScreen: Step 2 - Uploading coin offer');
      const formData = new FormData();

      for (let i = 0; i < uploadImages.length; i++) {
        const uri = uploadImages[i];
        const filename = uri.split('/').pop() || `image${i}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any);
      }

      formData.append('title', uploadTitle.trim());
      formData.append('country', uploadCountry.trim());
      formData.append('year', uploadYear.trim());
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim());
      }
      if (offerMessage.trim()) {
        formData.append('message', offerMessage.trim());
      }

      const offerResponse = await authenticatedFetch(`/api/trades/${tradeId}/offers/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!offerResponse.ok) {
        const errorText = await offerResponse.text();
        console.error('CoinDetailScreen: Failed to upload coin offer:', errorText);
        throw new Error('Failed to upload coin offer');
      }

      console.log('CoinDetailScreen: Trade created successfully with uploaded coin');
      
      // Reset form
      setUploadImages([]);
      setUploadTitle('');
      setUploadCountry('');
      setUploadYear('');
      setUploadDescription('');
      setOfferMessage('');
      setShowUploadCoin(false);

      Alert.alert(
        'Trade Proposed!',
        'Your trade request has been sent with your coin offer.',
        [
          {
            text: 'View Trade',
            onPress: () => router.push(`/trade-detail?id=${tradeId}`),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error: any) {
      console.error('CoinDetailScreen: Error creating trade with upload:', error);
      Alert.alert('Error', error.message || 'Failed to propose trade. Please try again.');
    } finally {
      setUploading(false);
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

      {/* Trade Choice Modal */}
      <Modal
        visible={showTradeModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tradeChoiceModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add a Coin to Your Trade Offer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTradeModal(false)}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.tradeChoiceDescription}>
              To propose a trade, you need to offer one of your coins in exchange. Choose how you&apos;d like to add a coin:
            </Text>
            <TouchableOpacity
              style={[styles.tradeChoiceButton, styles.primaryButton]}
              onPress={handleSelectFromMyCoins}
            >
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.tradeChoiceButtonText}>Select from My Coins</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeChoiceButton, styles.secondaryButton]}
              onPress={handleUploadNewCoin}
            >
              <IconSymbol
                ios_icon_name="plus.circle"
                android_material_icon_name="add-circle"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.tradeChoiceButtonText}>Upload New Coin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Coin Picker Modal */}
      <Modal
        visible={showCoinPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCoinPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: SCREEN_HEIGHT * 0.85, marginTop: SCREEN_HEIGHT * 0.15 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Coin to Offer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowCoinPicker(false);
                  setOfferMessage('');
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
            <View style={styles.modalMessageInput}>
              <TextInput
                style={styles.messageInput}
                placeholder="Add a message with your offer (optional)"
                placeholderTextColor={colors.textSecondary}
                value={offerMessage}
                onChangeText={setOfferMessage}
                multiline
                maxLength={200}
              />
            </View>
            {loadingCoins ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.emptyText, { marginTop: 16 }]}>Loading your coins...</Text>
              </View>
            ) : userCoins.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <IconSymbol
                  ios_icon_name="photo"
                  android_material_icon_name="image"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptyText, { marginTop: 16, marginBottom: 8 }]}>
                  You don&apos;t have any coins to offer
                </Text>
                <Text style={[styles.emptyText, { fontSize: 13, marginBottom: 16 }]}>
                  Upload a new coin to make your trade offer
                </Text>
                <TouchableOpacity
                  style={[styles.tradeChoiceButton, styles.primaryButton]}
                  onPress={() => {
                    setShowCoinPicker(false);
                    setShowUploadCoin(true);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle"
                    android_material_icon_name="add-circle"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.tradeChoiceButtonText}>Upload New Coin</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={userCoins}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.coinListItem}
                    onPress={() => handleOfferCoin(item.id)}
                  >
                    {item.images && item.images.length > 0 && item.images[0]?.url ? (
                      <Image
                        source={{ uri: item.images[0].url }}
                        style={styles.coinListImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.coinListImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol
                          ios_icon_name="photo"
                          android_material_icon_name="image"
                          size={32}
                          color={colors.textSecondary}
                        />
                      </View>
                    )}
                    <View style={styles.coinListInfo}>
                      <Text style={styles.coinListTitle}>{item.title}</Text>
                      <Text style={styles.coinListDetails}>
                        {item.country} • {item.year}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Coin Modal */}
      <Modal
        visible={showUploadCoin}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUploadCoin(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: SCREEN_HEIGHT * 0.9, marginTop: SCREEN_HEIGHT * 0.1 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Coin for Trade</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowUploadCoin(false);
                  setUploadImages([]);
                  setUploadTitle('');
                  setUploadCountry('');
                  setUploadYear('');
                  setUploadDescription('');
                  setOfferMessage('');
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

            <ScrollView style={styles.uploadForm} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Images */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Images (Required)</Text>
                <View style={styles.imagePickerContainer}>
                  <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
                    <IconSymbol
                      ios_icon_name="photo.on.rectangle"
                      android_material_icon_name="photo-library"
                      size={24}
                      color={colors.primary}
                    />
                    <Text style={styles.imagePickerText}>Choose from Library</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                    <IconSymbol
                      ios_icon_name="camera"
                      android_material_icon_name="camera-alt"
                      size={24}
                      color={colors.primary}
                    />
                    <Text style={styles.imagePickerText}>Take Photo</Text>
                  </TouchableOpacity>
                </View>
                {uploadImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewContainer}>
                    {uploadImages.map((uri, index) => (
                      <View key={index} style={styles.imagePreview}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeUploadImage(index)}
                        >
                          <IconSymbol
                            ios_icon_name="xmark.circle.fill"
                            android_material_icon_name="cancel"
                            size={24}
                            color="#F44336"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Title */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter coin title"
                  placeholderTextColor={colors.textSecondary}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                />
              </View>

              {/* Country */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Country *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter country"
                  placeholderTextColor={colors.textSecondary}
                  value={uploadCountry}
                  onChangeText={setUploadCountry}
                />
              </View>

              {/* Year */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Year *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter year"
                  placeholderTextColor={colors.textSecondary}
                  value={uploadYear}
                  onChangeText={setUploadYear}
                  keyboardType="numeric"
                />
              </View>

              {/* Description */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Enter description (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Offer Message */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Message with Offer</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Add a message with your offer (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={offerMessage}
                  onChangeText={setOfferMessage}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.tradeChoiceButton, styles.primaryButton, { marginTop: 16 }]}
                onPress={handleUploadCoinOffer}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.tradeChoiceButtonText}>Submit Trade Offer</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeChoiceModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
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
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  tradeChoiceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  tradeChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.textSecondary,
  },
  tradeChoiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalMessageInput: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  messageInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  coinListItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coinListImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  coinListInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  coinListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  coinListDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  uploadForm: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginTop: 12,
  },
  imagePreview: {
    marginRight: 12,
    position: 'relative',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
});
