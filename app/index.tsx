
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();

  console.log('Index screen - loading:', loading, 'user:', user?.username);

  useEffect(() => {
    console.log('Index screen mounted');
  }, []);

  if (loading) {
    console.log('Showing loading indicator');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16, fontSize: 16 }}>Loading CoinHub...</Text>
      </View>
    );
  }

  if (!user) {
    console.log('No user, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (user.needsProfileCompletion) {
    console.log('User needs profile completion, staying on auth');
    return <Redirect href="/auth" />;
  }

  console.log('User authenticated, redirecting to home');
  return <Redirect href="/(tabs)/(home)" />;
}
