
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { createAuthenticatedFetchOptions } from '@/lib/cookieManager';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar_url?: string;
  };
  images: Array<{ url: string; order_index?: number }>;
  like_count?: number;
  comment_count?: number;
  trade_status?: string;
  created_at?: string;
  isLiked?: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev";
const { width } = Dimensions.get('window');

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  coinCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  coinHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  imageContainer: {
    width: '100%',
    height: width - 32,
    backgroundColor: colors.border,
  },
  coinImage: {
    width: '100%',
    height: '100%',
  },
  coinInfo: {
    padding: 12,
  },
  coinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  coinDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tradeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  coinActions: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionTextActive: {
    color: colors.primary,
  },
});

export default function FeedScreen() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user);
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching coins from feed');
      
      const fetchOptions = await createAuthenticatedFetchOptions({
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const response = await fetch(`${API_URL}/api/coins/feed`, fetchOptions);
      
      console.log('FeedScreen: Feed response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('FeedScreen: Fetched', data.length, 'coins');
      
      setCoins(data);
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('FeedScreen: Refreshing feed');
    setRefreshing(true);
    fetchCoins();
  };

  const handleLike = async (coinId: string) => {
    console.log('FeedScreen: Toggling like for coin:', coinId);
    
    try {
      const coin = coins.find(c => c.id === coinId);
      const isLiked = coin?.isLiked;
      
      const fetchOptions = await createAuthenticatedFetchOptions({
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, fetchOptions);
      
      if (response.ok) {
        // Update local state
        setCoins(prevCoins =>
          prevCoins.map(c =>
            c.id === coinId
              ? {
                  ...c,
                  isLiked: !isLiked,
                  like_count: (c.like_count || 0) + (isLiked ? -1 : 1),
                }
              : c
          )
        );
      }
    } catch (error) {
      console.error('FeedScreen: Error toggling like:', error);
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: Navigating to add coin');
    router.push('/add-coin');
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('FeedScreen: Navigating to user profile:', username);
    router.push(`/user-profile?userId=${userId}&username=${username}`);
  };

  const handleCoinPress = (coinId: string) => {
    console.log('FeedScreen: Navigating to coin detail:', coinId);
    router.push(`/coin-detail?coinId=${coinId}`);
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const firstImage = item.images?.[0];
    
    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.9}
      >
        {/* User Header */}
        <TouchableOpacity
          style={styles.coinHeader}
          onPress={() => handleUserPress(item.user.id, item.user.username)}
        >
          {item.user.avatar_url ? (
            <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={24}
                color={colors.textSecondary}
              />
            </View>
          )}
          <View style={styles.coinHeaderText}>
            <Text style={styles.username}>{item.user.displayName}</Text>
            <Text style={styles.timestamp}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        {/* Coin Image */}
        {firstImage && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: firstImage.url }}
              style={styles.coinImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Coin Info */}
        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle}>{item.title}</Text>
          <Text style={styles.coinDetails}>
            {item.country} • {item.year}
          </Text>
          {item.trade_status === 'open' && (
            <View style={styles.tradeBadge}>
              <Text style={styles.tradeBadgeText}>Open to Trade</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.coinActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <IconSymbol
              ios_icon_name={item.isLiked ? "heart.fill" : "heart"}
              android_material_icon_name={item.isLiked ? "favorite" : "favorite-border"}
              size={24}
              color={item.isLiked ? colors.error : colors.textSecondary}
            />
            <Text style={[styles.actionText, item.isLiked && styles.actionTextActive]}>
              {item.like_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCoinPress(item.id)}
          >
            <IconSymbol
              ios_icon_name="bubble.left"
              android_material_icon_name="chat-bubble-outline"
              size={24}
              color={colors.textSecondary}
            />
            <Text style={styles.actionText}>{item.comment_count || 0}</Text>
          </TouchableOpacity>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CoinHub</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCoin}>
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {coins.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="photo.stack"
            android_material_icon_name="photo-library"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            No coins yet. Be the first to share your collection!
          </Text>
        </View>
      ) : (
        <FlatList
          data={coins}
          renderItem={renderCoinCard}
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
