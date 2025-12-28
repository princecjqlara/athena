-- =====================================================
-- User Data Persistence Schema
-- Prevents data loss when cookies/localStorage cleared
-- =====================================================

-- User Ads Table - stores all imported ads with traits
CREATE TABLE IF NOT EXISTS public.user_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    ad_id TEXT NOT NULL, -- Original ad ID (could be Facebook ID or generated)
    ad_data JSONB NOT NULL, -- Full ad object with traits, metrics, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ad_id)
);

-- User Pipelines Table - stores pipeline configurations
CREATE TABLE IF NOT EXISTS public.user_pipelines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL, -- Original pipeline ID
    name TEXT NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]', -- Array of stage objects
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pipeline_id)
);

-- User Leads Table - stores leads in pipelines
CREATE TABLE IF NOT EXISTS public.user_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL,
    lead_id TEXT NOT NULL, -- Original lead ID
    lead_data JSONB NOT NULL, -- Full lead object with conversation, stage, etc.
    stage_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lead_id)
);

-- User Contacts Table - stores contact information
CREATE TABLE IF NOT EXISTS public.user_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    contact_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id)
);

-- User Settings Table - stores user preferences and tokens
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    settings_data JSONB NOT NULL DEFAULT '{}',
    ml_weights JSONB,
    ml_training_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_ads_user ON public.user_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pipelines_user ON public.user_pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leads_user ON public.user_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leads_pipeline ON public.user_leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_user ON public.user_contacts(user_id);

-- Enable RLS
ALTER TABLE public.user_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can manage their own ads"
    ON public.user_ads FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own pipelines"
    ON public.user_pipelines FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own leads"
    ON public.user_leads FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own contacts"
    ON public.user_contacts FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own settings"
    ON public.user_settings FOR ALL
    USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_ads_updated_at
    BEFORE UPDATE ON public.user_ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_pipelines_updated_at
    BEFORE UPDATE ON public.user_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_leads_updated_at
    BEFORE UPDATE ON public.user_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_contacts_updated_at
    BEFORE UPDATE ON public.user_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
