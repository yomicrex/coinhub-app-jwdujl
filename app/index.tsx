
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import React from 'react';

export default function Index() {
  const { user, loading } = useAuth();

  console.log('Index: Checking auth state, loading:', loading, 'user:', user);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Not authenticated - go to auth screen
  if (!user) {
    console.log('Index: No user, redirecting to /auth');
    return <Redirect href="/auth" />;
  }

  // Authenticated but profile not complete - go to auth screen for profile completion
  if (!user.hasCompletedProfile || !user.username) {
    console.log('Index: User needs to complete profile, redirecting to /auth');
    return <Redirect href="/auth" />;
  }

  // Fully authenticated with profile - go to main app
  console.log('Index: User authenticated with profile, redirecting to home');
  return <Redirect href="/(tabs)/(home)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
