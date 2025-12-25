-- ============================================
-- CREATE ORGANIZER ACCOUNT
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: First, create the user via Supabase Dashboard or Auth API
-- Go to Authentication > Users > Add User
-- Email: cjlara032107@gmail.com
-- Password: demet5732595

-- Step 2: After creating the user, run this to make them an organizer
-- Replace 'USER_ID_HERE' with the actual user ID from Supabase

-- Option A: If user already exists, update their profile
UPDATE user_profiles
SET 
  role = 'organizer',
  status = 'active',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'cjlara032107@gmail.com'
);

-- Option B: If the trigger didn't create the profile, insert it manually
INSERT INTO user_profiles (id, role, status, full_name, created_at, updated_at)
SELECT 
  id,
  'organizer',
  'active',
  email,
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'cjlara032107@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'organizer',
  status = 'active',
  updated_at = NOW();

-- Verify the organizer was created
SELECT 
  up.id,
  au.email,
  up.role,
  up.status,
  up.full_name,
  up.created_at
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE au.email = 'cjlara032107@gmail.com';
