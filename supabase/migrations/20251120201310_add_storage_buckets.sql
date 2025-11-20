/*
  # Add Storage Buckets for Video Files

  1. Storage Buckets
    - `clips` - Raw uploaded video files
    - `exports` - Processed/rendered export videos
    - `thumbnails` - Generated thumbnail images

  2. Security
    - Users can upload to their own folders
    - Users can read their own files
    - Public read access for shared exports
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('clips', 'clips', false, 524288000, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']),
  ('exports', 'exports', false, 524288000, ARRAY['video/mp4']),
  ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own clips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clips' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own clips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clips' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own clips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clips' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can read thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
