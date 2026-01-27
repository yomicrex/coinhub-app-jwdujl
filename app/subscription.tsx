
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedFetch } from '@/utils/api';
import Constants from 'expo-constants';
import * as IAP from 'react-native-iap';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';

const PRODUCT_ID = 'coinhub_premium_monthly';

interface SubscriptionStatus {
  tier: 'free' | 'premium';
  coinsUploadedThisMonth: number;
  tradesInitiatedThisMonth: number;
  subscriptionExpiresAt: string | null;
  limits: {
    maxCoins: number | null;
    maxTrades: number | null;
  };
}

interface Product {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
}

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    initializeIAP();
    fetchSubscriptionStatus();

    return () => {
      IAP.endConnection();
    };
  }, []);

  const initializeIAP = async () => {
    console.log('SubscriptionScreen: Initializing IAP');
    try {
      await IAP.initConnection();
      console.log('SubscriptionScreen: IAP connection initialized');

      const products = await IAP.getSubscriptions({ skus: [PRODUCT_ID] });
      console.log('SubscriptionScreen: Products fetched:', products);

      if (products && products.length > 0) {
        const productData = products[0];
        setProduct({
          productId: productData.productId,
          title: productData.title || 'Premium Subscription',
          description: productData.description || 'Unlimited coins and trades',
          price: productData.price || '$2.99',
          currency: productData.currency || 'USD',
          localizedPrice: productData.localizedPrice || '$2.99',
        });
      } else {
        console.warn('SubscriptionScreen: No products found for ID:', PRODUCT_ID);
      }
    } catch (error) {
      console.error('SubscriptionScreen: Error initializing IAP:', error);
    }
  };

  const fetchSubscriptionStatus = async () => {
    console.log('SubscriptionScreen: Fetching subscription status');
    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/subscription/status`);
      if (response.ok) {
        const data = await response.json();
        console.log('SubscriptionScreen: Status received:', data);
        setStatus(data);
      } else {
        console.error('SubscriptionScreen: Failed to fetch status, status:', response.status);
      }
    } catch (error) {
      console.error('SubscriptionScreen: Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    console.log('SubscriptionScreen: User tapped subscribe button');
    setSubscribing(true);

    try {
      console.log('SubscriptionScreen: Requesting purchase for product:', PRODUCT_ID);
      const purchase = await IAP.requestSubscription({ sku: PRODUCT_ID });
      console.log('SubscriptionScreen: Purchase response:', purchase);

      if (purchase) {
        const receipt = purchase.transactionReceipt;
        const platformName = Platform.OS === 'ios' ? 'ios' : 'android';

        console.log('SubscriptionScreen: Validating receipt with backend');
        const response = await authenticatedFetch(`${API_URL}/api/subscription/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receipt,
            platform: platformName,
            productId: PRODUCT_ID,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('SubscriptionScreen: Subscription activated:', data);

          await IAP.finishTransaction({ purchase, isConsumable: false });
          console.log('SubscriptionScreen: Transaction finished');

          setShowSuccessModal(true);
          await fetchSubscriptionStatus();
        } else {
          const errorData = await response.json();
          console.error('SubscriptionScreen: Failed to activate subscription:', errorData);
          setErrorMessage(errorData.error || 'Failed to activate subscription');
          setShowErrorModal(true);
        }
      }
    } catch (error: any) {
      console.error('SubscriptionScreen: Error during purchase:', error);
      if (error.code === 'E_USER_CANCELLED') {
        console.log('SubscriptionScreen: User cancelled purchase');
      } else {
        setErrorMessage(error.message || 'An error occurred during purchase');
        setShowErrorModal(true);
      }
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestorePurchases = async () => {
    console.log('SubscriptionScreen: User tapped restore purchases');
    setRestoring(true);

    try {
      console.log('SubscriptionScreen: Getting purchase history');
      const purchases = await IAP.getPurchaseHistory();
      console.log('SubscriptionScreen: Purchase history:', purchases);

      if (purchases && purchases.length > 0) {
        const latestPurchase = purchases[0];
        const receipt = latestPurchase.transactionReceipt;
        const platformName = Platform.OS === 'ios' ? 'ios' : 'android';

        console.log('SubscriptionScreen: Restoring subscription with backend');
        const response = await authenticatedFetch(`${API_URL}/api/subscription/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receipt,
            platform: platformName,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('SubscriptionScreen: Subscription restored:', data);
          setShowSuccessModal(true);
          await fetchSubscriptionStatus();
        } else {
          const errorData = await response.json();
          console.error('SubscriptionScreen: Failed to restore subscription:', errorData);
          setErrorMessage(errorData.error || 'No purchases found to restore');
          setShowErrorModal(true);
        }
      } else {
        console.log('SubscriptionScreen: No purchases found to restore');
        setErrorMessage('No purchases found to restore');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('SubscriptionScreen: Error restoring purchases:', error);
      setErrorMessage(error.message || 'Failed to restore purchases');
      setShowErrorModal(true);
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    console.log('SubscriptionScreen: User tapped manage subscription');
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Subscription', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subscription details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Subscription', headerShown: true }} />
        <View style={styles.errorContainer}>
          <IconSymbol ios_icon_name="exclamationmark.triangle" android_material_icon_name="warning" size={64} color={colors.error} />
          <Text style={styles.errorText}>Failed to load subscription details</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchSubscriptionStatus}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = status.tier === 'premium';
  const coinsUsedText = `${status.coinsUploadedThisMonth}`;
  const coinsLimitText = status.limits.maxCoins ? `${status.limits.maxCoins}` : 'Unlimited';
  const tradesUsedText = `${status.tradesInitiatedThisMonth}`;
  const tradesLimitText = status.limits.maxTrades ? `${status.limits.maxTrades}` : 'Unlimited';
  const displayPrice = product?.localizedPrice || '$2.99';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Subscription', headerShown: true }} />
      
      <ScrollView>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusBadge}>
              <IconSymbol
                ios_icon_name={isPremium ? 'star.fill' : 'person.fill'}
                android_material_icon_name={isPremium ? 'star' : 'person'}
                size={20}
                color={isPremium ? '#FFB800' : colors.textSecondary}
              />
              <Text style={[styles.statusBadgeText, isPremium && styles.premiumText]}>
                {isPremium ? 'Premium' : 'Free'}
              </Text>
            </View>
          </View>

          <Text style={styles.statusTitle}>Current Plan</Text>
          <Text style={styles.statusDescription}>
            {isPremium
              ? 'You have unlimited access to all features'
              : 'Upgrade to Premium for unlimited coins and trades'}
          </Text>

          <View style={styles.usageSection}>
            <Text style={styles.usageSectionTitle}>This Month</Text>
            
            <View style={styles.usageItem}>
              <View style={styles.usageItemHeader}>
                <IconSymbol
                  ios_icon_name="photo.stack"
                  android_material_icon_name="collections"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.usageItemLabel}>Coins Uploaded</Text>
              </View>
              <View style={styles.usageItemValue}>
                <Text style={styles.usageNumber}>{coinsUsedText}</Text>
                <Text style={styles.usageSeparator}>/</Text>
                <Text style={styles.usageLimit}>{coinsLimitText}</Text>
              </View>
            </View>

            <View style={styles.usageItem}>
              <View style={styles.usageItemHeader}>
                <IconSymbol
                  ios_icon_name="arrow.2.squarepath"
                  android_material_icon_name="sync"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.usageItemLabel}>Trades Initiated</Text>
              </View>
              <View style={styles.usageItemValue}>
                <Text style={styles.usageNumber}>{tradesUsedText}</Text>
                <Text style={styles.usageSeparator}>/</Text>
                <Text style={styles.usageLimit}>{tradesLimitText}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresSectionTitle}>Premium Features</Text>
          
          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <IconSymbol
                ios_icon_name="infinity"
                android_material_icon_name="all-inclusive"
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Unlimited Coin Uploads</Text>
              <Text style={styles.featureDescription}>
                Upload as many coins as you want to your collection
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <IconSymbol
                ios_icon_name="arrow.2.squarepath"
                android_material_icon_name="sync"
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Unlimited Trades</Text>
              <Text style={styles.featureDescription}>
                Initiate as many trades as you want each month
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={24}
                color="#FFB800"
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Premium Badge</Text>
              <Text style={styles.featureDescription}>
                Stand out with a premium badge on your profile
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.pricingAmount}>{displayPrice}</Text>
          <Text style={styles.pricingPeriod}>per month</Text>
          <Text style={styles.pricingNote}>Cancel anytime</Text>
        </View>

        {!isPremium ? (
          <>
            <TouchableOpacity
              style={[styles.subscribeButton, subscribing && styles.subscribeButtonDisabled]}
              onPress={handleSubscribe}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="star.fill"
                    android_material_icon_name="star"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={styles.subscribeButtonText}>Upgrade to Premium</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.restoreButton, restoring && styles.restoreButtonDisabled]}
              onPress={handleRestorePurchases}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={handleManageSubscription}
          >
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.manageButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}

        {!isPremium && (
          <View style={styles.freeTierInfo}>
            <Text style={styles.freeTierTitle}>Free Tier Limits</Text>
            <Text style={styles.freeTierText}>• {status.limits.maxCoins || 25} coin uploads total</Text>
            <Text style={styles.freeTierText}>• {status.limits.maxTrades || 1} trade per month</Text>
            <Text style={styles.freeTierText}>• Trade limit resets on the 1st of each month</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={64}
              color={colors.success}
            />
            <Text style={styles.modalTitle}>Welcome to Premium!</Text>
            <Text style={styles.modalMessage}>
              You now have unlimited access to all features
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={64}
              color={colors.error}
            />
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  statusCard: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusHeader: {
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  premiumText: {
    color: '#FFB800',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  usageSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  usageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  usageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  usageItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageItemLabel: {
    fontSize: 14,
    color: colors.text,
  },
  usageItemValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  usageNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  usageSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  usageLimit: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  featuresSection: {
    margin: 16,
    marginTop: 0,
  },
  featuresSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  featureCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 12,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pricingCard: {
    margin: 16,
    marginTop: 0,
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  pricingAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
  },
  pricingPeriod: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    gap: 8,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.background,
  },
  restoreButton: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  freeTierInfo: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freeTierTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  freeTierText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
