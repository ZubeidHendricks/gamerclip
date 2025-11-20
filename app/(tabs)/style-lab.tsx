import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const STYLE_PACKS = [
  {
    id: 1,
    name: 'Valorant Vibes',
    game: 'Valorant',
    isPremium: false,
    color: '#fa4454',
  },
  {
    id: 2,
    name: 'Warzone Winner',
    game: 'Call of Duty',
    isPremium: false,
    color: '#5daf37',
  },
  {
    id: 3,
    name: 'Apex Legends',
    game: 'Apex Legends',
    isPremium: true,
    color: '#d93d2b',
  },
  {
    id: 4,
    name: 'Fortnite Flex',
    game: 'Fortnite',
    isPremium: true,
    color: '#0091ff',
  },
];

export default function StyleLabScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Style Lab</Text>
            <Text style={styles.subtitle}>Choose your editing style</Text>
          </View>

          <View style={styles.grid}>
            {STYLE_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                style={styles.packCard}>
                <View
                  style={[
                    styles.packThumbnail,
                    { backgroundColor: pack.color + '30' },
                  ]}>
                  <Sparkles size={32} color={pack.color} />
                  {pack.isPremium && (
                    <View style={styles.premiumBadge}>
                      <Lock size={12} color="#fbbf24" />
                    </View>
                  )}
                </View>
                <View style={styles.packInfo}>
                  <Text style={styles.packName}>{pack.name}</Text>
                  <Text style={styles.packGame}>{pack.game}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What are Style Packs?</Text>
            <Text style={styles.infoText}>
              Style Packs are pre-designed templates that automatically apply
              game-specific overlays, transitions, and effects to your clips.
            </Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  packCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  packThumbnail: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#422006',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  packInfo: {
    padding: 12,
  },
  packName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  packGame: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 21,
  },
});
