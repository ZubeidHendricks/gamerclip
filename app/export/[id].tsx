import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Sparkles, Check, Download } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { generateUUID } from '@/lib/uuid';

type StylePack = {
  id: string;
  name: string;
  game: string;
  is_premium: boolean;
  thumbnail_url: string;
};

type Clip = {
  id: string;
  title: string;
};

export default function ExportScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [clip, setClip] = useState<Clip | null>(null);
  const [stylePacks, setStylePacks] = useState<StylePack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [processingOptions, setProcessingOptions] = useState({
    add_captions: false,
    enhance_speech: false,
    reframe: false,
    add_b_roll: false,
    add_voiceover: false,
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      if (!user?.id || !id) return;

      const [clipRes, packsRes] = await Promise.all([
        supabase
          .from('clips')
          .select('id, title')
          .eq('id', id as string)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('style_packs')
          .select('*')
          .order('is_premium', { ascending: true }),
      ]);

      if (clipRes.error) throw clipRes.error;
      if (packsRes.error) throw packsRes.error;

      setClip(clipRes.data);
      const packs = (packsRes.data || []) as StylePack[];
      setStylePacks(packs);

      const defaultPack = packs.find((p) => !p.is_premium);
      if (defaultPack) {
        setSelectedPack(defaultPack.id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      Alert.alert('Error', 'Failed to load export options');
    } finally {
      setLoading(false);
    }
  };

  const handlePackSelect = (pack: StylePack) => {
    if (pack.is_premium) {
      Alert.alert(
        'Premium Style Pack',
        'This style pack requires a premium subscription. Upgrade to unlock!',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedPack(pack.id);
  };

  const handleStartExport = async () => {
    if (!selectedPack || !clip) return;

    try {
      setExporting(true);

      const exportId = generateUUID();

      const { error } = await supabase
        .from('exports')
        .insert({
          id: exportId,
          user_id: user?.id,
          clip_id: id,
          style_pack_id: selectedPack,
          status: 'pending',
          settings: { resolution: '1080', fps: 60 },
          processing_options: processingOptions,
        } as any);

      if (error) throw error;

      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        if (Object.values(processingOptions).some(v => v)) {
          fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-video-features`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ clip_id: id, features: processingOptions }),
            }
          ).catch(err => console.error('Failed to trigger processing:', err));
        }

        fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/render-export`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ export_id: exportId }),
          }
        ).catch(err => console.error('Failed to trigger render:', err));
      }

      Alert.alert(
        'Export Started',
        'Your clip is being processed! You\'ll receive a notification when it\'s ready.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to start export');
    } finally {
      setExporting(false);
    }
  };

  const getPackColor = (game: string) => {
    switch (game.toLowerCase()) {
      case 'valorant':
        return '#fa4454';
      case 'call of duty':
        return '#5daf37';
      case 'apex legends':
        return '#d93d2b';
      case 'fortnite':
        return '#0091ff';
      default:
        return '#8b5cf6';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
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
          <Text style={styles.headerTitle}>Export Clip</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.clipInfo}>
            <Text style={styles.clipLabel}>Exporting</Text>
            <Text style={styles.clipTitle}>{clip.title}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Style Pack</Text>
            <Text style={styles.sectionDescription}>
              Select a style pack to apply to your exported clip
            </Text>

            <View style={styles.packsGrid}>
              {stylePacks.map((pack) => (
                <TouchableOpacity
                  key={pack.id}
                  style={[
                    styles.packCard,
                    selectedPack === pack.id && styles.packCardSelected,
                  ]}
                  onPress={() => handlePackSelect(pack)}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.packThumbnail,
                      { backgroundColor: getPackColor(pack.game) + '30' },
                    ]}>
                    <Sparkles size={32} color={getPackColor(pack.game)} />
                    {selectedPack === pack.id && !pack.is_premium && (
                      <View style={styles.selectedBadge}>
                        <Check size={16} color="#ffffff" />
                      </View>
                    )}
                    {pack.is_premium && (
                      <View style={styles.premiumBadge}>
                        <Text style={styles.premiumText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.packInfo}>
                    <Text style={styles.packName}>{pack.name}</Text>
                    <Text style={styles.packGame}>{pack.game}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Processing Features</Text>
            <View style={styles.featuresList}>
              <TouchableOpacity
                style={styles.featureToggle}
                onPress={() =>
                  setProcessingOptions(prev => ({
                    ...prev,
                    add_captions: !prev.add_captions,
                  }))
                }>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureName}>AI Captions</Text>
                  <Text style={styles.featureDescription}>
                    Auto-generate subtitles
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    processingOptions.add_captions && styles.toggleActive,
                  ]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureToggle}
                onPress={() =>
                  setProcessingOptions(prev => ({
                    ...prev,
                    enhance_speech: !prev.enhance_speech,
                  }))
                }>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureName}>Enhance Speech</Text>
                  <Text style={styles.featureDescription}>
                    Improve audio clarity
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    processingOptions.enhance_speech && styles.toggleActive,
                  ]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureToggle}
                onPress={() =>
                  setProcessingOptions(prev => ({
                    ...prev,
                    reframe: !prev.reframe,
                  }))
                }>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureName}>AI Reframe</Text>
                  <Text style={styles.featureDescription}>
                    Auto-crop to 9:16 vertical
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    processingOptions.reframe && styles.toggleActive,
                  ]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureToggle}
                onPress={() =>
                  setProcessingOptions(prev => ({
                    ...prev,
                    add_b_roll: !prev.add_b_roll,
                  }))
                }>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureName}>AI B-Roll</Text>
                  <Text style={styles.featureDescription}>
                    Insert contextual footage
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    processingOptions.add_b_roll && styles.toggleActive,
                  ]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureToggle}
                onPress={() =>
                  setProcessingOptions(prev => ({
                    ...prev,
                    add_voiceover: !prev.add_voiceover,
                  }))
                }>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureName}>AI Voice-over</Text>
                  <Text style={styles.featureDescription}>
                    Generate commentary
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    processingOptions.add_voiceover && styles.toggleActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.exportInfo}>
            <Text style={styles.exportInfoTitle}>Export Details</Text>
            <View style={styles.exportInfoRow}>
              <Text style={styles.exportInfoLabel}>Resolution:</Text>
              <Text style={styles.exportInfoValue}>1080p</Text>
            </View>
            <View style={styles.exportInfoRow}>
              <Text style={styles.exportInfoLabel}>Frame Rate:</Text>
              <Text style={styles.exportInfoValue}>60 FPS</Text>
            </View>
            <View style={styles.exportInfoRow}>
              <Text style={styles.exportInfoLabel}>Format:</Text>
              <Text style={styles.exportInfoValue}>MP4</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.exportButton,
              (!selectedPack || exporting) && styles.exportButtonDisabled,
            ]}
            onPress={handleStartExport}
            disabled={!selectedPack || exporting}>
            <Download size={20} color="#ffffff" />
            <Text style={styles.exportButtonText}>
              {exporting ? 'Starting Export...' : 'Start Export'}
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 100,
  },
  clipInfo: {
    marginBottom: 32,
  },
  clipLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  clipTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  packCard: {
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
  packCardSelected: {
    borderColor: Colors.brand.primary,
    borderWidth: 2.5,
    shadowColor: Colors.shadow.primary,
    shadowOpacity: 0.4,
  },
  packThumbnail: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    padding: 4,
    shadowColor: Colors.shadow.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#422006',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
  },
  packInfo: {
    padding: 12,
  },
  packName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  packGame: {
    fontSize: 12,
    color: '#94a3b8',
  },
  featuresList: {
    gap: 12,
  },
  featureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureInfo: {
    flex: 1,
  },
  featureName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#94a3b8',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569',
  },
  toggleActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  exportInfo: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  exportInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exportInfoLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  exportInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
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
});
