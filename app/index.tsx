
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  console.log('Index screen - loading:', loading, 'user:', user?.username, 'email:', user?.email);

  useEffect(() => {
    console.log('Index screen mounted - App starting');
    console.log('App version: 1.0.18 (Build 18)');
  }, []);

  useEffect(() => {
    console.log('Index screen - Auth state changed:', { 
      loading, 
      hasUser: !!user, 
      username: user?.username,
      email: user?.email,
      needsProfileCompletion: user?.needsProfileCompletion 
    });
  }, [loading, user]);

  // Always show loading while checking auth
  if (loading) {
    console.log('Showing loading indicator');
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🪙</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading CoinHub...</Text>
      </View>
    );
  }

  // Prevent multiple redirects
  if (hasRedirected) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🪙</Text>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No user at all - redirect to login screen
  if (!user) {
    console.log('No user found - redirecting to login screen');
    setHasRedirected(true);
    return <Redirect href="/auth" />;
  }

  // User exists but needs profile completion - redirect to profile completion screen
  if (user.needsProfileCompletion) {
    console.log('User needs profile completion - redirecting to complete-profile screen');
    setHasRedirected(true);
    return <Redirect href="/complete-profile" />;
  }

  // User is authenticated and has complete profile - go to home
  console.log('User authenticated with complete profile - redirecting to home feed');
  setHasRedirected(true);
  return <Redirect href="/(tabs)/(home)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  logo: {
    fontSize: 48,
    marginBottom: 24,
  },
  loadingText: {
    color: colors.text,
    marginTop: 16,
    fontSize: 16,
  },
});
