/*
  # Add Processing Features for AI Editing

  1. Schema Changes
    - Add `processing_options` JSONB column to exports table for feature toggles
    - Add `captions` table for storing generated captions/subtitles
    - Add `processing_jobs` table for tracking individual processing tasks

  2. New Tables
    - `captions`
      - `id` (uuid, primary key)
      - `clip_id` (uuid, foreign key)
      - `segments` (jsonb array of {start, end, text})
      - `language` (text)
      - `created_at` (timestamp)
    
    - `processing_jobs`
      - `id` (uuid, primary key)
      - `clip_id` (uuid, foreign key)
      - `job_type` (text: 'captions', 'enhance_speech', 'reframe', 'b_roll', 'voiceover')
      - `status` (text: 'pending', 'processing', 'completed', 'failed')
      - `result_data` (jsonb)
      - `error_message` (text)
      - `created_at`, `completed_at` (timestamps)

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Add processing options to exports
ALTER TABLE exports 
ADD COLUMN IF NOT EXISTS processing_options JSONB DEFAULT '{
  "add_captions": false,
  "enhance_speech": false,
  "reframe": false,
  "add_b_roll": false,
  "add_voiceover": false,
  "voiceover_script": null
}'::jsonb;

-- Create captions table
CREATE TABLE IF NOT EXISTS captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  language text DEFAULT 'en',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own captions"
  ON captions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own captions"
  ON captions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own captions"
  ON captions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('captions', 'enhance_speech', 'reframe', 'b_roll', 'voiceover')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processing jobs"
  ON processing_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own processing jobs"
  ON processing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_captions_clip_id ON captions(clip_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_clip_id ON processing_jobs(clip_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(job_type);
