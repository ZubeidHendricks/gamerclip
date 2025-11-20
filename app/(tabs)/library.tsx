import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

type Clip = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  duration: number;
  thumbnail_url: string | null;
  created_at: string;
};

export default function LibraryScreen() {
  const { user } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchClips();

    const channel = supabase
      .channel('library-clips')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setClips((prev) => [payload.new as Clip, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setClips((prev) =>
              prev.map((clip) =>
                clip.id === payload.new.id ? (payload.new as Clip) : clip
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setClips((prev) => prev.filter((clip) => clip.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchClips = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClips(data || []);
    } catch (err) {
      console.error('Error fetching clips:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClips();
    setRefreshing(false);
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'Processing...';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'processing':
        return '#3b82f6';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading clips...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <View style={styles.header}>
            <Text style={styles.title}>My Library</Text>
            <Text style={styles.subtitle}>
              {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
            </Text>
          </View>

          {clips.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Video size={64} color="#475569" />
              </View>
              <Text style={styles.emptyTitle}>No Clips Yet</Text>
              <Text style={styles.emptyDescription}>
                Start by importing a clip from the Home tab
              </Text>
            </View>
          ) : (
            <View style={styles.clipsGrid}>
              {clips.map((clip) => (
                <TouchableOpacity
                  key={clip.id}
                  style={styles.clipCard}
                  onPress={() => router.push(`/clip/${clip.id}`)}
                  activeOpacity={0.7}>
                  <View style={styles.clipThumbnail}>
                    {clip.thumbnail_url ? (
                      <View style={styles.thumbnailPlaceholder}>
                        <Video size={32} color="#64748b" />
                      </View>
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Video size={32} color="#64748b" />
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(clip.status) },
                      ]}>
                      <Text style={styles.statusText}>{clip.status}</Text>
                    </View>
                  </View>

                  <View style={styles.clipInfo}>
                    <Text style={styles.clipTitle} numberOfLines={2}>
                      {clip.title}
                    </Text>
                    <View style={styles.clipMeta}>
                      <Text style={styles.sourceType}>{clip.source_type}</Text>
                      <View style={styles.durationContainer}>
                        <Clock size={12} color="#94a3b8" />
                        <Text style={styles.duration}>
                          {formatDuration(clip.duration)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
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
    backgroundColor: '#0f172a',
  },
  gradient: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  clipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  clipCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clipThumbnail: {
    height: 120,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  clipInfo: {
    padding: 12,
  },
  clipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  clipMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
