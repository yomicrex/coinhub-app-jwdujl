
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/styles/commonStyles';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function EditCoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [agency, setAgency] = useState('');
  const [unit, setUnit] = useState('');
  const [coinNumber, setCoinNumber] = useState('');
  const [deployment, setDeployment] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [version, setVersion] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [description, setDescription] = useState('');
  const [tradeStatus, setTradeStatus] = useState<'not_for_trade' | 'open_to_trade'>('not_for_trade');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    console.log('EditCoinScreen: Component mounted, coinId:', id);
    if (!id) {
      console.error('EditCoinScreen: No coin ID provided');
      Alert.alert('Error', 'No coin ID provided');
      router.back();
      return;
    }

    fetchCoinData();
  }, [id]);

  const fetchCoinData = async () => {
    try {
      console.log('EditCoinScreen: Fetching coin data for ID:', id);
      const response = await fetch(`${API_URL}/api/coins/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('EditCoinScreen: Failed to fetch coin, status:', response.status);
        throw new Error('Failed to fetch coin');
      }

      const data = await response.json();
      const coin = data.coin || data;
      console.log('EditCoinScreen: Coin data loaded:', coin);

      // Populate form fields
      setTitle(coin.title || '');
      setAgency(coin.agency || '');
      setUnit(coin.unit || '');
      setCoinNumber(coin.coinNumber || '');
      setDeployment(coin.deployment || '');
      setCountry(coin.country || '');
      setYear(coin.year?.toString() || '');
      setVersion(coin.version || '');
      setManufacturer(coin.manufacturer || '');
      setDescription(coin.description || '');
      setTradeStatus(coin.tradeStatus || 'not_for_trade');
      setImages(coin.images?.map((img: any) => img.url) || []);
      setLoading(false);
    } catch (error: any) {
      console.error('EditCoinScreen: Error fetching coin:', error);
      Alert.alert('Error', error.message || 'Failed to load coin');
      setLoading(false);
      router.back();
    }
  };

  const pickImages = async () => {
    console.log('EditCoinScreen: User tapped pick images');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      console.log('EditCoinScreen: Selected', newImages.length, 'images');
      setImages([...images, ...newImages]);
    }
  };

  const takePhoto = async () => {
    console.log('EditCoinScreen: User tapped take photo');
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('EditCoinScreen: Photo taken');
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    console.log('EditCoinScreen: Removing image at index', index);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('EditCoinScreen: User tapped save button');
    
    // Validate required fields
    if (!agency || !country || !year) {
      console.log('EditCoinScreen: Missing required fields');
      Alert.alert('Error', 'Please fill in Agency, Country, and Year (all are required)');
      return;
    }

    if (images.length === 0) {
      console.log('EditCoinScreen: No images selected');
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    console.log('EditCoinScreen: Updating coin with data:', { 
      title, 
      agency, 
      unit, 
      coinNumber, 
      deployment, 
      country, 
      year, 
      version, 
      manufacturer, 
      description, 
      tradeStatus 
    });
    setSaving(true);

    try {
      // Update coin data
      const coinData = {
        title: title || `${agency} Coin`,
        agency,
        unit: unit || undefined,
        coinNumber: coinNumber || undefined,
        deployment: deployment || undefined,
        country,
        year: parseInt(year),
        version: version || undefined,
        manufacturer: manufacturer || undefined,
        description: description || undefined,
        visibility: 'public',
        tradeStatus,
      };

      console.log('EditCoinScreen: Sending coin data to backend:', coinData);

      const coinResponse = await fetch(`${API_URL}/api/coins/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(coinData),
      });

      if (!coinResponse.ok) {
        const errorText = await coinResponse.text();
        console.error('EditCoinScreen: Failed to update coin, status:', coinResponse.status, 'error:', errorText);
        throw new Error(`Failed to update coin: ${errorText}`);
      }

      console.log('EditCoinScreen: Coin updated successfully');

      // Check if there are any new images to upload (images that start with file:// or content://)
      const newImages = images.filter(uri => uri.startsWith('file://') || uri.startsWith('content://'));
      
      if (newImages.length > 0) {
        console.log('EditCoinScreen: Uploading', newImages.length, 'new images');
        
        let uploadedCount = 0;
        let failedCount = 0;
        
        for (let i = 0; i < newImages.length; i++) {
          console.log('EditCoinScreen: Uploading new image', i + 1, 'of', newImages.length);
          
          try {
            const formData = new FormData();
            const uri = newImages[i];
            const filename = uri.split('/').pop() || 'image.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
              uri,
              name: filename,
              type,
            } as any);

            // Use the index in the full images array for proper ordering
            const imageIndex = images.indexOf(uri);
            formData.append('orderIndex', imageIndex.toString());

            console.log('EditCoinScreen: Uploading to:', `${API_URL}/api/coins/${id}/images`);
            
            const imageResponse = await fetch(`${API_URL}/api/coins/${id}/images`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });

            console.log('EditCoinScreen: Image', i + 1, 'upload response status:', imageResponse.status);

            if (!imageResponse.ok) {
              const errorText = await imageResponse.text();
              console.error('EditCoinScreen: Failed to upload image', i + 1, 'error:', errorText);
              failedCount++;
            } else {
              console.log('EditCoinScreen: Image', i + 1, 'uploaded successfully');
              uploadedCount++;
            }
          } catch (error) {
            console.error('EditCoinScreen: Error uploading image', i + 1, ':', error);
            failedCount++;
          }
        }

        console.log('EditCoinScreen: Upload complete -', uploadedCount, 'succeeded,', failedCount, 'failed');

        if (failedCount > 0) {
          Alert.alert(
            'Partial Success',
            `Coin updated! ${uploadedCount} new image(s) uploaded successfully, ${failedCount} failed.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          Alert.alert('Success', 'Coin and images updated successfully!', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      } else {
        Alert.alert('Success', 'Coin updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      console.error('EditCoinScreen: Error updating coin:', error);
      Alert.alert('Error', error.message || 'Failed to update coin');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Edit Coin',
            headerBackTitle: 'Cancel',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading coin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Coin',
          headerBackTitle: 'Cancel',
          headerRight: () => (
            <TouchableOpacity onPress={handleSubmit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={100}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
          <Text style={styles.label}>Agency * (Required)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., U.S. Navy, U.S. Army, FBI"
            placeholderTextColor={colors.textSecondary}
            value={agency}
            onChangeText={setAgency}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Unit</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 1st Battalion, 5th Regiment"
            placeholderTextColor={colors.textSecondary}
            value={unit}
            onChangeText={setUnit}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Coin Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., #123, Serial 456"
            placeholderTextColor={colors.textSecondary}
            value={coinNumber}
            onChangeText={setCoinNumber}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Deployment</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Operation Desert Storm, Afghanistan 2010"
            placeholderTextColor={colors.textSecondary}
            value={deployment}
            onChangeText={setDeployment}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Country * (Required)</Text>
            <TextInput
              style={styles.input}
              placeholder="USA"
              placeholderTextColor={colors.textSecondary}
              value={country}
              onChangeText={setCountry}
            />
          </View>

          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Year * (Required)</Text>
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
          <Text style={styles.label}>Version</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Limited Edition, Version 2.0"
            placeholderTextColor={colors.textSecondary}
            value={version}
            onChangeText={setVersion}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Manufacturer</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Northwest Territorial Mint"
            placeholderTextColor={colors.textSecondary}
            value={manufacturer}
            onChangeText={setManufacturer}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Additional Information</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us more about this coin..."
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
                console.log('EditCoinScreen: Set trade status to not_for_trade');
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
                console.log('EditCoinScreen: Set trade status to open_to_trade');
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
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
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
