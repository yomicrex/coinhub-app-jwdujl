
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authClient } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';

interface Trade {
  id: string;
  coin: {
    id: string;
    title: string;
    images: Array<{ url: string }>;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
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
});

export default function TradesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('TradesScreen: Component mounted, fetching trades');
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      console.log('TradesScreen: Fetching trades from API');
      const session = await authClient.getSession();
      if (!session) {
        console.log('TradesScreen: No session found');
        return;
      }

      const response = await fetch(`${API_URL}/api/trades`, {
        headers: {
          Authorization: `Bearer ${session.session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trades');
      }

      const data = await response.json();
      console.log('TradesScreen: Fetched trades:', data.trades?.length || 0);
      setTrades(data.trades || []);
    } catch (error) {
      console.error('TradesScreen: Error fetching trades:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    const isRequester = item.requester.id === user?.id;
    const otherUser = isRequester ? item.owner : item.requester;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tradeCard}
        onPress={() => handleTradePress(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.coin.images[0]?.url }}
          style={styles.coinImage}
          resizeMode="cover"
        />
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
            {isRequester ? 'You requested' : 'Requested by'} {otherUser.displayName}
          </Text>
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
          <View style={styles.userInfo}>
            {otherUser.avatarUrl && (
              <Image
                source={{ uri: otherUser.avatarUrl }}
                style={styles.avatar}
              />
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trades</Text>
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
            No trades yet. Find coins marked "Open to Trade" to start trading!
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
        />
      )}
    </SafeAreaView>
  );
}
