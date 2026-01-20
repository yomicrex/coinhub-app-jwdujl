
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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

export default function TradesScreen() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const fetchTrades = useCallback(async () => {
    console.log('TradesScreen: Fetching trades');
    try {
      const response = await fetch(`${API_URL}/api/trades`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('TradesScreen: Fetched', data.trades?.length || 0, 'trades');
        setTrades(data.trades || []);
      } else {
        console.error('TradesScreen: Failed to fetch trades, status:', response.status);
        if (response.status === 401) {
          console.log('TradesScreen: User not authenticated');
        }
      }
    } catch (error) {
      console.error('TradesScreen: Error fetching trades:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    console.log('TradesScreen: Component mounted');
    if (user) {
      fetchTrades();
    } else {
      console.log('TradesScreen: No user, skipping fetch');
      setLoading(false);
    }
  }, [user, fetchTrades]);

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

  const renderTrade = ({ item }: { item: Trade }) => {
    const isRequester = item.requester.id === user?.id;
    const otherUser = isRequester ? item.owner : item.requester;

    return (
      <TouchableOpacity
        style={styles.tradeCard}
        onPress={() => handleTradePress(item.id)}
      >
        {item.coin.images && item.coin.images.length > 0 ? (
          <Image
            source={{ uri: item.coin.images[0].url }}
            style={styles.coinImage}
          />
        ) : (
          <View style={[styles.coinImage, styles.coinImagePlaceholder]}>
            <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={24} color={colors.textSecondary} />
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
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={12} color={colors.textSecondary} />
              </View>
            )}
            <Text style={styles.username}>@{otherUser.username}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trades</Text>
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Sign in to view your trades</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => {
              console.log('TradesScreen: User tapped sign in button');
              router.push('/auth');
            }}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trades</Text>
      </View>
      <FlatList
        data={trades}
        renderItem={renderTrade}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol ios_icon_name="arrow.left.arrow.right" android_material_icon_name="swap-horiz" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No trades yet</Text>
            <Text style={styles.emptySubtext}>
              Find coins marked "Open to Trade" to start trading!
            </Text>
          </View>
        }
        contentContainerStyle={trades.length === 0 ? styles.emptyList : undefined}
      />
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
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  signInButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 24,
  },
  signInButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  tradeCard: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  coinImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  coinImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
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
    marginRight: 6,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
