import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessRequest {
  clip_id: string;
  features: {
    add_captions?: boolean;
    enhance_speech?: boolean;
    reframe?: boolean;
    add_b_roll?: boolean;
    add_voiceover?: boolean;
    voiceover_script?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clip_id, features }: ProcessRequest = await req.json();

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

    const jobs = [];

    if (features.add_captions) {
      jobs.push(processJob(supabase, clip, 'captions'));
    }
    if (features.enhance_speech) {
      jobs.push(processJob(supabase, clip, 'enhance_speech'));
    }
    if (features.reframe) {
      jobs.push(processJob(supabase, clip, 'reframe'));
    }
    if (features.add_b_roll) {
      jobs.push(processJob(supabase, clip, 'b_roll'));
    }
    if (features.add_voiceover) {
      jobs.push(processJob(supabase, clip, 'voiceover', features.voiceover_script));
    }

    await Promise.all(jobs);

    return new Response(
      JSON.stringify({ success: true, jobs_created: jobs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Processing error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processJob(
  supabase: any,
  clip: any,
  jobType: string,
  additionalData?: string
): Promise<void> {
  const jobId = crypto.randomUUID();

  await supabase.from('processing_jobs').insert({
    id: jobId,
    clip_id: clip.id,
    user_id: clip.user_id,
    job_type: jobType,
    status: 'processing',
  });

  try {
    let result;
    switch (jobType) {
      case 'captions':
        result = await generateCaptions(clip, supabase);
        break;
      case 'enhance_speech':
        result = await enhanceSpeech(clip);
        break;
      case 'reframe':
        result = await reframeVideo(clip);
        break;
      case 'b_roll':
        result = await addBRoll(clip, supabase);
        break;
      case 'voiceover':
        result = await generateVoiceover(clip, additionalData);
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    await supabase.from('processing_jobs').update({
      status: 'completed',
      result_data: result,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  } catch (err) {
    await supabase.from('processing_jobs').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

async function generateCaptions(clip: any, supabase: any): Promise<any> {
  const assemblyAiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!assemblyAiKey) {
    throw new Error('ASSEMBLYAI_API_KEY not configured');
  }

  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'authorization': assemblyAiKey,
      'content-type': 'application/octet-stream',
    },
    body: await fetch(clip.video_url).then(r => r.arrayBuffer()),
  });

  const { upload_url } = await uploadResponse.json();

  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'authorization': assemblyAiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: 'en',
    }),
  });

  const { id: transcriptId } = await transcriptResponse.json();

  let transcript;
  while (true) {
    const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { 'authorization': assemblyAiKey },
    });
    transcript = await statusResponse.json();

    if (transcript.status === 'completed') break;
    if (transcript.status === 'error') throw new Error('Transcription failed');

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const segments = transcript.words.map((word: any) => ({
    start: word.start / 1000,
    end: word.end / 1000,
    text: word.text,
  }));

  await supabase.from('captions').insert({
    clip_id: clip.id,
    user_id: clip.user_id,
    segments,
    language: 'en',
  });

  return { segments, count: segments.length };
}

async function enhanceSpeech(clip: any): Promise<any> {
  const replicateKey = Deno.env.get('REPLICATE_API_KEY');
  if (!replicateKey) {
    throw new Error('REPLICATE_API_KEY not configured');
  }

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${replicateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'audio-enhancement-model',
      input: {
        audio: clip.video_url,
        task: 'enhance',
      },
    }),
  });

  const prediction = await response.json();
  let result = prediction;

  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Token ${replicateKey}` },
    });
    result = await pollResponse.json();
  }

  if (result.status === 'failed') {
    throw new Error('Speech enhancement failed');
  }

  return { enhanced_audio_url: result.output };
}

async function reframeVideo(clip: any): Promise<any> {
  const shotstackKey = Deno.env.get('SHOTSTACK_API_KEY');
  if (!shotstackKey) {
    throw new Error('SHOTSTACK_API_KEY not configured');
  }

  const renderSpec = {
    timeline: {
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'video',
                src: clip.video_url,
              },
              start: 0,
              length: clip.duration || 30,
              fit: 'crop',
              position: 'center',
            },
          ],
        },
      ],
    },
    output: {
      format: 'mp4',
      resolution: '1080',
      fps: 60,
      aspectRatio: '9:16',
    },
  };

  const renderResponse = await fetch('https://api.shotstack.io/v1/render', {
    method: 'POST',
    headers: {
      'x-api-key': shotstackKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(renderSpec),
  });

  const renderJob = await renderResponse.json();
  const renderId = renderJob.response.id;

  let status = 'rendering';
  let renderUrl = null;

  while (status === 'rendering' || status === 'queued') {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
      headers: { 'x-api-key': shotstackKey },
    });
    const statusData = await statusResponse.json();
    status = statusData.response.status;
    renderUrl = statusData.response.url;

    if (status === 'failed') throw new Error('Reframe failed');
  }

  return { reframed_video_url: renderUrl };
}

async function addBRoll(clip: any, supabase: any): Promise<any> {
  const pexelsKey = Deno.env.get('PEXELS_API_KEY');
  if (!pexelsKey) {
    throw new Error('PEXELS_API_KEY not configured');
  }

  const gameTitle = clip.game_title || 'gaming';
  const searchResponse = await fetch(
    `https://api.pexels.com/videos/search?query=${gameTitle}&per_page=5`,
    {
      headers: { 'Authorization': pexelsKey },
    }
  );

  const searchData = await searchResponse.json();
  const brollClips = searchData.videos.slice(0, 3).map((video: any) => ({
    url: video.video_files[0].link,
    duration: video.duration,
  }));

  return { b_roll_clips: brollClips };
}

async function generateVoiceover(clip: any, script?: string): Promise<any> {
  const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!elevenLabsKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const voiceoverText = script || `Check out this epic ${clip.game_title || 'gaming'} moment!`;

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: voiceoverText,
      model_id: 'eleven_monolingual_v1',
    }),
  });

  const audioBlob = await response.arrayBuffer();
  const audioPath = `/tmp/voiceover_${clip.id}.mp3`;
  await Deno.writeFile(audioPath, new Uint8Array(audioBlob));

  return {
    voiceover_path: audioPath,
    script: voiceoverText,
  };
}
