import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExportRequest {
  clip_id: string;
  format: 'tiktok' | 'reels' | 'shorts';
  include_captions?: boolean;
  crop_mode?: 'center' | 'smart' | 'facecam';
}

const FORMAT_SPECS = {
  tiktok: {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 180,
    name: 'TikTok',
  },
  reels: {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 90,
    name: 'Instagram Reels',
  },
  shorts: {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 60,
    name: 'YouTube Shorts',
  },
};

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

    const { clip_id, format = 'shorts', include_captions = true, crop_mode = 'center' }: ExportRequest = await req.json();

    if (!clip_id) {
      throw new Error('Missing clip_id');
    }

    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single();

    if (clipError || !clip) {
      throw new Error('Clip not found or access denied');
    }

    if (!clip.video_url) {
      throw new Error('No video URL available for export');
    }

    const formatSpec = FORMAT_SPECS[format];
    
    if (clip.duration > formatSpec.maxDuration) {
      throw new Error(`Clip duration (${clip.duration}s) exceeds ${formatSpec.name} maximum (${formatSpec.maxDuration}s). Please trim your clip first.`);
    }

    const exportId = crypto.randomUUID();
    
    const { data: exportRecord, error: insertError } = await supabase
      .from('exports')
      .insert({
        id: exportId,
        user_id: user.id,
        clip_id: clip_id,
        status: 'pending',
        settings: {
          format,
          vertical: true,
          width: formatSpec.width,
          height: formatSpec.height,
          crop_mode,
          include_captions,
        },
        processing_options: {
          add_captions: include_captions,
          reframe: crop_mode !== 'center',
          add_b_roll: false,
          add_voiceover: false,
          enhance_speech: false,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Export insert error:', insertError);
      throw new Error('Failed to create export record');
    }

    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!shotstackApiKey) {
      await supabase
        .from('exports')
        .update({ 
          status: 'failed',
          error_message: 'Shotstack API key not configured. Video rendering unavailable.',
        })
        .eq('id', exportId);
      
      throw new Error('Video rendering service not configured. Please contact support.');
    }

    fetch(`${supabaseUrl}/functions/v1/render-export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ export_id: exportId }),
    }).catch(err => console.error('Failed to trigger render:', err));

    return new Response(
      JSON.stringify({ 
        success: true, 
        export_id: exportId,
        format: formatSpec.name,
        message: `Your ${formatSpec.name} export is being processed. Check back in a few minutes.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Vertical export error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});