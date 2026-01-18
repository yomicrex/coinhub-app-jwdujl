
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    console.log('RootLayout mounted - App is starting');
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
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-coin" options={{ title: 'Add Coin', presentation: 'modal' }} />
          <Stack.Screen name="edit-coin" options={{ title: 'Edit Coin', presentation: 'modal' }} />
          <Stack.Screen name="coin-detail" options={{ title: 'Coin Details' }} />
          <Stack.Screen name="coin-comments" options={{ title: 'Comments' }} />
          <Stack.Screen name="user-profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
          <Stack.Screen name="trade-detail" options={{ title: 'Trade Details' }} />
          <Stack.Screen name="search-users" options={{ title: 'Search Users' }} />
          <Stack.Screen name="user-list" options={{ title: 'Users' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  );
}
