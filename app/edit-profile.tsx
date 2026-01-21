
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, authenticatedUpload } from '@/utils/api';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log('EditProfileScreen: Initializing with user data');
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
    }
  }, [user]);

  const pickImage = async () => {
    console.log('EditProfileScreen: User tapped pick image');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('EditProfileScreen: Image selected');
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    console.log('EditProfileScreen: User tapped save button');
    setLoading(true);

    try {
      // Upload avatar if changed
      if (avatarUri) {
        console.log('EditProfileScreen: Uploading avatar');
        const formData = new FormData();
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('avatar', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);

        const avatarResponse = await authenticatedUpload('/api/profiles/me/avatar', formData);
        
        if (!avatarResponse.ok) {
          const errorText = await avatarResponse.text();
          console.error('EditProfileScreen: Avatar upload failed:', errorText);
          throw new Error('Failed to upload avatar');
        }
        
        console.log('EditProfileScreen: Avatar uploaded successfully');
      }

      // Update profile
      console.log('EditProfileScreen: Updating profile data');
      const response = await authenticatedFetch('/api/profiles/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
          bio,
          location,
        }),
      });

      if (response.ok) {
        console.log('EditProfileScreen: Profile updated successfully');
        await refreshUser();
        Alert.alert('Success', 'Profile updated!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const errorText = await response.text();
        console.error('EditProfileScreen: Profile update failed:', errorText);
        throw new Error('Failed to update profile');
      }
    } catch (error: any) {
      console.error('EditProfileScreen: Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
          {avatarUri || user?.avatarUrl ? (
            <Image
              source={{ uri: avatarUri || user?.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={48} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.editBadge}>
            <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="camera-alt" size={16} color={colors.background} />
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.textMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="City, Country"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
          />
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
  content: {
    padding: 16,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
