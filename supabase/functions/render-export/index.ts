import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RenderRequest {
  export_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { export_id }: RenderRequest = await req.json();

    if (!export_id) {
      throw new Error('Missing export_id');
    }

    const { data: exportJob, error: exportError } = await supabase
      .from('exports')
      .select(`
        *,
        clip:clips(*),
        style_pack:style_packs(*)
      `)
      .eq('id', export_id)
      .single();

    if (exportError || !exportJob) {
      throw new Error('Export job not found');
    }

    await supabase
      .from('exports')
      .update({ status: 'processing' })
      .eq('id', export_id);

    const renderResult = await renderVideo(
      exportJob.clip,
      exportJob.style_pack,
      exportJob.settings,
      supabase
    );

    const exportPath = `${exportJob.user_id}/${export_id}.mp4`;
    const { data: { publicUrl: exportUrl } } = supabase.storage
      .from('exports')
      .getPublicUrl(exportPath);

    await supabase
      .from('exports')
      .update({
        status: 'completed',
        output_url: exportUrl,
        output_size: renderResult.fileSize,
        completed_at: new Date().toISOString(),
      })
      .eq('id', export_id);

    return new Response(
      JSON.stringify({ success: true, output_url: exportUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Render error:', err);

    const { export_id } = await req.json().catch(() => ({ export_id: null }));
    if (export_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('exports')
        .update({ status: 'failed' })
        .eq('id', export_id);
    }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function renderVideo(
  clip: any,
  stylePack: any,
  settings: any,
  supabase: any
): Promise<{ fileSize: number }> {
  try {
    if (!clip.video_url) {
      throw new Error('No video URL available');
    }

    const { data: detections } = await supabase
      .from('ai_detections')
      .select('*')
      .eq('clip_id', clip.id)
      .order('timestamp', { ascending: true });

    const shotgunApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!shotgunApiKey) {
      throw new Error('SHOTSTACK_API_KEY not configured for video rendering');
    }

    const renderSpec = buildRenderSpecification(
      clip,
      stylePack,
      detections || [],
      settings
    );

    const renderResponse = await fetch('https://api.shotstack.io/v1/render', {
      method: 'POST',
      headers: {
        'x-api-key': shotgunApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderSpec),
    });

    if (!renderResponse.ok) {
      throw new Error('Failed to start render job');
    }

    const renderJob = await renderResponse.json();
    const renderId = renderJob.response.id;

    let status = 'rendering';
    let renderUrl = null;

    while (status === 'rendering' || status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
        headers: { 'x-api-key': shotgunApiKey },
      });

      const statusData = await statusResponse.json();
      status = statusData.response.status;
      renderUrl = statusData.response.url;

      if (status === 'failed') {
        throw new Error('Render job failed');
      }
    }

    if (!renderUrl) {
      throw new Error('No render URL returned');
    }

    const videoResponse = await fetch(renderUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download rendered video');
    }

    const videoBlob = await videoResponse.arrayBuffer();
    const exportPath = `${clip.user_id}/${clip.id}_export.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(exportPath, videoBlob, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    return { fileSize: videoBlob.byteLength };
  } catch (err) {
    console.error('Video rendering error:', err);
    throw err;
  }
}

function buildRenderSpecification(
  clip: any,
  stylePack: any,
  detections: any[],
  settings: any
): any {
  const config = stylePack.assets_config || {};
  const highlightTimes = detections
    .filter(d => d.confidence > 0.7)
    .map(d => d.timestamp);

  const clips = [];
  const duration = clip.duration || 60;

  if (highlightTimes.length > 0) {
    for (const timestamp of highlightTimes.slice(0, 5)) {
      const start = Math.max(0, timestamp - 3);
      const length = 6;

      clips.push({
        asset: {
          type: 'video',
          src: clip.video_url,
          trim: start,
        },
        start: clips.reduce((sum, c) => sum + (c.length || 0), 0),
        length,
        transition: {
          in: 'fade',
          out: 'fade',
        },
      });
    }
  } else {
    clips.push({
      asset: {
        type: 'video',
        src: clip.video_url,
      },
      start: 0,
      length: Math.min(duration, 30),
    });
  }

  const tracks = [
    {
      clips,
    },
  ];

  if (config.overlay_image) {
    tracks.push({
      clips: [
        {
          asset: {
            type: 'image',
            src: config.overlay_image,
          },
          start: 0,
          length: clips.reduce((sum, c) => sum + (c.length || 0), 0),
          opacity: 0.3,
          position: 'topRight',
        },
      ],
    });
  }

  if (config.transition_style) {
    tracks.push({
      clips: detections.slice(0, 5).map((d, i) => ({
        asset: {
          type: 'title',
          text: d.detection_type.toUpperCase(),
          style: 'future',
        },
        start: clips[i]?.start || i * 6,
        length: 1,
        position: 'center',
      })),
    });
  }

  return {
    timeline: {
      tracks,
    },
    output: {
      format: 'mp4',
      resolution: settings.resolution || '1080',
      fps: settings.fps || 60,
      aspectRatio: '9:16',
    },
  };
}
