
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// CoinHub color scheme - gold and trust-focused colors
export const colors = {
  primary: '#D4AF37',      // Gold (coin color)
  secondary: '#B8860B',    // Dark goldenrod
  accent: '#FFD700',       // Bright gold
  background: '#FFFFFF',   // Clean white background
  backgroundAlt: '#F5F5F5', // Light gray
  text: '#1A1A1A',         // Dark text
  textSecondary: '#666666', // Gray text
  card: '#FFFFFF',         // White cards
  border: '#E0E0E0',       // Light border
  success: '#4CAF50',      // Green for success
  error: '#F44336',        // Red for errors
  highlight: '#FFF8DC',    // Cornsilk highlight
  tradeBadge: '#2196F3',   // Blue for trade badge
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    width: '100%',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: colors.primary,
  },
});
