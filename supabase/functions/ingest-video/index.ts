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
        const clipResult = await handleTwitchClip(url, user.id, clipId, supabase);
        videoUrl = clipResult.videoUrl;
        thumbnailUrl = clipResult.thumbnailUrl;
        duration = clipResult.duration;
      } else {
        throw new Error('Invalid Twitch URL format. Please use a valid Twitch clip URL (e.g., https://clips.twitch.tv/ClipSlug or https://twitch.tv/username/clip/ClipSlug) or VOD URL.');
      }
    } else if (source_type === 'kick') {
      throw new Error('Kick import not yet supported. Please use Twitch or direct upload.');
    }

    const clipStatus = source_type === 'twitch' ? 'completed' : 'processing';

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
        status: clipStatus,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const isVodImport = source_type === 'twitch' && url.includes('/videos/');
    const shouldAutoClip = isVodImport;

    if (source_type !== 'twitch' || isVodImport) {
      fetch(`${supabaseUrl}/functions/v1/process-ai-detection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clip_id: clipId,
          auto_clip: shouldAutoClip,
        }),
      }).catch(err => console.error('Failed to trigger AI processing:', err));
    }

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

async function getTwitchAccessToken(): Promise<string> {
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID');
  const twitchClientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');

  if (!twitchClientId || !twitchClientSecret) {
    throw new Error('Twitch API is not configured. To enable Twitch imports, please set up your Twitch Developer App credentials in the Supabase dashboard under Edge Functions > Secrets. Required secrets: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.');
  }

  try {
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: twitchClientId,
        client_secret: twitchClientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Twitch token error:', errorData);
      throw new Error('Failed to authenticate with Twitch. Please check your Twitch API credentials.');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Twitch auth error:', error);
    throw new Error('Unable to connect to Twitch API. Please try again later.');
  }
}

async function handleTwitchVod(
  url: string,
  userId: string,
  clipId: string,
  supabase: any
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  const access_token = await getTwitchAccessToken();
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID')!;

  const vodId = url.match(/videos\/(\d+)/)?.[1];
  if (!vodId) {
    throw new Error('Could not extract VOD ID from URL. Please provide a valid Twitch VOD URL (e.g., https://twitch.tv/videos/1234567890).');
  }

  try {
    const vodResponse = await fetch(`https://api.twitch.tv/helix/videos?id=${vodId}`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!vodResponse.ok) {
      const errorText = await vodResponse.text();
      console.error('Twitch VOD API error:', errorText);
      throw new Error('Failed to fetch VOD information from Twitch.');
    }

    const vodData = await vodResponse.json();
    if (!vodData.data || vodData.data.length === 0) {
      throw new Error('VOD not found. This video may be deleted, private, or subscriber-only.');
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error('Failed to process Twitch VOD. Please ensure the URL is correct and the video is publicly accessible.');
  }
}

async function handleTwitchClip(
  url: string,
  userId: string,
  clipId: string,
  supabase: any
): Promise<{ videoUrl: string; thumbnailUrl: string; duration: number }> {
  const access_token = await getTwitchAccessToken();
  const twitchClientId = Deno.env.get('TWITCH_CLIENT_ID')!;

  let clipSlug = '';
  
  if (url.includes('clips.twitch.tv/')) {
    clipSlug = url.split('/').pop()?.split('?')[0] || '';
  } else {
    const match = url.match(/\/clip\/([A-Za-z0-9_-]+)/);
    if (match) {
      clipSlug = match[1];
    }
  }

  if (!clipSlug || clipSlug.length === 0) {
    throw new Error('Could not extract clip ID from URL. Please provide a valid Twitch clip URL. Examples:\n• https://clips.twitch.tv/ClipSlug\n• https://twitch.tv/username/clip/ClipSlug');
  }

  console.log('Fetching Twitch clip:', clipSlug);
  
  try {
    const clipResponse = await fetch(`https://api.twitch.tv/helix/clips?id=${clipSlug}`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!clipResponse.ok) {
      const errorText = await clipResponse.text();
      console.error('Twitch Clips API error:', errorText);
      throw new Error('Failed to fetch clip information from Twitch.');
    }

    const clipData = await clipResponse.json();
    console.log('Twitch API response:', JSON.stringify(clipData));
    
    if (!clipData.data || clipData.data.length === 0) {
      throw new Error(`Clip not found. This clip may be deleted, expired, or unavailable. Twitch clips are automatically deleted after 90 days if not saved. Clip ID: ${clipSlug}`);
    }

    const clip = clipData.data[0];
    
    let thumbnailUrl = clip.thumbnail_url;
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
      duration: Math.round(clip.duration),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error('Failed to process Twitch clip. Please ensure the URL is correct and the clip is still available.');
  }
}