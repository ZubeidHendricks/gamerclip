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

    if (source_type === 'twitch') {
      const isVod = url.includes('/videos/');
      const isClip = url.includes('/clip/') || url.match(/clips\.twitch\.tv/);

      if (isVod) {
        const vodResult = await handleTwitchVod(url, user.id, clipId, supabase);
        videoUrl = vodResult.videoUrl;
        thumbnailUrl = vodResult.thumbnailUrl;
        duration = vodResult.duration;
      } else if (isClip) {
        const clipResult = await downloadTwitchClip(url, user.id, clipId, supabase);
        videoUrl = clipResult.videoUrl;
        thumbnailUrl = clipResult.thumbnailUrl;
        duration = clipResult.duration;
      } else {
        throw new Error('Invalid Twitch URL. Please provide a clip or VOD URL.');
      }
    } else if (source_type === 'kick') {
      throw new Error('Kick import not yet supported. Please use Twitch or direct upload.');
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

async function handleTwitchVod(
  url: string,
  userId: string,
  clipId: string,
  supabase: any
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID');
  const twitchClientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');

  if (!twitchClientId || !twitchClientSecret) {
    throw new Error('Twitch API credentials not configured. Please contact support.');
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

  const vodId = url.match(/videos\/(\d+)/)?.[1];
  if (!vodId) {
    throw new Error('Invalid VOD URL');
  }

  const vodResponse = await fetch(`https://api.twitch.tv/helix/videos?id=${vodId}`, {
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${access_token}`,
    },
  });

  const vodData = await vodResponse.json();
  if (!vodData.data || vodData.data.length === 0) {
    throw new Error('VOD not found or unavailable');
  }

  const vod = vodData.data[0];
  
  const durationMatch = vod.duration.match(/(\d+)h(\d+)m(\d+)s/);
  let totalSeconds = 0;
  if (durationMatch) {
    totalSeconds = (parseInt(durationMatch[1]) * 3600) + (parseInt(durationMatch[2]) * 60) + parseInt(durationMatch[3]);
  }

  let thumbnailUrl = vod.thumbnail_url.replace('%{width}', '480').replace('%{height}', '272');

  if (thumbnailUrl) {
    try {
      const thumbResponse = await fetch(thumbnailUrl);
      if (thumbResponse.ok) {
        const thumbBlob = await thumbResponse.arrayBuffer();
        const thumbPath = `${userId}/${clipId}.jpg`;
        
        await supabase.storage
          .from('thumbnails')
          .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' });

        const { data: { publicUrl } } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(thumbPath);
        
        thumbnailUrl = publicUrl;
      }
    } catch (thumbErr) {
      console.error('Thumbnail upload failed:', thumbErr);
    }
  }

  return {
    videoUrl: url,
    thumbnailUrl,
    duration: totalSeconds,
  };
}

async function downloadTwitchClip(
  url: string,
  userId: string,
  clipId: string,
  supabase: any
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID');
  const twitchClientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');

  if (!twitchClientId || !twitchClientSecret) {
    throw new Error('Twitch API credentials not configured. Please contact support.');
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

  const clipSlug = url.match(/clip\/(\w+)/)?.[1] || url.split('/').pop();
  
  const clipResponse = await fetch(`https://api.twitch.tv/helix/clips?id=${clipSlug}`, {
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${access_token}`,
    },
  });

  const clipData = await clipResponse.json();
  if (!clipData.data || clipData.data.length === 0) {
    throw new Error('Clip not found or unavailable');
  }

  const clip = clipData.data[0];
  const videoDownloadUrl = clip.thumbnail_url.replace('-preview-480x272.jpg', '.mp4');

  const videoResponse = await fetch(videoDownloadUrl);
  if (!videoResponse.ok) throw new Error('Failed to download clip');

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

  let thumbnailUrl = clip.thumbnail_url;
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
    duration: clip.duration,
  };
}