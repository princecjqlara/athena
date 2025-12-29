-- =====================================================
-- Chat History Schema for Athena AI
-- Stores conversation history, sessions, and context
-- With search, pinning, and archiving capabilities
-- =====================================================

-- Chat Sessions Table
-- Each session represents a distinct conversation with Athena
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    -- Pinned conversations appear at top
    is_pinned BOOLEAN DEFAULT FALSE,
    pinned_at TIMESTAMPTZ,
    -- Archived conversations are hidden but not deleted
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    -- Metadata for additional info
    metadata JSONB DEFAULT '{}',
    -- Summary of the conversation for quick preview
    summary TEXT,
    -- Total messages in this session
    message_count INTEGER DEFAULT 0,
    -- Last message preview
    last_message_preview TEXT,
    -- Search vector for full-text search on title
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(summary, ''))) STORED
);

-- Chat Messages Table
-- Individual messages within a session
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_timestamp TIMESTAMPTZ DEFAULT NOW(),
    -- For action results
    action_result JSONB,
    action_type TEXT,
    -- Token usage for analytics
    token_count INTEGER,
    -- Was this message regenerated
    is_regenerated BOOLEAN DEFAULT FALSE,
    -- Parent message if regenerated
    parent_message_id UUID REFERENCES chat_messages(id),
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    -- Search vector for full-text search on content
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions(is_pinned, pinned_at DESC) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_archived ON chat_sessions(is_archived) WHERE is_archived = TRUE;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_search ON chat_sessions USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON chat_messages USING GIN(search_vector);

-- Function to update session metadata when messages are added
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET 
        updated_at = NOW(),
        message_count = message_count + 1,
        last_message_preview = LEFT(NEW.content, 100)
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session on new message
DROP TRIGGER IF EXISTS trigger_update_session_on_message ON chat_messages;
CREATE TRIGGER trigger_update_session_on_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

-- Function to auto-generate session title from first user message
CREATE OR REPLACE FUNCTION generate_session_title()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update title if it's still the default and this is a user message
    IF NEW.role = 'user' THEN
        UPDATE chat_sessions
        SET title = LEFT(NEW.content, 50)
        WHERE id = NEW.session_id 
          AND title = 'New Conversation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating session title
DROP TRIGGER IF EXISTS trigger_generate_session_title ON chat_messages;
CREATE TRIGGER trigger_generate_session_title
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION generate_session_title();

-- Function to search messages across all sessions
CREATE OR REPLACE FUNCTION search_chat_messages(
    p_user_id TEXT,
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    message_id UUID,
    session_id UUID,
    session_title TEXT,
    message_role TEXT,
    message_content TEXT,
    message_timestamp TIMESTAMPTZ,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id as message_id,
        cm.session_id,
        cs.title as session_title,
        cm.role as message_role,
        cm.content as message_content,
        cm.message_timestamp,
        ts_rank(cm.search_vector, plainto_tsquery('english', p_query)) as search_rank
    FROM chat_messages cm
    JOIN chat_sessions cs ON cm.session_id = cs.id
    WHERE cm.user_id = p_user_id
      AND cs.is_active = TRUE
      AND cm.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY search_rank DESC, cm.message_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search sessions by title/summary
CREATE OR REPLACE FUNCTION search_chat_sessions(
    p_user_id TEXT,
    p_query TEXT,
    p_include_archived BOOLEAN DEFAULT FALSE,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    result_session_id UUID,
    result_title TEXT,
    result_summary TEXT,
    result_message_count INTEGER,
    result_updated_at TIMESTAMPTZ,
    result_is_pinned BOOLEAN,
    result_is_archived BOOLEAN,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as result_session_id,
        cs.title as result_title,
        cs.summary as result_summary,
        cs.message_count as result_message_count,
        cs.updated_at as result_updated_at,
        cs.is_pinned as result_is_pinned,
        cs.is_archived as result_is_archived,
        ts_rank(cs.search_vector, plainto_tsquery('english', p_query)) as search_rank
    FROM chat_sessions cs
    WHERE cs.user_id = p_user_id
      AND cs.is_active = TRUE
      AND (p_include_archived OR cs.is_archived = FALSE)
      AND cs.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY search_rank DESC, cs.updated_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_sessions
DROP POLICY IF EXISTS chat_sessions_select_own ON chat_sessions;
CREATE POLICY chat_sessions_select_own ON chat_sessions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS chat_sessions_insert_own ON chat_sessions;
CREATE POLICY chat_sessions_insert_own ON chat_sessions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS chat_sessions_update_own ON chat_sessions;
CREATE POLICY chat_sessions_update_own ON chat_sessions
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS chat_sessions_delete_own ON chat_sessions;
CREATE POLICY chat_sessions_delete_own ON chat_sessions
    FOR DELETE USING (true);

-- Policies for chat_messages
DROP POLICY IF EXISTS chat_messages_select_own ON chat_messages;
CREATE POLICY chat_messages_select_own ON chat_messages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS chat_messages_insert_own ON chat_messages;
CREATE POLICY chat_messages_insert_own ON chat_messages
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS chat_messages_update_own ON chat_messages;
CREATE POLICY chat_messages_update_own ON chat_messages
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS chat_messages_delete_own ON chat_messages;
CREATE POLICY chat_messages_delete_own ON chat_messages
    FOR DELETE USING (true);

-- View for session list with message counts (ordered by pinned first, then by date)
CREATE OR REPLACE VIEW chat_sessions_with_stats AS
SELECT 
    cs.*,
    COUNT(cm.id) as actual_message_count,
    MAX(cm.message_timestamp) as last_message_at
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
GROUP BY cs.id
ORDER BY cs.is_pinned DESC, cs.pinned_at DESC NULLS LAST, cs.updated_at DESC;

-- Grant permissions
GRANT ALL ON chat_sessions TO anon, authenticated;
GRANT ALL ON chat_messages TO anon, authenticated;
GRANT SELECT ON chat_sessions_with_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_chat_messages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_chat_sessions TO anon, authenticated;
