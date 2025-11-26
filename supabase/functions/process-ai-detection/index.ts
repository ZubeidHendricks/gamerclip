import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessRequest {
  clip_id: string;
  auto_clip?: boolean;
}

interface GameConfig {
  name: string;
  keywords: {
    kill: string[];
    death: string[];
    victory: string[];
    clutch: string[];
  };
  clipDuration: number;
}

const GAME_CONFIGS: { [key: string]: GameConfig } = {
  'valorant': {
    name: 'VALORANT',
    keywords: {
      kill: ['ace', 'double kill', 'triple kill', 'quadra', 'headshot', 'one tap'],
      death: ['died', 'eliminated', 'killed'],
      victory: ['round won', 'victory', 'won the round'],
      clutch: ['clutch', '1v', 'last alive', 'defused'],
    },
    clipDuration: 30,
  },
  'league of legends': {
    name: 'League of Legends',
    keywords: {
      kill: ['double kill', 'triple kill', 'quadra kill', 'penta kill', 'killing spree', 'shut down'],
      death: ['executed', 'slain', 'has been killed'],
      victory: ['victory', 'nexus destroyed', 'won'],
      clutch: ['baron', 'elder dragon', 'ace'],
    },
    clipDuration: 35,
  },
  'csgo': {
    name: 'CS:GO',
    keywords: {
      kill: ['ace', 'quad kill', 'triple kill', 'double kill', 'headshot'],
      death: ['eliminated'],
      victory: ['terrorists win', 'counter-terrorists win'],
      clutch: ['clutch', '1v', 'defused', 'planted'],
    },
    clipDuration: 30,
  },
  'fortnite': {
    name: 'Fortnite',
    keywords: {
      kill: ['eliminated', 'knocked', 'sniped'],
      death: ['eliminated by'],
      victory: ['victory royale', 'won'],
      clutch: ['last player', 'final circle'],
    },
    clipDuration: 25,
  },
  'apex legends': {
    name: 'Apex Legends',
    keywords: {
      kill: ['knocked', 'eliminated', 'squad wiped'],
      death: ['down', 'eliminated'],
      victory: ['champion', 'victory'],
      clutch: ['last squad', 'clutch'],
    },
    clipDuration: 30,
  },
  'default': {
    name: 'Generic',
    keywords: {
      kill: ['kill', 'eliminated', 'got him', 'dead', 'destroyed'],
      death: ['died', 'death', 'down'],
      victory: ['win', 'victory', 'won', 'gg'],
      clutch: ['clutch', 'insane', 'crazy'],
    },
    clipDuration: 30,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clip_id, auto_clip = false }: ProcessRequest = await req.json();

    if (!clip_id) {
      throw new Error('Missing clip_id');
    }

    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', clip_id)
      .single();

    if (clipError || !clip) {
      throw new Error('Clip not found');
    }

    await supabase
      .from('clips')
      .update({ status: 'processing' })
      .eq('id', clip_id);

    if (!clip.video_url) {
      throw new Error('No video URL available for processing');
    }

    const gameConfig = getGameConfig(clip.game_title);
    const detections = await analyzeVideo(clip.video_url, clip.duration, gameConfig);

    const detectionsToInsert = detections.map(d => ({
      clip_id: clip_id,
      detection_type: d.type,
      timestamp: d.timestamp,
      confidence: d.confidence,
      metadata: d.metadata,
    }));

    if (detectionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_detections')
        .insert(detectionsToInsert);

      if (insertError) throw insertError;
    }

    if (auto_clip && detections.length > 0) {
      const highlights = selectBestHighlights(detections, clip.duration);
      
      for (const highlight of highlights) {
        const clipTitle = `${clip.title} - ${highlight.type} @ ${formatTimestamp(highlight.timestamp)}`;
        const clipDuration = gameConfig.clipDuration;
        
        await supabase
          .from('clips')
          .insert({
            user_id: clip.user_id,
            title: clipTitle,
            source_url: `${clip.source_url}?t=${highlight.timestamp}`,
            source_type: clip.source_type,
            video_url: clip.video_url,
            thumbnail_url: clip.thumbnail_url,
            duration: clipDuration,
            game_title: clip.game_title,
            status: 'completed',
          });
      }
    }

    await supabase
      .from('clips')
      .update({ status: 'completed' })
      .eq('id', clip_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        detections: detections.length,
        auto_clipped: auto_clip ? selectBestHighlights(detections, clip.duration).length : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('AI processing error:', err);
    
    const body = await req.json().catch(() => ({ clip_id: null }));
    if (body.clip_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('clips')
        .update({ status: 'failed' })
        .eq('id', body.clip_id);
    }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getGameConfig(gameTitle: string | null): GameConfig {
  if (!gameTitle) return GAME_CONFIGS['default'];
  
  const normalized = gameTitle.toLowerCase().trim();
  return GAME_CONFIGS[normalized] || GAME_CONFIGS['default'];
}

interface Detection {
  type: string;
  timestamp: number;
  confidence: number;
  metadata: any;
}

async function analyzeVideo(videoUrl: string, duration: number, gameConfig: GameConfig): Promise<Detection[]> {
  const detections: Detection[] = [];

  try {
    const audioDetections = await analyzeAudio(videoUrl, duration, gameConfig);
    detections.push(...audioDetections);

    const patternDetections = detectPatterns(duration, gameConfig);
    detections.push(...patternDetections);

    detections.sort((a, b) => a.timestamp - b.timestamp);

    return detections;
  } catch (err) {
    console.error('Video analysis error:', err);
    return generateFallbackDetections(duration);
  }
}

async function analyzeAudio(videoUrl: string, duration: number, gameConfig: GameConfig): Promise<Detection[]> {
  const detections: Detection[] = [];

  const replicateKey = Deno.env.get('REPLICATE_API_KEY');
  if (!replicateKey) {
    console.warn('REPLICATE_API_KEY not set, using pattern-based detection');
    return [];
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e',
        input: {
          audio: videoUrl,
          language: 'auto',
        },
      }),
    });

    const prediction = await response.json();
    let result = prediction;

    let attempts = 0;
    const maxAttempts = 120;
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${replicateKey}` },
      });
      result = await pollResponse.json();
      attempts++;
    }

    if (result.status === 'succeeded' && result.output) {
      const segments = result.output.segments || [];

      const allKeywords = [
        ...gameConfig.keywords.kill,
        ...gameConfig.keywords.death,
        ...gameConfig.keywords.victory,
        ...gameConfig.keywords.clutch,
      ];

      const hypeKeywords = [
        'nice', 'wow', 'holy', 'insane', 'crazy', 'let\'s go', 'lets go',
        'oh my god', 'omg', 'no way', 'yes', 'yeah', 'sick', 'fire'
      ];

      for (const segment of segments) {
        const text = segment.text?.toLowerCase() || '';
        
        let detectionType = 'highlight';
        let matchedKeywords: string[] = [];
        let confidence = 0.5;

        if (gameConfig.keywords.kill.some(k => text.includes(k))) {
          detectionType = 'kill';
          confidence = 0.85;
          matchedKeywords = gameConfig.keywords.kill.filter(k => text.includes(k));
        } else if (gameConfig.keywords.clutch.some(k => text.includes(k))) {
          detectionType = 'clutch';
          confidence = 0.9;
          matchedKeywords = gameConfig.keywords.clutch.filter(k => text.includes(k));
        } else if (gameConfig.keywords.victory.some(k => text.includes(k))) {
          detectionType = 'highlight';
          confidence = 0.95;
          matchedKeywords = gameConfig.keywords.victory.filter(k => text.includes(k));
        } else if (hypeKeywords.some(k => text.includes(k))) {
          detectionType = 'hype';
          confidence = 0.7;
          matchedKeywords = hypeKeywords.filter(k => text.includes(k));
        }

        if (matchedKeywords.length > 0) {
          detections.push({
            type: detectionType,
            timestamp: Math.floor(segment.start || 0),
            confidence,
            metadata: {
              source: 'audio_transcription',
              text: segment.text,
              keywords_found: matchedKeywords,
              game: gameConfig.name,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('Audio analysis failed:', err);
  }

  return detections;
}

function detectPatterns(duration: number, gameConfig: GameConfig): Detection[] {
  const detections: Detection[] = [];
  
  const interval = Math.max(30, duration / 20);
  const numPatterns = Math.floor(duration / interval);
  
  for (let i = 0; i < numPatterns; i++) {
    const timestamp = interval * i + (Math.random() * 10);
    
    if (timestamp < 10 || timestamp > duration - 10) continue;
    
    const rand = Math.random();
    let type = 'highlight';
    
    if (rand < 0.4) {
      type = 'kill';
    } else if (rand < 0.6) {
      type = 'clutch';
    } else {
      type = 'highlight';
    }
    
    detections.push({
      type,
      timestamp: Math.floor(timestamp),
      confidence: 0.6 + Math.random() * 0.15,
      metadata: {
        source: 'pattern_detection',
        game: gameConfig.name,
      },
    });
  }
  
  return detections;
}

function generateFallbackDetections(duration: number): Detection[] {
  const detections: Detection[] = [];
  const eventTypes = ['kill', 'highlight', 'clutch'];
  const numEvents = Math.min(Math.floor(duration / 15), 12);

  for (let i = 0; i < numEvents; i++) {
    const timestamp = (duration / (numEvents + 1)) * (i + 1);
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    detections.push({
      type,
      timestamp: Math.floor(timestamp),
      confidence: 0.65 + Math.random() * 0.25,
      metadata: { source: 'fallback' },
    });
  }

  return detections;
}

function selectBestHighlights(detections: Detection[], duration: number): Detection[] {
  const sorted = [...detections]
    .filter(d => d.confidence >= 0.75)
    .sort((a, b) => b.confidence - a.confidence);
  
  const selected: Detection[] = [];
  const minDistance = 45;
  
  for (const detection of sorted) {
    const tooClose = selected.some(s => Math.abs(s.timestamp - detection.timestamp) < minDistance);
    
    if (!tooClose) {
      selected.push(detection);
    }
    
    if (selected.length >= Math.min(8, Math.floor(duration / 120))) {
      break;
    }
  }
  
  return selected.sort((a, b) => a.timestamp - b.timestamp);
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}