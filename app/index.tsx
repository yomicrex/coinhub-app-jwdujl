
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();

  console.log('Index screen - loading:', loading, 'user:', user?.username, 'email:', user?.email);

  useEffect(() => {
    console.log('Index screen mounted - App starting');
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

  // No user at all - redirect to login screen
  if (!user) {
    console.log('No user found - redirecting to login screen');
    return <Redirect href="/auth" />;
  }

  // User exists but needs profile completion - redirect to auth screen to complete profile
  if (user.needsProfileCompletion) {
    console.log('User needs profile completion - redirecting to auth screen');
    return <Redirect href="/auth" />;
  }

  // User is authenticated and has complete profile - go to home
  console.log('User authenticated with complete profile - redirecting to home feed');
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
