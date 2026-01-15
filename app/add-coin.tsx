
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function AddCoinScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [unit, setUnit] = useState('');
  const [organization, setOrganization] = useState('');
  const [agency, setAgency] = useState('');
  const [deployment, setDeployment] = useState('');
  const [coinNumber, setCoinNumber] = useState('');
  const [mintMark, setMintMark] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [tradeStatus, setTradeStatus] = useState<'not_for_trade' | 'open_to_trade'>('not_for_trade');

  const pickImages = async () => {
    console.log('AddCoin: User tapped pick images');
    
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to add coin images.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      console.log('AddCoin: User selected', result.assets.length, 'images');
      const newImages = result.assets.map(asset => asset.uri);
      setImages([...images, ...newImages].slice(0, 5)); // Max 5 images
    }
  };

  const takePhoto = async () => {
    console.log('AddCoin: User tapped take photo');
    
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow camera access to take photos of your coins.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      console.log('AddCoin: User took a photo');
      setImages([...images, result.assets[0].uri].slice(0, 5)); // Max 5 images
    }
  };

  const removeImage = (index: number) => {
    console.log('AddCoin: User removed image at index:', index);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('AddCoin: User tapped submit button');
    
    // Validation
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a coin title');
      return;
    }
    if (!country.trim()) {
      Alert.alert('Required Field', 'Please enter the country');
      return;
    }
    if (!year.trim() || isNaN(Number(year))) {
      Alert.alert('Invalid Year', 'Please enter a valid year');
      return;
    }
    if (images.length === 0) {
      Alert.alert('No Images', 'Please add at least one image of your coin');
      return;
    }

    setLoading(true);

    try {
      console.log('AddCoin: Uploading images...');
      
      // Upload images first
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const imageUri = images[i];
        console.log(`AddCoin: Uploading image ${i + 1}/${images.length}`);
        
        // Create form data
        const formData = new FormData();
        
        // Handle different platforms
        if (Platform.OS === 'web') {
          // Web: fetch the blob
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('image', blob, 'coin-image.jpg');
        } else {
          // Native: use the URI directly
          formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'coin-image.jpg',
          } as any);
        }

        // Upload image
        const uploadResponse = await fetch(`${API_URL}/api/images`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('AddCoin: Image upload failed:', uploadResponse.status, errorText);
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        console.log('AddCoin: Image uploaded:', uploadData.url);
        imageUrls.push(uploadData.url);
      }

      console.log('AddCoin: All images uploaded, creating coin...');

      // Create coin
      const coinData = {
        title: title.trim(),
        country: country.trim(),
        year: parseInt(year),
        unit: unit.trim() || undefined,
        organization: organization.trim() || undefined,
        agency: agency.trim() || undefined,
        deployment: deployment.trim() || undefined,
        coin_number: coinNumber.trim() || undefined,
        mint_mark: mintMark.trim() || undefined,
        condition: condition.trim() || undefined,
        description: description.trim() || undefined,
        visibility,
        trade_status: tradeStatus,
        images: imageUrls.map((url, index) => ({
          url,
          order_index: index,
        })),
      };

      console.log('AddCoin: Creating coin with data:', coinData);

      const response = await fetch(`${API_URL}/api/coins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(coinData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AddCoin: Coin creation failed:', response.status, errorText);
        throw new Error('Failed to create coin');
      }

      const result = await response.json();
      console.log('AddCoin: Coin created successfully:', result);

      Alert.alert(
        'Success!',
        'Your coin has been added to your collection.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('AddCoin: Navigating back to profile');
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('AddCoin: Error creating coin:', error);
      Alert.alert(
        'Error',
        'Failed to add coin. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add Coin',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos *</Text>
            <Text style={styles.sectionSubtitle}>Add up to 5 photos of your coin</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={24}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              ))}
              
              {images.length < 5 && (
                <>
                  <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                    <IconSymbol
                      ios_icon_name="photo"
                      android_material_icon_name="photo-library"
                      size={32}
                      color={colors.primary}
                    />
                    <Text style={styles.addImageText}>Gallery</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                    <IconSymbol
                      ios_icon_name="camera"
                      android_material_icon_name="camera"
                      size={32}
                      color={colors.primary}
                    />
                    <Text style={styles.addImageText}>Camera</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., 1943 Steel Penny"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Country *</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="e.g., United States"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="e.g., 1943"
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Optional Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
            
            <Text style={styles.label}>Unit/Service</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="e.g., Army, Navy, Air Force"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Organization</Text>
            <TextInput
              style={styles.input}
              value={organization}
              onChangeText={setOrganization}
              placeholder="e.g., 101st Airborne"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Agency</Text>
            <TextInput
              style={styles.input}
              value={agency}
              onChangeText={setAgency}
              placeholder="e.g., FBI, CIA"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Deployment</Text>
            <TextInput
              style={styles.input}
              value={deployment}
              onChangeText={setDeployment}
              placeholder="e.g., Operation Desert Storm"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Coin Number</Text>
            <TextInput
              style={styles.input}
              value={coinNumber}
              onChangeText={setCoinNumber}
              placeholder="e.g., #123"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Mint Mark</Text>
            <TextInput
              style={styles.input}
              value={mintMark}
              onChangeText={setMintMark}
              placeholder="e.g., D, S, P"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Condition/Grade</Text>
            <TextInput
              style={styles.input}
              value={condition}
              onChangeText={setCondition}
              placeholder="e.g., Excellent, Good, Fair"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us about this coin..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Privacy & Trading */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Trading</Text>
            
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, visibility === 'public' && styles.toggleButtonActive]}
                onPress={() => {
                  console.log('AddCoin: User set visibility to public');
                  setVisibility('public');
                }}
              >
                <Text style={[styles.toggleText, visibility === 'public' && styles.toggleTextActive]}>
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, visibility === 'private' && styles.toggleButtonActive]}
                onPress={() => {
                  console.log('AddCoin: User set visibility to private');
                  setVisibility('private');
                }}
              >
                <Text style={[styles.toggleText, visibility === 'private' && styles.toggleTextActive]}>
                  Private
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Trade Status</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, tradeStatus === 'not_for_trade' && styles.toggleButtonActive]}
                onPress={() => {
                  console.log('AddCoin: User set trade status to not for trade');
                  setTradeStatus('not_for_trade');
                }}
              >
                <Text style={[styles.toggleText, tradeStatus === 'not_for_trade' && styles.toggleTextActive]}>
                  Not for Trade
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, tradeStatus === 'open_to_trade' && styles.toggleButtonActive]}
                onPress={() => {
                  console.log('AddCoin: User set trade status to open to trade');
                  setTradeStatus('open_to_trade');
                }}
              >
                <Text style={[styles.toggleText, tradeStatus === 'open_to_trade' && styles.toggleTextActive]}>
                  Open to Trade
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Add Coin to Collection</Text>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  imagesScroll: {
    marginTop: 8,
  },
  imageContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  addImageButton: {
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  addImageText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
