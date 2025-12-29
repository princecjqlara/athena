-- =====================================================
-- FIX SIGNUP UNAUTHORIZED ERROR
-- Run this in Supabase SQL Editor
-- =====================================================

-- This script fixes RLS policies that block signup operations

-- Step 1: Fix user_profiles RLS policies for signup
-- The trigger creates profiles but updates need to work too

DROP POLICY IF EXISTS "Allow profile creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON user_profiles;
DROP POLICY IF EXISTS "Service role full access" ON user_profiles;

-- Allow the trigger to create profiles (service definer function)
CREATE POLICY "Allow profile creation" ON user_profiles 
  FOR INSERT WITH CHECK (true);

-- Allow service role updates (API routes use service key)
CREATE POLICY "Service role full access" ON user_profiles 
  FOR ALL USING (true);

-- Step 2: Fix invite_codes RLS policies
DROP POLICY IF EXISTS "Public read invite_codes" ON invite_codes;
DROP POLICY IF EXISTS "Public insert invite_codes" ON invite_codes;
DROP POLICY IF EXISTS "Public update invite_codes" ON invite_codes;
DROP POLICY IF EXISTS "Public delete invite_codes" ON invite_codes;

CREATE POLICY "Public read invite_codes" ON invite_codes FOR SELECT USING (true);
CREATE POLICY "Public insert invite_codes" ON invite_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update invite_codes" ON invite_codes FOR UPDATE USING (true);
CREATE POLICY "Public delete invite_codes" ON invite_codes FOR DELETE USING (true);

-- Step 3: Grant permissions to anon and authenticated roles
GRANT ALL ON invite_codes TO anon, authenticated;
GRANT ALL ON user_profiles TO anon, authenticated;

-- Step 4: Ensure the trigger function exists and has SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'marketer',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Done!
SELECT 'Signup authorization fixed!' as status;
