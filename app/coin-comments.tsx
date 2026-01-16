
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authClient } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

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
  const router = useRouter();
  const { coinId, coinTitle } = useLocalSearchParams<{ coinId: string; coinTitle?: string }>();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    console.log('CoinComments: Loading comments for coin:', coinId);
    if (coinId) {
      fetchComments();
    }
  }, [coinId]);

  const fetchComments = async () => {
    try {
      console.log('CoinComments: Fetching comments from /api/coins/' + coinId + '/comments');
      const response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/comments`);
      
      console.log('CoinComments: Response:', response);
      const commentsData = response?.data || response || [];
      
      setComments(commentsData);
      console.log('CoinComments: Loaded', commentsData.length, 'comments');
    } catch (error) {
      console.error('CoinComments: Error fetching comments:', error);
      Alert.alert('Error', 'Failed to load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      console.log('CoinComments: Cannot submit empty comment');
      return;
    }

    console.log('CoinComments: User submitting comment:', newComment);
    setSubmitting(true);

    try {
      const response = await authClient.$fetch(`${API_URL}/api/coins/${coinId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      console.log('CoinComments: Comment posted successfully:', response);
      
      // Clear input
      setNewComment('');
      
      // Refresh comments
      await fetchComments();
    } catch (error) {
      console.error('CoinComments: Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    console.log('CoinComments: User wants to delete comment:', commentId);
    
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authClient.$fetch(`${API_URL}/api/comments/${commentId}`, {
                method: 'DELETE',
              });

              console.log('CoinComments: Comment deleted successfully');
              
              // Refresh comments
              await fetchComments();
            } catch (error) {
              console.error('CoinComments: Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isOwner = item.user.id === user?.id;
    const commentDate = new Date(item.createdAt);
    const formattedDate = commentDate.toLocaleDateString() + ' ' + commentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <View style={styles.commentUserInfo}>
            <Text style={styles.commentDisplayName}>{item.user.displayName}</Text>
            <Text style={styles.commentUsername}>@{item.user.username}</Text>
          </View>
          <View style={styles.commentMeta}>
            <Text style={styles.commentDate}>{formattedDate}</Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id)}
                style={styles.deleteCommentButton}
              >
                <IconSymbol
                  ios_icon_name="trash"
                  android_material_icon_name="delete"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.commentContent}>{item.content}</Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: coinTitle ? `Comments - ${coinTitle}` : 'Comments',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
            <>
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <IconSymbol
                      ios_icon_name="message"
                      android_material_icon_name="chat-bubble"
                      size={64}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.emptyText}>No comments yet</Text>
                    <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                  </View>
                }
              />

              {/* Comment Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Write a comment..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={500}
                  editable={!submitting}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!newComment.trim() || submitting) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <IconSymbol
                      ios_icon_name="paperplane.fill"
                      android_material_icon_name="send"
                      size={24}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
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
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  commentsList: {
    padding: 16,
    paddingBottom: 8,
  },
  commentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commentUserInfo: {
    flex: 1,
  },
  commentDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  commentUsername: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteCommentButton: {
    padding: 4,
  },
  commentContent: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
