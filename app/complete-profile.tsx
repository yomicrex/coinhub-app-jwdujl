
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';

export default function CompleteProfileScreen() {
  const { user, completeProfile } = useAuth();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agency, setAgency] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  console.log('CompleteProfileScreen: Rendered for user:', user?.email);

  const showError = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const pickImage = async () => {
    console.log('CompleteProfileScreen: User tapped to pick profile image');
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('CompleteProfileScreen: Image selected:', result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    console.log('CompleteProfileScreen: User tapped to take photo');
    
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      showError('Permission Required', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('CompleteProfileScreen: Photo taken:', result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleComplete = async () => {
    console.log('CompleteProfileScreen: User tapped Complete Profile button');
    
    if (!username.trim()) {
      showError('Missing Information', 'Username is required');
      return;
    }

    if (!displayName.trim()) {
      showError('Missing Information', 'Display name is required');
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      showError(
        'Invalid Username',
        'Username must be 3-20 characters and can only contain letters, numbers, and underscores.'
      );
      return;
    }

    setLoading(true);
    
    try {
      console.log('CompleteProfileScreen: Completing profile with data:', {
        username,
        displayName,
        agency: agency || '(none)',
        hasAvatar: !!avatarUri
      });
      
      // Complete the profile with username and display name
      await completeProfile(username, displayName);
      
      console.log('CompleteProfileScreen: Profile completed successfully, redirecting to home');
      
      // Navigate to home feed
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.error('CompleteProfileScreen: Error completing profile:', error);
      
      let displayErrorMessage = error.message || 'Failed to complete profile';
      let displayErrorTitle = 'Error';
      
      if (displayErrorMessage.includes('already exists') || displayErrorMessage.includes('duplicate')) {
        displayErrorTitle = 'Username Taken';
        displayErrorMessage = 'This username is already taken. Please choose another one.';
      } else if (displayErrorMessage.toLowerCase().includes('network') || displayErrorMessage.toLowerCase().includes('fetch')) {
        displayErrorTitle = 'Connection Error';
        displayErrorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      }
      
      showError(displayErrorTitle, displayErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Complete Your Profile',
          headerShown: true,
          headerBackVisible: false,
        }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🪙</Text>
            <Text style={styles.title}>Welcome to CoinHub!</Text>
            <Text style={styles.subtitle}>
              Let&apos;s set up your profile to get started
            </Text>
          </View>

          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol 
                  ios_icon_name="person.fill" 
                  android_material_icon_name="person" 
                  size={48} 
                  color={colors.textSecondary} 
                />
              </View>
            )}
            <View style={styles.editBadge}>
              <IconSymbol 
                ios_icon_name="camera.fill" 
                android_material_icon_name="camera-alt" 
                size={16} 
                color={colors.background} 
              />
            </View>
          </TouchableOpacity>

          <Text style={styles.avatarHint}>
            Tap to add a profile picture (optional)
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Username <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <IconSymbol 
                  ios_icon_name="at" 
                  android_material_icon_name="alternate-email" 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="johndoe"
                  placeholderTextColor={colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.hint}>
                3-20 characters, letters, numbers, and underscores only
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Display Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <IconSymbol 
                  ios_icon_name="person.fill" 
                  android_material_icon_name="person" 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textSecondary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Agency (Optional)</Text>
              <View style={styles.inputContainer}>
                <IconSymbol 
                  ios_icon_name="building.2.fill" 
                  android_material_icon_name="business" 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., US Navy, Police Department"
                  placeholderTextColor={colors.textSecondary}
                  value={agency}
                  onChangeText={setAgency}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Complete Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="error"
              size={48}
              color="#FF3B30"
            />
            <Text style={styles.errorModalTitle}>{errorTitle}</Text>
            <Text style={styles.errorModalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  errorModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 24,
  },
  errorModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorModalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorModalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  errorModalButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
