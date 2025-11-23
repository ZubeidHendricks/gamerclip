import { View, Text, StyleSheet } from 'react-native';
import { Play, Gamepad2 } from 'lucide-react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const dimensions = {
    small: { icon: 24, text: 18, containerSize: 40 },
    medium: { icon: 32, text: 24, containerSize: 56 },
    large: { icon: 48, text: 36, containerSize: 80 },
  };

  const { icon, text, containerSize } = dimensions[size];

  return (
    <View style={styles.container}>
      <View style={styles.iconGroup}>
        <View style={[styles.gamepadContainer, { width: containerSize, height: containerSize }]}>
          <Gamepad2 size={icon} color="#1a1f3a" strokeWidth={2.5} />
        </View>
        <View style={[styles.playContainer, { width: containerSize * 0.7, height: containerSize * 0.7 }]}>
          <Play size={icon * 0.6} color="#1a1f3a" fill="#1a1f3a" strokeWidth={0} />
          <View style={styles.filmStrip}>
            <View style={styles.filmHole} />
            <View style={styles.filmHole} />
            <View style={styles.filmHole} />
          </View>
        </View>
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.brandText, { fontSize: text }]}>
            <Text style={styles.gamer}>GAMER</Text>
            {'\n'}
            <Text style={styles.clip}>CLIP</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconGroup: {
    position: 'relative',
  },
  gamepadContainer: {
    backgroundColor: '#ff5757',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playContainer: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#ff5757',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1a1f3a',
    shadowColor: '#ff5757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  filmStrip: {
    position: 'absolute',
    right: 2,
    flexDirection: 'column',
    gap: 2,
  },
  filmHole: {
    width: 3,
    height: 3,
    backgroundColor: '#1a1f3a',
    borderRadius: 1,
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandText: {
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 28,
  },
  gamer: {
    color: '#ffffff',
  },
  clip: {
    color: '#ffffff',
  },
});
