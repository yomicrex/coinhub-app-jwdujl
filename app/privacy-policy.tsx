
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  console.log('PrivacyPolicyScreen: Screen loaded');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Privacy Policy',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.title}>CoinHub Privacy Policy</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Collection</Text>
            <Text style={styles.paragraph}>
              CoinHub collects only the minimum necessary data to provide our service:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Email address (for authentication)</Text>
              <Text style={styles.bullet}>• Display name</Text>
              <Text style={styles.bullet}>• Optional service affiliation (user-controlled)</Text>
              <Text style={styles.bullet}>• User-uploaded coin images, metadata, logs, and comments</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What We Do Not Require</Text>
            <Text style={styles.paragraph}>
              CoinHub does not require you to provide:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Real name</Text>
              <Text style={styles.bullet}>• Rank or badge numbers</Text>
              <Text style={styles.bullet}>• Deployment details</Text>
              <Text style={styles.bullet}>• Operational information</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility Controls</Text>
            <Text style={styles.paragraph}>
              All user content supports comprehensive visibility controls. You have full control over who can see your:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Coins (Private, Verified-only, or Public)</Text>
              <Text style={styles.bullet}>• Logs (Private, Verified-only, or Public)</Text>
              <Text style={styles.bullet}>• Profile fields (Private, Verified-only, or Public)</Text>
            </View>
            <Text style={styles.paragraph}>
              You decide what information to share and with whom.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Security</Text>
            <Text style={styles.paragraph}>
              CoinHub employs industry-standard security measures to protect your data:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Industry-standard cloud storage</Text>
              <Text style={styles.bullet}>• Passwords are hashed and never stored in plain text</Text>
              <Text style={styles.bullet}>• Role-based access controls</Text>
              <Text style={styles.bullet}>• Secure data transmission using encryption</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Usage</Text>
            <Text style={styles.paragraph}>
              CoinHub does not sell, share, or monetize your personal data. We use your information solely to:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Provide and improve our service</Text>
              <Text style={styles.bullet}>• Enable community features (likes, comments, trading)</Text>
              <Text style={styles.bullet}>• Communicate important updates</Text>
              <Text style={styles.bullet}>• Ensure platform safety and security</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>No Tracking</Text>
            <Text style={styles.paragraph}>
              CoinHub does not engage in:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Advertising tracking</Text>
              <Text style={styles.bullet}>• Cross-platform tracking</Text>
              <Text style={styles.bullet}>• Third-party data sharing for marketing purposes</Text>
              <Text style={styles.bullet}>• Behavioral profiling for advertising</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rights</Text>
            <Text style={styles.paragraph}>
              You have the right to:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Access your personal data</Text>
              <Text style={styles.bullet}>• Request data correction or deletion</Text>
              <Text style={styles.bullet}>• Export your data where feasible</Text>
              <Text style={styles.bullet}>• Control visibility of your content</Text>
              <Text style={styles.bullet}>• Delete your account at any time</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Retention</Text>
            <Text style={styles.paragraph}>
              Upon account deletion, CoinHub may retain anonymized or legally required records. Public content may be removed or anonymized based on your preferences.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.paragraph}>
              For privacy-related questions or requests, please contact us through the app or at our support channels.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By using CoinHub, you acknowledge that you have read and understood this Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletList: {
    marginLeft: 8,
    marginTop: 8,
  },
  bullet: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 4,
  },
  footer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
