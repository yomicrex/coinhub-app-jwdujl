
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();
  const [showDebug, setShowDebug] = useState(false);
  const [forceAuth, setForceAuth] = useState(false);
  const [showTest, setShowTest] = useState(false);

  console.log('Index screen - loading:', loading, 'user:', user?.username, 'needsCompletion:', user?.needsProfileCompletion);

  useEffect(() => {
    console.log('Index screen mounted');
    // Show debug info after 1 second if still loading
    const timer = setTimeout(() => {
      if (loading) {
        console.log('Still loading after 1 second, showing debug info');
        setShowDebug(true);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log('Index screen - Auth state changed:', { loading, hasUser: !!user, username: user?.username });
  }, [loading, user]);

  // Show test screen if requested
  if (showTest) {
    return <Redirect href="/test-screen" />;
  }

  if (loading) {
    console.log('Showing loading indicator');
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🪙</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading CoinHub...</Text>
        {showDebug && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>Loading: {loading ? 'true' : 'false'}</Text>
            <Text style={styles.debugText}>User: {user ? 'exists' : 'null'}</Text>
            <Text style={styles.debugText}>Check console for more details</Text>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => setForceAuth(true)}
            >
              <Text style={styles.debugButtonText}>Force Show Auth Screen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, { marginTop: 8, backgroundColor: colors.success }]}
              onPress={() => setShowTest(true)}
            >
              <Text style={styles.debugButtonText}>Show Test Screen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Force show auth if user clicked the debug button
  if (forceAuth) {
    console.log('Force showing auth screen');
    return <Redirect href="/auth" />;
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (user.needsProfileCompletion) {
    console.log('User needs profile completion, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  console.log('User authenticated, redirecting to home');
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
  debugContainer: {
    marginTop: 40,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 300,
  },
  debugText: {
    color: colors.text,
    fontSize: 12,
    marginBottom: 4,
  },
  debugButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
