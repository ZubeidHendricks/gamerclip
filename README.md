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

## What's Next

To make this production-ready, you would need to:

### Core Functionality
- Implement actual video processing pipeline (FFmpeg)
- Integrate real AI/ML models for highlight detection
- Implement video export/rendering with selected style packs
- Add progress tracking for processing and exports
- Real-time updates using Supabase Realtime

### Integrations
- Connect to real Twitch API for stream fetching
- Connect to Kick API for stream fetching
- Add Supabase Storage for video uploads
- Implement CDN for video delivery

### Premium Features
- Implement subscription flow with RevenueCat
- Gate premium style packs behind subscription
- Enable HD exports for premium users
- Add usage limits for free tier

### Enhancements
- Push notifications for completed exports
- Social sharing to Twitter, Instagram, TikTok
- Custom style pack creation
- Manual clip trimming interface
- Thumbnail generation
- Video compression options
- Export queue management

### Polish
- Loading states and skeletons
- Better error messages
- Onboarding tutorial
- Analytics and crash reporting
- Performance optimization

## License

MIT
