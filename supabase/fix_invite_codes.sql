-- =====================================================
-- Invite Codes - Full Setup Script
-- Run this in Supabase SQL Editor to create the invite_codes table
-- =====================================================

-- Step 1: Drop the table if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS invite_codes CASCADE;

-- Step 2: Create the invite_codes table with TEXT created_by (for flexibility)
CREATE TABLE invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    code_type TEXT NOT NULL CHECK (code_type IN ('client', 'marketer', 'admin')),
    created_by TEXT,  -- TEXT to support both UUID and generated IDs
    org_id UUID,
    used_by TEXT,     -- TEXT for flexibility
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Enable RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Step 4: Create permissive RLS policies for public access
CREATE POLICY "Public read invite_codes" ON invite_codes FOR SELECT USING (true);
CREATE POLICY "Public insert invite_codes" ON invite_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update invite_codes" ON invite_codes FOR UPDATE USING (true);
CREATE POLICY "Public delete invite_codes" ON invite_codes FOR DELETE USING (true);

-- Step 5: Create indexes for performance
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_type ON invite_codes(code_type);
CREATE INDEX idx_invite_codes_created_by ON invite_codes(created_by);
CREATE INDEX idx_invite_codes_expires ON invite_codes(expires_at);

-- Step 6: Grant permissions
GRANT ALL ON invite_codes TO anon, authenticated;

-- Done!
SELECT 'invite_codes table created successfully!' as status;
