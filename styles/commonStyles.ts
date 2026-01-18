
import { StyleSheet } from 'react-native';

export const colors = {
  // Brand colors for CoinHub
  primary: '#D4AF37', // Gold
  primaryDark: '#B8941F',
  secondary: '#2C3E50', // Dark blue-gray
  
  // Backgrounds
  background: '#0F1419',
  surface: '#1A1F26',
  surfaceLight: '#252D38',
  
  // Text
  text: '#E8E8E8',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  
  // Status colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // UI elements
  border: '#374151',
  divider: '#2D3748',
  
  // Trade status colors
  tradeOpen: '#10B981',
  tradePending: '#F59E0B',
  tradeCompleted: '#3B82F6',
  tradeCancelled: '#6B7280',
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
