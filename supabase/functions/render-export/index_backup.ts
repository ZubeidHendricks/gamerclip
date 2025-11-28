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

  let export_id: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RenderRequest = await req.json();
    export_id = body.export_id;

    if (!export_id) {
      throw new Error('Missing export_id');
    }

    console.log('Starting export for:', export_id);

    const { data: exportJob, error: exportError } = await supabase
      .from('exports')
      .select(`
        *,
        clip:clips(*),
        style_pack:style_packs(*)
      `)
      .eq('id', export_id)
      .maybeSingle();

    if (exportError) {
      console.error('Export fetch error:', exportError);
      throw new Error(`Export job not found: ${exportError.message}`);
    }

    if (!exportJob) {
      throw new Error('Export job not found');
    }

    console.log('Export job found:', {
      clip_id: exportJob.clip?.id,
      has_video_url: !!exportJob.clip?.video_url,
      style_pack: exportJob.style_pack?.name
    });

    await supabase
      .from('exports')
      .update({ status: 'processing' })
      .eq('id', export_id);

    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    const useMockExport = !shotstackApiKey || Deno.env.get('USE_MOCK_EXPORT') === 'true';

    if (useMockExport) {
      console.warn('Using mock export (SHOTSTACK_API_KEY not configured or USE_MOCK_EXPORT=true)');
      const mockResult = await createMockExport(
        exportJob.clip,
        exportJob.user_id,
        export_id,
        supabase
      );

      await supabase
        .from('exports')
        .update({
          status: 'completed',
          output_url: mockResult.url,
          output_size: mockResult.size,
          completed_at: new Date().toISOString(),
        })
        .eq('id', export_id);

      return new Response(
        JSON.stringify({
          success: true,
          output_url: mockResult.url,
          message: 'Mock export created - returns original video'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const renderResult = await renderVideo(
      exportJob.clip,
      exportJob.style_pack,
      exportJob.settings,
      exportJob.processing_options,
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

    console.log('Export completed successfully:', export_id);

    return new Response(
      JSON.stringify({ success: true, output_url: exportUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Render error:', err);

    if (export_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('exports')
        .update({
          status: 'failed',
          error_message: err.message || 'Unknown error'
        })
        .eq('id', export_id);
    }

    return new Response(
      JSON.stringify({ error: err.message || 'Export failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createMockExport(
  clip: any,
  userId: string,
  exportId: string,
  supabase: any
): Promise<{ url: string; size: number }> {
  console.log('Creating mock export - using original video as export output');

  if (!clip?.video_url) {
    throw new Error('No video URL available');
  }

  return {
    url: clip.video_url,
    size: 10485760
  };
}

async function renderVideo(
  clip: any,
  stylePack: any,
  settings: any,
  processingOptions: any,
  supabase: any
): Promise<{ fileSize: number }> {
  try {
    console.log('Starting video render with Shotstack...');

    if (!clip) {
      throw new Error('Clip data is missing');
    }

    if (!clip.video_url) {
      throw new Error('No video URL available for clip');
    }

    console.log('Clip video URL:', clip.video_url);

    const { data: detections } = await supabase
      .from('ai_detections')
      .select('*')
      .eq('clip_id', clip.id)
      .order('timestamp', { ascending: true });

    console.log('AI detections found:', detections?.length || 0);

    const { data: captions } = await supabase
      .from('captions')
      .select('*')
      .eq('clip_id', clip.id)
      .maybeSingle();

    console.log('Captions available:', !!captions);

    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY')!;
    const isSandbox = shotstackApiKey.includes('sandbox');

    console.log('Using Shotstack API:', isSandbox ? 'SANDBOX' : 'PRODUCTION');

    const renderSpec = buildRenderSpecification(
      clip,
      stylePack,
      detections || [],
      captions,
      processingOptions,
      settings
    );

    console.log('Render specification:', JSON.stringify(renderSpec, null, 2));

    const apiEndpoint = isSandbox
      ? 'https://api.shotstack.io/stage/render'
      : 'https://api.shotstack.io/v1/render';

    console.log('Submitting to:', apiEndpoint);

    const renderResponse = await fetch(apiEndpoint, {
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
      throw new Error(`Shotstack API returned ${renderResponse.status}: ${errorText}`);
    }

    const renderJob = await renderResponse.json();
    console.log('Render job created:', renderJob);

    if (!renderJob.response?.id) {
      throw new Error('No render ID returned from Shotstack');
    }

    const renderId = renderJob.response.id;
    console.log('Polling render job:', renderId);

    let status = 'rendering';
    let renderUrl = null;
    let attempts = 0;
    const maxAttempts = 60;

    while ((status === 'rendering' || status === 'queued' || status === 'preprocessing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const statusEndpoint = isSandbox
          ? `https://api.shotstack.io/stage/render/${renderId}`
          : `https://api.shotstack.io/v1/render/${renderId}`;

        const statusResponse = await fetch(statusEndpoint, {
          headers: { 'x-api-key': shotstackApiKey },
        });

        if (!statusResponse.ok) {
          console.error('Failed to check render status:', statusResponse.status);
          continue;
        }

        const statusData = await statusResponse.json();
        status = statusData.response?.status || 'unknown';
        renderUrl = statusData.response?.url;

        console.log(`Render status (attempt ${attempts}/${maxAttempts}):`, status);

        if (status === 'failed') {
          const error = statusData.response.error || 'Unknown Shotstack error';
          console.error('Shotstack render failed:', error);
          throw new Error(`Shotstack render failed: ${error}`);
        }

        if (status === 'done' && renderUrl) {
          console.log('Render completed successfully');
          break;
        }
      } catch (pollError) {
        console.error('Error polling render status:', pollError);
        if (attempts >= maxAttempts - 1) {
          throw pollError;
        }
      }
    }

    if (attempts >= maxAttempts && status !== 'done') {
      throw new Error(`Render timeout after ${maxAttempts * 5}s - status: ${status}`);
    }

    if (!renderUrl) {
      throw new Error(`No render URL returned from Shotstack (status: ${status})`);
    }

    console.log('Render completed, downloading from:', renderUrl);

    const videoResponse = await fetch(renderUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download rendered video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.arrayBuffer();
    console.log('Video downloaded, size:', videoBlob.byteLength);

    const exportPath = `${clip.user_id}/${clip.id}_export_${Date.now()}.mp4`;

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

    console.log('Export uploaded successfully to:', exportPath);

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
  captions: any,
  processingOptions: any,
  settings: any
): any {
  const config = stylePack?.assets_config || {};
  const duration = clip.duration || 30;

  const highConfidenceDetections = detections.filter(d => d.confidence > 0.7);

  console.log('Building render spec with:', {
    detections: highConfidenceDetections.length,
    hasCaptions: !!captions,
    processingOptions,
    clipDuration: duration
  });

  const clips = [];

  if (highConfidenceDetections.length > 0) {
    console.log('Using highlight-based editing');
    for (const detection of highConfidenceDetections.slice(0, 5)) {
      const start = Math.max(0, detection.timestamp - 2);
      const length = 5;

      if (start + length <= duration) {
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
    }
  }

  if (clips.length === 0) {
    console.log('Using simple trim (no highlights or fallback)');
    const trimDuration = Math.min(duration, 30);
    clips.push({
      asset: {
        type: 'video',
        src: clip.video_url,
        trim: 0,
      },
      start: 0,
      length: trimDuration,
    });
  }

  const tracks = [
    {
      clips,
    },
  ];

  if (config.overlay_image && processingOptions?.add_overlay !== false) {
    console.log('Adding overlay:', config.overlay_image);
    tracks.push({
      clips: [
        {
          asset: {
            type: 'image',
            src: config.overlay_image,
          },
          start: 0,
          length: clips.reduce((sum, c) => sum + (c.length || 0), 0),
          opacity: 0.2,
          position: 'topRight',
        },
      ],
    });
  }

  if (captions && processingOptions?.add_captions) {
    console.log('Adding captions');
    const captionData = typeof captions.content === 'string'
      ? JSON.parse(captions.content)
      : captions.content;

    if (captionData?.words && Array.isArray(captionData.words)) {
      const captionClips = captionData.words.slice(0, 20).map((word: any) => ({
        asset: {
          type: 'title',
          text: word.text || '',
          style: 'blockbuster',
        },
        start: word.start || 0,
        length: (word.end || word.start + 0.5) - (word.start || 0),
        position: 'bottom',
      }));

      if (captionClips.length > 0) {
        tracks.push({ clips: captionClips });
      }
    }
  }

  const aspectRatio = processingOptions?.reframe ? '9:16' : '16:9';

  return {
    timeline: {
      soundtrack: clip.audio_url ? {
        src: clip.audio_url,
        effect: 'fadeIn',
      } : undefined,
      tracks,
    },
    output: {
      format: 'mp4',
      resolution: settings?.resolution || 'hd',
      fps: parseInt(settings?.fps) || 30,
      aspectRatio,
    },
  };
}
