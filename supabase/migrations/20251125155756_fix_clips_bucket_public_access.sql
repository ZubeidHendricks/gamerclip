/*
  # Fix clips bucket public access

  1. Changes
    - Update the clips storage bucket to be public
    - This allows video URLs to be accessed directly without authentication
    - Required for video playback on mobile devices (Android/iOS)

  2. Security
    - Videos are already protected by RLS policies on the clips table
    - Making the bucket public only allows reading files if you know the exact URL
    - Upload permissions remain restricted through RLS
*/

UPDATE storage.buckets
SET public = true
WHERE name = 'clips';
