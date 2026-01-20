
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';
const { width } = Dimensions.get('window');

interface CoinDetail {
  id: string;
  title: string;
  country: string;
  year: number;
  description?: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  images: { url: string }[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  tradeStatus: string;
}

export default function CoinDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; coinId?: string }>();
  const coinId = params.id || params.coinId;
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  const fetchCoinDetail = useCallback(async () => {
    if (!coinId) {
      console.error('CoinDetailScreen: No coinId provided');
      setLoading(false);
      return;
    }

    try {
      console.log('CoinDetailScreen: Fetching coin detail for coinId:', coinId);
      const response = await fetch(`${API_URL}/api/coins/${coinId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CoinDetailScreen: Coin detail fetched successfully');
        setCoin(data.coin);
      } else {
        console.error('CoinDetailScreen: Failed to fetch coin, status:', response.status);
      }
    } catch (error) {
      console.error('CoinDetailScreen: Error fetching coin detail:', error);
    } finally {
      setLoading(false);
    }
  }, [coinId]);

  useEffect(() => {
    console.log('CoinDetailScreen: Component mounted, coinId:', coinId);
    fetchCoinDetail();
  }, [fetchCoinDetail]);

  const handleLike = async () => {
    if (!coin) return;

    if (!user) {
      console.log('CoinDetailScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }

    console.log('CoinDetailScreen: User tapped like/unlike button');
    try {
      const response = await fetch(`${API_URL}/api/coins/${coin.id}/like`, {
        method: coin.isLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        console.log('CoinDetailScreen: Like toggled successfully');
        setCoin({
          ...coin,
          isLiked: !coin.isLiked,
          likeCount: coin.likeCount + (coin.isLiked ? -1 : 1),
        });
      }
    } catch (error) {
      console.error('CoinDetailScreen: Error liking coin:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading coin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!coin) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Coin Details',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.errorText}>Coin not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log('CoinDetailScreen: User tapped back button');
              router.back();
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: coin.title,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView>
        {coin.images && coin.images.length > 0 && (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {coin.images.map((image, index) => (
              <Image key={index} source={{ uri: image.url }} style={styles.image} />
            ))}
          </ScrollView>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{coin.title}</Text>
          <Text style={styles.meta}>{coin.country} • {coin.year}</Text>

          {coin.tradeStatus === 'open_to_trade' && (
            <View style={styles.tradeBadge}>
              <IconSymbol ios_icon_name="arrow.2.squarepath" android_material_icon_name="sync" size={16} color={colors.success} />
              <Text style={styles.tradeBadgeText}>Open to Trade</Text>
            </View>
          )}

          {coin.description && (
            <Text style={styles.description}>{coin.description}</Text>
          )}

          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => {
              console.log('CoinDetailScreen: User tapped on profile:', coin.user.username);
              if (coin.user.id === user?.id) {
                console.log('CoinDetailScreen: Navigating to own profile');
                router.push('/(tabs)/profile');
              } else {
                console.log('CoinDetailScreen: Navigating to user profile:', coin.user.username);
                router.push(`/user-profile?username=${coin.user.username}`);
              }
            }}
          >
            {coin.user.avatarUrl ? (
              <Image source={{ uri: coin.user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
              </View>
            )}
            <View>
              <Text style={styles.displayName}>{coin.user.displayName || coin.user.username}</Text>
              <Text style={styles.username}>@{coin.user.username}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <IconSymbol
                ios_icon_name={coin.isLiked ? "heart.fill" : "heart"}
                android_material_icon_name={coin.isLiked ? "favorite" : "favorite-border"}
                size={24}
                color={coin.isLiked ? colors.error : colors.text}
              />
              <Text style={styles.actionText}>{coin.likeCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                console.log('CoinDetailScreen: User tapped comments button');
                router.push(`/coin-comments?coinId=${coin.id}`);
              }}
            >
              <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={24} color={colors.text} />
              <Text style={styles.actionText}>{coin.commentCount}</Text>
            </TouchableOpacity>

            {coin.tradeStatus === 'open_to_trade' && coin.user.id !== user?.id && (
              <TouchableOpacity
                style={[styles.actionButton, styles.tradeButton]}
                onPress={() => {
                  console.log('CoinDetailScreen: User tapped propose trade button');
                  if (!user) {
                    console.log('CoinDetailScreen: User not logged in, redirecting to auth');
                    router.push('/auth');
                    return;
                  }
                  // TODO: Implement trade initiation
                  console.log('CoinDetailScreen: Trade initiation not yet implemented');
                }}
              >
                <IconSymbol ios_icon_name="arrow.2.squarepath" android_material_icon_name="sync" size={24} color={colors.primary} />
                <Text style={[styles.actionText, styles.tradeButtonText]}>Propose Trade</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  image: {
    width: width,
    height: width,
    backgroundColor: colors.border,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  meta: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${colors.success}20`,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  tradeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginLeft: 6,
  },
  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: colors.text,
  },
  tradeButton: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tradeButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
