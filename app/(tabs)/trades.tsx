
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';

interface Trade {
  id: string;
  coin: {
    id: string;
    title: string;
    images: { url: string }[];
  };
  requester: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  status: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export default function TradesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      console.log('TradesScreen: Fetching trades from API');
      setError(null);
      
      const response = await fetch(`${API_URL}/api/trades`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error('TradesScreen: Failed to fetch trades, status:', response.status);
        throw new Error(`Failed to fetch trades: ${response.status}`);
      }

      const data = await response.json();
      console.log('TradesScreen: Fetched trades response:', data);
      
      // Handle different response formats
      const tradesData = data?.trades || data || [];
      console.log('TradesScreen: Parsed trades data:', tradesData);
      console.log('TradesScreen: Number of trades:', tradesData.length);
      
      setTrades(tradesData);
    } catch (error: any) {
      console.error('TradesScreen: Error fetching trades:', error);
      console.error('TradesScreen: Error message:', error.message);
      setError(error.message || 'Failed to load trades');
      Alert.alert('Error', 'Failed to load trades. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    console.log('TradesScreen: Component mounted, user:', user?.username);
    fetchTrades();
  }, [fetchTrades, user?.username]);

  const onRefresh = () => {
    console.log('TradesScreen: User initiated refresh');
    setRefreshing(true);
    fetchTrades();
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

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleTradePress = (tradeId: string) => {
    console.log('TradesScreen: User tapped trade:', tradeId);
    router.push(`/trade-detail?id=${tradeId}`);
  };

  const renderTradeCard = ({ item }: { item: Trade }) => {
    if (!item || !item.coin || !item.requester || !item.owner) {
      console.error('TradesScreen: Invalid trade item:', item);
      return null;
    }

    const isRequester = item.requester.id === user?.id;
    const otherUser = isRequester ? item.owner : item.requester;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCard}
        onPress={() => handleTradePress(item.id)}
        activeOpacity={0.7}
      >
        {item.coin.images && item.coin.images.length > 0 && item.coin.images[0]?.url ? (
          <Image
            source={{ uri: item.coin.images[0].url }}
            style={styles.coinImage}
            resizeMode="cover"
            onError={(e) => {
              console.error('TradesScreen: Error loading coin image:', e.nativeEvent.error);
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
        <View style={styles.tradeContent}>
          <View style={styles.tradeHeader}>
            <Text style={styles.coinTitle} numberOfLines={1}>
              {item.coin.title}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            >
              <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>
          <Text style={styles.tradeInfo}>
            {isRequester ? 'You requested from' : 'Requested by'} {otherUser.displayName}
          </Text>
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
          <View style={styles.userInfo}>
            {otherUser.avatarUrl ? (
              <Image
                source={{ uri: otherUser.avatarUrl }}
                style={styles.avatar}
                onError={(e) => {
                  console.error('TradesScreen: Error loading avatar:', e.nativeEvent.error);
                }}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={12}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <Text style={styles.username}>@{otherUser.username}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trades</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trades...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trades</Text>
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
              fetchTrades();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trades</Text>
        <Text style={styles.headerSubtitle}>
          {trades.length} active trade{trades.length !== 1 ? 's' : ''}
        </Text>
      </View>
      {trades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="arrow.left.arrow.right"
            android_material_icon_name="swap-horiz"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            No trades yet. Find coins marked &quot;Open to Trade&quot; to start trading!
          </Text>
        </View>
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTradeCard}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
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
  tradeCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  coinImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  tradeContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  coinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
  },
  tradeInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    marginRight: 6,
  },
  username: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
