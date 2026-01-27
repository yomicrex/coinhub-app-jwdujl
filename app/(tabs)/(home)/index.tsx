
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import React, { useState, useCallback } from 'react';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticatedFetch } from '@/utils/api';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface Coin {
  id: string;
  title: string;
  country: string;
  year: number;
  unit?: string;
  agency?: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  images: { url: string }[];
  likeCount?: number;
  commentCount?: number;
  tradeStatus?: string;
  isLiked?: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchCoins = useCallback(async () => {
    console.log('HomeScreen: Fetching public coins feed from /api/coins/feed');
    try {
      const response = await fetch(`${API_URL}/api/coins/feed`, {
        credentials: 'include',
      });

      console.log('HomeScreen: Feed response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('HomeScreen: Fetched', data.coins?.length || 0, 'coins');
        console.log('HomeScreen: Coins data:', JSON.stringify(data.coins?.slice(0, 2), null, 2));
        setCoins(data.coins || []);
      } else {
        console.error('HomeScreen: Failed to fetch coins, status:', response.status);
        const errorText = await response.text();
        console.error('HomeScreen: Error response:', errorText);
        setCoins([]);
      }
    } catch (error) {
      console.error('HomeScreen: Error fetching coins:', error);
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    console.log('HomeScreen: Component mounted, user:', user?.username);
    console.log('HomeScreen: Backend URL:', API_URL);
    console.log('HomeScreen: Starting initial data fetch');
    fetchCoins();
  }, [fetchCoins, user?.username]);

  const onRefresh = async () => {
    console.log('HomeScreen: User pulled to refresh');
    setRefreshing(true);
    await fetchCoins();
    setRefreshing(false);
  };

  const handleLike = async (coinId: string) => {
    console.log('HomeScreen: User tapped like button for coin:', coinId);
    
    if (!user) {
      console.log('HomeScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    const coin = coins.find(c => c.id === coinId);
    if (!coin) return;
    
    const wasLiked = coin.isLiked || false;
    
    setCoins(prevCoins => 
      prevCoins.map(c => 
        c.id === coinId 
          ? { 
              ...c, 
              isLiked: !wasLiked,
              likeCount: wasLiked ? (c.likeCount || 1) - 1 : (c.likeCount || 0) + 1
            }
          : c
      )
    );
    
    try {
      const method = wasLiked ? 'DELETE' : 'POST';
      console.log('HomeScreen: Sending', method, 'request to /api/coins/' + coinId + '/like');
      
      const fetchOptions: RequestInit = {
        method,
      };
      
      if (method === 'POST') {
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
        fetchOptions.body = JSON.stringify({});
      }
      
      const response = await authenticatedFetch(`/api/coins/${coinId}/like`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HomeScreen: Failed to like coin, status:', response.status, 'error:', errorText);
        throw new Error('Failed to toggle like');
      }
      
      console.log('HomeScreen: Like toggled successfully');
    } catch (error) {
      console.error('HomeScreen: Error liking coin:', error);
      
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === coinId 
            ? { 
                ...c, 
                isLiked: wasLiked,
                likeCount: wasLiked ? (c.likeCount || 0) + 1 : (c.likeCount || 1) - 1
              }
            : c
        )
      );
      
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  };

  const handleComment = (coinId: string) => {
    console.log('HomeScreen: User tapped comment button for coin:', coinId);
    
    if (!user) {
      console.log('HomeScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    setSelectedCoinId(coinId);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedCoinId || submittingComment) {
      return;
    }

    console.log('HomeScreen: Submitting comment for coin:', selectedCoinId);
    setSubmittingComment(true);

    try {
      const response = await authenticatedFetch(`/api/coins/${selectedCoinId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HomeScreen: Failed to submit comment, status:', response.status, 'error:', errorText);
        throw new Error('Failed to submit comment');
      }

      console.log('HomeScreen: Comment submitted successfully');
      
      setCoins(prevCoins => 
        prevCoins.map(c => 
          c.id === selectedCoinId 
            ? { ...c, commentCount: (c.commentCount || 0) + 1 }
            : c
        )
      );
      
      setShowCommentModal(false);
      setCommentText('');
      setSelectedCoinId(null);
      
      Alert.alert('Success', 'Comment posted!');
    } catch (error) {
      console.error('HomeScreen: Error submitting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddCoin = () => {
    console.log('HomeScreen: User tapped Add Coin button');
    
    if (!user) {
      console.log('HomeScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }
    
    router.push('/add-coin');
  };

  const handleSearchCoins = () => {
    console.log('HomeScreen: User tapped Search Coins button');
    router.push('/search-coins');
  };

  const handleSearchUsers = () => {
    console.log('HomeScreen: User tapped Search Users button');
    router.push('/search-users');
  };

  const renderCoin = ({ item }: { item: Coin }) => {
    const agencyText = item.agency || '';
    const unitText = item.unit || '';
    const titleText = item.title || '';
    
    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => {
          console.log('HomeScreen: User tapped on coin:', item.id);
          router.push(`/coin-detail?id=${item.id}`);
        }}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.textSecondary} />
          </View>
          <View>
            <Text style={styles.displayName}>{item.user.displayName}</Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </View>

        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0].url }} style={styles.coinImage} />
        ) : (
          <View style={[styles.coinImage, styles.imagePlaceholder]}>
            <IconSymbol ios_icon_name="photo" android_material_icon_name="image" size={48} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle}>{titleText}</Text>
          
          <View style={styles.coinMetaRow}>
            {agencyText ? (
              <Text style={styles.coinMeta}>{agencyText}</Text>
            ) : null}
            {agencyText && unitText ? (
              <Text style={styles.coinMetaSeparator}>•</Text>
            ) : null}
            {unitText ? (
              <Text style={styles.coinMeta}>{unitText}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleLike(item.id);
            }}
          >
            <IconSymbol
              ios_icon_name={item.isLiked ? 'heart.fill' : 'heart'}
              android_material_icon_name={item.isLiked ? 'favorite' : 'favorite-border'}
              size={24}
              color={item.isLiked ? colors.error : colors.text}
            />
            <Text style={styles.actionText}>{item.likeCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleComment(item.id);
            }}
          >
            <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={24} color={colors.text} />
            <Text style={styles.actionText}>{item.commentCount || 0}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🪙 CoinHub</Text>
        </View>
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
        <Text style={styles.headerTitle}>🪙 CoinHub</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSearchCoins} style={styles.headerButton}>
            <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={24} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSearchUsers} style={styles.headerButton}>
            <IconSymbol ios_icon_name="person.2" android_material_icon_name="group" size={24} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddCoin} style={styles.headerButton}>
            <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={28} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={coins}
        renderItem={renderCoin}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol ios_icon_name="tray" android_material_icon_name="inbox" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a coin!</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCoin}>
              <Text style={styles.emptyButtonText}>Add Your First Coin</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={coins.length === 0 ? styles.emptyList : undefined}
      />

      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCommentModal(false);
          setCommentText('');
          setSelectedCoinId(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                  setSelectedCoinId(null);
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
            <TextInput
              style={styles.commentInput}
              placeholder="Write your comment..."
              placeholderTextColor={colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submitButton, (!commentText.trim() || submittingComment) && styles.submitButtonDisabled]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Post Comment</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
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
  coinCard: {
    backgroundColor: colors.surface,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  coinImage: {
    width: '100%',
    height: 300,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
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
  coinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  coinMeta: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  coinMetaSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 6,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 6,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
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
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  commentInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
