
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  images: Array<{ url: string }>;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface TradeOffer {
  id: string;
  coin: Coin;
  offeredBy: User;
  message?: string;
  isCounterOffer: boolean;
  status: string;
  createdAt: string;
}

interface TradeMessage {
  id: string;
  sender: User;
  message: string;
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
  const [userCoins, setUserCoins] = useState<Coin[]>([]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);

  useEffect(() => {
    console.log('TradeDetailScreen: Component mounted, trade ID:', id);
    if (id) {
      fetchTradeDetail();
    } else {
      console.error('TradeDetailScreen: No trade ID provided in URL params');
      setError('No trade ID provided');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTradeDetail = async () => {
    if (!id) {
      console.error('TradeDetailScreen: Cannot fetch trade - no ID');
      return;
    }

    try {
      console.log('TradeDetailScreen: Fetching trade detail for ID:', id);
      const response = await fetch(`${API_URL}/api/trades/${id}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error('TradeDetailScreen: Failed to fetch trade, status:', response.status);
        throw new Error('Failed to load trade');
      }

      const data = await response.json();
      console.log('TradeDetailScreen: Fetched trade detail response:', data);
      
      if (!data) {
        console.error('TradeDetailScreen: No trade data in response');
        setError('Trade not found');
        setLoading(false);
        return;
      }

      console.log('TradeDetailScreen: Trade data loaded successfully, status:', data.status);
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
        return;
      }

      const response = await fetch(`${API_URL}/api/users/${user.id}/coins`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch coins');
      }

      const data = await response.json();
      const coinsData = data?.coins || data || [];
      console.log('TradeDetailScreen: Fetched', coinsData.length, 'user coins');
      setUserCoins(coinsData);
    } catch (error) {
      console.error('TradeDetailScreen: Error fetching user coins:', error);
      Alert.alert('Error', 'Failed to load your coins');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    console.log('TradeDetailScreen: User sending message:', message);
    setSending(true);

    try {
      const response = await fetch(`${API_URL}/api/trades/${id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      console.log('TradeDetailScreen: Message sent successfully');
      setMessage('');
      await fetchTradeDetail();
      
      // Scroll to bottom after sending message
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('TradeDetailScreen: Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleOfferCoin = async (coinId: string) => {
    console.log('TradeDetailScreen: User offering coin:', coinId, 'with message:', offerMessage);
    setShowCoinPicker(false);

    try {
      const response = await fetch(`${API_URL}/api/trades/${id}/offers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          coinId,
          message: offerMessage.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send offer');
      }

      console.log('TradeDetailScreen: Offer created successfully');
      Alert.alert('Success', 'Your coin offer has been sent!');
      setOfferMessage('');
      await fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error creating offer:', error);
      Alert.alert('Error', 'Failed to send offer');
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
              const response = await fetch(`${API_URL}/api/trades/${id}/offers/${offerId}/accept`, {
                method: 'POST',
                credentials: 'include',
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
              const response = await fetch(`${API_URL}/api/trades/${id}/offers/${offerId}/reject`, {
                method: 'POST',
                credentials: 'include',
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

  const handleCancelTrade = async () => {
    console.log('TradeDetailScreen: User canceling trade');

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
              const response = await fetch(`${API_URL}/api/trades/${id}/cancel`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              });

              if (!response.ok) {
                throw new Error('Failed to cancel trade');
              }

              console.log('TradeDetailScreen: Trade canceled successfully');
              Alert.alert('Success', 'Trade canceled.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('TradeDetailScreen: Error canceling trade:', error);
              Alert.alert('Error', 'Failed to cancel trade');
            }
          },
        },
      ]
    );
  };

  const handleMarkShipped = async () => {
    console.log('TradeDetailScreen: User marking coin as shipped with tracking:', trackingNumber);

    try {
      const response = await fetch(`${API_URL}/api/trades/${id}/shipping/initiate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
              const response = await fetch(`${API_URL}/api/trades/${id}/shipping/received`, {
                method: 'POST',
                credentials: 'include',
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
              
              const responseData = data?.data || data;
              if (responseData?.tradeCompleted) {
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
      const response = await fetch(`${API_URL}/api/trades/${id}/rate`, {
        method: 'POST',
        credentials: 'include',
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
              const response = await fetch(`${API_URL}/api/trades/${id}/report`, {
                method: 'POST',
                credentials: 'include',
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
  const myReceivedAt = isInitiator ? trade.shipping?.initiatorReceivedAt : trade.shipping?.ownerReceivedAt;
  
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
            {(trade.status === 'pending' || trade.status === 'accepted') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { marginTop: 12 }]}
                onPress={handleCancelTrade}
              >
                <Text style={styles.buttonText}>Cancel Trade</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Requested Coin */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requested Coin</Text>
            <View style={styles.coinCard}>
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
                <Text style={styles.coinDetails}>
                  {trade.coin.country} • {trade.coin.year}
                </Text>
                <Text style={styles.coinDetails}>Owner: @{trade.coinOwner.username}</Text>
              </View>
            </View>
          </View>

          {/* Offered Coins */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Offered Coins</Text>
            {trade.offers.length === 0 ? (
              <Text style={styles.emptyText}>No coins offered yet</Text>
            ) : (
              trade.offers.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <Text style={styles.offerUser}>
                      @{offer.offeredBy.username}
                    </Text>
                    {offer.isCounterOffer && (
                      <View style={styles.offerBadge}>
                        <Text style={styles.offerBadgeText}>Counter Offer</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.coinCard}>
                    {offer.coin.images && offer.coin.images.length > 0 && offer.coin.images[0]?.url ? (
                      <Image
                        source={{ uri: offer.coin.images[0].url }}
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
                      <Text style={styles.coinTitle}>{offer.coin.title}</Text>
                      <Text style={styles.coinDetails}>
                        {offer.coin.country} • {offer.coin.year}
                      </Text>
                    </View>
                  </View>
                  {offer.message && (
                    <Text style={styles.offerMessage}>{offer.message}</Text>
                  )}
                  {/* Accept/Reject buttons for coin owner */}
                  {canAcceptOffer && offer.status === 'pending' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={() => handleAcceptOffer(offer.id)}
                      >
                        <Text style={styles.buttonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.dangerButton]}
                        onPress={() => handleRejectOffer(offer.id)}
                      >
                        <Text style={styles.buttonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {offer.status === 'accepted' && (
                    <View style={[styles.offerBadge, { backgroundColor: '#4CAF50', marginTop: 8 }]}>
                      <Text style={styles.offerBadgeText}>Accepted ✓</Text>
                    </View>
                  )}
                  {offer.status === 'rejected' && (
                    <View style={[styles.offerBadge, { backgroundColor: '#F44336', marginTop: 8 }]}>
                      <Text style={styles.offerBadgeText}>Rejected</Text>
                    </View>
                  )}
                </View>
              ))
            )}
            {trade.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton, { marginTop: 12 }]}
                onPress={() => {
                  fetchUserCoins();
                  setShowCoinPicker(true);
                }}
              >
                <Text style={styles.buttonText}>
                  {isInitiator ? 'Offer a Coin' : 'Counter Offer'}
                </Text>
              </TouchableOpacity>
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
                    {!theirReceived && bothShipped && (
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
            {trade.messages.length === 0 ? (
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
                    <Text style={styles.messageText}>{msg.message}</Text>
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

      {/* Coin Picker Modal */}
      <Modal
        visible={showCoinPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCoinPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
          </View>
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
    marginBottom: 12,
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
  coinDetails: {
    fontSize: 14,
    color: colors.textSecondary,
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
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  offerMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
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
    maxHeight: '80%',
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
});
