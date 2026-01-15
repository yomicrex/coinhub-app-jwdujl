
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
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

interface CoinImage {
  id?: string;
  url: string;
  orderIndex: number;
  isNew?: boolean;
}

export default function EditCoinScreen() {
  const router = useRouter();
  const { coinId } = useLocalSearchParams<{ coinId: string }>();
  const [loading, setLoading] = useState(false);
  const [loadingCoin, setLoadingCoin] = useState(true);
  const [images, setImages] = useState<CoinImage[]>([]);
  
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

  useEffect(() => {
    if (coinId) {
      fetchCoinData();
    }
  }, [coinId]);

  const fetchCoinData = async () => {
    console.log('EditCoin: Fetching coin data for:', coinId);
    setLoadingCoin(true);
    
    try {
      const response = await fetch(`${API_URL}/api/coins/${coinId}`, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('EditCoin: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('EditCoin: Failed to fetch coin:', response.status, errorText);
        throw new Error('Failed to fetch coin data');
      }

      const coin = await response.json();
      console.log('EditCoin: Coin data loaded:', coin);

      // Populate form fields
      setTitle(coin.title || '');
      setCountry(coin.country || '');
      setYear(coin.year?.toString() || '');
      setUnit(coin.unit || '');
      setOrganization(coin.organization || '');
      setAgency(coin.agency || '');
      setDeployment(coin.deployment || '');
      setCoinNumber(coin.coinNumber || coin.coin_number || '');
      setMintMark(coin.mintMark || coin.mint_mark || '');
      setCondition(coin.condition || '');
      setDescription(coin.description || '');
      setVisibility(coin.visibility || 'public');
      setTradeStatus(coin.tradeStatus || coin.trade_status || 'not_for_trade');
      
      // Set existing images - handle both camelCase and snake_case
      if (coin.images && coin.images.length > 0) {
        setImages(coin.images.map((img: any, index: number) => ({
          id: img.id,
          url: img.url,
          orderIndex: img.orderIndex ?? img.order_index ?? index,
          isNew: false,
        })));
      }
    } catch (error: any) {
      console.error('EditCoin: Error fetching coin:', error);
      Alert.alert('Error', 'Failed to load coin data. Please try again.');
      router.back();
    } finally {
      setLoadingCoin(false);
    }
  };

  const pickImages = async () => {
    console.log('EditCoin: User tapped pick images');
    
    if (images.length >= 5) {
      Alert.alert('Maximum Images', 'You can only have up to 5 images per coin.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to add coin images.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });

    if (!result.canceled && result.assets) {
      console.log('EditCoin: User selected', result.assets.length, 'images');
      const newImages: CoinImage[] = result.assets.map((asset, index) => ({
        url: asset.uri,
        orderIndex: images.length + index,
        isNew: true,
      }));
      setImages([...images, ...newImages].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    console.log('EditCoin: User tapped take photo');
    
    if (images.length >= 5) {
      Alert.alert('Maximum Images', 'You can only have up to 5 images per coin.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow camera access to take photos of your coins.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      console.log('EditCoin: User took a photo');
      const newImage: CoinImage = {
        url: result.assets[0].uri,
        orderIndex: images.length,
        isNew: true,
      };
      setImages([...images, newImage].slice(0, 5));
    }
  };

  const removeImage = async (index: number) => {
    console.log('EditCoin: User removed image at index:', index);
    const imageToRemove = images[index];
    
    // If it's an existing image (has an ID), delete it from the server
    if (imageToRemove.id && !imageToRemove.isNew) {
      try {
        const response = await fetch(`${API_URL}/api/coins/${coinId}/images/${imageToRemove.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        
        if (!response.ok) {
          console.error('EditCoin: Failed to delete image from server');
        } else {
          console.log('EditCoin: Image deleted from server');
        }
      } catch (error) {
        console.error('EditCoin: Error deleting image:', error);
      }
    }
    
    // Remove from local state
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('EditCoin: User tapped save button');
    
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
      console.log('EditCoin: Updating coin data...');

      // Step 1: Update coin metadata
      const coinData = {
        title: title.trim(),
        country: country.trim(),
        year: parseInt(year),
        unit: unit.trim() || null,
        organization: organization.trim() || null,
        agency: agency.trim() || null,
        deployment: deployment.trim() || null,
        coinNumber: coinNumber.trim() || null,
        mintMark: mintMark.trim() || null,
        condition: condition.trim() || null,
        description: description.trim() || null,
        visibility,
        tradeStatus,
      };

      console.log('EditCoin: Updating coin with data:', coinData);

      const response = await fetch(`${API_URL}/api/coins/${coinId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(coinData),
      });

      console.log('EditCoin: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('EditCoin: Coin update failed:', response.status, errorText);
        throw new Error(`Failed to update coin: ${response.status} ${errorText}`);
      }

      const updatedCoin = await response.json();
      console.log('EditCoin: Coin updated successfully:', updatedCoin);

      // Step 2: Upload new images
      const newImages = images.filter(img => img.isNew);
      console.log('EditCoin: Uploading', newImages.length, 'new images');
      
      let uploadedCount = 0;
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];
        console.log(`EditCoin: Uploading new image ${i + 1}/${newImages.length}`);
        
        try {
          const formData = new FormData();
          
          if (Platform.OS === 'web') {
            const imageResponse = await fetch(image.url);
            const blob = await imageResponse.blob();
            formData.append('image', blob, `coin-image-${i}.jpg`);
          } else {
            formData.append('image', {
              uri: image.url,
              type: 'image/jpeg',
              name: `coin-image-${i}.jpg`,
            } as any);
          }

          const uploadResponse = await fetch(`${API_URL}/api/coins/${coinId}/images`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('EditCoin: Image upload failed:', uploadResponse.status, errorText);
          } else {
            const uploadData = await uploadResponse.json();
            console.log(`EditCoin: Image ${i + 1} uploaded successfully:`, uploadData.id);
            uploadedCount++;
          }
        } catch (imageError) {
          console.error(`EditCoin: Error uploading image ${i + 1}:`, imageError);
        }
      }

      console.log('EditCoin: Uploaded', uploadedCount, 'out of', newImages.length, 'new images');

      Alert.alert(
        'Success!',
        'Your coin has been updated.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('EditCoin: Navigating back');
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('EditCoin: Error updating coin:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update coin. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Coin',
      'Are you sure you want to delete this coin? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('EditCoin: User confirmed delete');
            setLoading(true);
            
            try {
              const response = await fetch(`${API_URL}/api/coins/${coinId}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              console.log('EditCoin: Delete response status:', response.status);

              if (!response.ok) {
                const errorText = await response.text();
                console.error('EditCoin: Delete failed:', response.status, errorText);
                throw new Error('Failed to delete coin');
              }

              console.log('EditCoin: Coin deleted successfully');
              Alert.alert('Deleted', 'Your coin has been deleted.', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]);
            } catch (error: any) {
              console.error('EditCoin: Error deleting coin:', error);
              Alert.alert('Error', 'Failed to delete coin. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loadingCoin) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Edit Coin',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading coin data...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Coin',
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
              {images.map((image, index) => (
                <View key={`image-${index}-${image.id || 'new'}`} style={styles.imageContainer}>
                  <Image source={{ uri: image.url }} style={styles.image} />
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
                  console.log('EditCoin: User set visibility to public');
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
                  console.log('EditCoin: User set visibility to private');
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
                  console.log('EditCoin: User set trade status to not for trade');
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
                  console.log('EditCoin: User set trade status to open to trade');
                  setTradeStatus('open_to_trade');
                }}
              >
                <Text style={[styles.toggleText, tradeStatus === 'open_to_trade' && styles.toggleTextActive]}>
                  Open to Trade
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton, loading && styles.submitButtonDisabled]}
            onPress={handleDelete}
            disabled={loading}
          >
            <Text style={styles.deleteButtonText}>Delete Coin</Text>
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
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
