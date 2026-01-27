
/**
 * Centralized environment configuration
 * This ensures the backend URL is consistently available across all environments:
 * - Development (Expo Go)
 * - Production (TestFlight/App Store)
 * - Web
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Get the backend URL from environment configuration
 * Priority:
 * 1. Constants.expoConfig?.extra?.backendUrl (from app.json)
 * 2. Hardcoded production URL as fallback
 */
function getBackendUrl(): string {
  // Try to get from app.json extra config
  const configUrl = Constants.expoConfig?.extra?.backendUrl;
  
  if (configUrl) {
    console.log('[ENV] Using backend URL from app.json:', configUrl);
    return configUrl;
  }
  
  // Fallback to hardcoded production URL
  const fallbackUrl = 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev';
  console.log('[ENV] Using fallback backend URL:', fallbackUrl);
  
  return fallbackUrl;
}

/**
 * Get the app scheme for deep linking
 */
function getAppScheme(): string {
  const scheme = Constants.expoConfig?.scheme || 'coinhub';
  console.log('[ENV] Using app scheme:', scheme);
  return scheme;
}

/**
 * Get the app name
 */
function getAppName(): string {
  const name = Constants.expoConfig?.name || 'CoinHub';
  return name;
}

/**
 * Check if running in development mode
 */
function isDevelopment(): boolean {
  return __DEV__;
}

/**
 * Check if running in Expo Go
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Check if running in standalone app (TestFlight/App Store)
 */
function isStandalone(): boolean {
  return Constants.appOwnership === 'standalone';
}

// Export configuration
export const ENV = {
  BACKEND_URL: getBackendUrl(),
  APP_SCHEME: getAppScheme(),
  APP_NAME: getAppName(),
  IS_DEV: isDevelopment(),
  IS_EXPO_GO: isExpoGo(),
  IS_STANDALONE: isStandalone(),
  PLATFORM: Platform.OS,
};

// Log configuration on import (helps with debugging)
console.log('[ENV] Configuration loaded:', {
  backendUrl: ENV.BACKEND_URL,
  appScheme: ENV.APP_SCHEME,
  appName: ENV.APP_NAME,
  isDev: ENV.IS_DEV,
  isExpoGo: ENV.IS_EXPO_GO,
  isStandalone: ENV.IS_STANDALONE,
  platform: ENV.PLATFORM,
});

export default ENV;
