-- Public Traits Schema
-- Stores AI-generated and user-created traits shared across the platform

CREATE TABLE IF NOT EXISTS public_traits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'Custom',
    emoji TEXT DEFAULT '✨',
    description TEXT,
    
    -- Creator info (using TEXT for flexibility, like other tables)
    created_by TEXT,
    created_by_ai BOOLEAN DEFAULT false,
    
    -- Moderation
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    
    -- Metadata
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_public_traits_status ON public_traits(status);
CREATE INDEX IF NOT EXISTS idx_public_traits_group ON public_traits(group_name);
CREATE INDEX IF NOT EXISTS idx_public_traits_created_by ON public_traits(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_traits_name_unique ON public_traits(LOWER(name));

-- RLS Policies (using open policies like other tables, API uses service key)
ALTER TABLE public_traits ENABLE ROW LEVEL SECURITY;

-- Allow all operations (API handles authorization)
CREATE POLICY "Allow all operations on public_traits"
    ON public_traits FOR ALL
    USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_public_traits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_public_traits_timestamp ON public_traits;
CREATE TRIGGER update_public_traits_timestamp
    BEFORE UPDATE ON public_traits
    FOR EACH ROW
    EXECUTE FUNCTION update_public_traits_timestamp();
