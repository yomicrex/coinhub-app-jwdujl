
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { createAuthenticatedFetchOptions } from '@/lib/cookieManager';

interface Trade {
  id: string;
  coin: {
    id: string;
    title: string;
  };
  initiator: {
    id: string;
    username: string;
    displayName: string;
  };
  coinOwner: {
    id: string;
    username: string;
    displayName: string;
  };
  status: string;
  createdAt: string;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";

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
  header: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  tradeCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  coinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tradeInfo: {
    gap: 8,
  },
  tradeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tradeInfoLabel: {
    fontWeight: '600',
    color: colors.text,
  },
});

export default function TradesScreen() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('TradesScreen: Component mounted');
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      console.log('TradesScreen: Fetching trades');
      
      const fetchOptions = await createAuthenticatedFetchOptions({
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const response = await fetch(`${API_URL}/api/trades`, fetchOptions);
      
      if (response.ok) {
        const data = await response.json();
        console.log('TradesScreen: Fetched', data.length, 'trades');
        setTrades(data);
      }
    } catch (error) {
      console.error('TradesScreen: Error fetching trades:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('TradesScreen: Refreshing trades');
    setRefreshing(true);
    fetchTrades();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'accepted':
        return colors.success;
      case 'completed':
        return colors.info;
      case 'cancelled':
      case 'rejected':
        return colors.textSecondary;
      default:
        return colors.primary;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleTradePress = (tradeId: string) => {
    console.log('TradesScreen: Navigating to trade detail:', tradeId);
    router.push(`/trade-detail?id=${tradeId}`);
  };

  const renderTradeCard = ({ item }: { item: Trade }) => {
    const otherUser = item.initiator.id === user?.id ? item.coinOwner : item.initiator;
    
    return (
      <TouchableOpacity
        style={styles.tradeCard}
        onPress={() => handleTradePress(item.id)}
      >
        <View style={styles.tradeHeader}>
          <Text style={styles.coinTitle} numberOfLines={1}>
            {item.coin.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.tradeInfo}>
          <View style={styles.tradeInfoRow}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.tradeInfoText}>
              <Text style={styles.tradeInfoLabel}>With: </Text>
              {otherUser.displayName}
            </Text>
          </View>
          
          <View style={styles.tradeInfoRow}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.tradeInfoText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trades</Text>
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
            No trades yet.{'\n'}Start trading coins with other collectors!
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
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}
