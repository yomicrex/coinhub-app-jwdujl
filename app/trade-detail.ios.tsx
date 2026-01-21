
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedFetch } from '@/utils/api';
import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: { url: string }[];
  description?: string;
  condition?: string;
  unit?: string;
  organization?: string;
  agency?: string;
  deployment?: string;
  coinNumber?: string;
  mintMark?: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface TradeOffer {
  id: string;
  coin?: Coin | null;
  offeredCoin?: Coin | null;
  offeredBy?: User;
  offerer?: User;
  message?: string;
  isCounterOffer: boolean;
  status: string;
  createdAt: string;
}

interface TradeMessage {
  id: string;
  sender: User;
  message: string;
  content?: string;
  createdAt: string;
}

interface ShippingInfo {
  id: string;
  tradeId: string;
  initiatorShipped: boolean;
  initiatorTrackingNumber?: string;
  initiatorShippedAt?: string;
  initiatorReceived: boolean;
  initiatorReceivedAt?: string;
  ownerShipped: boolean;
  ownerTrackingNumber?: string;
  ownerShippedAt?: string;
  ownerReceived: boolean;
  ownerReceivedAt?: string;
}

interface TradeDetail {
  id: string;
  coin: Coin;
  initiator: User;
  coinOwner: User;
  status: string;
  offers: TradeOffer[];
  messages: TradeMessage[];
  shipping: ShippingInfo | null;
  createdAt: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function TradeDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [showUploadCoin, setShowUploadCoin] = useState(false);
  const [showCoinDetail, setShowCoinDetail] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  const [userCoins, setUserCoins] = useState<Coin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Upload coin form state
  const [uploadImages, setUploadImages] = useState<string[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCountry, setUploadCountry] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    console.log('TradeDetailScreen: Component mounted, trade ID:', id);
    if (id) {
      fetchTradeDetail();
    } else {
      console.error('TradeDetailScreen: No trade ID provided in URL params');
      setError('No trade ID provided');
      setLoading(false);
    }
  }, [id]);

  const fetchTradeDetail = async () => {
    if (!id) {
      console.error('TradeDetailScreen: Cannot fetch trade - no ID');
      return;
    }

    try {
      console.log('TradeDetailScreen: Fetching trade detail for ID:', id);
      const response = await authenticatedFetch(`/api/trades/${id}`);
      
      if (!response.ok) {
        console.error('TradeDetailScreen: Failed to fetch trade, status:', response.status);
        throw new Error('Failed to load trade');
      }

      const data = await response.json();
      console.log('TradeDetailScreen: Fetched trade detail response:', {
        id: data.id,
        status: data.status,
        offerCount: data.offers?.length || 0,
        messageCount: data.messages?.length || 0,
        hasShipping: !!data.shipping
      });
      
      if (!data) {
        console.error('TradeDetailScreen: No trade data in response');
        setError('Trade not found');
        setLoading(false);
        return;
      }

      console.log('TradeDetailScreen: Trade data loaded successfully');
      console.log('TradeDetailScreen: Messages:', data.messages);
      setTrade(data);
      setError(null);
    } catch (error: any) {
      console.error('TradeDetailScreen: Error fetching trade detail:', error);
      console.error('TradeDetailScreen: Error details:', error.message);
      setError('Failed to load trade details');
      Alert.alert('Error', 'Failed to load trade details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCoins = async () => {
    try {
      console.log('TradeDetailScreen: Fetching user coins for offer');
      if (!user?.id) {
        console.log('TradeDetailScreen: No user ID available');
        Alert.alert('Error', 'User not logged in');
        return;
      }

      setLoadingCoins(true);
      const response = await authenticatedFetch(`/api/users/${user.id}/coins`);

      if (!response.ok) {
        console.error('TradeDetailScreen: Failed to fetch coins, status:', response.status);
        throw new Error('Failed to fetch coins');
      }

      const data = await response.json();
      const coinsData = data?.coins || data || [];
      console.log('TradeDetailScreen: Fetched', coinsData.length, 'user coins');
      setUserCoins(coinsData);
    } catch (error) {
      console.error('TradeDetailScreen: Error fetching user coins:', error);
      Alert.alert('Error', 'Failed to load your coins');
    } finally {
      setLoadingCoins(false);
    }
  };

  const handleOpenCoinPicker = async () => {
    console.log('TradeDetailScreen: User tapped "Select from My Coins" button');
    setShowCoinPicker(true);
    await fetchUserCoins();
  };

  const handleViewCoinDetail = (coin: Coin, offer?: TradeOffer) => {
    console.log('TradeDetailScreen: User viewing coin detail:', coin.id);
    setSelectedCoin(coin);
    setSelectedOffer(offer || null);
    setShowCoinDetail(true);
  };

  const pickImages = async () => {
    console.log('TradeDetailScreen: User tapped pick images for upload');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - uploadImages.length,
    });

    if (!result.canceled && result.assets) {
      console.log('TradeDetailScreen: User selected', result.assets.length, 'images');
      const newImages = result.assets.map((asset) => asset.uri);
      setUploadImages([...uploadImages, ...newImages].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    console.log('TradeDetailScreen: User tapped take photo for upload');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      console.log('TradeDetailScreen: User took a photo');
      setUploadImages([...uploadImages, result.assets[0].uri].slice(0, 5));
    }
  };

  const removeUploadImage = (index: number) => {
    console.log('TradeDetailScreen: User removed upload image at index:', index);
    setUploadImages(uploadImages.filter((_, i) => i !== index));
  };

  const handleUploadCoinOffer = async () => {
    console.log('TradeDetailScreen: User submitting uploaded coin offer');

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
      const formData = new FormData();

      // Add images
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

      // Add coin data
      formData.append('title', uploadTitle.trim());
      formData.append('country', uploadCountry.trim());
      formData.append('year', uploadYear.trim());
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim());
      }
      if (offerMessage.trim()) {
        formData.append('message', offerMessage.trim());
      }

      console.log('TradeDetailScreen: Uploading temporary coin for trade');
      const response = await authenticatedFetch(`/api/trades/${id}/offers/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TradeDetailScreen: Failed to upload coin offer:', errorText);
        throw new Error('Failed to upload coin offer');
      }

      console.log('TradeDetailScreen: Coin offer uploaded successfully');
      Alert.alert('Success', 'Your coin offer has been sent!');
      
      // Reset form
      setUploadImages([]);
      setUploadTitle('');
      setUploadCountry('');
      setUploadYear('');
      setUploadDescription('');
      setOfferMessage('');
      setShowUploadCoin(false);
      
      await fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error uploading coin offer:', error);
      Alert.alert('Error', 'Failed to upload coin offer. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) {
      console.log('TradeDetailScreen: Cannot send message - empty or already sending');
      return;
    }

    console.log('TradeDetailScreen: User sending message:', message);
    setSending(true);

    try {
      const response = await authenticatedFetch(`/api/trades/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TradeDetailScreen: Failed to send message, status:', response.status, 'error:', errorText);
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      console.log('TradeDetailScreen: Message sent successfully, response:', result);
      setMessage('');
      await fetchTradeDetail();
      
      // Scroll to bottom after sending message
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('TradeDetailScreen: Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleOfferCoin = async (coinId: string) => {
    console.log('TradeDetailScreen: User offering coin:', coinId, 'with message:', offerMessage);
    setShowCoinPicker(false);

    try {
      const response = await authenticatedFetch(`/api/trades/${id}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          coinId,
          message: offerMessage.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TradeDetailScreen: Failed to create offer:', errorData);
        throw new Error(errorData.message || 'Failed to send offer');
      }

      console.log('TradeDetailScreen: Offer created successfully');
      Alert.alert('Success', 'Your coin offer has been sent!');
      setOfferMessage('');
      await fetchTradeDetail();
    } catch (error: any) {
      console.error('TradeDetailScreen: Error creating offer:', error);
      Alert.alert('Error', error.message || 'Failed to send offer');
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    console.log('TradeDetailScreen: User accepting offer:', offerId);

    Alert.alert(
      'Accept Offer',
      'Are you sure you want to accept this offer? This will start the shipping process.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const response = await authenticatedFetch(`/api/trades/${id}/offers/${offerId}/accept`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });

              if (!response.ok) {
                throw new Error('Failed to accept offer');
              }

              console.log('TradeDetailScreen: Offer accepted successfully');
              Alert.alert('Success', 'Offer accepted! You can now proceed with shipping.');
              setShowCoinDetail(false);
              await fetchTradeDetail();
            } catch (error) {
              console.error('TradeDetailScreen: Error accepting offer:', error);
              Alert.alert('Error', 'Failed to accept offer');
            }
          },
        },
      ]
    );
  };

  const handleRejectOffer = async (offerId: string) => {
    console.log('TradeDetailScreen: User rejecting offer:', offerId);

    Alert.alert(
      'Reject Offer',
      'Are you sure you want to reject this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await authenticatedFetch(`/api/trades/${id}/offers/${offerId}/reject`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });

              if (!response.ok) {
                throw new Error('Failed to reject offer');
              }

              console.log('TradeDetailScreen: Offer rejected successfully');
              Alert.alert('Success', 'Offer rejected.');
              setShowCoinDetail(false);
              await fetchTradeDetail();
            } catch (error) {
              console.error('TradeDetailScreen: Error rejecting offer:', error);
              Alert.alert('Error', 'Failed to reject offer');
            }
          },
        },
      ]
    );
  };

  const handleCounterOffer = () => {
    console.log('TradeDetailScreen: User initiating counter offer');
    setShowCoinDetail(false);
    handleOpenCoinPicker();
  };

  const handleCancelTrade = async () => {
    console.log('TradeDetailScreen: User tapped Cancel Trade button');

    Alert.alert(
      'Cancel Trade',
      'Are you sure you want to cancel this trade?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('TradeDetailScreen: Sending cancel trade request to backend');
              const response = await authenticatedFetch(`/api/trades/${id}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('TradeDetailScreen: Cancel trade failed:', errorData);
                throw new Error(errorData.message || 'Failed to cancel trade');
              }

              console.log('TradeDetailScreen: Trade canceled successfully');
              Alert.alert('Success', 'Trade canceled.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              console.error('TradeDetailScreen: Error canceling trade:', error);
              Alert.alert('Error', error.message || 'Failed to cancel trade');
            }
          },
        },
      ]
    );
  };

  const handleMarkShipped = async () => {
    console.log('TradeDetailScreen: User marking coin as shipped with tracking:', trackingNumber);

    try {
      const response = await authenticatedFetch(`/api/trades/${id}/shipping/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipped: true,
          trackingNumber: trackingNumber.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update shipping');
      }

      console.log('TradeDetailScreen: Shipping updated successfully');
      Alert.alert('Success', 'Marked as shipped!');
      setTrackingNumber('');
      await fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error updating shipping:', error);
      Alert.alert('Error', 'Failed to update shipping status');
    }
  };

  const handleMarkReceived = async () => {
    console.log('TradeDetailScreen: User marking coin as received');

    Alert.alert(
      'Confirm Receipt',
      'Have you received the coin in good condition?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Received',
          onPress: async () => {
            try {
              const response = await authenticatedFetch(`/api/trades/${id}/shipping/received`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });

              if (!response.ok) {
                throw new Error('Failed to update received status');
              }

              const data = await response.json();
              console.log('TradeDetailScreen: Received status updated successfully');
              
              if (data?.tradeCompleted) {
                Alert.alert('Trade Completed!', 'Both parties have received their coins. Please rate your trading experience.', [
                  { text: 'Rate Now', onPress: () => setShowRatingModal(true) },
                  { text: 'Later', style: 'cancel' },
                ]);
              } else {
                Alert.alert('Success', 'Marked as received! Waiting for the other party to confirm receipt.');
              }
              
              await fetchTradeDetail();
            } catch (error) {
              console.error('TradeDetailScreen: Error updating received status:', error);
              Alert.alert('Error', 'Failed to update received status');
            }
          },
        },
      ]
    );
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    console.log('TradeDetailScreen: User submitting rating:', rating);

    try {
      const response = await authenticatedFetch(`/api/trades/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      console.log('TradeDetailScreen: Rating submitted successfully');
      Alert.alert('Success', 'Thank you for rating this trade!');
      setShowRatingModal(false);
      setRating(0);
      await fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating');
    }
  };

  const handleReportUser = () => {
    console.log('TradeDetailScreen: User initiating report');
    
    if (!trade) return;

    const reportedUserId = trade.initiator.id === user?.id 
      ? trade.coinOwner.id 
      : trade.initiator.id;

    Alert.prompt(
      'Report Trade Violation',
      'Please describe the issue with this trade:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Report',
          onPress: async (description) => {
            if (!description?.trim()) {
              Alert.alert('Error', 'Please provide a description');
              return;
            }

            try {
              const response = await authenticatedFetch(`/api/trades/${id}/report`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  reportedUserId,
                  reason: 'Trade Violation',
                  description: description.trim(),
                }),
              });

              if (!response.ok) {
                throw new Error('Failed to submit report');
              }

              console.log('TradeDetailScreen: Report submitted successfully');
              Alert.alert('Success', 'Report submitted. Our moderation team will review it.');
            } catch (error) {
              console.error('TradeDetailScreen: Error submitting report:', error);
              Alert.alert('Error', 'Failed to submit report');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      case 'cancelled':
        return '#9E9E9E';
      case 'countered':
        return '#9C27B0';
      default:
        return colors.primary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getMessageText = (msg: TradeMessage): string => {
    // Handle both 'message' and 'content' field names
    return msg.message || msg.content || '';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Trade Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trade...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !trade) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Trade Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>{error || 'Trade not found'}</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInitiator = trade.initiator.id === user?.id;
  const otherUser = isInitiator ? trade.coinOwner : trade.initiator;
  const canAcceptOffer = !isInitiator && trade.status === 'pending';
  
  // Handle shipping info based on user role - with null safety
  const myShipped = isInitiator ? (trade.shipping?.initiatorShipped || false) : (trade.shipping?.ownerShipped || false);
  const myTrackingNumber = isInitiator ? trade.shipping?.initiatorTrackingNumber : trade.shipping?.ownerTrackingNumber;
  const myShippedAt = isInitiator ? trade.shipping?.initiatorShippedAt : trade.shipping?.ownerShippedAt;
  const myReceived = isInitiator ? (trade.shipping?.initiatorReceived || false) : (trade.shipping?.ownerReceived || false);
  const myReceivedAt = isInitiator ? trade.shipping?.initiatorReceivedAt : trade.shipping?.initiatorReceivedAt;
  
  const theirShipped = isInitiator ? (trade.shipping?.ownerShipped || false) : (trade.shipping?.initiatorShipped || false);
  const theirTrackingNumber = isInitiator ? trade.shipping?.ownerTrackingNumber : trade.shipping?.initiatorTrackingNumber;
  const theirShippedAt = isInitiator ? trade.shipping?.ownerShippedAt : trade.shipping?.initiatorShippedAt;
  const theirReceived = isInitiator ? (trade.shipping?.ownerReceived || false) : (trade.shipping?.initiatorReceived || false);
  const theirReceivedAt = isInitiator ? trade.shipping?.ownerReceivedAt : trade.shipping?.initiatorReceivedAt;
  
  const bothShipped = myShipped && theirShipped;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Trade with @${otherUser.username}`,
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Status Section */}
          <View style={styles.section}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(trade.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
              </Text>
            </View>

            {/* Cancel button - available for pending and accepted trades */}
            {(trade.status === 'pending' || trade.status === 'accepted' || trade.status === 'countered') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { marginTop: 12 }]}
                onPress={handleCancelTrade}
              >
                <Text style={styles.buttonText}>Cancel Trade</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Up for Trade Coin */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coin Up for Trade</Text>
            <Text style={styles.sectionSubtitle}>
              This is the coin that @{trade.coinOwner.username} wants to trade
            </Text>
            <TouchableOpacity 
              style={styles.coinCard}
              onPress={() => handleViewCoinDetail(trade.coin)}
              activeOpacity={0.7}
            >
              {trade.coin.images && trade.coin.images.length > 0 && trade.coin.images[0]?.url ? (
                <Image
                  source={{ uri: trade.coin.images[0].url }}
                  style={styles.coinImage}
                  resizeMode="cover"
                  onError={(e) => {
                    console.error('TradeDetailScreen: Error loading coin image:', e.nativeEvent.error);
                  }}
                />
              ) : (
                <View style={[styles.coinImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <IconSymbol
                    ios_icon_name="photo"
                    android_material_icon_name="image"
                    size={32}
                    color={colors.textSecondary}
                  />
                </View>
              )}
              <View style={styles.coinInfo}>
                <Text style={styles.coinTitle}>{trade.coin.title}</Text>
                <View style={styles.coinDetailsRow}>
                  <Text style={styles.coinDetails}>{trade.coin.country}</Text>
                  <Text style={styles.coinDetailsSeparator}>•</Text>
                  <Text style={styles.coinDetails}>{trade.coin.year}</Text>
                </View>
                <Text style={styles.coinOwnerText}>Owner: @{trade.coinOwner.username}</Text>
                <Text style={[styles.coinDetails, { color: colors.primary, marginTop: 4 }]}>
                  Tap to view full details
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Offered Coins */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coins Offered in Exchange</Text>
            <Text style={styles.sectionSubtitle}>
              {trade.offers.length === 0 
                ? 'No coins have been offered yet. Make an offer below!'
                : 'Tap on any coin to view details and respond'}
            </Text>
            {trade.offers.length === 0 ? (
              <View style={styles.emptyOffersContainer}>
                <IconSymbol
                  ios_icon_name="arrow.down.circle"
                  android_material_icon_name="arrow-downward"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyOffersText}>
                  Use the buttons below to offer a coin for trade
                </Text>
              </View>
            ) : (
              trade.offers.map((offer) => {
                // Get the coin from either 'coin' or 'offeredCoin' property
                const offerCoin = offer.coin || offer.offeredCoin;
                // Get the user from either 'offeredBy' or 'offerer' property
                const offerUser = offer.offeredBy || offer.offerer;

                // Skip rendering if no coin data (pending offer)
                if (!offerCoin || !offerUser) {
                  console.log('TradeDetailScreen: Skipping offer with no coin data:', offer.id);
                  return null;
                }

                const isMyOffer = offerUser.id === user?.id;
                const canRespond = !isMyOffer && canAcceptOffer && offer.status === 'pending';

                return (
                  <View key={offer.id} style={styles.offerCard}>
                    <View style={styles.offerHeader}>
                      <View style={styles.offerUserContainer}>
                        <Text style={styles.offerUser}>
                          @{offerUser.username}
                        </Text>
                        {isMyOffer && (
                          <View style={[styles.offerBadge, { backgroundColor: colors.primary, marginLeft: 8 }]}>
                            <Text style={styles.offerBadgeText}>Your Offer</Text>
                          </View>
                        )}
                      </View>
                      {offer.isCounterOffer && (
                        <View style={[styles.offerBadge, { backgroundColor: '#9C27B0' }]}>
                          <Text style={styles.offerBadgeText}>Counter Offer</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity 
                      style={[styles.coinCard, { marginBottom: 0 }]}
                      onPress={() => handleViewCoinDetail(offerCoin, offer)}
                      activeOpacity={0.7}
                    >
                      {offerCoin.images && offerCoin.images.length > 0 && offerCoin.images[0]?.url ? (
                        <Image
                          source={{ uri: offerCoin.images[0].url }}
                          style={styles.coinImage}
                          resizeMode="cover"
                          onError={(e) => {
                            console.error('TradeDetailScreen: Error loading offer coin image:', e.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <View style={[styles.coinImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                          <IconSymbol
                            ios_icon_name="photo"
                            android_material_icon_name="image"
                            size={32}
                            color={colors.textSecondary}
                          />
                        </View>
                      )}
                      <View style={styles.coinInfo}>
                        <Text style={styles.coinTitle}>{offerCoin.title}</Text>
                        <View style={styles.coinDetailsRow}>
                          <Text style={styles.coinDetails}>{offerCoin.country}</Text>
                          <Text style={styles.coinDetailsSeparator}>•</Text>
                          <Text style={styles.coinDetails}>{offerCoin.year}</Text>
                        </View>
                        {canRespond && (
                          <Text style={[styles.coinDetails, { color: '#4CAF50', marginTop: 4, fontWeight: '600' }]}>
                            👆 Tap to Accept, Reject, or Counter
                          </Text>
                        )}
                        {!canRespond && (
                          <Text style={[styles.coinDetails, { color: colors.primary, marginTop: 4 }]}>
                            Tap to view full details
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {offer.message && (
                      <View style={styles.offerMessageContainer}>
                        <Text style={styles.offerMessageLabel}>Message:</Text>
                        <Text style={styles.offerMessage}>{offer.message}</Text>
                      </View>
                    )}
                    {offer.status === 'accepted' && (
                      <View style={[styles.offerBadge, { backgroundColor: '#4CAF50', marginTop: 8, alignSelf: 'flex-start' }]}>
                        <Text style={styles.offerBadgeText}>✓ Accepted</Text>
                      </View>
                    )}
                    {offer.status === 'rejected' && (
                      <View style={[styles.offerBadge, { backgroundColor: '#F44336', marginTop: 8, alignSelf: 'flex-start' }]}>
                        <Text style={styles.offerBadgeText}>✗ Rejected</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            {(trade.status === 'pending' || trade.status === 'countered') && (
              <View style={styles.offerButtonsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton, { flex: 1, marginTop: 12, marginRight: 8 }]}
                  onPress={handleOpenCoinPicker}
                >
                  <IconSymbol
                    ios_icon_name="list.bullet"
                    android_material_icon_name="list"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.buttonText}>Select from My Coins</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, { flex: 1, marginTop: 12 }]}
                  onPress={() => setShowUploadCoin(true)}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle"
                    android_material_icon_name="add-circle"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.buttonText}>Upload New Coin</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Shipping Section */}
          {trade.status === 'accepted' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping</Text>
              
              {/* My Shipping */}
              <View style={styles.shippingCard}>
                <Text style={styles.shippingHeader}>Your Shipment</Text>
                {myShipped ? (
                  <>
                    <View style={styles.shippingRow}>
                      <Text style={styles.shippingLabel}>Status:</Text>
                      <Text style={styles.shippingValue}>Shipped ✓</Text>
                    </View>
                    {myTrackingNumber && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Tracking:</Text>
                        <Text style={styles.shippingValue}>
                          {myTrackingNumber}
                        </Text>
                      </View>
                    )}
                    {myShippedAt && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Shipped:</Text>
                        <Text style={styles.shippingValue}>
                          {formatDate(myShippedAt)}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <TextInput
                      style={styles.trackingInput}
                      placeholder="Tracking number (optional)"
                      placeholderTextColor={colors.textSecondary}
                      value={trackingNumber}
                      onChangeText={setTrackingNumber}
                    />
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryButton]}
                      onPress={handleMarkShipped}
                    >
                      <Text style={styles.buttonText}>Mark as Shipped</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Their Shipping */}
              <View style={styles.shippingCard}>
                <Text style={styles.shippingHeader}>
                  {otherUser.displayName}&apos;s Shipment
                </Text>
                {theirShipped ? (
                  <>
                    <View style={styles.shippingRow}>
                      <Text style={styles.shippingLabel}>Status:</Text>
                      <Text style={styles.shippingValue}>
                        {theirReceived ? 'Received ✓' : 'Shipped ✓'}
                      </Text>
                    </View>
                    {theirTrackingNumber && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Tracking:</Text>
                        <Text style={styles.shippingValue}>
                          {theirTrackingNumber}
                        </Text>
                      </View>
                    )}
                    {theirShippedAt && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Shipped:</Text>
                        <Text style={styles.shippingValue}>
                          {formatDate(theirShippedAt)}
                        </Text>
                      </View>
                    )}
                    {!myReceived && bothShipped && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton, { marginTop: 8 }]}
                        onPress={handleMarkReceived}
                      >
                        <Text style={styles.buttonText}>Mark as Received</Text>
                      </TouchableOpacity>
                    )}
                    {theirReceivedAt && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Received:</Text>
                        <Text style={styles.shippingValue}>
                          {formatDate(theirReceivedAt)}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyText}>Not shipped yet</Text>
                )}
              </View>
            </View>
          )}

          {/* Messages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Messages</Text>
            {!trade.messages || trade.messages.length === 0 ? (
              <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
            ) : (
              trade.messages.map((msg) => (
                <View key={msg.id} style={styles.messageContainer}>
                  <View style={styles.messageHeader}>
                    {msg.sender.avatarUrl ? (
                      <Image
                        source={{ uri: msg.sender.avatarUrl }}
                        style={styles.messageAvatar}
                      />
                    ) : (
                      <View style={[styles.messageAvatar, { backgroundColor: colors.border }]}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </View>
                    )}
                    <Text style={styles.messageSender}>
                      {msg.sender.displayName}
                    </Text>
                    <Text style={styles.messageTime}>
                      {formatDate(msg.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.messageBubble}>
                    <Text style={styles.messageText}>{getMessageText(msg)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Report Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={handleReportUser}
            >
              <IconSymbol
                ios_icon_name="exclamationmark.triangle"
                android_material_icon_name="warning"
                size={20}
                color={colors.background}
              />
              <Text style={styles.reportButtonText}>Report Trade Violation</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send"
                size={20}
                color={colors.background}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Coin Detail Modal - IMPROVED POSITIONING AND HEIGHT */}
      <Modal
        visible={showCoinDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCoinDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: SCREEN_HEIGHT * 0.85, marginTop: SCREEN_HEIGHT * 0.15 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coin Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCoinDetail(false)}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            {selectedCoin && (
              <ScrollView style={styles.coinDetailScroll}>
                {selectedCoin.images && selectedCoin.images.length > 0 && (
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    {selectedCoin.images.map((img, index) => (
                      <Image
                        key={index}
                        source={{ uri: img.url }}
                        style={styles.coinDetailImage}
                        resizeMode="contain"
                      />
                    ))}
                  </ScrollView>
                )}
                <View style={styles.coinDetailInfo}>
                  <Text style={styles.coinDetailTitle}>{selectedCoin.title}</Text>
                  <View style={styles.coinDetailRow}>
                    <Text style={styles.coinDetailLabel}>Country:</Text>
                    <Text style={styles.coinDetailValue}>{selectedCoin.country}</Text>
                  </View>
                  <View style={styles.coinDetailRow}>
                    <Text style={styles.coinDetailLabel}>Year:</Text>
                    <Text style={styles.coinDetailValue}>{selectedCoin.year}</Text>
                  </View>
                  {selectedCoin.condition && (
                    <View style={styles.coinDetailRow}>
                      <Text style={styles.coinDetailLabel}>Condition:</Text>
                      <Text style={styles.coinDetailValue}>{selectedCoin.condition}</Text>
                    </View>
                  )}
                  {selectedCoin.description && (
                    <View style={styles.coinDetailSection}>
                      <Text style={styles.coinDetailLabel}>Description:</Text>
                      <Text style={styles.coinDetailDescription}>{selectedCoin.description}</Text>
                    </View>
                  )}

                  {/* Action buttons for offered coins */}
                  {selectedOffer && canAcceptOffer && selectedOffer.status === 'pending' && (
                    <View style={styles.coinDetailActions}>
                      <Text style={styles.actionPromptText}>What would you like to do?</Text>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton, { marginBottom: 8 }]}
                        onPress={() => handleAcceptOffer(selectedOffer.id)}
                      >
                        <IconSymbol
                          ios_icon_name="checkmark.circle.fill"
                          android_material_icon_name="check-circle"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.buttonText}>Accept This Offer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.dangerButton, { marginBottom: 8 }]}
                        onPress={() => handleRejectOffer(selectedOffer.id)}
                      >
                        <IconSymbol
                          ios_icon_name="xmark.circle.fill"
                          android_material_icon_name="cancel"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.buttonText}>Reject This Offer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={handleCounterOffer}
                      >
                        <IconSymbol
                          ios_icon_name="arrow.triangle.2.circlepath"
                          android_material_icon_name="sync"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.buttonText}>Make Counter Offer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
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
                style={styles.trackingInput}
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
                        style={styles.coinImage}
                        resizeMode="cover"
                        onError={(e) => {
                          console.error('TradeDetailScreen: Error loading coin picker image:', e.nativeEvent.error);
                        }}
                      />
                    ) : (
                      <View style={[styles.coinImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol
                          ios_icon_name="photo"
                          android_material_icon_name="image"
                          size={32}
                          color={colors.textSecondary}
                        />
                      </View>
                    )}
                    <View style={styles.coinInfo}>
                      <Text style={styles.coinTitle}>{item.title}</Text>
                      <Text style={styles.coinDetails}>
                        {item.country} • {item.year}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20 }}>
                    <Text style={styles.emptyText}>
                      You don&apos;t have any coins to offer yet
                    </Text>
                  </View>
                }
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
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
                  style={[styles.actionButton, styles.primaryButton, { marginTop: 16 }]}
                  onPress={handleUploadCoinOffer}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.buttonText}>Submit Offer</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate This Trade</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowRatingModal(false);
                  setRating(0);
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
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>How was your trading experience?</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <IconSymbol
                      ios_icon_name={star <= rating ? 'star.fill' : 'star'}
                      android_material_icon_name={star <= rating ? 'star' : 'star-border'}
                      size={48}
                      color={star <= rating ? '#FFD700' : colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton, { marginTop: 24 }]}
                onPress={handleSubmitRating}
                disabled={rating === 0}
              >
                <Text style={styles.buttonText}>Submit Rating</Text>
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  coinCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  coinImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  coinInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  coinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  coinDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  coinDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  coinDetailsSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 6,
  },
  coinOwnerText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.textSecondary,
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  offerButtonsContainer: {
    flexDirection: 'row',
  },
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerUser: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  offerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  offerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
  },
  offerMessageContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  offerMessageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  offerMessage: {
    fontSize: 14,
    color: colors.text,
    fontStyle: 'italic',
  },
  emptyOffersContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyOffersText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  messageTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  messageBubble: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginLeft: 40,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shippingCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  shippingHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  shippingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shippingLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  shippingValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  trackingInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalMessageInput: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coinListItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F44336',
    marginTop: 8,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
    marginLeft: 8,
  },
  ratingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  starButton: {
    padding: 4,
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
  coinDetailScroll: {
    flex: 1,
  },
  coinDetailImage: {
    width: Dimensions.get('window').width,
    height: 300,
    backgroundColor: colors.border,
  },
  coinDetailInfo: {
    padding: 16,
  },
  coinDetailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  coinDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  coinDetailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  coinDetailValue: {
    fontSize: 16,
    color: colors.text,
  },
  coinDetailSection: {
    marginTop: 16,
  },
  coinDetailDescription: {
    fontSize: 14,
    color: colors.text,
    marginTop: 8,
    lineHeight: 20,
  },
  coinDetailActions: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionPromptText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
});
