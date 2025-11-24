/*
  # Fix Security and Performance Issues

  1. Add Missing Foreign Key Indexes
    - Add index on captions.user_id
    - Add index on exports.style_pack_id
    - Add index on processing_jobs.user_id

  2. Optimize RLS Policies
    - Replace auth.uid() with (select auth.uid()) to prevent re-evaluation per row
    - Update all RLS policies across profiles, clips, exports, ai_detections, captions, processing_jobs

  3. Remove Unused Indexes
    - Drop indexes that haven't been used
    - Keep only performance-critical indexes

  4. Fix Function Security
    - Set immutable search_path for generate_sample_detections function
*/

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================

-- Index for captions.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_captions_user_id ON captions(user_id);

-- Index for exports.style_pack_id foreign key
CREATE INDEX IF NOT EXISTS idx_exports_style_pack_id ON exports(style_pack_id);

-- Index for processing_jobs.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON processing_jobs(user_id);

-- ============================================================================
-- PART 2: Optimize RLS Policies - Use (select auth.uid())
-- ============================================================================

-- Profiles table policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Clips table policies
DROP POLICY IF EXISTS "Users can read own clips" ON clips;
CREATE POLICY "Users can read own clips"
  ON clips FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own clips" ON clips;
CREATE POLICY "Users can insert own clips"
  ON clips FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own clips" ON clips;
CREATE POLICY "Users can update own clips"
  ON clips FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own clips" ON clips;
CREATE POLICY "Users can delete own clips"
  ON clips FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Exports table policies
DROP POLICY IF EXISTS "Users can read own exports" ON exports;
CREATE POLICY "Users can read own exports"
  ON exports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own exports" ON exports;
CREATE POLICY "Users can insert own exports"
  ON exports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own exports" ON exports;
CREATE POLICY "Users can update own exports"
  ON exports FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own exports" ON exports;
CREATE POLICY "Users can delete own exports"
  ON exports FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- AI Detections table policies
DROP POLICY IF EXISTS "Users can read detections for own clips" ON ai_detections;
CREATE POLICY "Users can read detections for own clips"
  ON ai_detections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clips
      WHERE clips.id = ai_detections.clip_id
      AND clips.user_id = (select auth.uid())
    )
  );

-- Captions table policies
DROP POLICY IF EXISTS "Users can view own captions" ON captions;
CREATE POLICY "Users can view own captions"
  ON captions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own captions" ON captions;
CREATE POLICY "Users can create own captions"
  ON captions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own captions" ON captions;
CREATE POLICY "Users can delete own captions"
  ON captions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Processing Jobs table policies
DROP POLICY IF EXISTS "Users can view own processing jobs" ON processing_jobs;
CREATE POLICY "Users can view own processing jobs"
  ON processing_jobs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own processing jobs" ON processing_jobs;
CREATE POLICY "Users can create own processing jobs"
  ON processing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- PART 3: Remove Unused Indexes
-- ============================================================================

-- Drop unused indexes that haven't been used
DROP INDEX IF EXISTS idx_clips_status;
DROP INDEX IF EXISTS idx_exports_user_id;
DROP INDEX IF EXISTS idx_exports_clip_id;
DROP INDEX IF EXISTS idx_processing_jobs_clip_id;
DROP INDEX IF EXISTS idx_processing_jobs_status;
DROP INDEX IF EXISTS idx_processing_jobs_type;

-- ============================================================================
-- PART 4: Fix Function Search Path
-- ============================================================================

-- Recreate function with immutable search_path
DROP FUNCTION IF EXISTS generate_sample_detections(uuid);

CREATE OR REPLACE FUNCTION generate_sample_detections(clip_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO ai_detections (clip_id, detection_type, timestamp, confidence)
  VALUES
    (clip_id_param, 'kill', 5.2, 0.95),
    (clip_id_param, 'kill', 12.8, 0.89),
    (clip_id_param, 'headshot', 18.5, 0.92),
    (clip_id_param, 'ace', 25.3, 0.97),
    (clip_id_param, 'clutch', 35.7, 0.88);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_sample_detections(uuid) TO authenticated;
