
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

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
  images: Array<{ url: string; order_index: number }>;
  like_count: number;
  comment_count: number;
  trade_status: string;
  created_at: string;
}

export default function FeedScreen() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    if (!user) {
      console.log('FeedScreen: No user found, redirecting to auth');
      router.replace('/auth');
    } else {
      fetchCoins();
    }
  }, [user]);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching coins from /api/coins/feed');
      const response = await fetch(`${API_URL}/api/coins/feed?limit=20&offset=0`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'coins');
        setCoins(data.coins || []);
      } else {
        console.error('FeedScreen: Failed to fetch coins, status:', response.status);
      }
    } catch (error) {
      console.error('FeedScreen: Error fetching coins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log('FeedScreen: User pulled to refresh');
    setRefreshing(true);
    fetchCoins();
  };

  const handleLike = async (coinId: string) => {
    if (!token) return;
    
    console.log('FeedScreen: User tapped like on coin:', coinId);
    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Like toggled, new count:', data.like_count);
        // Update local state
        setCoins(prevCoins =>
          prevCoins.map(coin =>
            coin.id === coinId ? { ...coin, like_count: data.like_count } : coin
          )
        );
      }
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
    }
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    const mainImage = item.images.sort((a, b) => a.order_index - b.order_index)[0];
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          console.log('FeedScreen: User tapped on coin:', item.title);
          // TODO: Navigate to coin detail screen
        }}
      >
        {mainImage && (
          <Image
            source={{ uri: mainImage.url }}
            style={styles.coinImage}
            resizeMode="cover"
          />
        )}
        
        {item.trade_status === 'open_to_trade' && (
          <View style={styles.tradeBadge}>
            <Text style={styles.tradeBadgeText}>Open to Trade</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={styles.coinTitle}>{item.title}</Text>
          <Text style={styles.coinInfo}>
            {item.year} • {item.country}
          </Text>

          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              {item.user.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={16}
                  color={colors.textSecondary}
                />
              )}
            </View>
            <Text style={styles.username}>{item.user.displayName}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
            >
              <IconSymbol
                ios_icon_name="heart.fill"
                android_material_icon_name="favorite"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.actionText}>{item.like_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol
                ios_icon_name="message.fill"
                android_material_icon_name="chat"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.actionText}>{item.comment_count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CoinHub</Text>
        <TouchableOpacity
          onPress={() => {
            console.log('FeedScreen: User tapped add coin button');
            // TODO: Navigate to add coin screen
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={28}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={coins}
        renderItem={renderCoinCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="circle.fill"
              android_material_icon_name="circle"
              size={60}
              color={colors.border}
            />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to share your collection!
            </Text>
          </View>
        }
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  coinImage: {
    width: '100%',
    height: 250,
    backgroundColor: colors.backgroundAlt,
  },
  tradeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.tradeBadge,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  coinTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  coinInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 24,
    height: 24,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
