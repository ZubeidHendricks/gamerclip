import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerticalExportRequest {
  clip_id: string;
  format: 'tiktok' | 'reels' | 'shorts';
  include_captions: boolean;
  crop_mode: 'center' | 'smart';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { clip_id, format, include_captions, crop_mode }: VerticalExportRequest = await req.json();

    if (!clip_id || !format) {
      throw new Error('Missing required fields: clip_id and format');
    }

    console.log('Starting vertical export:', { clip_id, format, user_id: user.id });

    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (clipError || !clip) {
      throw new Error('Clip not found or access denied');
    }

    if (!clip.video_url) {
      throw new Error('Clip has no video URL');
    }

    const formatSpecs = {
      tiktok: { maxDuration: 180, aspectRatio: '9:16', name: 'TikTok' },
      reels: { maxDuration: 90, aspectRatio: '9:16', name: 'Instagram Reels' },
      shorts: { maxDuration: 60, aspectRatio: '9:16', name: 'YouTube Shorts' },
    };

    const spec = formatSpecs[format];
    const exportId = crypto.randomUUID();

    const { error: exportError } = await supabase
      .from('exports')
      .insert({
        id: exportId,
        user_id: user.id,
        clip_id: clip_id,
        style_pack_id: null,
        status: 'pending',
        settings: {
          resolution: '1080',
          fps: 30,
          format: format,
          aspectRatio: '9:16',
          maxDuration: spec.maxDuration,
        },
        processing_options: {
          reframe: true,
          add_captions: include_captions,
          crop_mode: crop_mode,
          enhance_speech: false,
          add_b_roll: false,
          add_voiceover: false,
        },
      });

    if (exportError) {
      console.error('Export insert error:', exportError);
      throw new Error('Failed to create export job');
    }

    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');

    if (!shotstackApiKey) {
      console.warn('SHOTSTACK_API_KEY not configured - creating mock export');
      
      await supabase
        .from('exports')
        .update({
          status: 'completed',
          output_url: clip.video_url,
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      return new Response(
        JSON.stringify({
          success: true,
          export_id: exportId,
          message: `Mock ${spec.name} export created (Shotstack not configured)`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimDuration = Math.min(clip.duration || 30, spec.maxDuration);

    const { data: captions } = await supabase
      .from('captions')
      .select('*')
      .eq('clip_id', clip_id)
      .maybeSingle();

    const renderSpec = {
      timeline: {
        tracks: [
          {
            clips: [
              {
                asset: {
                  type: 'video',
                  src: clip.video_url,
                  trim: 0,
                },
                start: 0,
                length: trimDuration,
              },
            ],
          },
        ],
      },
      output: {
        format: 'mp4',
        resolution: 'hd',
        fps: 30,
        aspectRatio: '9:16',
      },
    };

    if (include_captions && captions) {
      const captionData = typeof captions.segments === 'string'
        ? JSON.parse(captions.segments)
        : captions.segments;

      if (Array.isArray(captionData) && captionData.length > 0) {
        const captionClips = captionData.slice(0, 20).map((segment: any) => ({
          asset: {
            type: 'title',
            text: segment.text || '',
            style: 'blockbuster',
          },
          start: segment.start || 0,
          length: (segment.end || segment.start + 2) - (segment.start || 0),
          position: 'bottom',
        }));

        if (captionClips.length > 0) {
          renderSpec.timeline.tracks.push({ clips: captionClips });
        }
      }
    }

    console.log('Submitting to Shotstack:', JSON.stringify(renderSpec, null, 2));

    await supabase
      .from('exports')
      .update({ status: 'processing' })
      .eq('id', exportId);

    const renderResponse = await fetch('https://api.shotstack.io/v1/render', {
      method: 'POST',
      headers: {
        'x-api-key': shotstackApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderSpec),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error('Shotstack API error:', errorText);
      
      await supabase
        .from('exports')
        .update({
          status: 'failed',
          error_message: `Shotstack error: ${errorText}`,
        })
        .eq('id', exportId);

      throw new Error(`Shotstack API error: ${errorText}`);
    }

    const renderJob = await renderResponse.json();
    console.log('Render job created:', renderJob);

    setTimeout(async () => {
      try {
        await pollAndCompleteRender(renderJob.response.id, exportId, user.id, clip_id, supabase, shotstackApiKey);
      } catch (err) {
        console.error('Background render polling error:', err);
      }
    }, 0);

    return new Response(
      JSON.stringify({
        success: true,
        export_id: exportId,
        render_id: renderJob.response.id,
        message: `Your ${spec.name} export is being processed! Max ${spec.maxDuration}s at ${spec.aspectRatio}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Vertical export error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Vertical export failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function pollAndCompleteRender(
  renderId: string,
  exportId: string,
  userId: string,
  clipId: string,
  supabase: any,
  apiKey: string
) {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!statusResponse.ok) {
      console.error('Failed to check render status');
      continue;
    }

    const statusData = await statusResponse.json();
    const status = statusData.response.status;
    const renderUrl = statusData.response.url;

    console.log(`Render status (attempt ${attempts}):`, status);

    if (status === 'failed') {
      const error = statusData.response.error || 'Unknown Shotstack error';
      await supabase
        .from('exports')
        .update({
          status: 'failed',
          error_message: error,
        })
        .eq('id', exportId);
      return;
    }

    if (status === 'done' && renderUrl) {
      const videoResponse = await fetch(renderUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to download rendered video');
      }

      const videoBlob = await videoResponse.arrayBuffer();
      const exportPath = `${userId}/${exportId}.mp4`;

      const { error: uploadError } = await supabase.storage
        .from('exports')
        .upload(exportPath, videoBlob, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload export: ${uploadError.message}`);
      }

      const { data: { publicUrl: exportUrl } } = supabase.storage
        .from('exports')
        .getPublicUrl(exportPath);

      await supabase
        .from('exports')
        .update({
          status: 'completed',
          output_url: exportUrl,
          output_size: videoBlob.byteLength,
          completed_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      console.log('Vertical export completed:', exportId);
      return;
    }
  }

  await supabase
    .from('exports')
    .update({
      status: 'failed',
      error_message: 'Render timeout',
    })
    .eq('id', exportId);
}
