import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Download, Trash2, Zap } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import VideoPlayer from '@/components/VideoPlayer';

type Clip = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  duration: number;
  game_title: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  created_at: string;
};

type AIDetection = {
  id: string;
  detection_type: string;
  timestamp: number;
  confidence: number;
  metadata: any;
};

export default function ClipDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [clip, setClip] = useState<Clip | null>(null);
  const [detections, setDetections] = useState<AIDetection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClipDetails();
      fetchDetections();
    }
  }, [id]);

  const fetchClipDetails = async () => {
    try {
      if (!user?.id || !id) return;

      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', id as string)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setClip(data);
    } catch (err) {
      console.error('Error fetching clip:', err);
      Alert.alert('Error', 'Failed to load clip details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetections = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_detections')
        .select('*')
        .eq('clip_id', id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setDetections(data || []);
    } catch (err) {
      console.error('Error fetching detections:', err);
    }
  };

  const handleDelete = () => {
    console.log('handleDelete called!');
    Alert.alert(
      'Delete Clip',
      'Are you sure you want to delete this clip? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.id || !clip) {
                Alert.alert('Error', 'Unable to delete clip');
                return;
              }

              console.log('Deleting clip:', id, 'for user:', user.id);

              if (clip.video_url && clip.source_type === 'upload') {
                const pathMatch = clip.video_url.match(/clips\/(.+)$/);
                if (pathMatch) {
                  console.log('Removing video file:', pathMatch[1]);
                  await supabase.storage
                    .from('clips')
                    .remove([pathMatch[1]])
                    .catch(err => console.error('Storage delete error:', err));
                }
              }

              if (clip.thumbnail_url && clip.thumbnail_url.includes('storage/v1/object/public/thumbnails/')) {
                const thumbMatch = clip.thumbnail_url.match(/thumbnails\/(.+)$/);
                if (thumbMatch) {
                  console.log('Removing thumbnail:', thumbMatch[1]);
                  await supabase.storage
                    .from('thumbnails')
                    .remove([thumbMatch[1]])
                    .catch(err => console.error('Thumbnail delete error:', err));
                }
              }

              console.log('Deleting clip from database...');
              const { error, data } = await supabase
                .from('clips')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id)
                .select();

              console.log('Delete result:', { error, data });

              if (error) {
                console.error('Delete error details:', error);
                throw error;
              }

              if (!data || data.length === 0) {
                throw new Error('Clip not found or already deleted');
              }

              router.back();
            } catch (err: any) {
              console.error('Delete error:', err);
              Alert.alert('Error', err.message || 'Failed to delete clip');
            }
          },
        },
      ]
    );
  };

  const handleExport = () => {
    if (!clip) return;
    router.push(`/export/${clip.id}`);
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDetectionIcon = (type: string) => {
    switch (type) {
      case 'kill':
        return '💀';
      case 'death':
        return '☠️';
      case 'highlight':
        return '⭐';
      case 'clutch':
        return '🔥';
      default:
        return '📌';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading clip...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!clip) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Clip not found</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Clip Details</Text>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: 'rgba(255,0,0,0.1)' }]}
            onPress={() => {
              console.log('DELETE BUTTON PRESSED!');
              handleDelete();
            }}
            activeOpacity={0.7}>
            <Trash2 size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.videoContainer}>
            <VideoPlayer videoUrl={clip.video_url} style={styles.video} />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.clipTitle}>{clip.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.statusBadge, { backgroundColor: clip.status === 'completed' ? '#10b981' : '#3b82f6' }]}>
                <Text style={styles.statusText}>{clip.status}</Text>
              </View>
              <Text style={styles.metaText}>{clip.source_type}</Text>
              {clip.duration > 0 && (
                <Text style={styles.metaText}>{formatTimestamp(clip.duration)}</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Zap size={20} color="#10b981" />
              <Text style={styles.sectionTitle}>AI Detections</Text>
            </View>

            {detections.length === 0 ? (
              <View style={styles.emptyDetections}>
                <Text style={styles.emptyText}>No AI detections yet</Text>
                <Text style={styles.emptySubtext}>Processing in progress...</Text>
              </View>
            ) : (
              <View style={styles.detectionsList}>
                {detections.map((detection) => (
                  <View key={detection.id} style={styles.detectionCard}>
                    <Text style={styles.detectionIcon}>
                      {getDetectionIcon(detection.detection_type)}
                    </Text>
                    <View style={styles.detectionInfo}>
                      <Text style={styles.detectionType}>{detection.detection_type}</Text>
                      <Text style={styles.detectionTime}>
                        {formatTimestamp(detection.timestamp)}
                      </Text>
                    </View>
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(detection.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
              <Download size={20} color="#ffffff" />
              <Text style={styles.actionButtonText}>Export Clip</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    padding: 20,
  },
  videoContainer: {
    marginBottom: 24,
  },
  video: {
    height: 220,
  },
  infoSection: {
    marginBottom: 24,
  },
  clipTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  metaText: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyDetections: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  detectionsList: {
    gap: 8,
  },
  detectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  detectionInfo: {
    flex: 1,
  },
  detectionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  detectionTime: {
    fontSize: 14,
    color: '#94a3b8',
  },
  confidenceBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionsSection: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  backButton: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
