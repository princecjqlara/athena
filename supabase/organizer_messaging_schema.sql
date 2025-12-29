-- =====================================================
-- Organizer Messaging Schema
-- Announcements and Direct Messages for Organizer
-- =====================================================

-- =====================================================
-- ANNOUNCEMENTS TABLE
-- Broadcast messages to all users or specific roles
-- =====================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Targeting
    target_audience TEXT NOT NULL DEFAULT 'all' 
        CHECK (target_audience IN ('all', 'admin', 'marketer', 'client')),
    
    -- Metadata
    created_by TEXT NOT NULL,  -- User ID of organizer
    is_active BOOLEAN DEFAULT TRUE,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Optional expiration
    
    -- Read tracking (stored as JSONB array of user IDs who read it)
    read_by JSONB DEFAULT '[]'
);

-- =====================================================
-- DIRECT MESSAGES TABLE
-- One-to-one messages from organizer to users
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    
    -- Content
    subject TEXT,
    content TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Thread support (optional)
    parent_message_id UUID REFERENCES direct_messages(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

CREATE INDEX IF NOT EXISTS idx_direct_messages_to_user ON direct_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_from_user ON direct_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread ON direct_messages(to_user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON direct_messages(parent_message_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Announcements policies (public read, organizer write)
DROP POLICY IF EXISTS announcements_select ON announcements;
CREATE POLICY announcements_select ON announcements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS announcements_insert ON announcements;
CREATE POLICY announcements_insert ON announcements
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS announcements_update ON announcements;
CREATE POLICY announcements_update ON announcements
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS announcements_delete ON announcements;
CREATE POLICY announcements_delete ON announcements
    FOR DELETE USING (true);

-- Direct messages policies
DROP POLICY IF EXISTS direct_messages_select ON direct_messages;
CREATE POLICY direct_messages_select ON direct_messages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS direct_messages_insert ON direct_messages;
CREATE POLICY direct_messages_insert ON direct_messages
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS direct_messages_update ON direct_messages;
CREATE POLICY direct_messages_update ON direct_messages
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS direct_messages_delete ON direct_messages;
CREATE POLICY direct_messages_delete ON direct_messages
    FOR DELETE USING (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get unread count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM direct_messages 
        WHERE to_user_id = p_user_id AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get unread announcements for a user (based on role)
CREATE OR REPLACE FUNCTION get_unread_announcements(p_user_id TEXT, p_user_role TEXT)
RETURNS TABLE (
    announcement_id UUID,
    announcement_title TEXT,
    announcement_content TEXT,
    announcement_priority TEXT,
    announcement_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id as announcement_id,
        title as announcement_title,
        content as announcement_content,
        priority as announcement_priority,
        created_at as announcement_created_at
    FROM announcements
    WHERE is_active = TRUE
      AND (target_audience = 'all' OR target_audience = p_user_role)
      AND (expires_at IS NULL OR expires_at > NOW())
      AND NOT (read_by ? p_user_id)
    ORDER BY 
        CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
        END,
        created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark announcement as read
CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id UUID, p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE announcements
    SET read_by = read_by || to_jsonb(p_user_id)
    WHERE id = p_announcement_id
      AND NOT (read_by ? p_user_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT ALL ON announcements TO anon, authenticated;
GRANT ALL ON direct_messages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_unread_announcements TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_announcement_read TO anon, authenticated;
