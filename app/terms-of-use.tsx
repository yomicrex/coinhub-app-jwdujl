
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function TermsOfUseScreen() {
  const router = useRouter();

  console.log('TermsOfUseScreen: Screen loaded');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Terms of Use',
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
          <Text style={styles.title}>CoinHub Terms of Use</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eligibility</Text>
            <Text style={styles.paragraph}>
              Users must be 18 years of age or older to use CoinHub. By creating an account, you confirm that you meet this age requirement.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite-Only Access</Text>
            <Text style={styles.paragraph}>
              CoinHub is an invite-only platform. Access may be revoked at CoinHub's discretion to protect the trust and integrity of the community. We reserve the right to suspend or terminate accounts without prior notice if terms are violated.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Ownership</Text>
            <Text style={styles.paragraph}>
              You retain full ownership of all content you upload to CoinHub, including:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Coin images and photographs</Text>
              <Text style={styles.bullet}>• Descriptions and metadata</Text>
              <Text style={styles.bullet}>• Comments and logs</Text>
              <Text style={styles.bullet}>• Profile information</Text>
            </View>
            <Text style={styles.paragraph}>
              By uploading content, you grant CoinHub a non-exclusive, revocable license to store and display your content within the app for the purpose of providing our service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Disclaimers</Text>
            <Text style={styles.paragraph}>
              CoinHub provides a platform for collectors to catalog and share their collections. However:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• CoinHub does not authenticate coins</Text>
              <Text style={styles.bullet}>• CoinHub does not appraise or determine coin value</Text>
              <Text style={styles.bullet}>• CoinHub does not guarantee historical accuracy</Text>
              <Text style={styles.bullet}>• Physical coins remain the sole responsibility of users</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acceptable Use Policy</Text>
            <Text style={styles.subSectionTitle}>Permitted Activities:</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Cataloging personal challenge coins</Text>
              <Text style={styles.bullet}>• Sharing historical or personal stories</Text>
              <Text style={styles.bullet}>• Respectful community interaction</Text>
              <Text style={styles.bullet}>• Verified trading features when enabled</Text>
            </View>

            <Text style={styles.subSectionTitle}>Prohibited Activities:</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Posting stolen or unlawfully obtained coins</Text>
              <Text style={styles.bullet}>• Impersonation of military, police, or government entities</Text>
              <Text style={styles.bullet}>• Posting classified, sensitive, or operational information</Text>
              <Text style={styles.bullet}>• Harassment, threats, hate speech, or extremist content</Text>
              <Text style={styles.bullet}>• Political campaigning</Text>
              <Text style={styles.bullet}>• Commercial spam or solicitation</Text>
              <Text style={styles.bullet}>• Public pricing, valuation, or cash solicitations</Text>
            </View>

            <Text style={styles.paragraph}>
              Verification badges indicate community trust only and do not constitute official endorsement.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enforcement & Moderation</Text>
            <Text style={styles.paragraph}>
              CoinHub may, at its sole discretion:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Remove content without notice</Text>
              <Text style={styles.bullet}>• Suspend or terminate accounts</Text>
              <Text style={styles.bullet}>• Restrict features or access</Text>
              <Text style={styles.bullet}>• Retain records for legal or safety reasons</Text>
            </View>
            <Text style={styles.paragraph}>
              Appeals are discretionary and not guaranteed. Our moderation decisions are final.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trading Disclaimer</Text>
            <Text style={styles.paragraph}>
              When trading features are enabled:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• CoinHub is not a broker or intermediary</Text>
              <Text style={styles.bullet}>• CoinHub does not take possession of coins</Text>
              <Text style={styles.bullet}>• All trades are peer-to-peer and voluntary</Text>
              <Text style={styles.bullet}>• Users are responsible for shipping, customs, and legal compliance</Text>
              <Text style={styles.bullet}>• Optional escrow or mediation tools do not imply CoinHub liability</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Indemnity & Liability</Text>
            <Text style={styles.paragraph}>
              By using CoinHub, you agree to indemnify CoinHub for claims arising from:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Your uploaded content</Text>
              <Text style={styles.bullet}>• Misrepresentation of coins or information</Text>
              <Text style={styles.bullet}>• Trade disputes with other users</Text>
              <Text style={styles.bullet}>• Legal or intellectual property violations</Text>
            </View>
            <Text style={styles.paragraph}>
              The platform is provided "as is" without warranties. CoinHub is not liable for:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Loss of coins or data</Text>
              <Text style={styles.bullet}>• Trade disputes or failed transactions</Text>
              <Text style={styles.bullet}>• Reputational or emotional harm</Text>
              <Text style={styles.bullet}>• Service interruptions or technical issues</Text>
            </View>
            <Text style={styles.paragraph}>
              CoinHub's liability is limited to amounts paid to CoinHub (if any) in the prior 12 months.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Termination</Text>
            <Text style={styles.paragraph}>
              You may delete your account and export your data where feasible. Upon deletion:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• CoinHub may retain anonymized or legally required records</Text>
              <Text style={styles.bullet}>• Public content may be removed or anonymized based on your preferences</Text>
              <Text style={styles.bullet}>• Your access to the platform will be permanently revoked</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Governing Law</Text>
            <Text style={styles.paragraph}>
              These Terms of Use are governed by the laws of Canada. Disputes will be handled through informal resolution first, followed by arbitration or courts if required.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Changes to Terms</Text>
            <Text style={styles.paragraph}>
              CoinHub reserves the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By using CoinHub, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.
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
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
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
