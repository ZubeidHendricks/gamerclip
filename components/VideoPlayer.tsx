import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Linking } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Play, Pause, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type VideoPlayerProps = {
  videoUrl: string | null;
  style?: any;
};

export default function VideoPlayer({ videoUrl, style }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTwitchEmbed, setIsTwitchEmbed] = useState(false);
  const [twitchEmbedUrl, setTwitchEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (videoUrl) {
      if (videoUrl.includes('twitch.tv')) {
        handleTwitchUrl(videoUrl);
      } else {
        getSignedUrl(videoUrl);
      }
    } else {
      setLoading(false);
    }
  }, [videoUrl]);

  const handleTwitchUrl = (url: string) => {
    setIsTwitchEmbed(true);

    if (Platform.OS === 'web') {
      const hostname = window.location.hostname;
      const parent = hostname === 'localhost' ? 'localhost' : hostname;

      const clipMatch = url.match(/clip\/([A-Za-z0-9_-]+)/);
      if (clipMatch) {
        const clipId = clipMatch[1];
        setTwitchEmbedUrl(
          `https://clips.twitch.tv/embed?clip=${clipId}&parent=${parent}&autoplay=false&muted=false`
        );
      } else {
        const vodMatch = url.match(/videos\/(\d+)/);
        if (vodMatch) {
          const vodId = vodMatch[1];
          setTwitchEmbedUrl(
            `https://player.twitch.tv/?video=${vodId}&parent=${parent}&autoplay=false&muted=false`
          );
        }
      }
    } else {
      setTwitchEmbedUrl(url);
    }

    setLoading(false);
  };

  const getSignedUrl = async (url: string) => {
    try {
      console.log('Processing video URL:', url);
      console.log('Platform:', Platform.OS);

      if (url.includes('storage/v1/object/public/clips/')) {
        console.log('URL is from Supabase storage');
        setSignedUrl(url);
      } else {
        console.log('Using URL directly');
        setSignedUrl(url);
      }
    } catch (err) {
      console.error('Error processing video URL:', err);
      setSignedUrl(url);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>Loading video...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.placeholder, style]}>
        <Play size={48} color="#ef4444" />
        <Text style={styles.placeholderText}>Video Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!videoUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <Play size={48} color="#94a3b8" />
        <Text style={styles.placeholderText}>No video available</Text>
      </View>
    );
  }

  if (isTwitchEmbed && videoUrl) {
    if (Platform.OS === 'web' && twitchEmbedUrl) {
      return (
        <View style={[styles.container, style]}>
          <iframe
            src={twitchEmbedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allowFullScreen
          />
        </View>
      );
    }

    return (
      <View style={[styles.twitchFallback, style]}>
        <View style={styles.twitchIcon}>
          <ExternalLink size={48} color="#9147ff" />
        </View>
        <Text style={styles.twitchTitle}>Twitch Content</Text>
        <Text style={styles.twitchDescription}>
          Twitch videos can't be embedded in this environment
        </Text>
        <TouchableOpacity
          style={styles.twitchButton}
          onPress={() => Linking.openURL(videoUrl)}
          activeOpacity={0.8}>
          <ExternalLink size={20} color="#ffffff" />
          <Text style={styles.twitchButtonText}>Open in Twitch</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!signedUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <Play size={48} color="#94a3b8" />
        <Text style={styles.placeholderText}>No video available</Text>
      </View>
    );
  }

  console.log('Rendering video with URL:', signedUrl);
  console.log('Platform:', Platform.OS);

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri: signedUrl }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if ('isLoaded' in status) {
            if (status.isLoaded) {
              console.log('Video loaded successfully');
              setIsPlaying(status.isPlaying);
              setError(null);
            } else if (status.error) {
              console.error('Video playback error:', status.error);
              setError(`Playback error: ${status.error}`);
            }
          }
        }}
        onError={(error) => {
          console.error('Video error:', error);
          setError(`Failed to load video: ${error}`);
        }}
        onLoad={() => {
          console.log('Video onLoad event fired');
        }}
        useNativeControls={Platform.OS !== 'web'}
      />

      {Platform.OS === 'web' && showControls && (
        <TouchableOpacity
          style={styles.controlsOverlay}
          onPress={handlePlayPause}
          activeOpacity={0.7}>
          <View style={styles.playButton}>
            {isPlaying ? (
              <Pause size={32} color="#ffffff" />
            ) : (
              <Play size={32} color="#ffffff" />
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  placeholderText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  twitchFallback: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  twitchIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  twitchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  twitchDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  twitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#9147ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  twitchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
