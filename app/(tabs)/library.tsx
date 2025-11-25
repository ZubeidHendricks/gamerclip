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
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useCallback } from 'react';

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

  useFocusEffect(
    useCallback(() => {
      fetchClips();
    }, [user])
  );

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up real-time subscription for user:', user.id);

    const channel = supabase
      .channel('library-clips')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time event received:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            console.log('Adding new clip to library');
            setClips((prev) => [payload.new as Clip, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            console.log('Updating clip in library');
            setClips((prev) =>
              prev.map((clip) =>
                clip.id === payload.new.id ? (payload.new as Clip) : clip
              )
            );
          } else if (payload.eventType === 'DELETE') {
            console.log('Removing clip from library:', payload.old.id);
            setClips((prev) => prev.filter((clip) => clip.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
        return Colors.status.success;
      case 'processing':
        return Colors.status.info;
      case 'failed':
        return Colors.status.error;
      default:
        return Colors.text.muted;
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
    backgroundColor: Colors.background.primary,
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
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '500',
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
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  clipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  clipCard: {
    width: '48%',
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  clipThumbnail: {
    height: 120,
    backgroundColor: Colors.background.primary,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  clipInfo: {
    padding: 12,
  },
  clipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  clipMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceType: {
    fontSize: 12,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
