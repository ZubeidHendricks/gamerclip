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

      if (!exportJob.clip?.video_url) {
        throw new Error('No video URL available');
      }

      const mockUrl = exportJob.clip.video_url;

      await supabase
        .from('exports')
        .update({
          status: 'completed',
          output_url: mockUrl,
          output_size: 10485760,
          completed_at: new Date().toISOString(),
        })
        .eq('id', export_id);

      return new Response(
        JSON.stringify({
          success: true,
          output_url: mockUrl,
          message: 'Mock export created - returns original video'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSandbox = shotstackApiKey.includes('sandbox');
    const apiEndpoint = isSandbox
      ? 'https://api.shotstack.io/stage/render'
      : 'https://api.shotstack.io/v1/render';

    console.log('Using Shotstack:', isSandbox ? 'SANDBOX' : 'PRODUCTION', 'endpoint:', apiEndpoint);

    const renderSpec = {
      timeline: {
        tracks: [
          {
            clips: [
              {
                asset: {
                  type: 'video',
                  src: exportJob.clip.video_url,
                },
                start: 0,
                length: Math.min(exportJob.clip.duration || 30, 30),
              },
            ],
          },
        ],
      },
      output: {
        format: 'mp4',
        resolution: 'sd',
        fps: 25,
      },
    };

    console.log('Submitting render job');

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
      throw new Error(`Shotstack API error: ${errorText}`);
    }

    const renderJob = await renderResponse.json();
    const renderId = renderJob.response?.id;

    if (!renderId) {
      throw new Error('No render ID returned from Shotstack');
    }

    console.log('Render job created:', renderId);

    let status = 'queued';
    let renderUrl = null;
    let attempts = 0;
    const maxAttempts = 60;

    const statusEndpoint = isSandbox
      ? `https://api.shotstack.io/stage/render/${renderId}`
      : `https://api.shotstack.io/v1/render/${renderId}`;

    while ((status === 'rendering' || status === 'queued' || status === 'preprocessing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const statusResponse = await fetch(statusEndpoint, {
          headers: { 'x-api-key': shotstackApiKey },
        });

        if (!statusResponse.ok) {
          console.error('Status check failed:', statusResponse.status);
          continue;
        }

        const statusData = await statusResponse.json();
        status = statusData.response?.status || 'unknown';
        renderUrl = statusData.response?.url;

        console.log(`Render (${attempts}/${maxAttempts}):`, status);

        if (status === 'failed') {
          const error = statusData.response.error || 'Unknown error';
          throw new Error(`Shotstack failed: ${error}`);
        }

        if (status === 'done' && renderUrl) {
          break;
        }
      } catch (pollError: any) {
        console.error('Polling error:', pollError.message);
        if (attempts >= maxAttempts - 1) {
          throw pollError;
        }
      }
    }

    if (status !== 'done' || !renderUrl) {
      throw new Error(`Render timeout after ${attempts * 5}s (status: ${status})`);
    }

    console.log('Downloading rendered video');

    const videoResponse = await fetch(renderUrl);
    if (!videoResponse.ok) {
      throw new Error(`Download failed: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.arrayBuffer();
    const exportPath = `${exportJob.user_id}/${export_id}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(exportPath, videoBlob, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
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
      .eq('id', export_id);

    console.log('Export completed successfully');

    return new Response(
      JSON.stringify({ success: true, output_url: exportUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Export error:', err);

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
