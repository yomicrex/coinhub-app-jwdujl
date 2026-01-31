
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
 * Get the X-App-Type header value for backend requests
 * CRITICAL: This determines how the backend treats the request (mobile vs browser)
 * Returns: "standalone" for TestFlight/App Store, "expo-go" for Expo Go, "unknown" otherwise
 */
function getAppType(): 'standalone' | 'expo-go' | 'unknown' {
  if (isStandalone()) {
    return 'standalone';
  }
  if (isExpoGo()) {
    return 'expo-go';
  }
  return 'unknown';
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
 * CRITICAL: In production builds (!__DEV__), we default to standalone if appOwnership is undefined
 * This ensures TestFlight builds are always correctly identified as standalone
 */
function isStandalone(): boolean {
  // Explicit standalone check
  if (Constants.appOwnership === 'standalone') {
    return true;
  }
  
  // In production builds, if appOwnership is not 'expo', assume standalone
  // This handles edge cases where appOwnership might be undefined in TestFlight
  if (!__DEV__ && Constants.appOwnership !== 'expo') {
    console.log('[ENV] Production build with non-expo appOwnership, treating as standalone');
    return true;
  }
  
  return false;
}

// Export configuration
export const ENV = {
  BACKEND_URL: getBackendUrl(),
  APP_SCHEME: getAppScheme(),
  APP_NAME: getAppName(),
  IS_DEV: isDevelopment(),
  IS_EXPO_GO: isExpoGo(),
  IS_STANDALONE: isStandalone(),
  APP_TYPE: getAppType(),
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
  appType: ENV.APP_TYPE,
  platform: ENV.PLATFORM,
  appOwnership: Constants.appOwnership,
});

export default ENV;
