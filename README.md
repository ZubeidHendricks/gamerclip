# GamerClip AI

A mobile app for gamers to import gaming clips, detect highlights using AI, and export edited videos with game-specific styles.

## Features

### Authentication
- Email/password sign up and login with Supabase Auth
- Secure session management
- Protected routes
- Sign out with confirmation

### Home Tab
- Import clips from Twitch/Kick URLs
- Upload video files from device using expo-document-picker
- Browse and import recent streams (mock data)
- Real-time statistics showing clip counts
- Clean, modern UI with gradients

### Library Tab
- View all imported clips fetched from database
- Pull-to-refresh functionality
- Status indicators (processing, completed, failed)
- Source type and duration display
- Clickable cards navigate to clip detail
- Empty state when no clips exist
- Responsive grid layout

### Clip Detail Screen
- Video player with expo-av
- Play/pause controls
- Clip title, status, source, and duration
- AI detections list with timestamps
- Detection types: kills, deaths, highlights, clutches
- Confidence scores for each detection
- Delete clip functionality
- Export button navigates to export screen
- Back navigation

### Export Screen
- Select from available style packs
- Visual style pack cards with game themes
- Premium pack indicators with locks
- Selected pack visual feedback
- Export settings display (resolution, FPS, format)
- Start export button creates export job in database
- Confirmation message on export start

### Style Lab Tab
- 4 game-specific style packs:
  - Valorant Vibes (free)
  - Warzone Winner (free)
  - Apex Legends (premium)
  - Fortnite Flex (premium)
- Selectable packs with visual feedback
- Green border on selected pack
- Premium lock indicators
- Alert for premium pack attempts
- Style pack information card

### Profile Tab
- User email and username display
- Real-time clips count from database
- Usage statistics
- Settings button navigates to settings screen
- Upgrade to Premium button (UI ready)
- Working sign out with confirmation dialog

### Settings Screen
- Push notifications toggle
- Auto-process clips toggle
- HD exports toggle (disabled for free tier)
- Help Center link
- Terms of Service link
- Privacy Policy link
- App version display

## Database Schema

### Tables
- `profiles` - User profile data linked to auth.users
- `clips` - Imported video clips with metadata and status
- `style_packs` - Game-specific editing templates with assets config
- `exports` - Export jobs with style pack and settings
- `ai_detections` - AI-detected moments in clips with timestamps

### Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Style packs readable by all authenticated users
- Secure foreign key relationships

### Database Functions
Helper function to generate sample AI detections:
```sql
SELECT generate_sample_detections('clip-uuid-here');
```

## Tech Stack

- **Framework**: React Native with Expo SDK
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL database + Auth)
- **Language**: TypeScript
- **UI**: React Native core components
- **Icons**: Lucide React Native
- **Styling**: StyleSheet API with Linear Gradients
- **Video**: expo-av for video playback
- **File Picker**: expo-document-picker

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Type check:
```bash
npm run typecheck
```

4. Build for web:
```bash
npm run build:web
```

## Project Structure

```
app/
├── (tabs)/               # Tab navigation screens
│   ├── index.tsx        # Home tab
│   ├── library.tsx      # Library tab
│   ├── style-lab.tsx    # Style Lab tab
│   └── profile.tsx      # Profile tab
├── auth/                # Authentication screens
│   ├── login.tsx
│   └── signup.tsx
├── clip/                # Clip detail screen
│   └── [id].tsx
├── export/              # Export screen
│   └── [id].tsx
├── settings.tsx         # Settings screen
└── _layout.tsx          # Root layout

components/
└── VideoPlayer.tsx      # Reusable video player component

contexts/
└── AuthContext.tsx      # Authentication context provider

lib/
└── supabase.ts          # Supabase client configuration

types/
└── database.ts          # TypeScript database types

supabase/
└── migrations/          # Database migrations
```

## Navigation Flow

- **Auth**: Login ⟷ Sign Up
- **Main Tabs**: Home | Library | Style Lab | Profile
- **Clip Flow**: Library → Clip Detail → Export
- **Settings**: Profile → Settings

## Key Features Implementation

### Authentication Flow
- Uses Supabase Auth with email/password
- AuthContext provides user state throughout app
- Protected routes check for user session
- Sign out clears session and redirects to login

### Data Fetching
- All queries use Supabase client with RLS
- Pull-to-refresh on library screen
- Real-time stats updates after actions
- Error handling with user-friendly alerts

### Video Player
- Built with expo-av Video component
- Custom controls overlay
- Graceful handling of missing video URLs
- Responsive sizing

### Style Packs
- Stored in database with JSON config
- Free vs premium differentiation
- Visual selection interface
- Used in export process

## Production Infrastructure

This app now has **real backend connections** for production use:

### Supabase Storage
- ✅ 3 storage buckets configured (clips, exports, thumbnails)
- ✅ Row Level Security policies for user isolation
- ✅ Direct file upload from mobile app
- ✅ Public URLs for video playback

### Edge Functions (Deployed)
1. **ingest-video** - Downloads videos from Twitch/Kick URLs
   - Fetches from Twitch API with OAuth
   - Downloads video file to Supabase Storage
   - Triggers AI detection automatically

2. **process-ai-detection** - AI-powered highlight detection
   - Audio analysis for hype moments (using Replicate API)
   - Visual detection for kill banners, death screens
   - Stores detections with timestamps and confidence scores
   - Fallback pattern-based detection if AI unavailable

3. **render-export** - Video rendering and export
   - Uses Shotstack API for video editing
   - Applies game-specific style packs
   - Smart trimming based on AI detections
   - Generates vertical (9:16) format for social media
   - Auto-layout with overlays and transitions

### Real-Time Updates
- ✅ Supabase Realtime subscriptions on library screen
- ✅ Automatic UI updates when clips change status
- ✅ Live processing status indicators

### Required API Keys

To fully activate the production features, configure these environment variables in your Supabase project:

```bash
# Twitch API (for stream/clip ingestion)
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_secret

# Replicate AI (for audio/visual detection)
REPLICATE_API_KEY=your_replicate_key

# Shotstack (for video rendering)
SHOTSTACK_API_KEY=your_shotstack_key
```

## Getting the API Keys

### 1. Twitch API
1. Visit [Twitch Developers](https://dev.twitch.tv/console/apps)
2. Create a new application
3. Get your Client ID and Client Secret
4. Add to Supabase Edge Function secrets

### 2. Replicate AI (Optional)
1. Visit [Replicate](https://replicate.com/)
2. Create an account
3. Generate an API token
4. Add to Supabase Edge Function secrets
5. Without this, the app uses fallback pattern-based detection

### 3. Shotstack Video Rendering
1. Visit [Shotstack](https://shotstack.io/)
2. Sign up for an account
3. Get your API key from dashboard
4. Add to Supabase Edge Function secrets

## How It Works

### 1. Video Ingestion Flow
```
User pastes Twitch URL
  → Home screen calls /ingest-video edge function
  → Edge function fetches video from Twitch API
  → Downloads video file
  → Uploads to Supabase Storage (clips bucket)
  → Creates clip record in database (status: processing)
  → Triggers /process-ai-detection edge function
```

### 2. AI Detection Flow
```
Clip uploaded with video_url
  → /process-ai-detection downloads video
  → Calls Replicate API for audio analysis (hype detection)
  → Calls Replicate API for visual detection (kill banners)
  → Stores all detections with timestamps in ai_detections table
  → Updates clip status to 'completed'
  → Library screen updates in real-time via Supabase Realtime
```

### 3. Export/Render Flow
```
User selects style pack and clicks export
  → Creates export record in database
  → Calls /render-export edge function
  → Edge function fetches clip + style pack + AI detections
  → Builds Shotstack render specification:
     - Trims video to highlight moments
     - Applies game-specific overlays/transitions
     - Converts to 9:16 vertical format
     - Adds text overlays for detection types
  → Polls Shotstack until render completes
  → Downloads rendered video
  → Uploads to Supabase Storage (exports bucket)
  → Updates export record with output URL
  → User can download/share
```

## Deployment Checklist

- [x] Database schema with RLS
- [x] Storage buckets with security policies
- [x] Edge functions deployed
- [x] Real-time subscriptions
- [x] Video upload to storage
- [ ] Configure API keys in Supabase
- [ ] Test Twitch video ingestion
- [ ] Test AI detection with sample videos
- [ ] Test export rendering
- [ ] Add push notifications (optional)
- [ ] Implement RevenueCat for subscriptions (optional)
- [ ] Deploy to App Store / Play Store

## Next Enhancements

- **Kick API Integration** - Add support for Kick.com clips
- **Custom Style Packs** - Let users create their own templates
- **Manual Trimming** - UI for manual clip editing
- **Social Sharing** - Direct sharing to Twitter, Instagram, TikTok
- **Push Notifications** - Notify when processing completes
- **Analytics** - Track usage and popular games
- **Advanced AI** - Better detection models, player recognition
- **Face-cam Auto-centering** - Smart cropping for face cams
- **Meme Library** - Insert trending memes into clips

## License

MIT
