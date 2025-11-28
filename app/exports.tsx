import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download, CheckCircle, Clock, XCircle, Smartphone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import * as WebBrowser from 'expo-web-browser';

type Export = {
  id: string;
  clip_id: string;
  status: string;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
  settings: any;
  error_message: string | null;
  clip?: {
    title: string;
  };
};

export default function ExportsScreen() {
  const { user } = useAuth();
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchExports();
  }, [user]);

  const fetchExports = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('exports')
        .select(`
          id,
          clip_id,
          status,
          output_url,
          created_at,
          completed_at,
          settings,
          error_message,
          clip:clips(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExports(data || []);
    } catch (err) {
      console.error('Error fetching exports:', err);
      Alert.alert('Error', 'Failed to load exports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExports();
  };

  const handleDownload = async (exportItem: Export) => {
    if (!exportItem.output_url) {
      Alert.alert('Not Ready', 'This export is still processing');
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(exportItem.output_url);
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Failed to open download link');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} color={Colors.status.success} />;
      case 'failed':
        return <XCircle size={20} color={Colors.status.error} />;
      case 'processing':
      case 'pending':
        return <Clock size={20} color={Colors.status.warning} />;
      default:
        return <Clock size={20} color={Colors.text.secondary} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.status.success;
      case 'failed':
        return Colors.status.error;
      case 'processing':
      case 'pending':
        return Colors.status.warning;
      default:
        return Colors.text.secondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFormatBadge = (settings: any) => {
    if (settings?.format) {
      const formatNames: Record<string, string> = {
        tiktok: 'TikTok',
        reels: 'Reels',
        shorts: 'Shorts',
      };
      return formatNames[settings.format] || 'Standard';
    }
    return 'Standard';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.back()}>
              <ArrowLeft size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Exports</Text>
            <View style={styles.headerButton} />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading exports...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}>
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Exports</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }>
          {exports.length === 0 ? (
            <View style={styles.emptyState}>
              <Download size={64} color="#475569" />
              <Text style={styles.emptyTitle}>No Exports Yet</Text>
              <Text style={styles.emptyDescription}>
                Your exported videos will appear here once you create them
              </Text>
            </View>
          ) : (
            <View style={styles.exportsList}>
              {exports.map((exportItem) => (
                <View key={exportItem.id} style={styles.exportCard}>
                  <View style={styles.exportHeader}>
                    <View style={styles.exportInfo}>
                      <Text style={styles.exportTitle} numberOfLines={1}>
                        {exportItem.clip?.title || 'Untitled Clip'}
                      </Text>
                      <Text style={styles.exportDate}>
                        {formatDate(exportItem.created_at)}
                      </Text>
                    </View>
                    <View style={styles.formatBadge}>
                      <Smartphone size={14} color="#ffffff" />
                      <Text style={styles.formatText}>
                        {getFormatBadge(exportItem.settings)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exportStatus}>
                    {getStatusIcon(exportItem.status)}
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(exportItem.status) },
                      ]}>
                      {exportItem.status.charAt(0).toUpperCase() +
                        exportItem.status.slice(1)}
                    </Text>
                  </View>

                  {exportItem.error_message && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>
                        {exportItem.error_message}
                      </Text>
                    </View>
                  )}

                  {exportItem.status === 'completed' && exportItem.output_url && (
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownload(exportItem)}
                      activeOpacity={0.7}>
                      <Download size={18} color="#ffffff" />
                      <Text style={styles.downloadButtonText}>
                        Download / Preview
                      </Text>
                    </TouchableOpacity>
                  )}

                  {exportItem.status === 'processing' && (
                    <View style={styles.processingInfo}>
                      <Text style={styles.processingText}>
                        Processing video... This may take 1-3 minutes
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  exportsList: {
    gap: 16,
  },
  exportCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exportInfo: {
    flex: 1,
    marginRight: 12,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  exportDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  formatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  exportStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 16,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    shadowColor: Colors.shadow.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  processingInfo: {
    backgroundColor: '#422006',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  processingText: {
    fontSize: 12,
    color: '#fcd34d',
    textAlign: 'center',
    lineHeight: 16,
  },
});
