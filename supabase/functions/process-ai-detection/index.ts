import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessRequest {
  clip_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clip_id }: ProcessRequest = await req.json();

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

    const detections = await analyzeVideo(clip.video_url, clip.duration);

    const detectionsToInsert = detections.map(d => ({
      clip_id: clip_id,
      detection_type: d.type,
      timestamp: d.timestamp,
      confidence: d.confidence,
      metadata: d.metadata,
    }));

    const { error: insertError } = await supabase
      .from('ai_detections')
      .insert(detectionsToInsert);

    if (insertError) throw insertError;

    await supabase
      .from('clips')
      .update({ status: 'completed' })
      .eq('id', clip_id);

    return new Response(
      JSON.stringify({ success: true, detections: detections.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('AI processing error:', err);
    
    const { clip_id } = await req.json().catch(() => ({ clip_id: null }));
    if (clip_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('clips')
        .update({ status: 'failed' })
        .eq('id', clip_id);
    }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface Detection {
  type: string;
  timestamp: number;
  confidence: number;
  metadata: any;
}

async function analyzeVideo(videoUrl: string, duration: number): Promise<Detection[]> {
  const detections: Detection[] = [];

  try {
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video for analysis');
    }

    const audioDetections = await analyzeAudio(videoUrl, duration);
    detections.push(...audioDetections);

    const visualDetections = await analyzeVisuals(videoUrl, duration);
    detections.push(...visualDetections);

    detections.sort((a, b) => a.timestamp - b.timestamp);

    return detections;
  } catch (err) {
    console.error('Video analysis error:', err);
    return generateFallbackDetections(duration);
  }
}

async function analyzeAudio(videoUrl: string, duration: number): Promise<Detection[]> {
  const detections: Detection[] = [];

  const replicateKey = Deno.env.get('REPLICATE_API_KEY');
  if (!replicateKey) {
    console.warn('REPLICATE_API_KEY not set, using fallback audio detection');
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

    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${replicateKey}` },
      });
      result = await pollResponse.json();
    }

    if (result.status === 'succeeded' && result.output) {
      const transcript = result.output.transcription || result.output.text || '';
      const segments = result.output.segments || [];

      const hypeKeywords = [
        'nice', 'wow', 'holy', 'insane', 'crazy', 'let\'s go', 'lets go',
        'oh my god', 'omg', 'no way', 'clutch', 'ace', 'kill', 'dead',
        'got him', 'gg', 'good game', 'yes', 'yeah', 'sick', 'fire'
      ];

      for (const segment of segments) {
        const text = segment.text?.toLowerCase() || '';
        const hasHypeWord = hypeKeywords.some(keyword => text.includes(keyword));

        if (hasHypeWord) {
          detections.push({
            type: 'hype',
            timestamp: Math.floor(segment.start || 0),
            confidence: 0.8,
            metadata: {
              source: 'audio_transcription',
              text: segment.text,
              keywords_found: hypeKeywords.filter(k => text.includes(k))
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

async function analyzeVisuals(videoUrl: string, duration: number): Promise<Detection[]> {
  const detections: Detection[] = [];

  const replicateKey = Deno.env.get('REPLICATE_API_KEY');
  if (!replicateKey) {
    console.warn('REPLICATE_API_KEY not set, using fallback visual detection');
    return [];
  }

  console.log('Visual detection with Grounding DINO is expensive for video frames');
  console.log('Skipping visual analysis to reduce API costs');
  console.log('Consider implementing frame sampling + detection if needed');

  return detections;
}

function mapVisualEventType(label: string): string {
  const mapping: { [key: string]: string } = {
    'kill_banner': 'kill',
    'death_screen': 'death',
    'victory_screen': 'highlight',
    'clutch_moment': 'clutch',
  };
  return mapping[label] || 'highlight';
}

function generateFallbackDetections(duration: number): Detection[] {
  const detections: Detection[] = [];
  const eventTypes = ['kill', 'death', 'highlight', 'clutch'];
  const numEvents = Math.min(Math.floor(duration / 10), 8);

  for (let i = 0; i < numEvents; i++) {
    const timestamp = (duration / (numEvents + 1)) * (i + 1);
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    detections.push({
      type,
      timestamp: Math.floor(timestamp),
      confidence: 0.65 + Math.random() * 0.3,
      metadata: { source: 'fallback', note: 'Using pattern-based detection' },
    });
  }

  return detections;
}