
import React, { useState } from 'react';
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
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function AddCoinScreen() {
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [tradeStatus, setTradeStatus] = useState<'not_for_trade' | 'open_to_trade'>('not_for_trade');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const pickImages = async () => {
    console.log('AddCoinScreen: User tapped pick images');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      console.log('AddCoinScreen: Selected', newImages.length, 'images');
      setImages([...images, ...newImages]);
    }
  };

  const takePhoto = async () => {
    console.log('AddCoinScreen: User tapped take photo');
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('AddCoinScreen: Photo taken');
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    console.log('AddCoinScreen: Removing image at index', index);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('AddCoinScreen: User tapped save button');
    
    if (!title || !country || !year) {
      console.log('AddCoinScreen: Missing required fields');
      Alert.alert('Error', 'Please fill in title, country, and year');
      return;
    }

    if (images.length === 0) {
      console.log('AddCoinScreen: No images selected');
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    console.log('AddCoinScreen: Creating coin with data:', { title, country, year, description, tradeStatus });
    setLoading(true);

    try {
      // Create coin
      const coinResponse = await fetch(`${API_URL}/api/coins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          country,
          year: parseInt(year),
          description,
          visibility: 'public',
          tradeStatus,
        }),
      });

      if (!coinResponse.ok) {
        const errorText = await coinResponse.text();
        console.error('AddCoinScreen: Failed to create coin, status:', coinResponse.status, 'error:', errorText);
        throw new Error('Failed to create coin');
      }

      const { coin } = await coinResponse.json();
      console.log('AddCoinScreen: Coin created with ID:', coin.id);

      // Upload images
      for (let i = 0; i < images.length; i++) {
        console.log('AddCoinScreen: Uploading image', i + 1, 'of', images.length);
        const formData = new FormData();
        const uri = images[i];
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri,
          name: filename,
          type,
        } as any);

        formData.append('orderIndex', i.toString());

        const imageResponse = await fetch(`${API_URL}/api/coins/${coin.id}/images`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!imageResponse.ok) {
          console.error('AddCoinScreen: Failed to upload image', i + 1);
        }
      }

      console.log('AddCoinScreen: Coin created successfully');
      Alert.alert('Success', 'Coin added successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('AddCoinScreen: Error creating coin:', error);
      Alert.alert('Error', error.message || 'Failed to create coin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add Coin',
          headerBackTitle: 'Cancel',
          headerRight: () => (
            <TouchableOpacity onPress={handleSubmit} disabled={loading}>
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
        <View style={styles.section}>
          <Text style={styles.label}>Images *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
              <IconSymbol ios_icon_name="photo" android_material_icon_name="photo-library" size={32} color={colors.textSecondary} />
              <Text style={styles.addImageText}>Add Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
              <IconSymbol ios_icon_name="camera" android_material_icon_name="camera-alt" size={32} color={colors.textSecondary} />
              <Text style={styles.addImageText}>Take Photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Navy Challenge Coin"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Country *</Text>
            <TextInput
              style={styles.input}
              placeholder="USA"
              placeholderTextColor={colors.textSecondary}
              value={country}
              onChangeText={setCountry}
            />
          </View>

          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={styles.input}
              placeholder="2024"
              placeholderTextColor={colors.textSecondary}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about this coin..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Trade Status</Text>
          <View style={styles.tradeOptions}>
            <TouchableOpacity
              style={[
                styles.tradeOption,
                tradeStatus === 'not_for_trade' && styles.tradeOptionActive,
              ]}
              onPress={() => {
                console.log('AddCoinScreen: Set trade status to not_for_trade');
                setTradeStatus('not_for_trade');
              }}
            >
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={20}
                color={tradeStatus === 'not_for_trade' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tradeOptionText,
                  tradeStatus === 'not_for_trade' && styles.tradeOptionTextActive,
                ]}
              >
                Not for Trade
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tradeOption,
                tradeStatus === 'open_to_trade' && styles.tradeOptionActive,
              ]}
              onPress={() => {
                console.log('AddCoinScreen: Set trade status to open_to_trade');
                setTradeStatus('open_to_trade');
              }}
            >
              <IconSymbol
                ios_icon_name="arrow.2.squarepath"
                android_material_icon_name="sync"
                size={20}
                color={tradeStatus === 'open_to_trade' ? colors.success : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tradeOptionText,
                  tradeStatus === 'open_to_trade' && styles.tradeOptionTextActive,
                ]}
              >
                Open to Trade
              </Text>
            </TouchableOpacity>
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
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
  imageScroll: {
    marginTop: 8,
  },
  imageContainer: {
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addImageText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  saveButton: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  tradeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tradeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  tradeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  tradeOptionTextActive: {
    color: colors.text,
  },
});
