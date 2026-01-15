
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function EditProfileScreen() {
  const { user, fetchUser } = useAuth();
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    console.log('EditProfile: Component mounted, user:', user);
    if (!user) {
      console.log('EditProfile: No user found, redirecting to auth');
      router.replace('/auth');
    }
  }, [user]);

  const pickImage = async () => {
    console.log('EditProfile: User tapped pick image');
    
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('EditProfile: Image selected:', result.assets[0].uri);
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    console.log('EditProfile: User tapped take photo');
    
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your camera to take a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('EditProfile: Photo taken:', result.assets[0].uri);
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      console.log('EditProfile: Uploading avatar, uri:', uri);
      setUploadingAvatar(true);

      // Create form data
      const formData = new FormData();
      
      // Get file extension
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      formData.append('avatar', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: `avatar.${fileType}`,
        type: `image/${fileType}`,
      } as any);

      console.log('EditProfile: Sending avatar upload request to /api/profiles/me/avatar');
      
      const response = await fetch(`${API_URL}/api/profiles/me/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('EditProfile: Avatar upload response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('EditProfile: Avatar uploaded successfully:', data);
        
        setAvatarUri(data.avatar_url || data.avatarUrl);
        
        Alert.alert(
          'Success',
          'Profile picture updated successfully!',
          [{ text: 'OK' }]
        );
        
        // Refresh user data
        await fetchUser();
      } else {
        const errorText = await response.text();
        console.error('EditProfile: Avatar upload failed, status:', response.status, 'error:', errorText);
        
        Alert.alert(
          'Upload Failed',
          'Failed to upload profile picture. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('EditProfile: Error uploading avatar:', error);
      Alert.alert(
        'Upload Error',
        'An error occurred while uploading your profile picture. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    console.log('EditProfile: User tapped save button');
    
    if (!displayName.trim()) {
      Alert.alert(
        'Display Name Required',
        'Please enter a display name.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setLoading(true);
      console.log('EditProfile: Saving profile changes');

      const response = await fetch(`${API_URL}/api/profiles/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio: bio.trim(),
          location: location.trim(),
        }),
      });

      console.log('EditProfile: Save profile response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('EditProfile: Profile saved successfully:', data);
        
        Alert.alert(
          'Success',
          'Profile updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh user data and go back
                fetchUser();
                router.back();
              },
            },
          ]
        );
      } else {
        const errorText = await response.text();
        console.error('EditProfile: Save profile failed, status:', response.status, 'error:', errorText);
        
        Alert.alert(
          'Save Failed',
          'Failed to update profile. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('EditProfile: Error saving profile:', error);
      Alert.alert(
        'Save Error',
        'An error occurred while saving your profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={50}
                    color={colors.textSecondary}
                  />
                </View>
              )}
              {uploadingAvatar && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.avatarButtons}>
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={pickImage}
                disabled={uploadingAvatar}
              >
                <IconSymbol
                  ios_icon_name="photo"
                  android_material_icon_name="photo"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.avatarButtonText}>Choose Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarButton}
                onPress={takePhoto}
                disabled={uploadingAvatar}
              >
                <IconSymbol
                  ios_icon_name="camera"
                  android_material_icon_name="camera"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.avatarButtonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Display Name *</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                placeholderTextColor={colors.textSecondary}
                maxLength={50}
              />
              <Text style={styles.helperText}>
                This is how your name will appear to other users
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>
                  @{user.username || 'Not set'}
                </Text>
              </View>
              <Text style={styles.helperText}>
                Username cannot be changed
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself and your collection"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                {bio.length}/200 characters
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={colors.textSecondary}
                maxLength={100}
              />
              <Text style={styles.helperText}>
                Optional - helps connect with local collectors
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>
                  {user.email}
                </Text>
              </View>
              <Text style={styles.helperText}>
                Email cannot be changed
              </Text>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    gap: 24,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  disabledInput: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.6,
  },
  disabledInputText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
