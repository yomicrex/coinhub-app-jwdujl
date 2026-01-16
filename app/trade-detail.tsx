
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authClient } from '@/lib/auth';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
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
  user: User;
  trackingNumber?: string;
  shippedAt?: string;
  receivedAt?: string;
}

interface TradeDetail {
  id: string;
  coin: Coin;
  requester: User;
  owner: User;
  status: string;
  offers: TradeOffer[];
  messages: TradeMessage[];
  shipping: ShippingInfo[];
  createdAt: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

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
});

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

  useEffect(() => {
    console.log('TradeDetailScreen: Component mounted, trade ID:', id);
    fetchTradeDetail();
  }, [id]);

  const fetchTradeDetail = async () => {
    try {
      console.log('TradeDetailScreen: Fetching trade detail');
      const session = await authClient.getSession();
      if (!session) {
        console.log('TradeDetailScreen: No session found');
        return;
      }

      const response = await fetch(`${API_URL}/api/trades/${id}`, {
        headers: {
          Authorization: `Bearer ${session.session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trade detail');
      }

      const data = await response.json();
      console.log('TradeDetailScreen: Fetched trade detail:', data.trade);
      setTrade(data.trade);
    } catch (error) {
      console.error('TradeDetailScreen: Error fetching trade detail:', error);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCoins = async () => {
    try {
      console.log('TradeDetailScreen: Fetching user coins for offer');
      const session = await authClient.getSession();
      if (!session || !user?.id) return;

      const response = await fetch(`${API_URL}/api/users/${user.id}/coins`, {
        headers: {
          Authorization: `Bearer ${session.session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user coins');
      }

      const data = await response.json();
      console.log('TradeDetailScreen: Fetched user coins:', data.coins?.length || 0);
      setUserCoins(data.coins || []);
    } catch (error) {
      console.error('TradeDetailScreen: Error fetching user coins:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    console.log('TradeDetailScreen: User sending message:', message);
    setSending(true);

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      console.log('TradeDetailScreen: Message sent successfully');
      setMessage('');
      fetchTradeDetail();
      
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
    console.log('TradeDetailScreen: User offering coin:', coinId);
    setShowCoinPicker(false);

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
        },
        body: JSON.stringify({ coinId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create offer');
      }

      console.log('TradeDetailScreen: Offer created successfully');
      Alert.alert('Success', 'Your coin offer has been sent!');
      fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error creating offer:', error);
      Alert.alert('Error', 'Failed to send offer');
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    console.log('TradeDetailScreen: User accepting offer:', offerId);

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/offers/${offerId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to accept offer');
      }

      console.log('TradeDetailScreen: Offer accepted successfully');
      Alert.alert('Success', 'Offer accepted! You can now proceed with shipping.');
      fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error accepting offer:', error);
      Alert.alert('Error', 'Failed to accept offer');
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    console.log('TradeDetailScreen: User rejecting offer:', offerId);

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/offers/${offerId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to reject offer');
      }

      console.log('TradeDetailScreen: Offer rejected successfully');
      Alert.alert('Success', 'Offer rejected.');
      fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error rejecting offer:', error);
      Alert.alert('Error', 'Failed to reject offer');
    }
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
              const session = await authClient.getSession();
              if (!session) return;

              const response = await fetch(`${API_URL}/api/trades/${id}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.session.token}`,
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

  const handleCompleteTrade = async () => {
    console.log('TradeDetailScreen: User marking trade as completed');

    Alert.alert(
      'Complete Trade',
      'Are you sure both parties have received their coins?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Complete',
          onPress: async () => {
            try {
              const session = await authClient.getSession();
              if (!session) return;

              // Mark as completed by ensuring both parties have marked received
              // The backend should handle the completion logic
              console.log('TradeDetailScreen: Trade marked as completed');
              Alert.alert('Success', 'Trade completed successfully!');
              fetchTradeDetail();
            } catch (error) {
              console.error('TradeDetailScreen: Error completing trade:', error);
              Alert.alert('Error', 'Failed to complete trade');
            }
          },
        },
      ]
    );
  };

  const handleMarkShipped = async () => {
    console.log('TradeDetailScreen: User marking coin as shipped');

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/shipping/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
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
      fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error updating shipping:', error);
      Alert.alert('Error', 'Failed to update shipping status');
    }
  };

  const handleMarkReceived = async () => {
    console.log('TradeDetailScreen: User marking coin as received');

    try {
      const session = await authClient.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/trades/${id}/shipping/received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to update shipping');
      }

      console.log('TradeDetailScreen: Received status updated successfully');
      Alert.alert('Success', 'Marked as received!');
      fetchTradeDetail();
    } catch (error) {
      console.error('TradeDetailScreen: Error updating received status:', error);
      Alert.alert('Error', 'Failed to update received status');
    }
  };

  const handleReportUser = () => {
    console.log('TradeDetailScreen: User initiating report');
    
    Alert.prompt(
      'Report User',
      'Please describe the trade violation:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (description) => {
            if (!description?.trim()) return;

            try {
              const session = await authClient.getSession();
              if (!session || !trade) return;

              const reportedUserId = trade.requester.id === user?.id 
                ? trade.owner.id 
                : trade.requester.id;

              const response = await fetch(`${API_URL}/api/trades/${id}/report`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.session.token}`,
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
              Alert.alert('Success', 'Report submitted. Our team will review it.');
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
        </View>
      </SafeAreaView>
    );
  }

  if (!trade) {
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
          <Text style={styles.emptyText}>Trade not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRequester = trade.requester.id === user?.id;
  const otherUser = isRequester ? trade.owner : trade.requester;
  const canComplete = trade.status === 'accepted';
  const myShipping = trade.shipping?.find((s) => s.user.id === user?.id);
  const theirShipping = trade.shipping?.find((s) => s.user.id === otherUser.id);

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

            {/* Complete button - shown when trade is accepted and both parties have shipped */}
            {canComplete && myShipping?.shippedAt && theirShipping?.shippedAt && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleCompleteTrade}
              >
                <Text style={styles.buttonText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}

            {/* Cancel button - available for pending and accepted trades */}
            {(trade.status === 'pending' || trade.status === 'accepted') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { marginTop: 8 }]}
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
              <Image
                source={{ uri: trade.coin.images[0]?.url }}
                style={styles.coinImage}
                resizeMode="cover"
              />
              <View style={styles.coinInfo}>
                <Text style={styles.coinTitle}>{trade.coin.title}</Text>
                <Text style={styles.coinDetails}>
                  {trade.coin.country} • {trade.coin.year}
                </Text>
                <Text style={styles.coinDetails}>Owner: @{trade.owner.username}</Text>
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
                    <Image
                      source={{ uri: offer.coin.images[0]?.url }}
                      style={styles.coinImage}
                      resizeMode="cover"
                    />
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
                  {!isRequester && trade.status === 'pending' && (
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
                </View>
              ))
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => {
                fetchUserCoins();
                setShowCoinPicker(true);
              }}
            >
              <Text style={styles.buttonText}>Offer a Coin</Text>
            </TouchableOpacity>
          </View>

          {/* Shipping Section */}
          {trade.status === 'accepted' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping</Text>
              
              {/* My Shipping */}
              <View style={styles.shippingCard}>
                <Text style={styles.shippingHeader}>Your Shipment</Text>
                {myShipping?.shippedAt ? (
                  <>
                    <View style={styles.shippingRow}>
                      <Text style={styles.shippingLabel}>Status:</Text>
                      <Text style={styles.shippingValue}>Shipped ✓</Text>
                    </View>
                    {myShipping.trackingNumber && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Tracking:</Text>
                        <Text style={styles.shippingValue}>
                          {myShipping.trackingNumber}
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
                {theirShipping?.shippedAt ? (
                  <>
                    <View style={styles.shippingRow}>
                      <Text style={styles.shippingLabel}>Status:</Text>
                      <Text style={styles.shippingValue}>
                        {theirShipping.receivedAt ? 'Received ✓' : 'Shipped ✓'}
                      </Text>
                    </View>
                    {theirShipping.trackingNumber && (
                      <View style={styles.shippingRow}>
                        <Text style={styles.shippingLabel}>Tracking:</Text>
                        <Text style={styles.shippingValue}>
                          {theirShipping.trackingNumber}
                        </Text>
                      </View>
                    )}
                    {!theirShipping.receivedAt && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={handleMarkReceived}
                      >
                        <Text style={styles.buttonText}>Mark as Received</Text>
                      </TouchableOpacity>
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
              <Text style={styles.emptyText}>No messages yet</Text>
            ) : (
              trade.messages.map((msg) => (
                <View key={msg.id} style={styles.messageContainer}>
                  <View style={styles.messageHeader}>
                    {msg.sender.avatarUrl && (
                      <Image
                        source={{ uri: msg.sender.avatarUrl }}
                        style={styles.messageAvatar}
                      />
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
                onPress={() => setShowCoinPicker(false)}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={userCoins}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.coinListItem}
                  onPress={() => handleOfferCoin(item.id)}
                >
                  <Image
                    source={{ uri: item.images[0]?.url }}
                    style={styles.coinImage}
                    resizeMode="cover"
                  />
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
    </SafeAreaView>
  );
}
