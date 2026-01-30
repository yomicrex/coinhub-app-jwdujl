
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import ENV from '@/config/env';
import Constants from 'expo-constants';

interface AuthDebugLog {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  method?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  error?: string;
  message?: string;
}

// Global debug log storage
const debugLogs: AuthDebugLog[] = [];
const MAX_LOGS = 100;

// Global function to add debug logs
export function addAuthDebugLog(log: Omit<AuthDebugLog, 'timestamp'>) {
  const timestamp = new Date().toISOString();
  debugLogs.unshift({ ...log, timestamp });
  
  // Keep only the most recent logs
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.pop();
  }
  
  // Log to console for immediate visibility
  console.log('[AUTH DEBUG]', log.type.toUpperCase(), log.endpoint, log);
}

// Export function to clear logs
export function clearAuthDebugLogs() {
  debugLogs.length = 0;
  console.log('[AUTH DEBUG] Logs cleared');
}

interface AuthDebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthDebugPanel({ visible, onClose }: AuthDebugPanelProps) {
  const [logs, setLogs] = useState<AuthDebugLog[]>([]);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);

  // Refresh logs every second when visible
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setLogs([...debugLogs]);
    }, 1000);

    // Initial load
    setLogs([...debugLogs]);

    return () => clearInterval(interval);
  }, [visible]);

  const handleCopyDebugReport = async () => {
    const report = generateDebugReport();
    await Clipboard.setStringAsync(report);
    console.log('[AUTH DEBUG] Debug report copied to clipboard');
    alert('Debug report copied to clipboard!');
  };

  const handleClearLogs = () => {
    clearAuthDebugLogs();
    setLogs([]);
    setExpandedLogIndex(null);
  };

  const generateDebugReport = (): string => {
    const sections: string[] = [];

    // Environment Info
    sections.push('=== ENVIRONMENT INFO ===');
    sections.push(`Backend URL: ${ENV.BACKEND_URL}`);
    sections.push(`App Scheme: ${ENV.APP_SCHEME}`);
    sections.push(`Platform: ${Platform.OS}`);
    sections.push(`Is Standalone: ${ENV.IS_STANDALONE}`);
    sections.push(`Is Expo Go: ${ENV.IS_EXPO_GO}`);
    sections.push(`Is Dev: ${ENV.IS_DEV}`);
    sections.push(`App Version: ${Constants.expoConfig?.version || 'unknown'}`);
    sections.push(`Build Number: ${Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'unknown'}`);
    sections.push('');

    // Recent Logs
    sections.push('=== RECENT AUTH LOGS (Most Recent First) ===');
    logs.slice(0, 50).forEach((log, index) => {
      sections.push(`\n[${index + 1}] ${log.timestamp}`);
      sections.push(`Type: ${log.type.toUpperCase()}`);
      sections.push(`Endpoint: ${log.endpoint}`);
      
      if (log.method) sections.push(`Method: ${log.method}`);
      if (log.status) sections.push(`Status: ${log.status}`);
      if (log.message) sections.push(`Message: ${log.message}`);
      if (log.error) sections.push(`Error: ${log.error}`);
      
      if (log.headers) {
        sections.push('Headers:');
        Object.entries(log.headers).forEach(([key, value]) => {
          // Truncate long values (like tokens)
          const displayValue = value.length > 50 ? `${value.substring(0, 50)}...` : value;
          sections.push(`  ${key}: ${displayValue}`);
        });
      }
      
      if (log.body) {
        const bodyPreview = log.body.length > 300 ? `${log.body.substring(0, 300)}...` : log.body;
        sections.push(`Body: ${bodyPreview}`);
      }
    });

    return sections.join('\n');
  };

  const getLogColor = (type: string): string => {
    switch (type) {
      case 'error': return '#FF4444';
      case 'request': return '#4A90E2';
      case 'response': return '#50C878';
      case 'info': return '#FFD700';
      default: return colors.text;
    }
  };

  const getLogIcon = (type: string): string => {
    switch (type) {
      case 'error': return 'error';
      case 'request': return 'arrow-upward';
      case 'response': return 'arrow-downward';
      case 'info': return 'info';
      default: return 'circle';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Auth Debug Mode</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Environment Info */}
        <View style={styles.envSection}>
          <Text style={styles.sectionTitle}>Environment</Text>
          <View style={styles.envRow}>
            <Text style={styles.envLabel}>Backend URL:</Text>
            <Text style={styles.envValue}>{ENV.BACKEND_URL}</Text>
          </View>
          <View style={styles.envRow}>
            <Text style={styles.envLabel}>Platform:</Text>
            <Text style={styles.envValue}>{Platform.OS}</Text>
          </View>
          <View style={styles.envRow}>
            <Text style={styles.envLabel}>Build Type:</Text>
            <Text style={styles.envValue}>
              {ENV.IS_STANDALONE ? 'Standalone (TestFlight/App Store)' : ENV.IS_EXPO_GO ? 'Expo Go' : 'Unknown'}
            </Text>
          </View>
          <View style={styles.envRow}>
            <Text style={styles.envLabel}>App Version:</Text>
            <Text style={styles.envValue}>{Constants.expoConfig?.version || 'unknown'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopyDebugReport}>
            <IconSymbol ios_icon_name="doc.on.clipboard" android_material_icon_name="content-copy" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Copy Debug Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClearLogs}>
            <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Clear Logs</Text>
          </TouchableOpacity>
        </View>

        {/* Logs List */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Recent Logs ({logs.length})</Text>
          <ScrollView style={styles.logsList} showsVerticalScrollIndicator={true}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No logs yet. Perform authentication actions to see logs.</Text>
            ) : (
              logs.map((log, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.logItem}
                  onPress={() => setExpandedLogIndex(expandedLogIndex === index ? null : index)}
                >
                  <View style={styles.logHeader}>
                    <IconSymbol
                      ios_icon_name="circle.fill"
                      android_material_icon_name={getLogIcon(log.type)}
                      size={12}
                      color={getLogColor(log.type)}
                    />
                    <Text style={[styles.logType, { color: getLogColor(log.type) }]}>
                      {log.type.toUpperCase()}
                    </Text>
                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  
                  <Text style={styles.logEndpoint} numberOfLines={1}>
                    {log.method ? `${log.method} ` : ''}{log.endpoint}
                  </Text>
                  
                  {log.status && (
                    <Text style={[styles.logStatus, log.status >= 400 ? styles.logStatusError : styles.logStatusSuccess]}>
                      Status: {log.status}
                    </Text>
                  )}
                  
                  {log.message && (
                    <Text style={styles.logMessage} numberOfLines={expandedLogIndex === index ? undefined : 2}>
                      {log.message}
                    </Text>
                  )}
                  
                  {log.error && (
                    <Text style={styles.logError} numberOfLines={expandedLogIndex === index ? undefined : 2}>
                      Error: {log.error}
                    </Text>
                  )}
                  
                  {expandedLogIndex === index && (
                    <View style={styles.logDetails}>
                      {log.headers && (
                        <View style={styles.logDetailSection}>
                          <Text style={styles.logDetailTitle}>Headers:</Text>
                          {Object.entries(log.headers).map(([key, value]) => (
                            <Text key={key} style={styles.logDetailText}>
                              {key}: {value.length > 50 ? `${value.substring(0, 50)}...` : value}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {log.body && (
                        <View style={styles.logDetailSection}>
                          <Text style={styles.logDetailTitle}>Body:</Text>
                          <Text style={styles.logDetailText}>
                            {log.body.length > 300 ? `${log.body.substring(0, 300)}...` : log.body}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  envSection: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  envRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  envLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 120,
  },
  envValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#FF4444',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logsSection: {
    flex: 1,
    padding: 16,
  },
  logsList: {
    flex: 1,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  logItem: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  logType: {
    fontSize: 12,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  logEndpoint: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logStatus: {
    fontSize: 12,
    marginBottom: 4,
  },
  logStatusSuccess: {
    color: '#50C878',
  },
  logStatusError: {
    color: '#FF4444',
  },
  logMessage: {
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  logError: {
    fontSize: 13,
    color: '#FF4444',
    marginTop: 4,
  },
  logDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logDetailSection: {
    marginBottom: 8,
  },
  logDetailTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  logDetailText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
