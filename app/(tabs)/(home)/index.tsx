
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
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('FeedScreen: Component mounted, user:', user?.username);
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      console.log('FeedScreen: Fetching coins from /api/coins/feed');
      const response = await fetch(`${API_URL}/api/coins/feed?limit=20&offset=0`, {
        credentials: 'include',
      });
      
      console.log('FeedScreen: Feed response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Fetched', data.coins?.length || 0, 'coins');
        
        // Log first coin to see structure
        if (data.coins && data.coins.length > 0) {
          console.log('FeedScreen: First coin structure:', JSON.stringify(data.coins[0], null, 2));
          console.log('FeedScreen: First coin images:', data.coins[0].images);
        }
        
        setCoins(data.coins || []);
      } else {
        const errorText = await response.text();
        console.error('FeedScreen: Failed to fetch coins, status:', response.status, 'error:', errorText);
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
    console.log('FeedScreen: User tapped like on coin:', coinId);
    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      console.log('FeedScreen: Like response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('FeedScreen: Like toggled, new count:', data.like_count);
        setCoins(prevCoins =>
          prevCoins.map(coin =>
            coin.id === coinId ? { ...coin, like_count: data.like_count } : coin
          )
        );
      } else {
        const errorText = await response.text();
        console.error('FeedScreen: Like failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('FeedScreen: Error liking coin:', error);
    }
  };

  const handleAddCoin = () => {
    console.log('FeedScreen: User tapped add coin button');
    router.push('/add-coin');
  };

  const handleUserPress = (userId: string, username: string) => {
    console.log('FeedScreen: User tapped on profile:', username);
    if (userId === user?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/user-profile?userId=${userId}`);
    }
  };

  const renderCoinCard = ({ item }: { item: Coin }) => {
    console.log('FeedScreen: Rendering coin:', item.title, 'with', item.images?.length || 0, 'images');
    
    // Handle both order_index and orderIndex
    const sortedImages = item.images?.sort((a, b) => {
      const aIndex = (a as any).order_index ?? a.order_index ?? 0;
      const bIndex = (b as any).order_index ?? b.order_index ?? 0;
      return aIndex - bIndex;
    }) || [];
    
    const mainImage = sortedImages[0];
    
    if (mainImage) {
      console.log('FeedScreen: Main image URL for', item.title, ':', mainImage.url);
    } else {
      console.log('FeedScreen: No images found for coin:', item.title);
    }
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          console.log('FeedScreen: User tapped on coin:', item.title);
          Alert.alert(
            item.title,
            `${item.year} • ${item.country}\n\nBy ${item.user.displayName}\n\n${item.like_count} likes • ${item.comment_count} comments`,
            [{ text: 'OK' }]
          );
        }}
      >
        {mainImage ? (
          <Image
            source={{ uri: mainImage.url }}
            style={styles.coinImage}
            resizeMode="cover"
            onError={(error) => {
              console.error('FeedScreen: Image failed to load:', mainImage.url, error.nativeEvent.error);
            }}
            onLoad={() => {
              console.log('FeedScreen: Image loaded successfully:', mainImage.url);
            }}
          />
        ) : (
          <View style={styles.coinImagePlaceholder}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={styles.noImageText}>No image</Text>
          </View>
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

          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => handleUserPress(item.user.id, item.user.username)}
          >
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
          </TouchableOpacity>

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
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CoinHub</Text>
        <TouchableOpacity onPress={handleAddCoin}>
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
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleAddCoin}
            >
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? 48 : 0,
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
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
  coinImagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
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
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
