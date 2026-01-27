
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
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedFetch, authenticatedUpload } from '@/utils/api';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

export default function AddCoinScreen() {
  const { user } = useAuth();
  const router = useRouter();
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
  const [version, setVersion] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [tradeStatus, setTradeStatus] = useState<'not_for_trade' | 'open_to_trade'>('not_for_trade');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [uploadLimit, setUploadLimit] = useState<{ coinsUploadedThisMonth: number; limit: number | null } | null>(null);

  useEffect(() => {
    checkUploadLimit();
  }, []);

  const checkUploadLimit = async () => {
    console.log('AddCoinScreen: Checking upload limit');
    setCheckingLimit(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/subscription/can-upload-coin`);
      if (response.ok) {
        const data = await response.json();
        console.log('AddCoinScreen: Upload limit check result:', data);
        setCanUpload(data.canUpload);
        setUploadLimit({
          coinsUploadedThisMonth: data.coinsUploadedThisMonth,
          limit: data.limit,
        });

        if (!data.canUpload) {
          console.log('AddCoinScreen: User has reached upload limit');
        }
      } else {
        console.error('AddCoinScreen: Failed to check upload limit');
      }
    } catch (error) {
      console.error('AddCoinScreen: Error checking upload limit:', error);
    } finally {
      setCheckingLimit(false);
    }
  };

  const pickImages = async () => {
    console.log('AddCoinScreen: User tapped pick images');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...newImages]);
      console.log('AddCoinScreen: Images selected:', newImages.length);
    }
  };

  const takePhoto = async () => {
    console.log('AddCoinScreen: User tapped take photo');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
      console.log('AddCoinScreen: Photo taken');
    }
  };

  const removeImage = (index: number) => {
    console.log('AddCoinScreen: Removing image at index:', index);
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('AddCoinScreen: User tapped submit button');

    if (!title.trim() || !country.trim() || !year.trim()) {
      Alert.alert('Missing Information', 'Please fill in title, country, and year');
      return;
    }

    if (images.length === 0) {
      Alert.alert('No Images', 'Please add at least one image of your coin');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('country', country.trim());
      formData.append('year', year.trim());
      if (unit.trim()) formData.append('unit', unit.trim());
      if (organization.trim()) formData.append('organization', organization.trim());
      if (agency.trim()) formData.append('agency', agency.trim());
      if (deployment.trim()) formData.append('deployment', deployment.trim());
      if (coinNumber.trim()) formData.append('coinNumber', coinNumber.trim());
      if (mintMark.trim()) formData.append('mintMark', mintMark.trim());
      if (condition.trim()) formData.append('condition', condition.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (version.trim()) formData.append('version', version.trim());
      if (manufacturer.trim()) formData.append('manufacturer', manufacturer.trim());
      formData.append('visibility', visibility);
      formData.append('tradeStatus', tradeStatus);

      images.forEach((imageUri, index) => {
        const filename = imageUri.split('/').pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('images', {
          uri: imageUri,
          name: filename,
          type,
        } as any);
      });

      console.log('AddCoinScreen: Uploading coin data');
      const response = await authenticatedUpload(`${API_URL}/api/coins`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('AddCoinScreen: Coin created successfully:', data);

        await authenticatedFetch(`${API_URL}/api/subscription/track-coin-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        console.log('AddCoinScreen: Coin upload tracked');

        Alert.alert('Success', 'Your coin has been added!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        const errorData = await response.json();
        console.error('AddCoinScreen: Failed to create coin:', errorData);
        Alert.alert('Error', errorData.error || 'Failed to add coin');
      }
    } catch (error) {
      console.error('AddCoinScreen: Error creating coin:', error);
      Alert.alert('Error', 'An error occurred while adding your coin');
    } finally {
      setUploading(false);
    }
  };

  if (checkingLimit) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Add Coin', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking upload limit...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!canUpload && uploadLimit) {
    const limitText = uploadLimit.limit ? `${uploadLimit.limit}` : 'unlimited';
    const uploadedText = `${uploadLimit.coinsUploadedThisMonth}`;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Add Coin', headerShown: true }} />
        <View style={styles.limitReachedContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={64}
            color={colors.error}
          />
          <Text style={styles.limitReachedTitle}>Upload Limit Reached</Text>
          <Text style={styles.limitReachedText}>
            You have uploaded {uploadedText} of {limitText} coins this month.
          </Text>
          <Text style={styles.limitReachedSubtext}>
            Upgrade to Premium for unlimited coin uploads!
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/subscription')}
          >
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={20}
              color={colors.background}
            />
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Add Coin', headerShown: true }} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Images *</Text>
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={24}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <IconSymbol
                  ios_icon_name="photo"
                  android_material_icon_name="photo"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text style={styles.addImageText}>Add Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                <IconSymbol
                  ios_icon_name="camera"
                  android_material_icon_name="camera"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text style={styles.addImageText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Title *"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Country *"
              placeholderTextColor={colors.textSecondary}
              value={country}
              onChangeText={setCountry}
            />
            <TextInput
              style={styles.input}
              placeholder="Year *"
              placeholderTextColor={colors.textSecondary}
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Unit"
              placeholderTextColor={colors.textSecondary}
              value={unit}
              onChangeText={setUnit}
            />
            <TextInput
              style={styles.input}
              placeholder="Organization"
              placeholderTextColor={colors.textSecondary}
              value={organization}
              onChangeText={setOrganization}
            />
            <TextInput
              style={styles.input}
              placeholder="Agency"
              placeholderTextColor={colors.textSecondary}
              value={agency}
              onChangeText={setAgency}
            />
            <TextInput
              style={styles.input}
              placeholder="Deployment"
              placeholderTextColor={colors.textSecondary}
              value={deployment}
              onChangeText={setDeployment}
            />
            <TextInput
              style={styles.input}
              placeholder="Coin Number"
              placeholderTextColor={colors.textSecondary}
              value={coinNumber}
              onChangeText={setCoinNumber}
            />
            <TextInput
              style={styles.input}
              placeholder="Mint Mark"
              placeholderTextColor={colors.textSecondary}
              value={mintMark}
              onChangeText={setMintMark}
            />
            <TextInput
              style={styles.input}
              placeholder="Condition"
              placeholderTextColor={colors.textSecondary}
              value={condition}
              onChangeText={setCondition}
            />
            <TextInput
              style={styles.input}
              placeholder="Version"
              placeholderTextColor={colors.textSecondary}
              value={version}
              onChangeText={setVersion}
            />
            <TextInput
              style={styles.input}
              placeholder="Manufacturer"
              placeholderTextColor={colors.textSecondary}
              value={manufacturer}
              onChangeText={setManufacturer}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Trading</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Visibility</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    visibility === 'public' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setVisibility('public')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      visibility === 'public' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    visibility === 'private' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setVisibility('private')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      visibility === 'private' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Trade Status</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    tradeStatus === 'not_for_trade' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setTradeStatus('not_for_trade')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      tradeStatus === 'not_for_trade' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Not for Trade
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    tradeStatus === 'open_to_trade' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setTradeStatus('open_to_trade')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      tradeStatus === 'open_to_trade' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Open to Trade
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>Add Coin</Text>
            )}
          </TouchableOpacity>
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
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  limitReachedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  limitReachedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  limitReachedText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  limitReachedSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  toggleButtonTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  submitButton: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.background,
  },
});
