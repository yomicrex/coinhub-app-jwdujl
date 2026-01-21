
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_URL } from '@/utils/api';

interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export default function CoinCommentsScreen() {
  const params = useLocalSearchParams<{ id?: string; coinId?: string }>();
  const coinId = params.id || params.coinId;
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const fetchComments = useCallback(async () => {
    if (!coinId) {
      console.error('CoinCommentsScreen: No coinId provided');
      setLoading(false);
      return;
    }

    console.log('CoinCommentsScreen: Fetching comments for coin:', coinId);
    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}/comments`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CoinCommentsScreen: Fetched', data.comments?.length || 0, 'comments');
        setComments(data.comments || []);
      } else {
        console.error('CoinCommentsScreen: Failed to fetch comments, status:', response.status);
      }
    } catch (error) {
      console.error('CoinCommentsScreen: Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [coinId]);

  useEffect(() => {
    console.log('CoinCommentsScreen: Component mounted, coinId:', coinId);
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      return;
    }

    if (!user) {
      console.log('CoinCommentsScreen: User not logged in, redirecting to auth');
      router.push('/auth');
      return;
    }

    console.log('CoinCommentsScreen: Submitting comment:', newComment);
    setSubmitting(true);

    try {
      // FIXED: Use authenticatedFetch for authenticated requests
      const response = await authenticatedFetch(`/api/coins/${coinId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment,
        }),
      });

      if (response.ok) {
        console.log('CoinCommentsScreen: Comment submitted successfully');
        setNewComment('');
        fetchComments();
      } else {
        const errorText = await response.text();
        console.error('CoinCommentsScreen: Failed to submit comment, status:', response.status, 'error:', errorText);
        Alert.alert('Error', 'Failed to post comment');
      }
    } catch (error) {
      console.error('CoinCommentsScreen: Error submitting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentCard}>
      <TouchableOpacity
        style={styles.commentHeader}
        onPress={() => {
          console.log('CoinCommentsScreen: User tapped on profile:', item.user.username);
          if (item.user.id === user?.id) {
            router.push('/(tabs)/profile');
          } else {
            router.push(`/user-profile?username=${item.user.username}`);
          }
        }}
      >
        {item.user.avatarUrl ? (
          <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={16} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.commentUserInfo}>
          <Text style={styles.displayName}>{item.user.displayName}</Text>
          <Text style={styles.username}>@{item.user.username}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.commentContent}>{item.content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Comments',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={comments.length === 0 ? styles.emptyList : styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSecondary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newComment.trim() || submitting) && styles.sendButtonDisabled]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <IconSymbol ios_icon_name="arrow.up.circle.fill" android_material_icon_name="send" size={32} color={colors.background} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  list: {
    padding: 16,
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
  commentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentUserInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  commentContent: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    maxHeight: 100,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
