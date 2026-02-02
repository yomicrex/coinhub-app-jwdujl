
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we load resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if splash screen is already hidden
});

export default function RootLayout() {
  useEffect(() => {
    console.log('RootLayout mounted - App is starting');
    console.log('App version: 1.0.17 (Build 17)');
    
    // Hide splash screen after a short delay to ensure everything is loaded
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // Ignore errors
      });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: '600',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
          <Stack.Screen name="test-screen" options={{ title: 'App Status Test' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-coin" options={{ title: 'Add Coin', presentation: 'modal' }} />
          <Stack.Screen name="edit-coin" options={{ title: 'Edit Coin', presentation: 'modal' }} />
          <Stack.Screen name="coin-detail" options={{ title: 'Coin Details' }} />
          <Stack.Screen name="coin-comments" options={{ title: 'Comments' }} />
          <Stack.Screen name="user-profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
          <Stack.Screen name="trade-detail" options={{ title: 'Trade Details' }} />
          <Stack.Screen name="search-users" options={{ title: 'Search Users' }} />
          <Stack.Screen name="search-coins" options={{ title: 'Search Coins' }} />
          <Stack.Screen name="user-list" options={{ title: 'Users' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
          <Stack.Screen name="subscription" options={{ title: 'Subscription', presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset Password', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  );
}
