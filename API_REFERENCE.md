# GamerClip AI - API Reference

## Edge Function Endpoints

Base URL: `https://nrcnnduqkelbojkxkjsg.supabase.co/functions/v1`

All endpoints require authentication via Bearer token in the Authorization header (except where noted).

---

## 1. Ingest Video

**Endpoint:** `POST /ingest-video`

**Description:** Downloads a video from Twitch/Kick URL and stores it in Supabase Storage.

**Authentication:** Required

**Request Body:**
```json
{
  "url": "https://clips.twitch.tv/CLIP_ID",
  "title": "Epic Valorant Ace",
  "source_type": "twitch",
  "game_title": "Valorant"
}
```

**Response:**
```json
{
  "success": true,
  "clip": {
    "id": "uuid",
    "title": "Epic Valorant Ace",
    "status": "processing",
    "video_url": "storage_url",
    "thumbnail_url": "thumbnail_url",
    "duration": 30
  }
}
```

**API Keys Used:**
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

---

## 2. Process AI Detection

**Endpoint:** `POST /process-ai-detection`

**Description:** Analyzes video for highlights (kills, deaths, clutches, hype moments).

**Authentication:** Not required (internal service)

**Request Body:**
```json
{
  "clip_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "detections": 15
}
```

**What It Does:**
- Audio analysis for hype moments
- Visual detection for kill banners, death screens
- Stores detections in `ai_detections` table
- Updates clip status to "completed"

**API Keys Used:**
- `REPLICATE_API_KEY` (optional, uses fallback if not set)

---

## 3. Process Video Features

**Endpoint:** `POST /process-video-features`

**Description:** Applies AI processing features (captions, speech enhancement, reframe, B-roll, voiceover).

**Authentication:** Not required (internal service)

**Request Body:**
```json
{
  "clip_id": "uuid",
  "features": {
    "add_captions": true,
    "enhance_speech": false,
    "reframe": true,
    "add_b_roll": false,
    "add_voiceover": false,
    "voiceover_script": "Optional custom script"
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobs_created": 2
}
```

**Features Breakdown:**

### AI Captions
- Generates word-level subtitles
- Stores in `captions` table
- **API Key:** `ASSEMBLYAI_API_KEY`

### Enhance Speech
- Improves audio clarity
- Removes background noise
- **API Key:** `REPLICATE_API_KEY`

### AI Reframe
- Crops to 9:16 vertical format
- Smart center detection
- **API Key:** `SHOTSTACK_API_KEY`

### AI B-Roll
- Fetches contextual footage
- Based on game title
- **API Key:** `PEXELS_API_KEY`

### AI Voice-over
- Generates commentary
- Custom or auto-generated script
- **API Key:** `ELEVENLABS_API_KEY`

---

## 4. Render Export

**Endpoint:** `POST /render-export`

**Description:** Renders final video with style pack and AI features applied.

**Authentication:** Not required (internal service)

**Request Body:**
```json
{
  "export_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "output_url": "https://storage.url/exports/video.mp4"
}
```

**What It Does:**
- Fetches clip, style pack, and AI detections
- Builds Shotstack render specification
- Trims to highlight moments
- Applies style pack overlays/transitions
- Converts to 9:16 vertical format
- Adds captions if enabled
- Inserts B-roll if enabled
- Mixes voiceover if enabled
- Stores final video in `exports` bucket

**API Keys Used:**
- `SHOTSTACK_API_KEY`

---

## Database Schema Quick Reference

### Tables
- `clips` - User video clips
- `ai_detections` - Timestamped highlights
- `captions` - Auto-generated subtitles
- `processing_jobs` - AI feature processing tasks
- `style_packs` - Game-specific templates
- `exports` - Export jobs
- `user_settings` - User preferences
- `user_stats` - Usage statistics

### Storage Buckets
- `clips` - Raw uploaded videos
- `exports` - Rendered final videos
- `thumbnails` - Generated thumbnails

---

## Example: Complete Workflow

### 1. User uploads Twitch clip
```javascript
const response = await fetch(
  'https://nrcnnduqkelbojkxkjsg.supabase.co/functions/v1/ingest-video',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://clips.twitch.tv/example',
      title: 'Epic Ace',
      source_type: 'twitch',
      game_title: 'Valorant'
    })
  }
);
```

### 2. AI detection runs automatically
The `ingest-video` function automatically triggers `process-ai-detection`.

### 3. User exports with features
```javascript
// Create export record in database
const { data: exportRecord } = await supabase
  .from('exports')
  .insert({
    clip_id: clipId,
    style_pack_id: stylePackId,
    processing_options: {
      add_captions: true,
      reframe: true
    }
  });

// Trigger processing
await fetch(
  'https://nrcnnduqkelbojkxkjsg.supabase.co/functions/v1/process-video-features',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clip_id: clipId,
      features: {
        add_captions: true,
        reframe: true
      }
    })
  }
);

// Trigger render
await fetch(
  'https://nrcnnduqkelbojkxkjsg.supabase.co/functions/v1/render-export',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      export_id: exportRecord.id
    })
  }
);
```

### 4. Monitor progress in real-time
```javascript
// Subscribe to clip updates
const channel = supabase
  .channel('clip-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'clips',
      filter: `id=eq.${clipId}`
    },
    (payload) => {
      console.log('Clip status:', payload.new.status);
    }
  )
  .subscribe();
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

Common errors:
- `401 Unauthorized` - Invalid or missing auth token
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Clip/export not found
- `500 Internal Server Error` - Processing failed (check logs)

---

## Rate Limits

Edge Functions have these limits:
- 2 million invocations/month (free tier)
- 100 concurrent executions
- 10-minute max execution time

For production, consider:
- Upgrading Supabase plan
- Implementing request queuing
- Adding rate limiting per user

---

## Monitoring

Check Edge Function logs in Supabase Dashboard:
https://supabase.com/dashboard/project/nrcnnduqkelbojkxkjsg/functions

Monitor:
- Execution time
- Error rates
- API key usage (external services)
- Storage usage

---

## Need Help?

- Check `SETUP_GUIDE.md` for API key configuration
- Check `README.md` for feature documentation
- View Edge Function logs in Supabase Dashboard
- Check `processing_jobs` table for AI feature status
