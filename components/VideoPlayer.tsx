import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { Play, Pause } from 'lucide-react-native';
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

    const clipMatch = url.match(/clip\/([A-Za-z0-9_-]+)/);
    if (clipMatch) {
      const clipId = clipMatch[1];
      setTwitchEmbedUrl(
        `https://clips.twitch.tv/embed?clip=${clipId}&parent=${window.location.hostname}&autoplay=false`
      );
    } else {
      const vodMatch = url.match(/videos\/(\d+)/);
      if (vodMatch) {
        const vodId = vodMatch[1];
        setTwitchEmbedUrl(
          `https://player.twitch.tv/?video=${vodId}&parent=${window.location.hostname}&autoplay=false`
        );
      }
    }

    setLoading(false);
  };

  const getSignedUrl = async (url: string) => {
    try {
      if (url.includes('storage/v1/object/public/clips/')) {
        const pathMatch = url.match(/public\/clips\/(.+)/);
        if (pathMatch) {
          const filePath = pathMatch[1];
          const { data, error } = await supabase.storage
            .from('clips')
            .createSignedUrl(filePath, 3600);

          if (error) {
            console.error('Error creating signed URL:', error);
            setSignedUrl(url);
          } else {
            setSignedUrl(data.signedUrl);
          }
        } else {
          setSignedUrl(url);
        }
      } else {
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

  if (!videoUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <Play size={48} color="#94a3b8" />
        <Text style={styles.placeholderText}>No video available</Text>
      </View>
    );
  }

  if (isTwitchEmbed && twitchEmbedUrl) {
    return (
      <View style={[styles.container, style]}>
        <WebView
          source={{ uri: twitchEmbedUrl }}
          style={styles.video}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
        />
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

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri: signedUrl }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
          }
        }}
        useNativeControls={false}
      />

      {showControls && (
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
});
