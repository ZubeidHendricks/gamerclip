import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IngestRequest {
  url: string;
  title: string;
  source_type: 'twitch' | 'kick' | 'upload';
  game_title?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { url, title, source_type, game_title }: IngestRequest = await req.json();

    if (!url || !title || !source_type) {
      throw new Error('Missing required fields');
    }

    const clipId = crypto.randomUUID();
    let videoUrl = null;
    let thumbnailUrl = null;
    let duration = 0;

    if (source_type === 'twitch' || source_type === 'kick') {
      const downloadResult = await downloadFromPlatform(url, source_type, user.id, clipId, supabase);
      videoUrl = downloadResult.videoUrl;
      thumbnailUrl = downloadResult.thumbnailUrl;
      duration = downloadResult.duration;
    }

    const { data: clip, error: insertError } = await supabase
      .from('clips')
      .insert({
        id: clipId,
        user_id: user.id,
        title,
        source_type,
        source_url: url,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration,
        game_title,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    fetch(`${supabaseUrl}/functions/v1/process-ai-detection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clip_id: clipId }),
    }).catch(err => console.error('Failed to trigger AI processing:', err));

    return new Response(
      JSON.stringify({ success: true, clip }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Ingest error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function downloadFromPlatform(
  url: string,
  source: 'twitch' | 'kick',
  userId: string,
  clipId: string,
  supabase: any
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  try {
    let videoData: { url: string; duration: number; thumbnail?: string };

    if (source === 'twitch') {
      videoData = await fetchTwitchVideo(url);
    } else {
      videoData = await fetchKickVideo(url);
    }

    const videoResponse = await fetch(videoData.url);
    if (!videoResponse.ok) throw new Error('Failed to download video');

    const videoBlob = await videoResponse.arrayBuffer();
    const videoPath = `${userId}/${clipId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('clips')
      .upload(videoPath, videoBlob, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('clips')
      .getPublicUrl(videoPath);

    let thumbnailUrl = videoData.thumbnail || null;
    if (thumbnailUrl) {
      try {
        const thumbResponse = await fetch(thumbnailUrl);
        const thumbBlob = await thumbResponse.arrayBuffer();
        const thumbPath = `${userId}/${clipId}.jpg`;
        
        await supabase.storage
          .from('thumbnails')
          .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' });

        const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(thumbPath);
        
        thumbnailUrl = thumbPublicUrl;
      } catch (thumbErr) {
        console.error('Thumbnail upload failed:', thumbErr);
      }
    }

    return {
      videoUrl: publicUrl,
      thumbnailUrl,
      duration: videoData.duration,
    };
  } catch (err) {
    console.error('Platform download error:', err);
    throw new Error(`Failed to download from ${source}: ${err.message}`);
  }
}

async function fetchTwitchVideo(url: string): Promise<{ url: string; duration: number; thumbnail?: string }> {
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID');
  const twitchClientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');

  if (!twitchClientId || !twitchClientSecret) {
    throw new Error('Twitch API credentials not configured');
  }

  const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: twitchClientId,
      client_secret: twitchClientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const { access_token } = await tokenResponse.json();

  const clipId = url.match(/clip\/(\w+)/)?.[1] || url.split('/').pop();
  
  const clipResponse = await fetch(`https://api.twitch.tv/helix/clips?id=${clipId}`, {
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${access_token}`,
    },
  });

  const clipData = await clipResponse.json();
  if (!clipData.data || clipData.data.length === 0) {
    throw new Error('Clip not found');
  }

  const clip = clipData.data[0];
  return {
    url: clip.thumbnail_url.replace('-preview-480x272.jpg', '.mp4'),
    duration: clip.duration,
    thumbnail: clip.thumbnail_url,
  };
}

async function fetchKickVideo(url: string): Promise<{ url: string; duration: number; thumbnail?: string }> {
  throw new Error('Kick API integration not yet implemented. Please use Twitch or direct upload.');
}
