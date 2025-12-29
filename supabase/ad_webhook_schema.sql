-- Facebook Ad Webhook Events Schema
-- Stores webhook events for ad status changes to enable smart syncing

-- Table to store incoming webhook events
CREATE TABLE IF NOT EXISTS ad_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ad_id TEXT,
    adset_id TEXT,
    campaign_id TEXT,
    old_value TEXT,
    new_value TEXT,
    actor_id TEXT,
    event_time TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by account
CREATE INDEX IF NOT EXISTS idx_ad_webhook_events_account ON ad_webhook_events(account_id);
CREATE INDEX IF NOT EXISTS idx_ad_webhook_events_event_time ON ad_webhook_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_ad_webhook_events_processed ON ad_webhook_events(processed) WHERE processed = FALSE;

-- Table to track sync triggers (one per account, upserted on webhook)
CREATE TABLE IF NOT EXISTS ad_sync_triggers (
    account_id TEXT PRIMARY KEY,
    last_change TIMESTAMPTZ NOT NULL,
    change_type TEXT NOT NULL,
    affected_ad_id TEXT,
    affected_campaign_id TEXT,
    requires_sync BOOLEAN DEFAULT TRUE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update trigger for sync_triggers
CREATE OR REPLACE FUNCTION update_ad_sync_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ad_sync_triggers_updated_at ON ad_sync_triggers;
CREATE TRIGGER trigger_ad_sync_triggers_updated_at
    BEFORE UPDATE ON ad_sync_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_ad_sync_triggers_updated_at();

-- Function to check if sync is needed for an account
CREATE OR REPLACE FUNCTION check_sync_needed(p_account_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_requires_sync BOOLEAN;
BEGIN
    SELECT requires_sync INTO v_requires_sync
    FROM ad_sync_triggers
    WHERE account_id = p_account_id;
    
    RETURN COALESCE(v_requires_sync, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to acknowledge sync (mark as synced)
CREATE OR REPLACE FUNCTION acknowledge_sync(p_account_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE ad_sync_triggers
    SET requires_sync = FALSE,
        acknowledged_at = NOW()
    WHERE account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;

-- Ad performance cache table (optional - for storing synced metrics)
CREATE TABLE IF NOT EXISTS ad_performance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    metrics JSONB NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_ad_cache UNIQUE (account_id, ad_id)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_ad_performance_cache_account ON ad_performance_cache(account_id);
CREATE INDEX IF NOT EXISTS idx_ad_performance_cache_synced ON ad_performance_cache(synced_at DESC);

-- Clean up old webhook events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ad_webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE ad_webhook_events IS 'Stores Facebook webhook events for ad status changes';
COMMENT ON TABLE ad_sync_triggers IS 'Tracks pending sync triggers per ad account';
COMMENT ON TABLE ad_performance_cache IS 'Caches ad performance metrics to reduce API calls';
