import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Upload, Video, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';

export default function HomeScreen() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showStreamsModal, setShowStreamsModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const handleLinkImport = async () => {
    if (!linkUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setLoading(true);
    try {
      const sourceType = linkUrl.includes('twitch') ? 'twitch' : 'kick';
      const title = `Imported ${sourceType} clip`;

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ingest-video`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: linkUrl,
            title,
            source_type: sourceType,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import clip');
      }

      Alert.alert('Success', 'Clip import started! Check your library.');
      setShowLinkModal(false);
      setLinkUrl('');
    } catch (err: any) {
      console.error('Import error:', err);
      Alert.alert('Error', err.message || 'Failed to import clip');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name || `upload_${Date.now()}.mp4`;
      const filePath = `${user?.id}/${crypto.randomUUID()}.mp4`;

      const fileBlob = await fetch(file.uri).then(r => r.blob());

      const { error: uploadError } = await supabase.storage
        .from('clips')
        .upload(filePath, fileBlob, {
          contentType: file.mimeType || 'video/mp4',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clips')
        .getPublicUrl(filePath);

      const clipId = crypto.randomUUID();

      const { error: insertError } = await supabase
        .from('clips')
        .insert({
          id: clipId,
          user_id: user?.id,
          title: fileName,
          source_type: 'upload',
          status: 'processing',
          video_url: publicUrl,
          duration: 0,
        } as any);

      if (insertError) throw insertError;

      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-ai-detection`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clip_id: clipId }),
          }
        ).catch(err => console.error('Failed to trigger processing:', err));
      }

      Alert.alert('Success', 'Video uploaded! Processing will begin shortly.');
    } catch (err: any) {
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleRecentStreams = () => {
    setShowStreamsModal(true);
  };

  const mockStreams = [
    { id: '1', title: 'Valorant Ranked Grind', date: '2 hours ago', duration: '3h 45m' },
    { id: '2', title: 'Fortnite Battle Royale', date: '1 day ago', duration: '4h 12m' },
    { id: '3', title: 'Apex Legends Season 20', date: '2 days ago', duration: '2h 30m' },
  ];

  const handleStreamSelect = async (stream: typeof mockStreams[0]) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('clips')
        .insert({
          user_id: user?.id,
          title: stream.title,
          source_type: 'twitch',
          status: 'processing',
        } as any);

      if (error) throw error;

      Alert.alert('Success', `"${stream.title}" added to your library!`);
      setShowStreamsModal(false);
    } catch (err) {
      console.error('Stream import error:', err);
      Alert.alert('Error', 'Failed to import stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>GamerClip AI</Text>
            <Text style={styles.tagline}>Turn streams into viral clips</Text>
          </View>

          <View style={styles.importSection}>
            <Text style={styles.sectionTitle}>Import Your Clips</Text>

            <TouchableOpacity
              style={styles.importCard}
              onPress={() => setShowLinkModal(true)}
              activeOpacity={0.7}>
              <View style={styles.iconContainer}>
                <Link size={32} color="#10b981" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Twitch / Kick Link</Text>
                <Text style={styles.cardDescription}>
                  Paste a VOD or clip URL to extract highlights
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.importCard}
              onPress={handleUpload}
              activeOpacity={0.7}>
              <View style={styles.iconContainer}>
                <Upload size={32} color="#3b82f6" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Upload Video</Text>
                <Text style={styles.cardDescription}>
                  Import directly from your device
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.importCard}
              onPress={handleRecentStreams}
              activeOpacity={0.7}>
              <View style={styles.iconContainer}>
                <Video size={32} color="#8b5cf6" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Recent Streams</Text>
                <Text style={styles.cardDescription}>
                  Browse your latest Twitch broadcasts
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Clips Processed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Exports This Month</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import from Link</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Paste a Twitch VOD, Twitch clip, or Kick stream URL
            </Text>

            <TextInput
              style={styles.modalInput}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://twitch.tv/..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLinkModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.importButton, loading && styles.buttonDisabled]}
                onPress={handleLinkImport}
                disabled={loading}>
                <Text style={styles.importButtonText}>
                  {loading ? 'Importing...' : 'Import'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showStreamsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStreamsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Streams</Text>
              <TouchableOpacity onPress={() => setShowStreamsModal(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Select a stream to import and extract highlights
            </Text>

            <ScrollView style={styles.streamsList}>
              {mockStreams.map((stream) => (
                <TouchableOpacity
                  key={stream.id}
                  style={styles.streamCard}
                  onPress={() => handleStreamSelect(stream)}
                  activeOpacity={0.7}>
                  <View style={styles.streamIcon}>
                    <Video size={24} color="#8b5cf6" />
                  </View>
                  <View style={styles.streamInfo}>
                    <Text style={styles.streamTitle}>{stream.title}</Text>
                    <Text style={styles.streamMeta}>
                      {stream.date} • {stream.duration}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]}
              onPress={() => setShowStreamsModal(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
  },
  importSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  importCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  importButton: {
    backgroundColor: '#10b981',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  streamsList: {
    maxHeight: 400,
  },
  streamCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  streamIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streamInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  streamMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
